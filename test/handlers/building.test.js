import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { BuildingHandler } from '../../src/handlers/building.js';

test('BuildingHandler calculates deficiency correctly', () => {
  const fakeBot = {
    inventory: {
      items: () => [
        { name: 'cobblestone', count: 10 },
        { name: 'oak_planks', count: 5 },
      ],
    },
  };

  const handler = new BuildingHandler(fakeBot, { log: () => {} });
  // platform needs 9 blocks
  const platformDef = handler.calculateDeficiency('platform');
  assert.equal(platformDef.requiredCount, 9);
  assert.equal(platformDef.availableCount, 15);
  assert.equal(platformDef.missing, 0);
  assert.equal(platformDef.canBuild, true);

  // shelter needs 31 blocks
  const shelterDef = handler.calculateDeficiency('shelter');
  assert.equal(shelterDef.requiredCount, 31);
  assert.equal(shelterDef.availableCount, 15);
  assert.equal(shelterDef.missing, 16);
  assert.equal(shelterDef.canBuild, false);
});

test('BuildingHandler finds adjacent reference block', () => {
  const fakeBot = {
    blockAt: (pos) => {
      // Ground below target is solid cobblestone
      if (pos.x === 0 && pos.y === 63 && pos.z === 0) {
        return { name: 'cobblestone', position: pos };
      }
      return { name: 'air', position: pos };
    },
  };

  const handler = new BuildingHandler(fakeBot, { log: () => {} });
  const targetPos = new Vec3(0, 64, 0);
  const ref = handler.findReferenceBlock(targetPos);

  assert.ok(ref);
  assert.equal(ref.block.name, 'cobblestone');
  assert.deepEqual(ref.face, new Vec3(0, 1, 0));
});
