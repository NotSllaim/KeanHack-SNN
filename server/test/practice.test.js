import assert from 'node:assert/strict';
import { test, beforeEach, afterEach, mock } from 'node:test';
import { generateConversationTurn, analyzeReading, analyzeVerbiage } from '../src/services/gemmaService.js';
import { textToSpeech } from '../src/services/elevenLabsService.js';

const keys = ['AI_PROVIDER', 'SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_TOKEN', 'GEMMA_API_KEY', 'GEMMA_API_URL', 'DEEPGRAM_API_KEY', 'DEEPGRAM_TTS_SANA_MODEL_ID'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
});
afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  mock.restoreAll();
});

test('voice overrides loaded after module import are honored', async () => {
  process.env.DEEPGRAM_API_KEY = 'test-only';
  process.env.DEEPGRAM_TTS_SANA_MODEL_ID = 'test-voice';
  const fetch = mock.method(globalThis, 'fetch', async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
  const speech = await textToSpeech('Sample text', { botId: 'sana' });
  assert.equal(speech.voiceModel, 'test-voice');
  assert.equal(new URL(fetch.mock.calls[0].arguments[0]).searchParams.get('model'), 'test-voice');
});

test('keyless practice is deterministic and does not make network calls', async () => {
  const fetch = mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected external call'); });
  const short = await generateConversationTurn({ botId: 'sana', userMessage: 'Hello' });
  const detailed = await generateConversationTurn({ botId: 'sana', userMessage: 'I enjoy helping my team explain complicated ideas with clear examples.' });
  assert.equal(short.aiDebug.source, 'fallback');
  assert.ok(detailed.scores.engagement > short.scores.engagement);
  const reading = await analyzeReading({ passage: 'Example passage', transcript: 'Example passage' });
  assert.match(reading.feedback.improvements[0], /Record/);
  for (const [pace, expected] of [[0,70],[94,58],[95,74],[119,74],[120,88],[160,88],[161,74],[185,74],[186,58]]) {
    const result = await analyzeReading({ passage: 'Example', transcript: 'Example', audioMetrics: { wordsPerMinute: pace } });
    assert.equal(result.scores.pacing, expected);
  }
  const wording = await analyzeVerbiage({ promptText: 'Tell a story', responseText: 'Sample text' });
  assert.equal(wording.scores.wording, 70);
  assert.equal(fetch.mock.callCount(), 0);
});

test('conversation stays on Snowflake even when AI_PROVIDER selects Gemini', async () => {
  Object.assign(process.env, { AI_PROVIDER: 'gemini', SNOWFLAKE_ACCOUNT: 'unit-test', SNOWFLAKE_TOKEN: 'test-only', GEMMA_API_KEY: 'test-only', GEMMA_API_URL: 'https://example.invalid/google' });
  const generated = { botReply: 'What did you learn?', feedback: { summary: 'Test response' }, scores: { confidence: 80 } };
  const fetch = mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(generated) } }] }) }));
  const result = await generateConversationTurn({ botId: 'sana', userMessage: 'A sample answer' });
  assert.equal(result.aiDebug.source, 'snowflake');
  assert.match(fetch.mock.calls[0].arguments[0], /snowflakecomputing/);
});

test('reading selects Google explicitly; Snowflake HTTP failure does not retry Google', async () => {
  Object.assign(process.env, { AI_PROVIDER: 'gemini', SNOWFLAKE_ACCOUNT: 'unit-test', SNOWFLAKE_TOKEN: 'test-only', GEMMA_API_KEY: 'test-only', GEMMA_API_URL: 'https://example.invalid/google' });
  const fetch = mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ feedback: { summary: 'Mocked Google result' }, scores: { pacing: 82 } }) }] } }] }) }));
  assert.equal((await analyzeReading({ passage: 'Example', transcript: 'Example' })).scores.pacing, 82);
  assert.equal(fetch.mock.calls[0].arguments[0], 'https://example.invalid/google');
  process.env.AI_PROVIDER = 'snowflake';
  fetch.mock.mockImplementation(async () => ({ ok: false, status: 503, text: async () => 'Unavailable' }));
  const result = await analyzeReading({ passage: 'Example', transcript: 'Example' });
  assert.equal(result.scores.pacing, 70);
  assert.equal(fetch.mock.callCount(), 2);
  assert.match(fetch.mock.calls[1].arguments[0], /snowflakecomputing/);
});
