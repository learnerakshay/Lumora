import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
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
  updateSource,
  updateWorkspaceSource,
  deleteWorkspaceSource,
  SourceType,
} from '../lib/source-store';
import { validateSourceInput } from '../lib/ingestion/validators';
import { processSourcePipeline } from '../lib/ingestion/pipeline';
import { getWorkspaceChunks } from '../lib/chunk-store';
import { searchWorkspaceChunks, buildRAGContext } from '../lib/retrieval/rag-service';
import {
  getWorkspaceMessages,
  createWorkspaceMessage,
  clearWorkspaceMessages,
} from '../lib/chat/conversation-store';
import { requireApiAuth } from '../lib/auth';
import { AppError } from '../lib/errors';
import { successResponse, errorResponse } from '../lib/api-response';
import { logger } from '../lib/logger';

export const workspaceRouter = Router();

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
workspaceRouter.post('/:id/sources', async (req: Request, res: Response) => {
  try {
    const workspaceId = res.locals.workspace.id;
    const { title, type, url, fileSize, rawContent, metadata } = req.body || {};

    const validTypes: SourceType[] = ['PDF', 'WEBSITE', 'TEXT', 'YOUTUBE', 'VTT'];
    const sourceType: SourceType = validTypes.includes(type) ? type : 'TEXT';

    // 1. Fetch existing workspace sources to validate duplicates
    const existingSources = await getWorkspaceSources(workspaceId);

    // 2. Validate Source Upload Input
    const validation = validateSourceInput({
      workspaceId,
      title: title || '',
      type: sourceType,
      url,
      fileSize,
      rawContent,
      existingSources,
    });

    if (!validation.valid) {
      return res.status(400).json(errorResponse(new Error(validation.error || 'Invalid source input')).payload);
    }

    const finalUrl = validation.normalizedUrl || url;

    // 3. Create Source record with PROCESSING status
    const source = await createSource({
      workspaceId,
      title: (title || '').trim(),
      type: sourceType,
      status: 'PROCESSING',
      url: finalUrl,
      fileSize,
      rawContent,
      metadata: {
        ...(metadata || {}),
        stage: 'QUEUED',
        stageProgress: 5,
        url: finalUrl || null,
      },
    });

    // 4. Trigger Ingestion Pipeline asynchronously
    processSourcePipeline({
      sourceId: source.id,
      workspaceId,
      title: source.title,
      type: sourceType,
      url: finalUrl,
      fileSize,
      rawContent,
    }).catch((err) => {
      logger.error(`Background ingestion pipeline error for source ${source.id}`, err);
    });

    return res.status(201).json(successResponse(source));
  } catch (err: any) {
    logger.error('Failed to create workspace source', err);
    return res
      .status(500)
      .json(errorResponse(new Error('Failed to add workspace source')).payload);
  }
});

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

    // Update status to PROCESSING with reset stage metadata
    await updateSource(sourceId, {
      status: 'PROCESSING',
      metadata: {
        ...(source.metadata || {}),
        stage: 'QUEUED',
        stageProgress: 10,
        errorMessage: null,
      },
    });

    // Trigger pipeline in background
    processSourcePipeline({
      sourceId: source.id,
      workspaceId,
      title: source.title,
      type: source.type,
      url: source.url,
      fileSize: source.fileSize,
      rawContent: source.metadata?.rawContent || source.metadata?.rawContentSnippet || null,
    }).catch((err) => {
      logger.error(`Reprocessing pipeline error for source ${source.id}`, err);
    });

    return res.status(200).json(
      successResponse({
        id: source.id,
        status: 'PROCESSING',
        message: 'Source reprocessing started.',
      })
    );
  } catch (err: any) {
    logger.error('Failed to reprocess source', err);
    return res.status(500).json(errorResponse(new Error('Failed to reprocess source')).payload);
  }
});

