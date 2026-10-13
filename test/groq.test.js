import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askGroq, parseJsonLoose } from '../src/groq.js';

const reply = (content, status = 200) => async () => ({
  ok: status < 400,
  status,
  json: async () => ({ choices: [{ message: { content } }] }),
  text: async () => content,
});

test('askGroq mengirim header, model, dan response_format JSON', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return reply('{"action":"explore"}')();
  };
  const out = await askGroq([{ role: 'user', content: 'hi' }], {
    apiKey: 'k', model: 'm', baseUrl: 'https://example.test/v1', fetchImpl,
  });
  assert.deepEqual(out, { action: 'explore' });
  assert.equal(captured.url, 'https://example.test/v1/chat/completions');
  assert.equal(captured.init.headers.Authorization, 'Bearer k');
  assert.equal(captured.body.model, 'm');
  assert.deepEqual(captured.body.response_format, { type: 'json_object' });
});

test('askGroq melempar error pada HTTP non-2xx', async () => {
  await assert.rejects(
    askGroq([], { apiKey: 'k', fetchImpl: reply('rate limited', 429) }),
    /Groq HTTP 429/,
  );
});

test('askGroq butuh API key', async () => {
  await assert.rejects(askGroq([], { apiKey: '' }), /GROQ_API_KEY/);
});

test('parseJsonLoose menerima JSON dengan teks tambahan', () => {
  assert.deepEqual(parseJsonLoose('Berikut: {"action":"flee"} semoga membantu'), { action: 'flee' });
  assert.throws(() => parseJsonLoose('tidak ada json'), /bukan JSON/);
});
