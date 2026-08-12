import { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import {
  getWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
} from '../lib/workspace-store';
import {
  getWorkspaceSources,
  createSource,
  createReprocessingVersion,
  updateWorkspaceSource,
  deleteWorkspaceSource,
  SourceType,
} from '../lib/source-store';
import { SOURCE_LIMITS, validateSourceInput } from '../lib/ingestion/validators';
import { ingestionCoordinator } from '../lib/ingestion/coordinator';
import { extractYouTubeVideoId } from '../lib/ingestion/youtube-url';
import { getWorkspaceChunks } from '../lib/chunk-store';
import { searchWorkspaceChunks, buildRAGContext } from '../lib/retrieval/rag-service';
import {
  getWorkspaceMessages,
  createWorkspaceMessage,
  clearWorkspaceMessages,
  deleteWorkspaceQueryTurn,
  reserveAssistantRegeneration,
  releaseAssistantRegeneration,
  replaceWorkspaceAssistantMessage,
  ChatMessageConflictError,
  type StoredMessage,
} from '../lib/chat/conversation-store';
import { buildConversationHistory } from '../lib/chat/conversation-context';
import {
  activeChatGenerations,
  classifyChatLifecycleFailure,
  type ChatLifecyclePhase,
} from '../lib/chat/generation-lifecycle';
import {
  CitationSafeStream,
  citationsUsedByResponse,
} from '../lib/chat/citation-consistency';
import {
  ChatGenerationAbortedError,
} from '../lib/chat/openai-provider';
import {
  orchestrateGroundedResponse,
  webSourcesFromExecution,
} from '../lib/ai/orchestrator';
import { isTavilySearchAvailable } from '../lib/ai/production-tools';
import {
  externalWebSourcesAppendix,
  ExternalWebSafeStream,
} from '../lib/ai/web-attribution';
import {
  AIActionError,
  executeAIAction,
  type AIActionExecutionPlan,
  type AIActionRequest,
} from '../lib/ai/actions';
import { requireApiAuth } from '../lib/auth';
import { AppError } from '../lib/errors';
import { successResponse, errorResponse } from '../lib/api-response';
import { logger } from '../lib/logger';
import { getServerEnv } from '../lib/env';

export const workspaceRouter = Router();

const sourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: SOURCE_LIMITS.PDF_BYTES,
    files: 1,
    fields: 8,
    parts: 9,
    fieldSize: SOURCE_LIMITS.TEXT_BYTES,
    fieldNestingDepth: 0,
  },
});

const sourceUploadMiddleware: RequestHandler = (req, res, next) => {
  const uploadStartedAt = Date.now();
  sourceUpload.single('file')(req, res, (error: any) => {
    res.locals.sourceUploadDurationMs = Date.now() - uploadStartedAt;
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded file exceeds the 20 MB limit.'
        : `Invalid source upload: ${error.message || 'multipart parsing failed'}`;
    const response = errorResponse(AppError.badRequest(message, 'INVALID_SOURCE_UPLOAD'));
    logger.warn('Ingestion upload rejected', {
      stage: 'UPLOAD',
      durationMs: res.locals.sourceUploadDurationMs,
      errorCode: 'INVALID_SOURCE_UPLOAD',
      uploadCode: typeof error.code === 'string' ? error.code : 'MULTIPART_ERROR',
    });
    res.status(response.statusCode).json(response.payload);
  });
};

workspaceRouter.use(requireApiAuth);

workspaceRouter.param('id', async (req: Request, res: Response, next, workspaceId: string) => {
  try {
    const workspace = await getWorkspaceById(workspaceId, res.locals.userId);
    if (!workspace) {
      const response = errorResponse(
        AppError.forbidden('You do not have access to this workspace', 'WORKSPACE_ACCESS_DENIED'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    res.locals.workspace = workspace;
    next();
  } catch (error) {
    logger.error('Workspace ownership verification failed', error);
    const response = errorResponse(error);
    return res.status(response.statusCode).json(response.payload);
  }
});

// GET /api/workspaces
workspaceRouter.get('/', async (req: Request, res: Response) => {
  try {
    const workspaces = await getWorkspaces(res.locals.userId);
    return res.status(200).json(successResponse(workspaces));
  } catch (err: any) {
    logger.error('Failed to fetch workspaces', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to retrieve workspaces')).payload);
  }
});

// POST /api/workspaces
workspaceRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, icon } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res
        .status(400)
        .json(errorResponse(new Error('Workspace name is required')).payload);
    }

    if (name.trim().length > 60) {
      return res
        .status(400)
        .json(errorResponse(new Error('Workspace name cannot exceed 60 characters')).payload);
    }

    const created = await createWorkspace({
      name,
      description,
      icon,
      userId: res.locals.userId,
    });

    return res.status(201).json(successResponse(created));
  } catch (err: any) {
    logger.error('Failed to create workspace', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to create workspace')).payload);
  }
});

