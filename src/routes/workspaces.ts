import { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import {
  getWorkspaces,
  getWorkspaceSourceSummaries,
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
  getWorkspaceSourceArtifact,
  DuplicateSourceError,
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
  attachWorkspaceMessageResources,
  ChatMessageConflictError,
  type StoredMessage,
} from '../lib/chat/conversation-store';
import { buildConversationHistory } from '../lib/chat/conversation-context';
import {
  activeChatGenerations,
  classifyChatLifecycleFailure,
  INSUFFICIENT_WORKSPACE_EVIDENCE_MESSAGE,
  shouldReturnInsufficientWorkspaceEvidence,
  type ChatLifecyclePhase,
} from '../lib/chat/generation-lifecycle';
import {
  CitationSafeStream,
  GeneralResponseSafeStream,
  citationsUsedByResponse,
} from '../lib/chat/citation-consistency';
import {
  GENERAL_FALLBACK_PREAMBLE,
  assessWorkspaceEvidenceSufficiency,
  isWorkspaceMetaQuestion,
  latestGroundedFollowUpTopicQuery,
  NO_SOURCES_META_RESPONSE,
  normalizedDistinctiveTopicQuery,
  selectInitialChatRoute,
  selectResponseModeAfterRetrieval,
} from '../lib/chat/grounding-router';
import {
  ChatGenerationAbortedError,
} from '../lib/chat/openai-provider';
import {
  orchestrateGroundedResponse,
  webSourcesFromExecution,
} from '../lib/ai/orchestrator';
import {
  externalWebSourcesAppendix,
  ExternalWebSafeStream,
  sanitizeExternalWebLinks,
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
import {
  checkAndReserve,
  commitUsage,
  discardUsage,
  shouldCommitChatUsage,
} from '../lib/usage/service';
import { usageLimitError } from '../lib/usage/errors';
import type { ChatStreamEvent } from '../types';
import { detectResourceIntent } from '../lib/resources/normalization';
import { resolveResources } from '../lib/resources/resolver';
import { toLearningResourceRecommendation } from '../lib/resources/domain';
import { isYouTubeRecommendationQuery, promoteIngestedYouTubeSources } from '../lib/resources/ingested-youtube-boost';

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

// One deferred dashboard enrichment request replaces one full sources request
// per Workspace. The relation filter keeps every result scoped to the user.
workspaceRouter.get('/source-summaries', async (_req: Request, res: Response) => {
  try {
    const summaries = await getWorkspaceSourceSummaries(res.locals.userId);
    return res.status(200).json(successResponse(summaries));
  } catch (err) {
    logger.error('Failed to fetch Workspace source summaries', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to retrieve source summaries')).payload);
  }
});

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
  let usageEventId: string | null = null;
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

    const validationStartedAt = Date.now();
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
    logger.info('Ingestion source validation completed', {
      sourceType,
      durationMs: Date.now() - validationStartedAt,
      valid: validation.valid,
      remoteSource: Boolean(url),
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

    const reservation = await checkAndReserve(res.locals.userId, 'INGESTION');
    if ('details' in reservation) {
      const response = errorResponse(usageLimitError(reservation.details));
      return res.status(response.statusCode).json(response.payload);
    }
    usageEventId = reservation.usageEventId;

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

    const dispatched = ingestionCoordinator.dispatch({
      sourceId: source.id,
      workspaceId,
      title: source.title,
      type: sourceType,
      version: source.currentVersion,
      usageEventId,
    });
    if (!dispatched) {
      await discardUsage(usageEventId);
      usageEventId = null;
      throw new Error('The source ingestion job could not be started.');
    }
    usageEventId = null;

    return res.status(201).json(successResponse(source));
  } catch (err: any) {
    if (usageEventId) {
      await discardUsage(usageEventId).catch((discardError) => {
        logger.error('Failed to discard source usage reservation', discardError, {
          workspaceId: res.locals.workspace?.id,
          usageEventId,
        });
      });
    }
    if (err instanceof DuplicateSourceError) {
      const response = errorResponse(
        new AppError(err.message, 409, 'DUPLICATE_SOURCE'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    logger.error('Failed to create workspace source', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to add workspace source')).payload);
  }
  },
);

// POST /api/workspaces/:id/sources/:sourceId/reprocess (Retry capability)
workspaceRouter.post('/:id/sources/:sourceId/reprocess', async (req: Request, res: Response) => {
  let usageEventId: string | null = null;
  try {
    const workspaceId = res.locals.workspace.id;
    const { sourceId } = req.params;
    const sources = await getWorkspaceSources(workspaceId);
    const source = sources.find((s) => s.id === sourceId);

    if (!source) {
      return res.status(404).json(errorResponse(new Error('Source not found')).payload);
    }

    if (source.status === 'FAILED' && source.metadata?.retryable !== true) {
      const response = errorResponse(
        new AppError(
          'This source failed for a permanent reason and cannot be retried.',
          422,
          'SOURCE_REPROCESSING_UNAVAILABLE',
        ),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const reservation = await checkAndReserve(res.locals.userId, 'INGESTION');
    if ('details' in reservation) {
      const response = errorResponse(usageLimitError(reservation.details));
      return res.status(response.statusCode).json(response.payload);
    }
    usageEventId = reservation.usageEventId;

    const version = await createReprocessingVersion(sourceId, {
      staleAfterMs: getServerEnv().INGESTION_STALE_AFTER_MS,
    });

    const dispatched = ingestionCoordinator.dispatch({
      sourceId: source.id,
      workspaceId,
      title: source.title,
      type: source.type,
      version,
      usageEventId,
    });
    if (!dispatched) {
      await discardUsage(usageEventId);
      usageEventId = null;
      throw new Error('The source reprocessing job could not be started.');
    }
    usageEventId = null;

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
    if (usageEventId) {
      await discardUsage(usageEventId).catch((discardError) => {
        logger.error('Failed to discard reprocessing usage reservation', discardError, {
          workspaceId: res.locals.workspace?.id,
          sourceId: req.params.sourceId,
          usageEventId,
        });
      });
    }
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

// GET /api/workspaces/:id/sources/:sourceId/content
// Serves the original uploaded PDF inline after the normal authenticated,
// Workspace-scoped router checks have succeeded.
workspaceRouter.get('/:id/sources/:sourceId/content', async (req: Request, res: Response) => {
  try {
    const record = await getWorkspaceSourceArtifact(
      res.locals.workspace.id,
      req.params.sourceId,
    );
    if (!record || record.type !== 'PDF' || !record.artifact.artifactData) {
      const response = errorResponse(
        AppError.notFound('PDF source content is unavailable', 'SOURCE_CONTENT_UNAVAILABLE'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const encodedFileName = encodeURIComponent(
      record.artifact.artifactFileName || `${record.title}.pdf`,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(Buffer.from(record.artifact.artifactData));
  } catch (error) {
    logger.error('Failed to serve source content', error, {
      workspaceId: res.locals.workspace?.id,
      sourceId: req.params.sourceId,
    });
    const response = errorResponse(new Error('Failed to retrieve source content'));
    return res.status(response.statusCode).json(response.payload);
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
    mode: requestedMode = 'CONCISE',
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
  const workspaceSourceCount = Number(res.locals.workspace.sourcesCount || 0);
  const workspaceMetaQuestion = !actionPlan && isWorkspaceMetaQuestion(queryText);
  const initialChatRoute = selectInitialChatRoute({
    sourceCount: workspaceSourceCount,
    query: queryText,
    isAIAction: Boolean(actionPlan),
  });
  const resourceIntent = actionPlan ? null : detectResourceIntent(queryText);
  const meteredActionType = actionPlan ? 'AI_ACTION' : 'CHAT';
  const usageReservation = await checkAndReserve(
    res.locals.userId,
    meteredActionType,
  );
  if ('details' in usageReservation) {
    await releaseReservation();
    const response = errorResponse(usageLimitError(usageReservation.details));
    return res.status(response.statusCode).json(response.payload);
  }
  let usageEventId: string | null = usageReservation.usageEventId;
  let providerCompletionMetadata:
    | {
        provider: string;
        model: string;
        inputTokens?: number;
        outputTokens?: number;
      }
    | undefined;
  let assistantPersisted = false;
  let persistedAssistantMessage: StoredMessage | null = null;
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
    await discardUsage(usageEventId);
    usageEventId = null;
    await releaseReservation();
    const response = errorResponse(
      new AppError('This chat operation is already active.', 409, 'CHAT_OPERATION_CONFLICT'),
    );
    return res.status(response.statusCode).json(response.payload);
  }

  const resourceRecommendationsPromise = resourceIntent
    ? resolveResources({
        ...resourceIntent,
        workspaceId,
        userId: res.locals.userId,
        signal: generationController.signal,
        limit: 4,
      })
        .then((resources) => resources.map(toLearningResourceRecommendation))
        .catch((error) => {
          logger.warn('Learning resource resolution failed closed', {
            workspaceId,
            operationId,
            reason: error instanceof Error ? error.name : 'unknown',
          });
          return [];
        })
        .then(async (recommendations) => {
          if (!isYouTubeRecommendationQuery(resourceIntent.query)) return recommendations;
          try {
            const workspaceSources = await getWorkspaceSources(workspaceId);
            const ingestedYouTubeSources = workspaceSources
              .filter((source) => source.type === 'YOUTUBE' && source.status === 'COMPLETED')
              .map((source) => ({
                id: source.id,
                title: source.title,
                url: (source.metadata?.url as string | undefined) || source.url || null,
              }));
            return promoteIngestedYouTubeSources({
              query: resourceIntent.query,
              topics: resourceIntent.topics,
              level: resourceIntent.level,
              ingestedYouTubeSources,
              recommendations,
            });
          } catch (error) {
            logger.warn('Ingested YouTube source boost failed closed', {
              workspaceId,
              operationId,
              reason: error instanceof Error ? error.name : 'unknown',
            });
            return recommendations;
          }
        })
    : Promise.resolve([]);

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

  const sendEvent = (eventData: ChatStreamEvent): boolean => {
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
    if (initialChatRoute.kind === 'DETERMINISTIC_NO_SOURCES') {
      sendEvent({
        type: 'start',
        hasContext: false,
        responseMode: initialChatRoute.responseMode,
        candidateCitationCount: 0,
        citations: [],
      });
      sendEvent({ type: 'chunk', text: NO_SOURCES_META_RESPONSE });
      const savedMessage = await replaceWorkspaceAssistantMessage({
        workspaceId,
        assistantMessageId: regenerationTurn
          ? regenerationTurn.assistantMessage.id
          : pendingAssistantMessage!.id,
        content: NO_SOURCES_META_RESPONSE,
        mode,
        responseMode: initialChatRoute.responseMode,
      });
      assistantPersisted = true;
      await commitUsage(usageEventId);
      usageEventId = null;
      regenerationReserved = false;
      sendEvent({
        type: 'done',
        messageId: savedMessage.id,
        userMessage: savedUserMessage,
        message: savedMessage,
        citations: [],
        responseMode: initialChatRoute.responseMode,
        groundingStatus: 'workspace_has_no_sources',
        regenerated: Boolean(regenerationTurn),
      });
      return;
    }

    let retrievedChunks = [];
    lifecyclePhase = 'retrieval';
    try {
      if (initialChatRoute.kind === 'GENERAL_WITHOUT_RETRIEVAL') {
        retrievedChunks = [];
      } else if (actionPlan?.sourceRetrievals?.length) {
        const scopedResults = await Promise.all(
          actionPlan.sourceRetrievals.map(async (scope) => {
            const candidates = await searchWorkspaceChunks(
              workspaceId,
              res.locals.userId,
              scope.query,
              { topK: 5, threshold: 0.15, sourceIds: [scope.sourceId] },
            );
            return {
              scope,
              chunks: candidates,
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
          {
            topK: 5,
            threshold: 0.15,
            ...(actionPlan?.target === 'source' && actionPlan.sourceIds.length > 0
              ? { sourceIds: actionPlan.sourceIds }
              : {}),
          },
        );
      }
    } catch (retrievalError: any) {
      logger.error('Validated Workspace retrieval failed', retrievalError);
      throw retrievalError;
    }
    lifecyclePhase = 'citation_validation';
    let ragContext = buildRAGContext(retrievedChunks, retrievalQuery, mode);
    const requestedTopicQuery = actionPlan || workspaceMetaQuestion
      ? null
      : normalizedDistinctiveTopicQuery(retrievalQuery);
    const followUpTopicQuery = requestedTopicQuery
      ? null
      : latestGroundedFollowUpTopicQuery(recentHistory);
    const answerabilityQuery = requestedTopicQuery || followUpTopicQuery || retrievalQuery;
    let evidenceSufficiency =
      actionPlan || workspaceMetaQuestion
        ? {
            sufficient: ragContext.hasContext,
            reason: 'complete_topic_coverage' as const,
            topicGroupCount: 0,
            coveredTopicGroupCount: 0,
          }
        : assessWorkspaceEvidenceSufficiency(answerabilityQuery, ragContext.chunks);
    const recoveryQuery = requestedTopicQuery || followUpTopicQuery;
    if (
      !actionPlan &&
      !workspaceMetaQuestion &&
      !evidenceSufficiency.sufficient &&
      recoveryQuery
    ) {
      lifecyclePhase = 'retrieval';
      const recoveryChunks = await searchWorkspaceChunks(
        workspaceId,
        res.locals.userId,
        recoveryQuery,
        { topK: 5, threshold: 0.15 },
      );
      const recoveredChunkIds = new Set(recoveryChunks.map(({ id }) => id));
      retrievedChunks = [
        ...recoveryChunks,
        ...retrievedChunks.filter(({ id }) => !recoveredChunkIds.has(id)),
      ].slice(0, 10);
      lifecyclePhase = 'citation_validation';
      ragContext = buildRAGContext(retrievedChunks, retrievalQuery, mode);
      evidenceSufficiency = assessWorkspaceEvidenceSufficiency(
        answerabilityQuery,
        ragContext.chunks,
      );
      logger.info('Completed bounded Workspace evidence recovery', {
        workspaceId,
        operationId,
        recoveredChunkCount: recoveryChunks.length,
        combinedChunkCount: ragContext.chunks.length,
        sufficient: evidenceSufficiency.sufficient,
        topicGroupCount: evidenceSufficiency.topicGroupCount,
        coveredTopicGroupCount: evidenceSufficiency.coveredTopicGroupCount,
      });
    }
    const responseMode =
      initialChatRoute.kind === 'GENERAL_WITHOUT_RETRIEVAL'
        ? initialChatRoute.responseMode
        : selectResponseModeAfterRetrieval({
            hasContext: ragContext.hasContext,
            hasSufficientEvidence: evidenceSufficiency.sufficient,
            isAIAction: Boolean(actionPlan),
            isWorkspaceMeta: workspaceMetaQuestion,
          });
    const hasGroundedContext = responseMode === 'GROUNDED' && ragContext.hasContext;
    if (ragContext.hasContext && responseMode === 'GENERAL') {
      logger.info('Workspace evidence did not cover the complete chat request', {
        workspaceId,
        operationId,
        reason: evidenceSufficiency.reason,
        topicGroupCount: evidenceSufficiency.topicGroupCount,
        coveredTopicGroupCount: evidenceSufficiency.coveredTopicGroupCount,
        candidateChunkCount: ragContext.chunks.length,
      });
    }
    sendEvent({
      type: 'start',
      hasContext: hasGroundedContext,
      responseMode,
      candidateCitationCount: hasGroundedContext ? ragContext.citations.length : 0,
      citations: [],
      ...(actionPlan
        ? { action: { id: actionPlan.actionId, label: actionPlan.actionLabel } }
        : {}),
    });

    if (
      responseMode !== 'GENERAL' &&
      shouldReturnInsufficientWorkspaceEvidence(
        ragContext.hasContext,
        actionPlan?.allowWithoutWorkspaceContext === true,
      )
    ) {
      const insufficientContext =
        actionPlan
          ? `I couldn't retrieve sufficient validated Workspace evidence to complete ${actionPlan.actionLabel}. Check that the selected sources are fully indexed, then try again.`
          : INSUFFICIENT_WORKSPACE_EVIDENCE_MESSAGE;
      sendEvent({ type: 'chunk', text: insufficientContext });
      const savedMessage = regenerationTurn
        ? await replaceWorkspaceAssistantMessage({
            workspaceId,
            assistantMessageId: regenerationTurn.assistantMessage.id,
            content: insufficientContext,
            mode,
            responseMode: responseMode || undefined,
          })
        : await replaceWorkspaceAssistantMessage({
            workspaceId,
            assistantMessageId: pendingAssistantMessage!.id,
            content: insufficientContext,
            mode,
            responseMode: responseMode || undefined,
          });
      await discardUsage(usageEventId);
      usageEventId = null;
      regenerationReserved = false;
      sendEvent({
        type: 'done',
        messageId: savedMessage.id,
        userMessage: savedUserMessage,
        message: savedMessage,
        citations: [],
        responseMode,
        groundingStatus: 'insufficient_workspace_evidence',
        regenerated: Boolean(regenerationTurn),
      });
      return;
    }

    const citationSafeStream = hasGroundedContext
      ? new CitationSafeStream(
          ragContext.citations,
          (text) => {
            sendEvent({ type: 'chunk', text });
          },
        )
      : null;
    const generalSafeStream = responseMode === 'GENERAL'
      ? new GeneralResponseSafeStream((text) => sendEvent({ type: 'chunk', text }))
      : null;
    const externalWebSafeStream = new ExternalWebSafeStream(
      hasGroundedContext ? ragContext.citations : [],
      (text) => {
        if (citationSafeStream) {
          citationSafeStream.push(text);
        } else if (generalSafeStream) {
          generalSafeStream.push(text);
        } else {
          sendEvent({ type: 'chunk', text });
        }
      },
    );
    const generalPreamble =
      responseMode === 'GENERAL' && workspaceSourceCount > 0
        ? GENERAL_FALLBACK_PREAMBLE
        : '';
    if (generalPreamble) generalSafeStream?.push(generalPreamble);
    const conversationHistory = buildConversationHistory(
      recentHistory,
      savedUserMessage.id,
      undefined,
      responseMode === 'GENERAL',
    );
    lifecyclePhase = 'orchestration';
    const generated = await orchestrateGroundedResponse({
      workspaceId,
      hasWorkspaceContext: hasGroundedContext,
      hasActionContext: actionPlan?.allowWithoutWorkspaceContext === true,
      allowGeneralKnowledge: responseMode === 'GENERAL',
      instructions: hasGroundedContext
        ? `${ragContext.contextPrompt}${
            actionPlan
              ? `\n\n=== ACTIVE AI ACTION: ${actionPlan.actionLabel.toUpperCase()} ===\n${actionPlan.additionalInstructions}`
              : ''
          }`
        : `You are Lumora AI Knowledge Operating System. No relevant indexed Workspace context is available for this request. Follow the web intelligence policy and never present unsupported factual claims.${
            actionPlan
              ? `\n\n=== ACTIVE AI ACTION: ${actionPlan.actionLabel.toUpperCase()} ===\n${actionPlan.additionalInstructions}`
              : ''
          }${responseMode === 'GENERAL' ? '\nAnswer as disclosed general knowledge. Never claim that the response is based on Workspace sources, and never emit [Citation #N] markers.' : ''}`,
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
    providerCompletionMetadata = {
      provider: generated.provider,
      model: generated.model,
      ...(generated.usage
        ? {
            inputTokens: generated.usage.inputTokens,
            outputTokens: generated.usage.outputTokens,
          }
        : {}),
    };
    if (generationController.signal.aborted) throw new ChatGenerationAbortedError();

    lifecyclePhase = 'citation_validation';
    const usedCitations = hasGroundedContext
      ? citationsUsedByResponse(generated.text, ragContext.citations)
      : [];
    const safeGeneratedResponse = sanitizeExternalWebLinks(
      generated.text,
      generated.orchestration.webSources,
      hasGroundedContext ? ragContext.citations : [],
    );
    if (safeGeneratedResponse.suppressedCount > 0) {
      logger.warn('Suppressed unverified model-generated external links', {
        workspaceId,
        operationId,
        suppressedCount: safeGeneratedResponse.suppressedCount,
      });
    }
    const webAppendix = externalWebSourcesAppendix(
      generated.orchestration.webSources,
    );
    const finalResponse = `${generalPreamble}${safeGeneratedResponse.text}${webAppendix}`;
    if (webAppendix) externalWebSafeStream.push(webAppendix);
    externalWebSafeStream.finish(finalResponse);
    citationSafeStream?.finish(finalResponse);
    generalSafeStream?.finish(finalResponse);
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
    let savedAssistantMessage = regenerationTurn
      ? await replaceWorkspaceAssistantMessage({
          workspaceId,
          assistantMessageId: regenerationTurn.assistantMessage.id,
          content: finalResponse,
          mode,
          responseMode: responseMode || undefined,
          citations: persistedCitations,
        })
      : await replaceWorkspaceAssistantMessage({
          workspaceId,
          assistantMessageId: pendingAssistantMessage!.id,
          content: finalResponse,
          mode,
          responseMode: responseMode || undefined,
          citations: persistedCitations,
        });
    persistedAssistantMessage = savedAssistantMessage;
    assistantPersisted = true;
    let resourceRecommendations = [];
    try {
      resourceRecommendations = await resourceRecommendationsPromise;
      if (resourceRecommendations.length > 0) {
        savedAssistantMessage = await attachWorkspaceMessageResources({
          workspaceId,
          assistantMessageId: savedAssistantMessage.id,
          resourceRecommendations,
        });
        persistedAssistantMessage = savedAssistantMessage;
      }
    } catch (resourceError) {
      resourceRecommendations = [];
      logger.warn('Optional learning resource attachment failed closed', {
        workspaceId,
        operationId,
        messageId: savedAssistantMessage.id,
        reason: resourceError instanceof Error ? resourceError.name : 'unknown',
      });
    }
    await commitUsage(usageEventId, providerCompletionMetadata);
    usageEventId = null;
    regenerationReserved = false;
    logger.info('Chat response completed and persisted', {
      workspaceId,
      messageId: savedAssistantMessage.id,
      provider: generated.provider,
      model: generated.model,
      providerResponseId: generated.responseId,
      citationCount: usedCitations.length,
      responseMode,
      toolExecutionCount: generated.orchestration.toolExecutions.length,
      intelligenceMode: generated.orchestration.intelligenceMode,
      webSourceCount: generated.orchestration.webSources.length,
      resourceRecommendationCount: resourceRecommendations.length,
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
      responseMode,
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
    if (usageEventId) {
      try {
        if (
          shouldCommitChatUsage({
            providerCompleted: Boolean(providerCompletionMetadata),
            assistantPersisted,
            intentionalCancellation,
          })
        ) {
          await commitUsage(usageEventId, providerCompletionMetadata);
        } else {
          await discardUsage(usageEventId);
        }
        usageEventId = null;
      } catch (usageError) {
        logger.error('Failed to settle chat usage reservation', usageError, {
          workspaceId,
          operationId,
          usageEventId,
          providerCompleted: Boolean(providerCompletionMetadata),
        });
      }
    }
    if (assistantPersisted && persistedAssistantMessage && savedUserMessage) {
      logger.error('Post-persistence chat finalization failed; preserving durable success', err, {
        workspaceId,
        operationId,
        messageId: persistedAssistantMessage.id,
        transportDisconnected,
      });
      sendEvent({
        type: 'done',
        messageId: persistedAssistantMessage.id,
        userMessage: savedUserMessage,
        message: persistedAssistantMessage,
        citations: persistedAssistantMessage.citations || [],
        responseMode: persistedAssistantMessage.responseMode,
        regenerated: Boolean(regenerationTurn),
      });
      return;
    }
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
    if (usageEventId && !providerCompletionMetadata) {
      await discardUsage(usageEventId).catch((usageError) => {
        logger.error('Failed to discard unsettled chat usage reservation', usageError, {
          workspaceId,
          operationId,
          usageEventId,
        });
      });
    }
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
