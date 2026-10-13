import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestTool } from '../src/executor.js';

const bot = (names) => ({
  inventory: { items: () => names.map((name, slot) => ({ name, slot })) },
});

test('bestTool memilih material tertinggi', () => {
  assert.equal(bestTool(bot(['wooden_pickaxe', 'diamond_pickaxe', 'iron_pickaxe']), 'pickaxe').name, 'diamond_pickaxe');
  assert.equal(bestTool(bot(['stone_sword', 'iron_axe']), 'sword').name, 'stone_sword');
  assert.equal(bestTool(bot(['stone_sword']), 'pickaxe'), null);
});