// GET /api/workspaces/:id
workspaceRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    return res.status(200).json(successResponse(res.locals.workspace));
  } catch (err: any) {
    logger.error('Failed to fetch workspace', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to retrieve workspace')).payload);
  }
});

// PATCH /api/workspaces/:id
workspaceRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = res.locals.workspace.id;
    const { name, description, icon } = req.body || {};

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res
        .status(400)
        .json(errorResponse(new Error('Workspace name cannot be empty')).payload);
    }

    const updated = await updateWorkspace(
      id,
      { name, description, icon },
      res.locals.userId
    );

    if (!updated) {
      return res
        .status(404)
        .json(errorResponse(new Error('Workspace not found or could not be updated')).payload);
    }

    return res.status(200).json(successResponse(updated));
  } catch (err: any) {
    logger.error('Failed to update workspace', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to update workspace')).payload);
  }
});

// DELETE /api/workspaces/:id
workspaceRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = res.locals.workspace.id;

    const deleted = await deleteWorkspace(id, res.locals.userId);

    if (!deleted) {
      return res
        .status(404)
        .json(errorResponse(new Error('Workspace not found')).payload);
    }

    return res.status(200).json(successResponse({ success: true, id }));
  } catch (err: any) {
    logger.error('Failed to delete workspace', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to delete workspace')).payload);
  }
});

