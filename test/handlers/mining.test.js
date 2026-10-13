import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { MiningHandler } from '../../src/handlers/mining.js';

test('MiningHandler detects lava hazard and falling block hazard', () => {
  const fakeBot = {
    blockAt: (pos) => {
      if (pos.y === 65) return { name: 'lava', position: pos };
      if (pos.y === 66) return { name: 'gravel', position: pos };
      return { name: 'stone', position: pos };
    },
  };

  const handler = new MiningHandler(fakeBot, { log: () => {} });
  const headPos = new Vec3(1, 65, 0);
  const footPos = new Vec3(1, 64, 0);

  const hazardLava = handler.detectHazard(headPos, footPos);
  assert.equal(hazardLava?.type, 'lava');

  const safeHead = new Vec3(1, 64, 0);
  const safeFoot = new Vec3(1, 63, 0);
  // above safeHead (y=65 is lava, but if above is gravel at y=66):
  const hazardGravel = handler.detectHazard(new Vec3(1, 65, 0), safeFoot);
  // headPos is y=65, above is y=66 (gravel)
  // But wait, in detectHazard: headPos.name is lava, so lava returned first.
  // Let's test gravel separately with a mock where head is air and above is gravel:
  const fakeBotGravel = {
    blockAt: (pos) => {
      if (pos.y === 66) return { name: 'gravel', position: pos };
      return { name: 'air', position: pos };
    },
  };
  const handlerGravel = new MiningHandler(fakeBotGravel, { log: () => {} });
  const hazard = handlerGravel.detectHazard(new Vec3(1, 65, 0), new Vec3(1, 64, 0));
  assert.equal(hazard?.type, 'falling_block');
});

test('MiningHandler equips highest tier pickaxe', async () => {
  let equipped = null;
  const fakeBot = {
    inventory: {
      items: () => [
        { name: 'wooden_pickaxe' },
        { name: 'diamond_pickaxe' },
        { name: 'stone_pickaxe' },
      ],
    },
    equip: async (item, slot) => {
      equipped = { item, slot };
    },
  };

  const handler = new MiningHandler(fakeBot, { log: () => {} });
  await handler.equipBestPickaxe();

  assert.equal(equipped?.item?.name, 'diamond_pickaxe');
  assert.equal(equipped?.slot, 'hand');
});
