import assert from 'node:assert/strict';
import test from 'node:test';
import { AIOrchestrationError } from '../ai/orchestrator';
import {
  ChatGenerationAbortedError,
  ChatProviderError,
} from './openai-provider';
import {
  ActiveChatGenerationRegistry,
  classifyChatLifecycleFailure,
} from './generation-lifecycle';

test('transport disconnect does not abort bounded generation and completion can persist', async () => {
  const registry = new ActiveChatGenerationRegistry();
  const controller = new AbortController();
  assert.equal(registry.register('workspace-1', 'user-1', 'operation-1', controller), true);

  let persisted = false;
  await Promise.resolve().then(() => {
    persisted = true;
    registry.unregister('workspace-1', 'user-1', 'operation-1');
  });

  assert.equal(controller.signal.aborted, false);
  assert.equal(persisted, true);
});

test('explicit cancellation aborts generation and waits for terminal cleanup', async () => {
  const registry = new ActiveChatGenerationRegistry();
  const controller = new AbortController();
  registry.register('workspace-1', 'user-1', 'operation-1', controller);

  let cancellationFinished = false;
  const cancellation = registry
    .cancelAndWait('workspace-1', 'user-1', 'operation-1')
    .then((cancelled) => {
      cancellationFinished = true;
      return cancelled;
    });
  await Promise.resolve();
  assert.equal(controller.signal.aborted, true);
  assert.equal(cancellationFinished, false);
  assert.equal(
    registry.wasCancellationRequested('workspace-1', 'user-1', 'operation-1'),
    true,
  );

  registry.unregister('workspace-1', 'user-1', 'operation-1');
  assert.equal(await cancellation, true);
  assert.equal(cancellationFinished, true);
});

test('generation registry isolates cancellation by Workspace and authenticated user', () => {
  const registry = new ActiveChatGenerationRegistry();
  const controller = new AbortController();
  registry.register('workspace-1', 'user-1', 'operation-1', controller);
  assert.equal(registry.cancel('workspace-2', 'user-1', 'operation-1'), false);
  assert.equal(registry.cancel('workspace-1', 'user-2', 'operation-1'), false);
  assert.equal(controller.signal.aborted, false);
  registry.unregister('workspace-1', 'user-1', 'operation-1');
});

test('chat lifecycle errors retain safe phase-specific classifications', () => {
  const timeout = classifyChatLifecycleFailure(
    new ChatProviderError('The AI provider timed out before completing.', 'OPENAI_TIMEOUT', 504),
    'orchestration',
    false,
  );
  assert.equal(timeout.code, 'OPENAI_TIMEOUT');

  const malformed = classifyChatLifecycleFailure(
    new ChatProviderError('Malformed provider stream.', 'OPENAI_MALFORMED_STREAM'),
    'orchestration',
    false,
  );
  assert.equal(malformed.code, 'OPENAI_MALFORMED_STREAM');

  const providerAbort = classifyChatLifecycleFailure(
    new ChatGenerationAbortedError(),
    'orchestration',
    false,
  );
  assert.equal(providerAbort.code, 'PROVIDER_ABORTED');

  const orchestration = classifyChatLifecycleFailure(
    new AIOrchestrationError('Tool rounds exhausted.', 'ORCHESTRATION_LIMIT_REACHED'),
    'orchestration',
    false,
  );
  assert.equal(orchestration.code, 'ORCHESTRATION_LIMIT_REACHED');

  const persistence = classifyChatLifecycleFailure(
    new Error('database unavailable'),
    'persistence',
    false,
  );
  assert.equal(persistence.code, 'CHAT_PERSISTENCE_FAILED');
  assert.doesNotMatch(persistence.userMessage, /database unavailable/);

  const cancellation = classifyChatLifecycleFailure(
    new ChatGenerationAbortedError(),
    'orchestration',
    true,
  );
  assert.equal(cancellation.code, 'CHAT_CANCELLED');
  assert.equal(cancellation.intentionalCancellation, true);
});
