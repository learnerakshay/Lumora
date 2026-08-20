import assert from 'node:assert/strict';
import test from 'node:test';
import type { PersistedSourceArtifact } from '../source-store';
import { processSourcePipeline, resolveSourceAcquisitionMode } from './pipeline';

function createMinimalPdf(text: string): Uint8Array {
  const stream = `BT /F1 18 Tf 72 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    output += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'binary');
}

function artifact(overrides: Partial<PersistedSourceArtifact> = {}): PersistedSourceArtifact {
  return {
    id: 'content-1',
    sourceId: 'source-1',
    version: 1,
    originalContent: null,
    artifactData: createMinimalPdf('Lumora PDF creates searchable evidence'),
    artifactFileName: 'grounded-evidence.pdf',
    artifactMimeType: 'application/pdf',
    artifactSize: 700,
    sourceUrl: null,
    rawContent: '',
    cleanText: '',
    parserMetadata: null,
    parserVersion: 'pending',
    checksum: 'checksum-1',
    ...overrides,
  };
}

test('uploaded PDF bytes run through parse, chunks, embeddings, and READY index commit', async () => {
  const persistedArtifact = artifact();
  const stages: string[] = [];
  let parsedArtifact: Record<string, unknown> | null = null;
  let readyIndex: Record<string, unknown> | null = null;

  const result = await processSourcePipeline(
    {
      sourceId: 'source-1',
      workspaceId: 'workspace-1',
      title: 'Grounded evidence',
      type: 'PDF',
      version: 1,
    },
    {
      getSourceArtifact: async () => persistedArtifact,
      claimProcessingAttempt: async () => 'attempt-1',
      transitionProcessingStage: async (input: any) => {
        stages.push(input.nextStage);
      },
      touchProcessingAttempt: async () => true,
      persistParsedSourceArtifact: async (input: any) => {
        parsedArtifact = input;
      },
      generateEmbeddingsBatch: async (texts: string[]) => ({
        vectors: texts.map(() => [1, ...new Array(1535).fill(0)]),
        contract: {
          provider: 'openai',
          model: 'text-embedding-3-small',
          dimensions: 1536,
          version: 'v1',
        },
        inputTokens: 14,
      }),
      saveSourceIndex: (async (input: any) => {
        readyIndex = {
          status: 'READY',
          sourceId: input.sourceId,
          workspaceId: input.workspaceId,
          chunkCount: input.chunks.length,
          firstChunk: input.chunks[0]?.content,
        };
        return {
          indexId: 'index-1',
          sourceVersion: 1,
          chunkVersion: input.chunkVersion,
          chunkCount: input.chunks.length,
          indexedAt: new Date().toISOString(),
          chunks: [],
        };
      }) as any,
    },
  );

  assert.equal(resolveSourceAcquisitionMode('PDF', persistedArtifact), 'UPLOADED_BYTES');
  assert.equal(result.success, true);
  assert.ok(result.chunkCount > 0);
  assert.deepEqual(stages, [
    'PROCESSING',
    'PARSING',
    'CHUNKING',
    'READY_FOR_INDEXING',
    'EMBEDDING',
    'INDEXING',
  ]);
  assert.ok(parsedArtifact);
  assert.equal((parsedArtifact as any).artifactData.byteLength, persistedArtifact.artifactData!.byteLength);
  assert.match((parsedArtifact as any).cleanText, /searchable evidence/);
  assert.deepEqual(readyIndex, {
    status: 'READY',
    sourceId: 'source-1',
    workspaceId: 'workspace-1',
    chunkCount: result.chunkCount,
    firstChunk: (readyIndex as any).firstChunk,
  });
  assert.match(String((readyIndex as any).firstChunk), /searchable evidence/);
});

test('missing uploaded PDF bytes persist a controlled non-retryable FAILED state', async () => {
  const transitions: any[] = [];
  const missingArtifact = artifact({
    artifactData: null,
    artifactSize: null,
    sourceUrl: null,
  });

  const result = await processSourcePipeline(
    {
      sourceId: 'source-1',
      workspaceId: 'workspace-1',
      title: 'Missing PDF',
      type: 'PDF',
      version: 1,
    },
    {
      getSourceArtifact: async () => missingArtifact,
      claimProcessingAttempt: async () => 'attempt-1',
      transitionProcessingStage: async (input: any) => {
        transitions.push(input);
      },
      touchProcessingAttempt: async () => true,
    },
  );

  const failed = transitions.at(-1);
  assert.equal(resolveSourceAcquisitionMode('PDF', missingArtifact), 'MISSING');
  assert.equal(result.success, false);
  assert.equal(failed.nextStage, 'FAILED');
  assert.equal(failed.details.errorCode, 'SOURCE_ARTIFACT_MISSING');
  assert.equal(failed.details.retryable, false);
  assert.equal(failed.details.failedStage, 'PARSING');
  assert.match(failed.errorMessage, /uploaded PDF is no longer available/i);
  assert.doesNotMatch(failed.errorMessage, /remote source/i);
});

test('a corrupt persisted PDF fails as parsing, never as remote acquisition', async () => {
  const transitions: any[] = [];
  const invalidArtifact = artifact({
    artifactData: Buffer.from('not-a-pdf'),
    artifactSize: 9,
  });

  const result = await processSourcePipeline(
    {
      sourceId: 'source-1',
      workspaceId: 'workspace-1',
      title: 'Corrupt PDF',
      type: 'PDF',
      version: 1,
    },
    {
      getSourceArtifact: async () => invalidArtifact,
      claimProcessingAttempt: async () => 'attempt-1',
      transitionProcessingStage: async (input: any) => {
        transitions.push(input);
      },
      touchProcessingAttempt: async () => true,
    },
  );

  const failed = transitions.at(-1);
  assert.equal(result.success, false);
  assert.equal(failed.details.errorCode, 'PARSING_ERROR');
  assert.equal(failed.details.acquisitionMode, 'UPLOADED_BYTES');
  assert.equal(failed.details.retryable, false);
  assert.doesNotMatch(failed.errorMessage, /remote source/i);
});