// PATCH /api/workspaces/:id/sources/:sourceId
workspaceRouter.patch('/:id/sources/:sourceId', async (req: Request, res: Response) => {
  try {
    const sourceId = req.params.sourceId;
    const { title, status } = req.body || {};

    const updated = await updateWorkspaceSource(
      res.locals.workspace.id,
      sourceId,
      res.locals.userId,
      { title, status },
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

// POST /api/workspaces/:id/chat/stream
workspaceRouter.post('/:id/chat/stream', async (req: Request, res: Response) => {
  const workspaceId = res.locals.workspace.id;
  const { message, mode = 'DETAILED' } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json(errorResponse(new Error('Message query cannot be empty')).payload);
  }

  const queryText = message.trim();

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendEvent = (eventData: object) => {
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
  };

  try {
    // 1. Save User Message
    await createWorkspaceMessage({
      workspaceId,
      role: 'USER',
      content: queryText,
      mode,
    });

    // 2. Fetch Recent Conversation History for Follow-Up Context Awareness
    const recentHistory = await getWorkspaceMessages(workspaceId);
    const conversationTurns = recentHistory
      .slice(-7, -1)
      .map((m) => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    // 3. Search Workspace Chunks (Vector Semantic Search with Workspace Isolation)
    const retrievedChunks = await searchWorkspaceChunks(workspaceId, queryText, { topK: 5, threshold: 0.15 });

    // 4. Build Context & Citations
    const ragContext = buildRAGContext(retrievedChunks, queryText, mode);

    // Send initial start event with citations
    sendEvent({
      type: 'start',
      hasContext: ragContext.hasContext,
      citations: ragContext.citations,
    });

    // 5. Construct LLM Prompt
    let fullPrompt = ragContext.contextPrompt;
    if (conversationTurns) {
      fullPrompt += `\n\n=== RECENT CONVERSATION HISTORY ===\n${conversationTurns}\n===================================`;
    }

    let fullAnswerText = '';

    // 6. Gemini Generation Call
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const responseStream = await ai.models.generateContentStream({
          model: 'gemini-3.6-flash',
          contents: fullPrompt,
        });

        for await (const chunk of responseStream) {
          const textChunk = chunk.text;
          if (textChunk) {
            fullAnswerText += textChunk;
            sendEvent({ type: 'chunk', text: textChunk });
          }
        }
      } catch (geminiErr) {
        logger.error('Gemini API streaming error, executing grounded fallback stream', geminiErr);
      }
    }

    // Fallback if no LLM response or API unavailable
    if (!fullAnswerText) {
      if (!ragContext.hasContext) {
        fullAnswerText = "I couldn't find sufficient information inside your current workspace to answer this question. Please upload relevant documents, web pages, or transcripts to expand your workspace knowledge.";
      } else {
        const topChunk = retrievedChunks[0];
        fullAnswerText = `Based on your workspace source **${topChunk.sourceTitle}**:\n\n${topChunk.content}\n\n*This response was directly extracted from your grounded workspace knowledge base.*`;
      }
      sendEvent({ type: 'chunk', text: fullAnswerText });
    }

    // 7. Save Assistant Message + Citations
    const savedAssistantMessage = await createWorkspaceMessage({
      workspaceId,
      role: 'ASSISTANT',
      content: fullAnswerText,
      mode,
      citations: ragContext.citations.map((c) => ({
        chunkId: c.chunkId,
        title: c.title,
        snippet: c.snippet,
        kind: c.kind,
        score: c.score,
        url: c.url,
        page: c.page,
      })),
    });

    // Send final 'done' event
    sendEvent({
      type: 'done',
      messageId: savedAssistantMessage.id,
      citations: ragContext.citations,
    });

    res.end();
  } catch (err: any) {
    logger.error('RAG Stream Handler Error', err);
    sendEvent({
      type: 'error',
      error: err.message || 'An unexpected error occurred during grounded AI response generation.',
    });
    res.end();
  }
});
