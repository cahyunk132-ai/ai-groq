import test from 'node:test';
import assert from 'node:assert/strict';
import { EncounterState } from '../../src/states/EncounterState.js';
import { SocializingState } from '../../src/states/SocializingState.js';
import { Memory } from '../../src/memory/Memory.js';

test('EncounterState: melakukan lookAt, crouch, swing arm, dan sapaan chat', async () => {
  const actions = [];
  const fakeBot = {
    pathfinder: {
      stop: () => actions.push('pathfinder.stop'),
    },
    lookAt: async (pos) => actions.push(`lookAt:${pos.x},${pos.y},${pos.z}`),
    setControlState: (state, val) => actions.push(`control:${state}:${val}`),
    swingArm: (arm) => actions.push(`swingArm:${arm}`),
    chat: (msg) => actions.push(`chat:${msg}`),
  };

  const memory = new Memory();
  const state = new EncounterState(fakeBot);

  const context = {
    sensors: {
      threat: {
        nearestPlayer: () => ({
          entity: {
            position: { x: 5, y: 64, z: 5, offset: (dx, dy, dz) => ({ x: 5 + dx, y: 64 + dy, z: 5 + dz }) },
            height: 1.6,
          },
          username: 'bot_admin',
        }),
        isFriendBot: () => true,
      },
    },
    memory,
  };

  await state.onEnter(context);

  // Verifikasi aksi yang dilakukan
  assert.ok(actions.includes('pathfinder.stop'));
  assert.ok(actions.some((a) => a.startsWith('lookAt')));
  assert.ok(actions.includes('control:sneak:true'));
  assert.ok(actions.includes('control:sneak:false'));
  assert.ok(actions.includes('swingArm:right-hand'));
  assert.ok(actions.some((a) => a.startsWith('chat:Halo rekan bot_admin')));

  // Cooldown harus tercatat
  assert.equal(memory.canEncounter('bot_admin', 60000), false);
  assert.equal(memory.canChat('bot_admin', 45000), false);
});

test('SocializingState: menghadap pemain, menggunakan gameContext, dan membersihkan pending chat', async () => {
  const chatsSent = [];
  const fakeBot = {
    health: 19,
    food: 18,
    entity: {
      position: { x: 12, y: 65, z: -30 },
    },
    entities: {
      1: {
        username: 'steve',
        name: 'steve',
        height: 1.6,
        position: { x: 14, y: 65, z: -30, offset: (dx, dy, dz) => ({ x: 14 + dx, y: 65 + dy, z: -30 + dz }) },
      },
    },
    lookAt: async () => {},
    chat: (msg) => chatsSent.push(msg),
  };

  const memory = new Memory();
  memory.recordChat('steve', 'dimana posisimu?');

  let passedContext = null;
  const mockAdvisor = {
    respondToChat: async (user, msg, ctx) => {
      passedContext = ctx;
      return `Saya di X: ${ctx.x}, Y: ${ctx.y}, Z: ${ctx.z}`;
    },
  };

  const state = new SocializingState(fakeBot, memory, mockAdvisor);
  await state.onEnter({ memory });

  // Verifikasi gameContext
  assert.ok(passedContext);
  assert.equal(passedContext.x, 12);
  assert.equal(passedContext.y, 65);
  assert.equal(passedContext.z, -30);
  assert.equal(passedContext.health, 19);

  // Verifikasi chat terkirim dan dibersihkan
  assert.equal(chatsSent.length, 1);
  assert.ok(chatsSent[0].includes('X: 12'));
  assert.equal(memory.pendingChat.length, 0);
});
