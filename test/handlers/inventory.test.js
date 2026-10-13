import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { InventoryHandler } from '../../src/handlers/inventory.js';

test('InventoryHandler finds chest and deposits non-essential items', async () => {
  const depositedItems = [];
  let closed = false;

  const mockChestWindow = {
    deposit: async (type, meta, count) => {
      depositedItems.push({ type, count });
    },
    close: () => {
      closed = true;
    },
  };

  const fakeBot = {
    registry: {
      blocksByName: {
        chest: { id: 54 },
      },
    },
    findBlocks: () => [new Vec3(1, 64, 0)],
    blockAt: (pos) => ({ name: 'chest', position: pos }),
    entity: { position: new Vec3(0, 64, 0) },
    inventory: {
      items: () => [
        { name: 'iron_sword', type: 1, count: 1 }, // essential, should NOT deposit
        { name: 'bread', type: 2, count: 5 }, // essential, should NOT deposit
        { name: 'cobblestone', type: 3, count: 64 }, // excess, SHOULD deposit
        { name: 'iron_ore', type: 4, count: 12 }, // excess, SHOULD deposit
      ],
    },
    openChest: async () => mockChestWindow,
  };

  const handler = new InventoryHandler(fakeBot, { log: () => {} });
  const success = await handler.depositExcessItems();

  assert.equal(success, true);
  assert.equal(closed, true);
  // Only cobblestone (type 3) and iron_ore (type 4) should be deposited
  assert.equal(depositedItems.length, 2);
  assert.equal(depositedItems[0].type, 3);
  assert.equal(depositedItems[1].type, 4);
});

test('InventoryHandler retrieves item from chest', async () => {
  let withdrawn = null;
  const mockChestWindow = {
    items: () => [{ name: 'torch', type: 50, count: 16 }],
    withdraw: async (type, meta, count) => {
      withdrawn = { type, count };
    },
    close: () => {},
  };

  const fakeBot = {
    registry: {
      blocksByName: { chest: { id: 54 } },
    },
    findBlocks: () => [new Vec3(1, 64, 0)],
    blockAt: (pos) => ({ name: 'chest', position: pos }),
    entity: { position: new Vec3(0, 64, 0) },
    openChest: async () => mockChestWindow,
  };

  const handler = new InventoryHandler(fakeBot, { log: () => {} });
  const success = await handler.retrieveItem('torch', 8);

  assert.equal(success, true);
  assert.equal(withdrawn?.type, 50);
  assert.equal(withdrawn?.count, 8);
});
