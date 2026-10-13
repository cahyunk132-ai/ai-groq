import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDecision, parseTarget, DecisionError } from '../src/actions.js';

const state = {
  health: 10, maxHealth: 20, hunger: 15,
  inventory: [
    { name: 'iron_pickaxe', isFood: false, durability: 500 },
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

const richState = {
  ...state,
  position: [0, 64, 0],
  inventory: [
    ...state.inventory,
    { name: 'oak_planks', count: 40, isFood: false },
  ],
  nearbyResources: [
    { name: 'oak_log', count: 12, distance: 3.2 },
    { name: 'stone', count: 5, distance: 6 },
  ],
  craftable: ['wooden_pickaxe', 'stick'],
  pendingChat: [],
};

test('gather hanya untuk blok yang ada di sekitar', () => {
  const d = validateDecision({ action: 'gather', item_to_use: 'oak_log', count: 4 }, richState);
  assert.equal(d.item_to_use, 'oak_log');
  assert.equal(d.count, 4);
  assert.throws(() => validateDecision({ action: 'gather', item_to_use: 'diamond_ore' }, richState), /tidak ada/);
});

test('gather membatasi jumlah ke 1..8', () => {
  assert.equal(validateDecision({ action: 'gather', item_to_use: 'oak_log', count: 99 }, richState).count, 8);
  assert.equal(validateDecision({ action: 'gather', item_to_use: 'oak_log', count: -3 }, richState).count, 1);
});

test('craft hanya untuk item yang bisa dibuat sekarang', () => {
  const d = validateDecision({ action: 'craft', item_to_use: 'wooden_pickaxe', count: 1 }, richState);
  assert.equal(d.item_to_use, 'wooden_pickaxe');
  assert.throws(() => validateDecision({ action: 'craft', item_to_use: 'diamond_sword' }, richState), /tidak bisa dibuat/);
});

test('build butuh bahan di inventory dan struktur yang dikenal', () => {
  const d = validateDecision({ action: 'build', item_to_use: 'oak_planks', structure: 'shelter' }, richState);
  assert.equal(d.structure, 'shelter');
  assert.equal(d.target, null);
  assert.throws(() => validateDecision({ action: 'build', item_to_use: 'cobblestone' }, richState), /tidak punya/);
  assert.throws(() => validateDecision({ action: 'build', item_to_use: 'oak_planks', structure: 'castle' }, richState), /tidak dikenal/);
});

test('build menolak target yang terlalu jauh', () => {
  assert.throws(
    () => validateDecision({ action: 'build', item_to_use: 'oak_planks', target: [100, 64, 0] }, richState),
    /terlalu jauh/,
  );
});

test('idle membatasi durasi ke 2..15 detik', () => {
  assert.equal(validateDecision({ action: 'idle', seconds: 100 }, richState).seconds, 15);
  assert.equal(validateDecision({ action: 'idle' }, richState).seconds, 5);
});

test('say dipotong dan dirapikan; chat wajib punya teks', () => {
  const d = validateDecision({ action: 'explore', say: '  halo\n semua  ' }, richState);
  assert.equal(d.say, 'halo semua');
  assert.throws(() => validateDecision({ action: 'chat' }, richState), /butuh field say/);
  assert.equal(validateDecision({ action: 'chat', say: 'hai' }, richState).say, 'hai');
});

test('goal disimpan jika berupa teks', () => {
  assert.equal(validateDecision({ action: 'explore', goal: 'bangun rumah' }, richState).goal, 'bangun rumah');
  assert.equal(validateDecision({ action: 'explore', goal: 42 }, richState).goal, null);
});

test('build menolak jika bahan kurang untuk struktur', () => {
  const few = { ...richState, inventory: [{ name: 'oak_planks', count: 20, isFood: false }] };
  assert.throws(() => validateDecision({ action: 'build', item_to_use: 'oak_planks', structure: 'shelter' }, few), /butuh 31/);
  assert.equal(validateDecision({ action: 'build', item_to_use: 'oak_planks', structure: 'wall' }, few).structure, 'wall');
});

test('mine ditolak jika pickaxe hampir hancur', () => {
  const broken = { ...state, inventory: [{ name: 'iron_pickaxe', isFood: false, durability: 4 }] };
  assert.throws(() => validateDecision({ action: 'mine', target: [120, -54, 88] }, broken), /layak pakai/);
});
