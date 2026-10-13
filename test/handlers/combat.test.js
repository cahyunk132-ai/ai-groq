import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { CombatHandler } from '../../src/handlers/combat.js';

test('CombatHandler equips weapon, performs crit jump, and attacks', async () => {
  let jumped = false;
  let equipped = null;
  let attackedTarget = null;

  const fakeTarget = {
    isValid: true,
    position: new Vec3(2, 64, 0),
    height: 1.8,
  };

  const fakeBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      onGround: true,
    },
    inventory: {
      items: () => [
        { name: 'iron_sword', type: 1 },
        { name: 'shield', type: 2 },
      ],
    },
    equip: async (item, slot) => {
      equipped = { item, slot };
    },
    lookAt: async () => {},
    setControlState: (ctrl, val) => {
      if (ctrl === 'jump') jumped = val;
    },
    attack: (target) => {
      attackedTarget = target;
    },
  };

  const handler = new CombatHandler(fakeBot, { log: () => {} });
  await handler.attack(fakeTarget);

  assert.equal(equipped?.item?.name, 'iron_sword');
  assert.equal(jumped, true);
  assert.equal(attackedTarget, fakeTarget);
});

test('CombatHandler blockWithShield equips shield to off-hand and activates', async () => {
  let equipped = null;
  let activated = false;

  const fakeBot = {
    inventory: {
      items: () => [{ name: 'shield', type: 99 }],
    },
    equip: async (item, slot) => {
      equipped = { item, slot };
    },
    activateItem: (offhand) => {
      activated = offhand;
    },
    deactivateItem: () => {
      activated = false;
    },
  };

  const handler = new CombatHandler(fakeBot, { log: () => {} });
  const success = await handler.blockWithShield();

  assert.equal(success, true);
  assert.equal(equipped?.slot, 'off-hand');
  assert.equal(activated, true);
  assert.equal(handler.isBlocking, true);

  handler.unblock();
  assert.equal(handler.isBlocking, false);
  assert.equal(activated, false);
});