// GET /api/workspaces/:id/sources
workspaceRouter.get('/:id/sources', async (req: Request, res: Response) => {
  try {
    const workspaceId = res.locals.workspace.id;
    const sources = await getWorkspaceSources(workspaceId);
    return res.status(200).json(successResponse(sources));
  } catch (err: any) {
    logger.error('Failed to fetch workspace sources', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to retrieve workspace sources')).payload);
  }
});

// POST /api/workspaces/:id/sources
workspaceRouter.post(
  '/:id/sources',
  sourceUploadMiddleware,
  async (req: Request, res: Response) => {
  const sourceRequestStartedAt = Date.now();
  try {
    const workspaceId = res.locals.workspace.id;
    const { title, type, url, rawContent } = req.body || {};
    let metadata: Record<string, any> = {};
    if (typeof req.body?.metadata === 'string' && req.body.metadata) {
      try {
        metadata = JSON.parse(req.body.metadata);
      } catch {
        const response = errorResponse(
          AppError.badRequest('Source metadata must be valid JSON', 'INVALID_SOURCE_METADATA'),
        );
        return res.status(response.statusCode).json(response.payload);
      }
    } else if (req.body?.metadata && typeof req.body.metadata === 'object') {
      metadata = req.body.metadata;
    }

    const validTypes: SourceType[] = ['PDF', 'WEBSITE', 'TEXT', 'YOUTUBE', 'VTT'];
    if (!validTypes.includes(type)) {
      const response = errorResponse(
        AppError.badRequest('Source type is invalid', 'INVALID_SOURCE_TYPE'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    const sourceType = type as SourceType;

    const existingSources = await getWorkspaceSources(workspaceId);
    const validation = validateSourceInput({
      workspaceId,
      title: title || '',
      type: sourceType,
      url,
      rawContent,
      file: req.file || null,
      existingSources,
    });

    if (!validation.valid) {
      const response = errorResponse(
        AppError.badRequest(
          validation.error || 'Invalid source input',
          'INVALID_SOURCE_INPUT',
        ),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    if (sourceType === 'YOUTUBE' && !extractYouTubeVideoId(validation.normalizedUrl || url || '')) {
      const response = errorResponse(
        AppError.badRequest('Enter a valid YouTube video URL.', 'INVALID_YOUTUBE_URL'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const finalUrl = validation.normalizedUrl || url;
    let originalContent = rawContent || null;
    let artifactData: Uint8Array | null = null;
    let artifactMimeType: string | null = null;
    let artifactFileName: string | null = null;
    let artifactSize: number | null = null;

    if (req.file) {
      artifactMimeType = req.file.mimetype;
      artifactFileName = req.file.originalname;
      artifactSize = req.file.size;
      if (sourceType === 'PDF') {
        artifactData = req.file.buffer;
        originalContent = null;
      } else if (sourceType === 'VTT') {
        try {
          originalContent = new TextDecoder('utf-8', { fatal: true }).decode(
            req.file.buffer,
          );
        } catch {
          const response = errorResponse(
            AppError.badRequest(
              'Uploaded VTT must contain valid UTF-8 text',
              'INVALID_VTT_ENCODING',
            ),
          );
          return res.status(response.statusCode).json(response.payload);
        }
      }
    }

    const displaySize = artifactSize
      ? `${(artifactSize / 1024).toFixed(1)} KB`
      : originalContent
        ? `${(Buffer.byteLength(originalContent, 'utf8') / 1024).toFixed(1)} KB`
        : 'Remote source';
    const source = await createSource({
      workspaceId,
      title: (title || '').trim(),
      type: sourceType,
      url: finalUrl,
      fileSize: displaySize,
      metadata: {
        ...metadata,
        uploadedAt: new Date().toISOString(),
      },
      artifact: {
        originalContent,
        artifactData,
        fileName: artifactFileName,
        mimeType: artifactMimeType,
        size: artifactSize,
        sourceUrl: finalUrl || null,
      },
    });
    logger.info('Ingestion source persisted', {
      sourceId: source.id,
      version: source.currentVersion,
      sourceType,
      stage: 'UPLOAD',
      durationMs: res.locals.sourceUploadDurationMs ?? Date.now() - sourceRequestStartedAt,
      persistenceDurationMs: Date.now() - sourceRequestStartedAt,
      artifactBytes: artifactSize ?? (
        originalContent ? Buffer.byteLength(originalContent, 'utf8') : null
      ),
      remoteSource: Boolean(finalUrl),
    });

    ingestionCoordinator.dispatch({
      sourceId: source.id,
      workspaceId,
      title: source.title,
      type: sourceType,
      version: source.currentVersion,
    });

    return res.status(201).json(successResponse(source));
  } catch (err: any) {
    logger.error('Failed to create workspace source', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to add workspace source')).payload);
  }
  },
);

// POST /api/workspaces/:id/sources/:sourceId/reprocess (Retry capability)
workspaceRouter.post('/:id/sources/:sourceId/reprocess', async (req: Request, res: Response) => {
  try {
    const workspaceId = res.locals.workspace.id;
    const { sourceId } = req.params;
    const sources = await getWorkspaceSources(workspaceId);
    const source = sources.find((s) => s.id === sourceId);

    if (!source) {
      return res.status(404).json(errorResponse(new Error('Source not found')).payload);
    }

    const version = await createReprocessingVersion(sourceId, {
      staleAfterMs: getServerEnv().INGESTION_STALE_AFTER_MS,
    });

    ingestionCoordinator.dispatch({
      sourceId: source.id,
      workspaceId,
      title: source.title,
      type: source.type,
      version,
    });

    return res.status(200).json(
      successResponse({
        id: source.id,
        status: 'PENDING',
        stage: 'CREATED',
        version,
        message: 'Source reprocessing started.',
      })
    );
  } catch (err: any) {
    logger.error('Failed to reprocess source', err);
    if (
      err?.message === 'Source is already being processed' ||
      err?.message === 'Persisted original source artifact not found'
    ) {
      const statusCode =
        err.message === 'Source is already being processed' ? 409 : 422;
      const response = errorResponse(
        new AppError(err.message, statusCode, 'SOURCE_REPROCESSING_UNAVAILABLE'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to reprocess source')).payload);
  }
});

// PATCH /api/workspaces/:id/sources/:sourceId
workspaceRouter.patch('/:id/sources/:sourceId', async (req: Request, res: Response) => {
  try {
    const sourceId = req.params.sourceId;
    const { title, status } = req.body || {};
    if (status !== undefined) {
      const response = errorResponse(
        AppError.badRequest(
          'Source processing status is controlled by the ingestion pipeline',
          'IMMUTABLE_SOURCE_STATUS',
        ),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const updated = await updateWorkspaceSource(
      res.locals.workspace.id,
      sourceId,
      res.locals.userId,
      { title },
    );
    if (!updated) {
      return res
        .status(404)
        .json(errorResponse(new Error('Source not found')).payload);
    }

    return res.status(200).json(successResponse(updated));
  } catch (err: any) {
    logger.error('Failed to update workspace source', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to update workspace source')).payload);
  }
});

// DELETE /api/workspaces/:id/sources/:sourceId
workspaceRouter.delete('/:id/sources/:sourceId', async (req: Request, res: Response) => {
  try {
    const sourceId = req.params.sourceId;

    const deleted = await deleteWorkspaceSource(
      res.locals.workspace.id,
      sourceId,
      res.locals.userId,
    );

    if (!deleted) {
      return res
        .status(404)
        .json(errorResponse(new Error('Source not found')).payload);
    }

    return res.status(200).json(successResponse({ success: true, id: sourceId }));
  } catch (err: any) {
    logger.error('Failed to delete workspace source', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to delete workspace source')).payload);
  }
});

// GET /api/workspaces/:id/sources/:sourceId/chunks
workspaceRouter.get('/:id/sources/:sourceId/chunks', async (req: Request, res: Response) => {
  try {
    const workspaceId = res.locals.workspace.id;
    const { sourceId } = req.params;
    const chunks = await getWorkspaceChunks(workspaceId);
    const sourceChunks = chunks.filter((c) => c.sourceId === sourceId);

    return res.status(200).json(successResponse(sourceChunks));
  } catch (err: any) {
    logger.error('Failed to fetch source chunks', err);
    return res.status(500).json(errorResponse(new Error('Failed to fetch source chunks')).payload);
  }
});

// GET /api/workspaces/:id/messages
workspaceRouter.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const workspaceId = res.locals.workspace.id;
    const messages = await getWorkspaceMessages(workspaceId);
    return res.status(200).json(successResponse(messages));
  } catch (err: any) {
    logger.error('Failed to fetch workspace messages', err);
    return res.status(500).json(errorResponse(new Error('Failed to fetch messages')).payload);
  }
});

// DELETE /api/workspaces/:id/messages
workspaceRouter.delete('/:id/messages', async (req: Request, res: Response) => {
  try {
    const workspaceId = res.locals.workspace.id;
    await clearWorkspaceMessages(workspaceId);
    return res.status(200).json(successResponse({ success: true }));
  } catch (err: any) {
    logger.error('Failed to clear workspace messages', err);
    return res.status(500).json(errorResponse(new Error('Failed to clear messages')).payload);
  }
});

// DELETE /api/workspaces/:id/messages/:messageId
workspaceRouter.delete('/:id/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const deletedMessageIds = await deleteWorkspaceQueryTurn(
      res.locals.workspace.id,
      req.params.messageId,
    );
    if (!deletedMessageIds) {
      return res
        .status(404)
        .json(errorResponse(new Error('User query not found')).payload);
    }
    return res.status(200).json(successResponse({ deletedMessageIds }));
  } catch (error) {
    if (error instanceof ChatMessageConflictError) {
      const response = errorResponse(
        new AppError(error.message, 409, 'CHAT_MESSAGE_CONFLICT'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    logger.error('Failed to delete chat query turn', error, {
      workspaceId: res.locals.workspace.id,
      messageId: req.params.messageId,
    });
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to delete the selected query')).payload);
  }
});

// POST /api/workspaces/:id/chat/cancel
workspaceRouter.post('/:id/chat/cancel', async (req: Request, res: Response) => {
  const operationId = req.body?.operationId;
  if (typeof operationId !== 'string' || !operationId.trim() || operationId.length > 200) {
    const response = errorResponse(
      AppError.badRequest('A valid chat operation ID is required', 'INVALID_CHAT_OPERATION'),
    );
    return res.status(response.statusCode).json(response.payload);
  }
  const cancelled = await activeChatGenerations.cancelAndWait(
    res.locals.workspace.id,
    res.locals.userId,
    operationId,
  );
  return res.status(200).json(successResponse({ cancelled }));
});

// POST /api/workspaces/:id/chat/stream
workspaceRouter.post('/:id/chat/stream', async (req: Request, res: Response) => {
  const workspaceId = res.locals.workspace.id;
  const {
    message,
    mode: requestedMode = 'DETAILED',
    action: requestedAction,
    regenerateMessageId,
    operationId: requestedOperationId,
  } = req.body || {};
  const validModes = ['CONCISE', 'DETAILED', 'CRITICAL', 'CREATIVE'] as const;
  const isRegeneration = regenerateMessageId !== undefined;
  let regenerationTurn:
    | Awaited<ReturnType<typeof reserveAssistantRegeneration>>
    | null = null;
  let regenerationReserved = false;

  if (
    requestedOperationId !== undefined &&
    (typeof requestedOperationId !== 'string' ||
      !requestedOperationId.trim() ||
      requestedOperationId.length > 200)
  ) {
    const response = errorResponse(
      AppError.badRequest('Chat operation ID is invalid', 'INVALID_CHAT_OPERATION'),
    );
    return res.status(response.statusCode).json(response.payload);
  }

  if (
    isRegeneration &&
    (typeof regenerateMessageId !== 'string' || !regenerateMessageId.trim())
  ) {
    const response = errorResponse(
      AppError.badRequest(
        'A valid assistant message is required for regeneration',
        'INVALID_REGENERATION_REQUEST',
      ),
    );
    return res.status(response.statusCode).json(response.payload);
  }
  if (isRegeneration) {
    try {
      regenerationTurn = await reserveAssistantRegeneration(
        workspaceId,
        regenerateMessageId,
      );
      if (!regenerationTurn) {
        return res
          .status(404)
          .json(errorResponse(new Error('Assistant response not found')).payload);
      }
      regenerationReserved = true;
    } catch (error) {
      if (error instanceof ChatMessageConflictError) {
        const response = errorResponse(
          new AppError(error.message, 409, 'REGENERATION_IN_PROGRESS'),
        );
        return res.status(response.statusCode).json(response.payload);
      }
      logger.error('Failed to reserve assistant response regeneration', error, {
        workspaceId,
        regenerateMessageId,
      });
      return res
        .status(500)
        .json(errorResponse(new Error('Unable to regenerate this response')).payload);
    }
  }

  const action = isRegeneration
    ? regenerationTurn?.userMessage.action || undefined
    : requestedAction;
  const mode = isRegeneration
    ? regenerationTurn!.userMessage.mode
    : requestedMode;
  const submittedMessage = isRegeneration
    ? regenerationTurn!.userMessage.content
    : message;
  const releaseReservation = async () => {
    if (!regenerationReserved || !regenerationTurn) return;
    regenerationReserved = false;
    await releaseAssistantRegeneration(
      workspaceId,
      regenerationTurn.assistantMessage.id,
    );
  };

  if (
    action !== undefined &&
    (!action || typeof action !== 'object' || Array.isArray(action))
  ) {
    await releaseReservation();
    const response = errorResponse(
      AppError.badRequest('AI action request is invalid', 'INVALID_AI_ACTION'),
    );
    return res.status(response.statusCode).json(response.payload);
  }
  if (
    action === undefined &&
    (!submittedMessage ||
      typeof submittedMessage !== 'string' ||
      !submittedMessage.trim())
  ) {
    await releaseReservation();
    const response = errorResponse(
      AppError.badRequest('Message query cannot be empty', 'EMPTY_CHAT_MESSAGE'),
    );
    return res.status(response.statusCode).json(response.payload);
  }
  if (
    typeof submittedMessage === 'string' &&
    submittedMessage.trim().length > 20_000
  ) {
    await releaseReservation();
    const response = errorResponse(
      new AppError(
        'Message query cannot exceed 20,000 characters',
        413,
        'CHAT_MESSAGE_TOO_LARGE',
      ),
    );
    return res.status(response.statusCode).json(response.payload);
  }
  if (!validModes.includes(mode)) {
    await releaseReservation();
    const response = errorResponse(
      AppError.badRequest('Chat mode is invalid', 'INVALID_CHAT_MODE'),
    );
    return res.status(response.statusCode).json(response.payload);
  }

  let actionPlan: AIActionExecutionPlan | undefined;
  let actionMessageSnapshot:
    | Awaited<ReturnType<typeof getWorkspaceMessages>>
    | undefined;
  if (action !== undefined) {
    try {
      const [actionSources, actionMessages] = await Promise.all([
        getWorkspaceSources(workspaceId),
        getWorkspaceMessages(workspaceId),
      ]);
      actionMessageSnapshot = actionMessages;
      actionPlan = await executeAIAction(action as AIActionRequest, {
        workspaceId,
        userId: res.locals.userId,
        sources: actionSources.map(({ id, title, type, status }) => ({
          id,
          title,
          type,
          status,
        })),
        conversation: actionMessages.flatMap((item) =>
          item.status === 'SUCCESS' &&
          item.id !== regenerationTurn?.userMessage.id &&
          item.id !== regenerationTurn?.assistantMessage.id &&
          (item.role === 'USER' || item.role === 'ASSISTANT')
            ? [{ role: item.role, content: item.content }]
            : [],
        ),
      });
    } catch (error) {
      if (error instanceof AIActionError) {
        await releaseReservation();
        const response = errorResponse(
          new AppError(error.message, error.statusCode, error.code),
        );
        return res.status(response.statusCode).json(response.payload);
      }
      logger.error('AI action preparation failed', error, { workspaceId });
      await releaseReservation();
      const response = errorResponse(
        new AppError(
          'The AI action could not be prepared.',
          500,
          'ACTION_EXECUTION_FAILED',
        ),
      );
      return res.status(response.statusCode).json(response.payload);
    }
  }

  const queryText =
    actionPlan?.displayMessage ||
    (typeof submittedMessage === 'string' ? submittedMessage.trim() : '');
  const retrievalQuery = actionPlan?.retrievalQuery || queryText;
  const modelQuery = actionPlan?.modelPrompt || queryText;
  const operationId =
    typeof requestedOperationId === 'string' ? requestedOperationId : randomUUID();
  const generationController = new AbortController();
  let responseFinished = false;
  let transportDisconnected = false;
  let lifecyclePhase: ChatLifecyclePhase = 'request';
  let savedUserMessage: StoredMessage | null = null;
  let pendingAssistantMessage: StoredMessage | null = null;

  if (
    !activeChatGenerations.register(
      workspaceId,
      res.locals.userId,
      operationId,
      generationController,
    )
  ) {
    const response = errorResponse(
      new AppError('This chat operation is already active.', 409, 'CHAT_OPERATION_CONFLICT'),
    );
    return res.status(response.statusCode).json(response.payload);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const markTransportDisconnected = () => {
    if (transportDisconnected || responseFinished) return;
    transportDisconnected = true;
    logger.info('Chat transport disconnected; bounded generation will continue', {
      workspaceId,
      operationId,
      reason: 'transport_disconnect',
    });
  };
  const handleRequestAborted = () => markTransportDisconnected();
  const handleResponseClose = () => markTransportDisconnected();
  req.once('aborted', handleRequestAborted);
  res.once('close', handleResponseClose);

  const sendEvent = (eventData: object): boolean => {
    if (transportDisconnected || res.destroyed || res.writableEnded) {
      markTransportDisconnected();
      return false;
    }
    const accepted = res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    if (!accepted && res.destroyed) markTransportDisconnected();
    return !transportDisconnected;
  };

  try {
    lifecyclePhase = 'persistence';
    savedUserMessage = regenerationTurn
      ? regenerationTurn.userMessage
      : await createWorkspaceMessage({
          workspaceId,
          role: 'USER',
          content: queryText,
          mode,
          action: action as AIActionRequest | undefined,
        });
    if (!regenerationTurn) {
      sendEvent({ type: 'user_persisted', message: savedUserMessage });
      pendingAssistantMessage = await createWorkspaceMessage({
        workspaceId,
        parentMessageId: savedUserMessage.id,
        role: 'ASSISTANT',
        content: 'Response generation is in progress.',
        mode,
        status: 'SENDING',
      });
    }
    if (generationController.signal.aborted) throw new ChatGenerationAbortedError();

    const recentHistory =
      actionMessageSnapshot || (await getWorkspaceMessages(workspaceId));
    const conversationHistory = buildConversationHistory(
      recentHistory,
      savedUserMessage.id,
    );

    let retrievedChunks;
    lifecyclePhase = 'retrieval';
    try {
      if (actionPlan?.sourceRetrievals?.length) {
        const scopedResults = await Promise.all(
          actionPlan.sourceRetrievals.map(async (scope) => {
            const candidates = await searchWorkspaceChunks(
              workspaceId,
              res.locals.userId,
              scope.query,
              { topK: 20, threshold: 0.15 },
            );
            return {
              scope,
              chunks: candidates
                .filter(({ sourceId }) => sourceId === scope.sourceId)
                .slice(0, 5),
            };
          }),
        );
        const missingScope = scopedResults.find(({ chunks }) => chunks.length === 0);
        if (missingScope) {
          throw new Error(
            `No usable indexed context was found for "${missingScope.scope.sourceTitle}".`,
          );
        }
        retrievedChunks = [];
        const largestScope = Math.max(
          ...scopedResults.map(({ chunks }) => chunks.length),
        );
        for (let index = 0; index < largestScope; index += 1) {
          for (const { chunks } of scopedResults) {
            if (chunks[index]) retrievedChunks.push(chunks[index]);
          }
        }
      } else {
        retrievedChunks = await searchWorkspaceChunks(
          workspaceId,
          res.locals.userId,
          retrievalQuery,
          { topK: 5, threshold: 0.15 },
        );
      }
    } catch (retrievalError: any) {
      logger.error('Validated Workspace retrieval failed', retrievalError);
      throw retrievalError;
    }
    if (
      actionPlan?.target === 'source' &&
      actionPlan.sourceIds.length > 0 &&
      !actionPlan.sourceRetrievals?.length
    ) {
      const allowedSourceIds = new Set(actionPlan.sourceIds);
      retrievedChunks = retrievedChunks.filter(({ sourceId }) =>
        allowedSourceIds.has(sourceId),
      );
    }

    lifecyclePhase = 'citation_validation';
    const ragContext = buildRAGContext(retrievedChunks, retrievalQuery, mode);
    sendEvent({
      type: 'start',
      hasContext: ragContext.hasContext,
      candidateCitationCount: ragContext.citations.length,
      citations: [],
      ...(actionPlan
        ? { action: { id: actionPlan.actionId, label: actionPlan.actionLabel } }
        : {}),
    });

    if (
      !ragContext.hasContext &&
      !actionPlan?.allowWithoutWorkspaceContext &&
      (!isTavilySearchAvailable() || actionPlan?.sourceIds.length)
    ) {
      const insufficientContext =
        actionPlan
          ? `I couldn't retrieve sufficient validated Workspace evidence to complete ${actionPlan.actionLabel}. Check that the selected sources are fully indexed, then try again.`
          : "I couldn't find sufficient indexed knowledge in this Workspace to answer that question. Add or reprocess a relevant source, then try again.";
      sendEvent({ type: 'chunk', text: insufficientContext });
      const savedMessage = regenerationTurn
        ? await replaceWorkspaceAssistantMessage({
            workspaceId,
            assistantMessageId: regenerationTurn.assistantMessage.id,
            content: insufficientContext,
            mode,
          })
        : await replaceWorkspaceAssistantMessage({
            workspaceId,
            assistantMessageId: pendingAssistantMessage!.id,
            content: insufficientContext,
            mode,
          });
      regenerationReserved = false;
      sendEvent({
        type: 'done',
        messageId: savedMessage.id,
        userMessage: savedUserMessage,
        message: savedMessage,
        citations: [],
        regenerated: Boolean(regenerationTurn),
      });
      return;
    }

    const citationSafeStream = ragContext.hasContext
      ? new CitationSafeStream(
          ragContext.citations,
          (text) => {
            sendEvent({ type: 'chunk', text });
          },
        )
      : null;
    const externalWebSafeStream = new ExternalWebSafeStream(
      ragContext.citations,
      (text) => {
        if (citationSafeStream) {
          citationSafeStream.push(text);
        } else {
          sendEvent({ type: 'chunk', text });
        }
      },
    );
    lifecyclePhase = 'orchestration';
    const generated = await orchestrateGroundedResponse({
      workspaceId,
      hasWorkspaceContext: ragContext.hasContext,
      hasActionContext: actionPlan?.allowWithoutWorkspaceContext === true,
      instructions: ragContext.hasContext
        ? `${ragContext.contextPrompt}${
            actionPlan
              ? `\n\n=== ACTIVE AI ACTION: ${actionPlan.actionLabel.toUpperCase()} ===\n${actionPlan.additionalInstructions}`
              : ''
          }`
        : `You are Lumora AI Knowledge Operating System. No relevant indexed Workspace context is available for this request. Follow the web intelligence policy and never present unsupported factual claims.${
            actionPlan
              ? `\n\n=== ACTIVE AI ACTION: ${actionPlan.actionLabel.toUpperCase()} ===\n${actionPlan.additionalInstructions}`
              : ''
          }`,
      history: conversationHistory,
      query: modelQuery,
      userId: res.locals.userId,
      mode,
      signal: generationController.signal,
      onTextDelta: (text) => externalWebSafeStream.push(text),
      onToolResult: (record) => {
        const webSources = webSourcesFromExecution(record);
        if (webSources.length > 0) {
          externalWebSafeStream.addSources(webSources);
          sendEvent({ type: 'web_sources', sources: webSources });
        }
      },
      onToolStatus: (status) => {
        sendEvent({ type: 'tool_status', ...status });
      },
    });
    if (generationController.signal.aborted) throw new ChatGenerationAbortedError();

    lifecyclePhase = 'citation_validation';
    const usedCitations = ragContext.hasContext
      ? citationsUsedByResponse(generated.text, ragContext.citations)
      : [];
    const webAppendix = externalWebSourcesAppendix(
      generated.orchestration.webSources,
    );
    const finalResponse = `${generated.text}${webAppendix}`;
    if (webAppendix) externalWebSafeStream.push(webAppendix);
    externalWebSafeStream.finish(finalResponse);
    citationSafeStream?.finish(finalResponse);
    const persistedCitations = usedCitations.map((c) => ({
      chunkId: c.chunkId,
      sourceId: c.sourceId,
      indexId: c.indexId,
      title: c.title,
      snippet: c.snippet,
      kind: c.kind,
      score: c.score,
      url: c.url,
      page: c.page,
      timestampStartMs: c.timestampStartMs,
      timestampEndMs: c.timestampEndMs,
      textOrigin: c.textOrigin,
    }));
    lifecyclePhase = 'persistence';
    const savedAssistantMessage = regenerationTurn
      ? await replaceWorkspaceAssistantMessage({
          workspaceId,
          assistantMessageId: regenerationTurn.assistantMessage.id,
          content: finalResponse,
          mode,
          citations: persistedCitations,
        })
      : await replaceWorkspaceAssistantMessage({
          workspaceId,
          assistantMessageId: pendingAssistantMessage!.id,
          content: finalResponse,
          mode,
          citations: persistedCitations,
        });
    regenerationReserved = false;
    logger.info('Grounded response completed and persisted', {
      workspaceId,
      messageId: savedAssistantMessage.id,
      provider: generated.provider,
      model: generated.model,
      providerResponseId: generated.responseId,
      citationCount: usedCitations.length,
      toolExecutionCount: generated.orchestration.toolExecutions.length,
      intelligenceMode: generated.orchestration.intelligenceMode,
      webSourceCount: generated.orchestration.webSources.length,
      actionId: actionPlan?.actionId,
      actionTarget: actionPlan?.target,
      operationId,
      transportDisconnected,
    });

    sendEvent({
      type: 'done',
      messageId: savedAssistantMessage.id,
      userMessage: savedUserMessage,
      message: savedAssistantMessage,
      citations: usedCitations,
      intelligenceMode: generated.orchestration.intelligenceMode,
      webSources: generated.orchestration.webSources,
      regenerated: Boolean(regenerationTurn),
    });
  } catch (err: any) {
    const intentionalCancellation = activeChatGenerations.wasCancellationRequested(
      workspaceId,
      res.locals.userId,
      operationId,
    );
    const failure = classifyChatLifecycleFailure(
      err,
      lifecyclePhase,
      intentionalCancellation,
    );
    logger.error('Chat lifecycle failed', err, {
      workspaceId,
      operationId,
      phase: failure.phase,
      code: failure.code,
      transportDisconnected,
      intentionalCancellation: failure.intentionalCancellation,
    });
    let terminalMessage: StoredMessage | null = null;
    if (savedUserMessage && pendingAssistantMessage && !regenerationTurn) {
      try {
        terminalMessage = await replaceWorkspaceAssistantMessage({
          workspaceId,
          assistantMessageId: pendingAssistantMessage.id,
          content: failure.userMessage,
          mode,
          status: 'ERROR',
        });
      } catch (persistenceError) {
        logger.error('Failed to persist terminal chat failure', persistenceError, {
          workspaceId,
          operationId,
          originalCode: failure.code,
        });
      }
    }
    sendEvent({
      type: 'error',
      code: failure.code,
      phase: failure.phase,
      error: failure.userMessage,
      ...(terminalMessage && savedUserMessage
        ? { message: terminalMessage, userMessage: savedUserMessage }
        : {}),
    });
  } finally {
    try {
      await releaseReservation();
    } catch (releaseError) {
      logger.error('Failed to release assistant regeneration reservation', releaseError, {
        workspaceId,
        regenerateMessageId,
      });
    }
    activeChatGenerations.unregister(workspaceId, res.locals.userId, operationId);
    responseFinished = true;
    req.removeListener('aborted', handleRequestAborted);
    res.removeListener('close', handleResponseClose);
    if (!res.writableEnded && !res.destroyed) res.end();
  }
});
