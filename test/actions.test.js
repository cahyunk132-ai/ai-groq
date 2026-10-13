import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDecision, parseTarget, DecisionError } from '../src/actions.js';

const state = {
  health: 10, maxHealth: 20, hunger: 15,
  inventory: [
    { name: 'iron_sword', isFood: false },
    { name: 'baked_potato', isFood: true },
    { name: 'wheat_seeds', isFood: false },
  ],
  nearbyEntities: [
    { id: 45, name: 'zombie', intent: 'Aggressive', distance: 3 },
    { id: 48, name: 'cow', intent: 'Passive', distance: 8 },
    { id: 7, name: 'Steve', intent: 'Player', distance: 5 },
  ],
  nearbyBlocks: {
    ores: [{ name: 'diamond_ore', pos: [120, -54, 88], distance: 4 }],
    crops: [
      { name: 'wheat', pos: [10, 64, 10], mature: true },
      { name: 'wheat', pos: [11, 64, 10], mature: false },
    ],
    farmland: [{ pos: [12, 64, 10] }],
  },
};

test('menerima attack ke zombie agresif dengan id numerik atau string', () => {
  assert.equal(validateDecision({ action: 'attack', target: 45 }, state).target, 45);
  assert.equal(validateDecision({ action: 'attack', target: '45' }, state).target, 45);
});

test('menolak attack ke pemain dan mob pasif saat tidak lapar', () => {
  assert.throws(() => validateDecision({ action: 'attack', target: 7 }, state), DecisionError);
  assert.throws(() => validateDecision({ action: 'attack', target: 48 }, state), /tidak lapar/);
  const hungry = { ...state, hunger: 8 };
  assert.equal(validateDecision({ action: 'attack', target: 48 }, hungry).target, 48);
});

test('mine hanya untuk koordinat ore yang ada di state', () => {
  assert.deepEqual(validateDecision({ action: 'mine', target: [120, -54, 88] }, state).target, [120, -54, 88]);
  assert.throws(() => validateDecision({ action: 'mine', target: [1, 1, 1] }, state), /tidak ada ore/);
});

test('farm: panen tanaman matang, tolak yang belum matang, tanam di farmland jika ada bibit', () => {
  assert.deepEqual(validateDecision({ action: 'farm', target: [10, 64, 10] }, state).target, [10, 64, 10]);
  assert.throws(() => validateDecision({ action: 'farm', target: [11, 64, 10] }, state), /belum siap/);
  assert.deepEqual(validateDecision({ action: 'farm', target: [12, 64, 10] }, state).target, [12, 64, 10]);
  const noSeeds = { ...state, inventory: [] };
  assert.throws(() => validateDecision({ action: 'farm', target: [12, 64, 10] }, noSeeds), /bibit/);
});

test('eat memakai makanan dari inventory, atau makanan pertama jika item tidak disebut', () => {
  assert.equal(validateDecision({ action: 'eat', item_to_use: 'baked_potato' }, state).item_to_use, 'baked_potato');
  assert.equal(validateDecision({ action: 'eat' }, state).item_to_use, 'baked_potato');
  assert.throws(() => validateDecision({ action: 'eat', item_to_use: 'golden_apple' }, state), DecisionError);
});

test('aksi tidak dikenal dan JSON rusak ditolak', () => {
  assert.throws(() => validateDecision({ action: 'dance' }, state), /tidak dikenal/);
  assert.throws(() => validateDecision(null, state), DecisionError);
  assert.throws(() => validateDecision(['attack'], state), DecisionError);
  assert.throws(() => validateDecision({ action: 'mine', target: '120,-54,88' }, state), DecisionError);
});

test('explore dan flee tidak butuh target', () => {
  assert.equal(validateDecision({ action: 'explore' }, state).action, 'explore');
  assert.equal(validateDecision({ action: 'FLEE', target: null }, state).action, 'flee');
});

test('parseTarget menerima koordinat, id, atau null', () => {
  assert.deepEqual(parseTarget([1.7, 2, -3.2]), { pos: [1, 2, -4] });
  assert.deepEqual(parseTarget(12), { id: 12 });
  assert.equal(parseTarget(undefined), null);
  assert.throws(() => parseTarget([1, 2]), DecisionError);
});
