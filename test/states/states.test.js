import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { EatingState } from '../../src/states/EatingState.js';
import { CombatState } from '../../src/states/CombatState.js';
import { CraftingState } from '../../src/states/CraftingState.js';
import { SocializingState } from '../../src/states/SocializingState.js';

test('EatingState consumes food and completes', async () => {
  let consumed = false;
  let equipped = null;

  const fakeBot = {
    equip: async (item, slot) => {
      equipped = { item, slot };
    },
    consume: async () => {
      consumed = true;
    },
  };

  const fakeSelf = {
    bestFood: () => ({ name: 'baked_potato' }),
  };

  const state = new EatingState(fakeBot, fakeSelf);
  assert.equal(state.interruptible, false);

  await state.onEnter({});
  const done = await state.onUpdate({});

  assert.equal(equipped?.item?.name, 'baked_potato');
  assert.equal(consumed, true);
  assert.equal(done, true);
});

test('CombatState flees when HP is critical and hostile is close', async () => {
  let fled = false;
  let attacked = false;

  const fakeCombatHandler = {
    fleeFrom: async () => {
      fled = true;
    },
    attack: async () => {
      attacked = true;
    },
    log: () => {},
  };

  const fakeThreat = {
    highestThreat: () => ({ name: 'zombie', distance: 2, entity: {} }),
  };

  const fakeSelf = {
    hp: 4,
    hpRatio: 0.2, // critical (< 0.3)
  };

  const state = new CombatState({}, fakeCombatHandler, fakeThreat, fakeSelf);
  await state.onUpdate({});

  assert.equal(fled, true);
  assert.equal(attacked, false);
});

test('CraftingState crafts item and dequeues task', async () => {
  let craftedItem = null;
  let dequeued = false;

  const fakeCraftingHandler = {
    craftItem: async (item) => {
      craftedItem = item;
    },
    log: () => {},
  };

  const context = {
    taskQueue: {
      currentTask: () => ({ params: { item: 'iron_pickaxe' } }),
      dequeue: () => {
        dequeued = true;
      },
    },
  };

  const state = new CraftingState({}, fakeCraftingHandler);
  const done = await state.onUpdate(context);

  assert.equal(craftedItem, 'iron_pickaxe');
  assert.equal(dequeued, true);
  assert.equal(done, true);
});

test('SocializingState responds to pending chat and clears memory', async () => {
  let chattered = null;

  const fakeBot = {
    health: 20,
    food: 20,
    chat: (msg) => {
      chattered = msg;
    },
  };

  const fakeMemory = {
    pendingChat: [{ from: 'Steve', message: 'halo bot' }],
    clearPendingChat: () => {
      fakeMemory.pendingChat = [];
    },
  };

  const state = new SocializingState(fakeBot, fakeMemory);
  await state.onEnter({});
  const done = await state.onUpdate({});

  assert.ok(chattered.includes('Halo Steve'));
  assert.equal(fakeMemory.pendingChat.length, 0);
  assert.equal(done, true);
});
