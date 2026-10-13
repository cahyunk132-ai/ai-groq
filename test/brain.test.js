import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../src/brain.js';

const state = {
  health: 20, maxHealth: 20, hunger: 20, inventory: [],
  nearbyEntities: [{ id: 45, name: 'zombie', intent: 'Aggressive', distance: 3 }],
  nearbyBlocks: { ores: [], crops: [], farmland: [] },
};

test('brain memakai keputusan Groq jika valid', async () => {
  const decide = createBrain({
    ask: async () => ({ thought: 'serang', action: 'attack', target: 45, item_to_use: null }),
    log: () => {},
  });
  const d = await decide(state);
  assert.equal(d.action, 'attack');
  assert.equal(d.source, 'groq');
});

test('brain jatuh ke kebijakan cadangan jika Groq gagal', async () => {
  const logs = [];
  const decide = createBrain({
    ask: async () => { throw new Error('timeout'); },
    log: (m) => logs.push(m),
  });
  const d = await decide(state);
  assert.equal(d.source, 'fallback');
  assert.equal(d.action, 'attack');
  assert.match(logs[0], /timeout/);
});

test('brain menolak keputusan Groq yang tidak valid lalu memakai cadangan', async () => {
  const decide = createBrain({
    ask: async () => ({ action: 'attack', target: 999 }),
    log: () => {},
  });
  const d = await decide(state);
  assert.equal(d.source, 'fallback');
});

test('brain tidak memanggil Groq saat budget belum mengizinkan; memakai cadangan', async () => {
  let calls = 0;
  const budget = { check: () => ({ ok: false, reason: 'menunggu jadwal' }), recordCall() {}, recordRateLimit() {} };
  const decide = createBrain({ ask: async () => { calls += 1; return {}; }, log: () => {}, budget });
  const d = await decide({ ...state, nearbyEntities: [] });
  assert.equal(calls, 0);
  assert.equal(d.source, 'fallback');
});

test('brain mencatat panggilan dan jeda saat Groq membalas 429', async () => {
  const events = [];
  const budget = {
    check: () => ({ ok: true, reason: 'rencana' }),
    recordCall: () => events.push('call'),
    recordRateLimit: () => events.push('429'),
  };
  const decide = createBrain({
    ask: async () => { throw new Error('Groq HTTP 429: rate limit'); },
    log: () => {},
    budget,
  });
  const d = await decide({ ...state, nearbyEntities: [] });
  assert.deepEqual(events, ['call', '429']);
  assert.equal(d.source, 'fallback');
});
