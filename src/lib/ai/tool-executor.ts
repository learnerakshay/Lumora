import { logger } from '../logger';
import { ToolExecutionError } from './tool-errors';
import { ToolRegistry } from './tool-registry';
import type {
  ExecutionContext,
  ExecutionResult,
  JsonValue,
  ToolError,
  ToolRequest,
  ToolResponse,
} from './types';

const DEFAULT_TOOL_TIMEOUT_MS = 15_000;

function toolError(
  code: ToolError['code'],
  message: string,
  retryable = false,
): ToolError {
  return { code, message, retryable };
}

function failedResponse(
  request: ToolRequest,
  status: ToolResponse['status'],
  error: ToolError,
  startedAt: Date,
): ExecutionResult {
  const completedAt = new Date();
  return {
    succeeded: false,
    response: {
      requestId: request.id,
      toolName: request.name,
      status,
      error,
      metadata: {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    },
  };
}

export class ToolExecutor {
  constructor(private readonly registry: ToolRegistry) {}

  async execute(
    request: ToolRequest,
    context: Omit<ExecutionContext, 'requestId' | 'signal'> & { signal: AbortSignal },
  ): Promise<ExecutionResult> {
    const startedAt = new Date();
    if (context.signal.aborted) {
      return failedResponse(
        request,
        'cancelled',
        toolError('TOOL_EXECUTION_CANCELLED', `Tool "${request.name}" was cancelled.`),
        startedAt,
      );
    }
    const definition = this.registry.get(request.name);
    if (!definition) {
      return failedResponse(
        request,
        'unsupported',
        toolError('TOOL_NOT_FOUND', `Tool "${request.name}" is not available.`),
        startedAt,
      );
    }

    if (request.argumentParseError) {
      return failedResponse(
        request,
        'invalid',
        toolError('INVALID_TOOL_ARGUMENTS', 'The tool arguments are not valid JSON.'),
        startedAt,
      );
    }

    let validatedArguments: unknown;
    try {
      validatedArguments = definition.validate(request.arguments);
    } catch (error) {
      return failedResponse(
        request,
        'invalid',
        toolError(
          'INVALID_TOOL_ARGUMENTS',
          error instanceof Error ? error.message : 'The tool arguments are invalid.',
        ),
        startedAt,
      );
    }

    const executionController = new AbortController();
    const abortExecution = () => executionController.abort();
    context.signal.addEventListener('abort', abortExecution, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      executionController.abort();
    }, definition.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS);

    logger.debug('AI tool execution started', {
      workspaceId: context.workspaceId,
      toolName: request.name,
      requestId: request.id,
    });

    try {
      const output = await Promise.race([
        definition.execute(validatedArguments, {
          ...context,
          requestId: request.id,
          signal: executionController.signal,
        }),
        new Promise<never>((_, reject) => {
          executionController.signal.addEventListener(
            'abort',
            () => reject(new Error(timedOut ? 'TOOL_TIMEOUT' : 'TOOL_CANCELLED')),
            { once: true },
          );
        }),
      ]);
      const serializedOutput = JSON.stringify(output);
      if (serializedOutput === undefined) {
        throw new Error('Tool returned a non-serializable result.');
      }
      const structuredOutput = JSON.parse(serializedOutput) as JsonValue;
      const completedAt = new Date();
      logger.debug('AI tool execution completed', {
        workspaceId: context.workspaceId,
        toolName: request.name,
        requestId: request.id,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      });
      return {
        succeeded: true,
        response: {
          requestId: request.id,
          toolName: request.name,
          status: 'completed',
          output: structuredOutput,
          metadata: {
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            durationMs: completedAt.getTime() - startedAt.getTime(),
          },
        },
      };
    } catch (error) {
      const cancelled = context.signal.aborted;
      const code = timedOut
        ? 'TOOL_EXECUTION_TIMEOUT'
        : cancelled
          ? 'TOOL_EXECUTION_CANCELLED'
          : error instanceof ToolExecutionError
            ? error.code
          : 'TOOL_EXECUTION_FAILED';
      const status = timedOut ? 'timed_out' : cancelled ? 'cancelled' : 'failed';
      logger.warn('AI tool execution failed', {
        workspaceId: context.workspaceId,
        toolName: request.name,
        requestId: request.id,
        code,
      });
      logger.debug('AI tool execution failure details', {
        workspaceId: context.workspaceId,
        toolName: request.name,
        requestId: request.id,
        message: error instanceof Error ? error.message : 'Unexpected tool failure',
      });
      return failedResponse(
        request,
        status,
        toolError(
          code,
          timedOut
            ? `Tool "${request.name}" timed out.`
            : cancelled
              ? `Tool "${request.name}" was cancelled.`
              : error instanceof ToolExecutionError
                ? error.message
              : `Tool "${request.name}" failed to execute.`,
          error instanceof ToolExecutionError ? error.retryable : !cancelled,
        ),
        startedAt,
      );
    } finally {
      clearTimeout(timeout);
      context.signal.removeEventListener('abort', abortExecution);
    }
  }
}
