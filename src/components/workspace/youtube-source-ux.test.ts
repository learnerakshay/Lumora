import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getYouTubeFailureMessage,
  YOUTUBE_INGESTION_GUIDANCE,
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
  assert.equal(transient.title, 'YouTube processing failed temporarily.');
  assert.equal(unavailable.title, 'This video could not be accessed.');

  for (const message of [noSpeech, transient, unavailable]) {
    const visibleText = `${message.title} ${message.detail || ''}`;
    assert.doesNotMatch(
      visibleText,
      /Gemini|TRANSCRIPT_UNAVAILABLE|NO_SPEECH_DETECTED|VIDEO_UNAVAILABLE/,
    );
  }
});
