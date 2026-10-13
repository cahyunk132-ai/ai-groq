import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildState, intentOf, currentTask } from '../src/state.js';
import { fakeBot } from './helpers.js';

test('intentOf memetakan tipe entitas ke label prompt', () => {
  assert.equal(intentOf({ type: 'hostile', name: 'zombie' }), 'Aggressive');
  assert.equal(intentOf({ type: 'mob', name: 'slime' }), 'Aggressive');
  assert.equal(intentOf({ type: 'animal', name: 'cow' }), 'Passive');
  assert.equal(intentOf({ type: 'player', name: 'Steve' }), 'Player');
  assert.equal(intentOf({ type: 'mob', name: 'iron_golem' }), 'Neutral');
});

test('buildState merangkum HP, lapar, entitas, dan blok sekitar', () => {
  const bot = fakeBot({
    health: 10,
    food: 15,
    items: [
      { slot: 0, name: 'iron_sword', count: 1, maxDurability: 250, durabilityUsed: 50 },
      { slot: 1, name: 'baked_potato', count: 3 },
    ],
    entities: [
      { id: 45, name: 'zombie', type: 'hostile', position: { x: 3, y: 64, z: 0, distanceTo: () => 3 } },
    ],
    blocks: { '120,60,88': 'diamond_ore', '2,64,0': 'wheat:7', '3,64,0': 'farmland' },
  });
  // Posisi entitas memakai Vec3 sungguhan agar distanceTo berfungsi.
  bot.entities[45].position = new (bot.entity.position.constructor)(3, 64, 0);

  const state = buildState(bot, 16);
  assert.equal(state.health, 10);
  assert.equal(state.hunger, 15);
  assert.deepEqual(state.position, [0, 64, 0]);
  assert.equal(state.inventory[0].durability, 200);
  assert.equal(state.inventory[1].isFood, true);
  assert.equal(state.nearbyEntities[0].intent, 'Aggressive');
  assert.equal(state.nearbyEntities[0].id, 45);
  assert.equal(state.nearbyBlocks.crops[0].mature, true);
  assert.equal(state.nearbyBlocks.farmland.length, 1);
  assert.equal(state.currentTaskPriority, 'Fighting');
});

test('currentTask memilih Mining jika hanya ada ore', () => {
  const base = {
    health: 20, maxHealth: 20, hunger: 20, inventory: [],
    nearbyEntities: [],
    nearbyBlocks: { ores: [{ name: 'diamond_ore', pos: [1, 2, 3] }], crops: [], farmland: [] },
  };
  assert.equal(currentTask(base), 'Mining');
  assert.equal(currentTask({ ...base, nearbyBlocks: { ores: [], crops: [], farmland: [] } }), 'Exploring');
});
