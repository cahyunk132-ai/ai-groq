import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsStaircase, stairDirection, isHazardName } from '../src/mining.js';
import { fallbackDecision } from '../src/policy.js';
import { validateDecision } from '../src/actions.js';

const base = (over = {}) => ({
  health: 20, maxHealth: 20, hunger: 20, position: [0, 64, 0],
  inventory: [{ name: 'stone_pickaxe', count: 1, durability: 50 }, { name: 'iron_sword', count: 1, durability: 200 }],
  nearbyEntities: [],
  nearbyBlocks: { ores: [], crops: [], farmland: [], tillable: [] },
  nearbyResources: [], craftable: [], recentActions: [], pendingChat: [],
  ...over,
});

test('needsStaircase: ore dalam jangkauan (<= 2 di bawah kaki) tidak perlu tangga', () => {
  assert.equal(needsStaircase(64, 62), false);
  assert.equal(needsStaircase(64, 61), true, '3 blok di bawah kaki perlu tangga');
  assert.equal(needsStaircase(64, 59), true);
  assert.equal(needsStaircase(64, 70), false, 'ore di atas tidak perlu tangga');
});

test('stairDirection: menuju sumbu dengan selisih terbesar, bukan diagonal', () => {
  assert.deepEqual(stairDirection([0, 64, 0], [5, 50, 2]), { dx: 1, dz: 0 });
  assert.deepEqual(stairDirection([0, 64, 0], [-1, 50, -6]), { dx: 0, dz: -1 });
  assert.deepEqual(stairDirection([3, 64, 3], [3, 50, 3]), { dx: 1, dz: 0 });
});

test('isHazardName mengenali lava dan air, bukan blok lain', () => {
  assert.equal(isHazardName('lava'), true);
  assert.equal(isHazardName('flowing_lava'), true);
  assert.equal(isHazardName('water'), true);
  assert.equal(isHazardName('stone'), false);
  assert.equal(isHazardName('lava_cauldron'), false);
});

test('validasi mine menolak ore yang lebih dari 12 blok di bawah bot', () => {
  const s = base({ nearbyBlocks: { ores: [{ name: 'iron_ore', pos: [3, 50, 0] }], crops: [], farmland: [], tillable: [] } });
  assert.throws(() => validateDecision({ action: 'mine', target: [3, 50, 0] }, s), /terlalu dalam/);
});

test('validasi mine menerima ore yang masih dalam batas kedalaman', () => {
  const s = base({ nearbyBlocks: { ores: [{ name: 'coal_ore', pos: [3, 56, 0] }], crops: [], farmland: [], tillable: [] } });
  assert.equal(validateDecision({ action: 'mine', target: [3, 56, 0] }, s).action, 'mine');
});

test('fallback: ore yang bisa dijangkau didahulukan daripada ore yang perlu tangga', () => {
  const s = base({
    nearbyBlocks: {
      ores: [{ name: 'coal_ore', pos: [1, 58, 1] }, { name: 'coal_ore', pos: [2, 63, 2] }],
      crops: [], farmland: [], tillable: [],
    },
  });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'mine');
  assert.deepEqual(d.target, [2, 63, 2]);
});

test('fallback: ore terlalu dalam diabaikan (tidak ada lubang vertikal)', () => {
  const s = base({
    nearbyBlocks: { ores: [{ name: 'coal_ore', pos: [1, 40, 1] }], crops: [], farmland: [], tillable: [] },
  });
  assert.notEqual(fallbackDecision(s).action, 'mine');
});
