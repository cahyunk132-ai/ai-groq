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
  const pick = [{ name: 'stone_pickaxe', count: 1, durability: 100 }];
  const crop = base({ inventory: pick, nearbyBlocks: { ores: [{ pos: [1, 1, 1] }], crops: [{ pos: [2, 2, 2], mature: true }], farmland: [] } });
  assert.equal(fallbackDecision(crop).action, 'farm');
  const ore = base({ inventory: pick, nearbyBlocks: { ores: [{ pos: [1, 1, 1] }], crops: [], farmland: [] } });
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

test('fallback: craft pickaxe jika belum punya dan bisa dibuat', () => {
  const s = base({ craftable: ['wooden_pickaxe'], inventory: [] });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'craft');
  assert.equal(d.item_to_use, 'wooden_pickaxe');
});

test('fallback: kumpulkan kayu jika sedikit dan ada di sekitar', () => {
  const s = base({
    inventory: [{ name: 'wooden_pickaxe', count: 1 }],
    nearbyResources: [{ name: 'oak_log', count: 5, distance: 4 }],
  });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'gather');
  assert.equal(d.item_to_use, 'oak_log');
});

test('fallback: bangun shelter jika bahan cukup', () => {
  const s = base({
    inventory: [
      { name: 'wooden_pickaxe', count: 1 },
      { name: 'oak_log', count: 10 },
      { name: 'cobblestone', count: 80 },
    ],
  });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'build');
  assert.equal(d.structure, 'shelter');
});

test('nextStructure: tidak mengulang jenis bangunan terakhir', async () => {
  const { nextStructure } = await import('../src/policy.js');
  assert.equal(nextStructure(100, null), 'shelter');
  assert.equal(nextStructure(100, 'shelter'), 'tower');
  assert.equal(nextStructure(30, 'shelter'), 'platform');
  assert.equal(nextStructure(10, 'shelter'), null);
  assert.equal(nextStructure(3, null), null);
});

test('fallback: pickaxe hampir hancur memicu craft, bukan mine', () => {
  const s = base({
    inventory: [{ name: 'stone_pickaxe', count: 1, durability: 3 }],
    craftable: ['wooden_pickaxe'],
    nearbyBlocks: { ores: [{ pos: [1, 1, 1] }], crops: [], farmland: [] },
  });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'craft');
  assert.equal(d.item_to_use, 'wooden_pickaxe');
});
