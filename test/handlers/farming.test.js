import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { FarmingHandler } from '../../src/handlers/farming.js';

test('FarmingHandler harvests mature crop and replants seed', async () => {
  let dug = null;
  let placed = null;

  const fakeBot = {
    entity: { position: new Vec3(0, 64, 0) },
    inventory: {
      items: () => [{ name: 'wheat_seeds', count: 3 }],
    },
    blockAt: (pos) => {
      if (pos.y === 64) return { name: 'wheat', position: pos };
      if (pos.y === 63) return { name: 'farmland', position: pos };
      return null;
    },
    dig: async (block) => {
      dug = block;
    },
    equip: async () => {},
    placeBlock: async (refBlock, face) => {
      placed = { refBlock, face };
    },
  };

  const handler = new FarmingHandler(fakeBot, { log: () => {} });
  const result = await handler.harvestAndReplant(new Vec3(1, 64, 0));

  assert.equal(result, true);
  assert.equal(dug?.name, 'wheat');
  assert.equal(placed?.refBlock?.name, 'farmland');
});

test('FarmingHandler respects breeding population limits', async () => {
  const fakeBot = {
    entities: {
      1: { name: 'cow', position: new Vec3(1, 64, 0) },
      2: { name: 'cow', position: new Vec3(2, 64, 0) },
    },
    inventory: {
      items: () => [{ name: 'wheat', count: 5 }],
    },
    equip: async () => {},
    activateEntity: async () => {},
  };

  const handler = new FarmingHandler(fakeBot, { log: () => {} });
  // Population is 2, limit is 10 -> can breed
  const bred = await handler.breedAnimals('cow');
  assert.equal(bred, true);

  // Add more cows to exceed limit (MAX_ANIMAL_POPULATION for cow is 10)
  for (let i = 3; i <= 12; i++) {
    fakeBot.entities[i] = { name: 'cow', position: new Vec3(i, 64, 0) };
  }
  const overLimit = await handler.breedAnimals('cow');
  assert.equal(overLimit, false);
});
