import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTransitions } from '../../src/fsm/transitions.js';

test('buildTransitions evaluates conditions correctly based on priorities', () => {
  const transitions = buildTransitions();

  // Test P1: HP critical + hostile close
  const p1 = transitions.find((t) => t.priority === 1);
  assert.ok(p1);
  assert.equal(
    p1.condition({
      sensors: {
        self: { hpRatio: 0.2 },
        threat: { nearestHostile: (d) => (d >= 4 ? { name: 'zombie' } : null) },
      },
    }),
    true
  );

  // Not P1 if HP healthy
  assert.equal(
    p1.condition({
      sensors: {
        self: { hpRatio: 0.8 },
        threat: { nearestHostile: () => ({ name: 'zombie' }) },
      },
    }),
    false
  );

  // Test P2: HP critical + has food + no hostile close
  const p2 = transitions.find((t) => t.priority === 2);
  assert.ok(p2);
  assert.equal(
    p2.condition({
      sensors: {
        self: { hpRatio: 0.2, hasFood: true },
        threat: { nearestHostile: () => null },
      },
    }),
    true
  );

  // Test P4: hunger < 14 and has food
  const p4 = transitions.find((t) => t.priority === 4);
  assert.ok(p4);
  assert.equal(
    p4.condition({
      sensors: {
        self: { hunger: 10, hasFood: true },
      },
    }),
    true
  );

  // Test P5: inventory full
  const p5 = transitions.find((t) => t.priority === 5);
  assert.ok(p5);
  assert.equal(
    p5.condition({
      sensors: {
        self: { inventoryFull: true },
      },
    }),
    true
  );

  // Test P6: needs essential tool
  const p6 = transitions.find((t) => t.priority === 6);
  assert.ok(p6);
  assert.equal(
    p6.condition({
      sensors: {
        self: { needsEssentialTool: true },
      },
    }),
    true
  );

  // Test P7.5: encounter
  const p75 = transitions.find((t) => t.priority === 7.5);
  assert.ok(p75);
  assert.equal(
    p75.condition({
      sensors: {
        threat: { nearestPlayer: () => ({ username: 'bot_admin' }) },
      },
      memory: { canEncounter: () => true },
    }),
    true
  );
  assert.equal(
    p75.condition({
      sensors: {
        threat: { nearestPlayer: () => ({ username: 'bot_admin' }) },
      },
      memory: { canEncounter: () => false },
    }),
    false
  );

  // Test P8: pending chat
  const p8 = transitions.find((t) => t.priority === 8);
  assert.ok(p8);
  assert.equal(
    p8.condition({
      memory: { pendingChat: [{ from: 'steve', message: 'Halo' }] },
    }),
    true
  );
  // Array kosong tidak boleh memicu socializing
  assert.equal(
    p8.condition({
      memory: { pendingChat: [] },
    }),
    false
  );
});
