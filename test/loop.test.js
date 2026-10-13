import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOodaLoop } from '../src/loop.js';

test('loop berjalan dan berhenti saat signal dibatalkan', async () => {
  const controller = new AbortController();
  let acts = 0;
  await runOodaLoop({
    observe: () => ({ currentTaskPriority: 'Exploring', health: 20, hunger: 20 }),
    decide: async () => ({ action: 'explore', target: null, source: 'test', thought: '' }),
    act: async () => {
      acts += 1;
      if (acts === 2) controller.abort();
      return { message: 'ok' };
    },
    tickMs: 1,
    signal: controller.signal,
    log: () => {},
  });
  assert.equal(acts, 2);
});

test('error di satu tick tidak menghentikan loop', async () => {
  const controller = new AbortController();
  let calls = 0;
  await runOodaLoop({
    observe: () => ({ currentTaskPriority: 'Exploring', health: 20, hunger: 20 }),
    decide: async () => { calls += 1; if (calls === 1) throw new Error('boom'); controller.abort(); return { action: 'explore', source: 't', thought: '' }; },
    act: async () => ({}),
    tickMs: 1,
    signal: controller.signal,
    log: () => {},
  });
  assert.equal(calls, 2);
});
