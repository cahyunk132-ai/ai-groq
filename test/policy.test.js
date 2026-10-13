import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackDecision, applySafetyOverrides } from '../src/policy.js';

const base = (over = {}) => ({
  health: 20, maxHealth: 20, hunger: 20,
  inventory: [],
  nearbyEntities: [],
  nearbyBlocks: { ores: [], crops: [], farmland: [] },
  ...over,
});

test('fallback: musuh dekat dan HP kritis => flee', () => {
  const s = base({ health: 5, nearbyEntities: [{ id: 1, intent: 'Aggressive', distance: 2 }] });
  assert.equal(fallbackDecision(s).action, 'flee');
});

test('fallback: musuh agresif jauh tapi dalam radius => attack', () => {
  const s = base({ nearbyEntities: [{ id: 9, intent: 'Aggressive', distance: 6 }] });
  assert.deepEqual([fallbackDecision(s).action, fallbackDecision(s).target], ['attack', 9]);
});

test('fallback: prioritas farm > mine > explore', () => {
  const crop = base({ nearbyBlocks: { ores: [{ pos: [1, 1, 1] }], crops: [{ pos: [2, 2, 2], mature: true }], farmland: [] } });
  assert.equal(fallbackDecision(crop).action, 'farm');
  const ore = base({ nearbyBlocks: { ores: [{ pos: [1, 1, 1] }], crops: [], farmland: [] } });
  assert.equal(fallbackDecision(ore).action, 'mine');
  assert.equal(fallbackDecision(base()).action, 'explore');
});

test('override: HP kritis + musuh dekat menimpa attack menjadi flee', () => {
  const s = base({ health: 4, nearbyEntities: [{ id: 1, intent: 'Aggressive', distance: 3 }] });
  const out = applySafetyOverrides({ action: 'attack', target: 1, thought: 'x', item_to_use: null }, s);
  assert.equal(out.action, 'flee');
});

test('override: HP kritis tanpa musuh dekat dan ada makanan => eat', () => {
  const s = base({ health: 4, inventory: [{ name: 'bread', isFood: true }] });
  const out = applySafetyOverrides({ action: 'mine', target: [1, 1, 1], thought: '', item_to_use: null }, s);
  assert.equal(out.action, 'eat');
  assert.equal(out.item_to_use, 'bread');
});

test('override: tidak mengubah keputusan saat HP cukup', () => {
  const d = { action: 'mine', target: [1, 1, 1], thought: '', item_to_use: null };
  assert.equal(applySafetyOverrides(d, base()), d);
});
