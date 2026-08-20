import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getYouTubeStageLabel,
  getYouTubeFailureMessage,
  YOUTUBE_SLOW_PROCESSING_NOTICE,
  YOUTUBE_SLOW_PROCESSING_THRESHOLD_MS,
  YOUTUBE_INGESTION_GUIDANCE,
  shouldShowYouTubeSlowProcessingNotice,
  youtubeProcessingAttemptKey,
} from './youtube-source-ux';

test('YouTube guidance accurately describes spoken-audio and access limitations', () => {
  assert.match(YOUTUBE_INGESTION_GUIDANCE, /clear spoken audio/i);
  assert.match(YOUTUBE_INGESTION_GUIDANCE, /restricted access/i);
  assert.doesNotMatch(YOUTUBE_INGESTION_GUIDANCE, /Gemini|transcript required/i);
});

test('YouTube failures map to specific user-safe messages without internal codes', () => {
  const noSpeech = getYouTubeFailureMessage({ errorCode: 'NO_SPEECH_DETECTED' });
  const transient = getYouTubeFailureMessage({
    errorCode: 'TRANSCRIPT_PROVIDER_ERROR',
    retryable: true,
  });
  const unavailable = getYouTubeFailureMessage({ errorCode: 'VIDEO_UNAVAILABLE' });

  assert.equal(noSpeech.title, 'No usable spoken content was detected in this video.');
  assert.equal(transient.title, 'We could not finish processing this video right now.');
  assert.equal(unavailable.title, 'This video could not be accessed.');

  for (const message of [noSpeech, transient, unavailable]) {
    const visibleText = `${message.title} ${message.detail || ''}`;
    assert.doesNotMatch(
      visibleText,
      /Gemini|TRANSCRIPT_UNAVAILABLE|NO_SPEECH_DETECTED|VIDEO_UNAVAILABLE/,
    );
  }
});

test('a Gemini content-policy failure shows its own ACCESS_RESTRICTED message, not the generic VIDEO_UNAVAILABLE one', () => {
  // Regression: fetchGeminiTranscript's ACCESS_RESTRICTED userMessage is
  // "...access is restricted." — the word "restricted" also matches
  // VIDEO_UNAVAILABLE's message-regex fallback. Since that fallback used to
  // run before the ACCESS_RESTRICTED errorCode check, this exact metadata
  // shape was silently displayed as "This video could not be accessed"
  // instead of its own, more specific copy.
  const accessRestricted = getYouTubeFailureMessage({
    errorCode: 'ACCESS_RESTRICTED',
    errorMessage: 'This YouTube video cannot be processed because access is restricted.',
    retryable: true,
  });
  assert.equal(accessRestricted.title, 'This video cannot be accessed for processing.');
  assert.equal(accessRestricted.detail, 'The video or its content is restricted.');
  assert.notEqual(accessRestricted.title, 'This video could not be accessed.');

  // A genuine VIDEO_UNAVAILABLE failure must still show its own message.
  const videoUnavailable = getYouTubeFailureMessage({
    errorCode: 'VIDEO_UNAVAILABLE',
    errorMessage: 'This video could not be accessed.',
    retryable: false,
  });
  assert.equal(videoUnavailable.title, 'This video could not be accessed.');
});

test('YouTube processing labels follow persisted stages without theatrical rotation', () => {
  assert.equal(getYouTubeStageLabel('QUEUED'), 'Queued');
  assert.equal(getYouTubeStageLabel('FETCHING'), 'Processing video');
  assert.equal(getYouTubeStageLabel('PARSING'), 'Preparing knowledge');
  assert.equal(getYouTubeStageLabel('EMBEDDING'), 'Indexing knowledge');
  assert.equal(getYouTubeStageLabel('COMPLETED'), 'Ready');
});

test('slow-processing notice is delayed, terminal-aware, and single-shot per source version', () => {
  assert.equal(YOUTUBE_SLOW_PROCESSING_THRESHOLD_MS, 60_000);
  assert.match(YOUTUBE_SLOW_PROCESSING_NOTICE, /taking a little longer/i);
  assert.match(YOUTUBE_SLOW_PROCESSING_NOTICE, /still preparing it for your Workspace/i);
  const source = {
    id: 'source-1',
    workspaceId: 'workspace-1',
    title: 'Lecture',
    type: 'YOUTUBE',
    status: 'PROCESSING',
    stage: 'FETCHING',
    currentVersion: 3,
    metadata: { claimedAt: '2026-08-16T00:00:00.000Z' },
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:01.000Z',
  } as const;
  assert.equal(youtubeProcessingAttemptKey(source), 'source-1:3');
  assert.equal(
    shouldShowYouTubeSlowProcessingNotice(
      source,
      new Set(),
      Date.parse('2026-08-16T00:00:59.999Z'),
    ),
    false,
  );
  assert.equal(
    shouldShowYouTubeSlowProcessingNotice(
      source,
      new Set(),
      Date.parse('2026-08-16T00:01:00.000Z'),
    ),
    true,
  );
  assert.equal(
    shouldShowYouTubeSlowProcessingNotice(
      source,
      new Set(['source-1:3']),
      Date.parse('2026-08-16T00:02:00.000Z'),
    ),
    false,
  );
});
