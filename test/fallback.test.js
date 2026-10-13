import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackDecision, chatReply } from '../src/policy.js';
import { pickAccent } from '../src/executor.js';

const base = (over = {}) => ({
  health: 20, maxHealth: 20, hunger: 20,
  inventory: [],
  nearbyEntities: [],
  nearbyBlocks: { ores: [], crops: [], farmland: [], tillable: [] },
  nearbyResources: [],
  craftable: [],
  recentActions: [],
  pendingChat: [],
  ...over,
});
const wood = [{ name: 'wooden_pickaxe', count: 1, durability: 50 }];
const stonePick = [{ name: 'stone_pickaxe', count: 1, durability: 50 }];

test('fallback: membalas chat tanpa Groq dan tetap menjalankan kegiatan', () => {
  const s = base({
    inventory: stonePick,
    pendingChat: [{ from: 'Budi', message: 'halo bot' }],
    nearbyResources: [{ name: 'oak_log', count: 3, distance: 4 }],
  });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'gather');
  assert.match(d.say, /^Halo Budi!/);
});

test('chatReply: pertanyaan dijawab dengan status, sapaan dengan salam, lainnya dengan konfirmasi', () => {
  assert.match(chatReply({ from: 'Ani', message: 'lagi ngapain?' }, 'Building'), /Ani, lagi bangun-bangun/);
  assert.match(chatReply({ from: 'Ani', message: 'pagi' }, 'Mining'), /^Halo Ani! Lagi nambang/);
  assert.equal(chatReply({ from: 'Ani', message: 'ok sip' }, 'Exploring'), 'Oke Ani, aku catat.');
});

test('fallback: setiap keputusan membawa goal untuk memori', () => {
  const d = fallbackDecision(base({ inventory: wood, nearbyResources: [{ name: 'oak_log', count: 3, distance: 4 }] }));
  assert.equal(typeof d.goal, 'string');
  assert.ok(d.goal.length > 0);
});

test('fallback: membuat pedang jika belum punya dan bisa dibuat', () => {
  const d = fallbackDecision(base({ inventory: stonePick, craftable: ['wooden_sword', 'stone_sword'] }));
  assert.equal(d.action, 'craft');
  assert.equal(d.item_to_use, 'stone_sword');
});

test('fallback: meningkatkan pickaxe kayu ke batu jika bisa dibuat', () => {
  const d = fallbackDecision(base({
    inventory: [...wood, { name: 'iron_sword', count: 1, durability: 200 }],
    craftable: ['stone_pickaxe'],
  }));
  assert.equal(d.action, 'craft');
  assert.equal(d.item_to_use, 'stone_pickaxe');
});

test('fallback: bajak tanah jika punya bibit dan cangkul, dan ada tanah kosong', () => {
  const s = base({
    inventory: [...stonePick, { name: 'iron_sword', count: 1, durability: 200 }, { name: 'wheat_seeds', count: 8 }, { name: 'stone_hoe', count: 1, durability: 50 }],
    nearbyBlocks: { ores: [], crops: [], farmland: [], tillable: [{ pos: [4, 64, 2], distance: 3 }] },
  });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'farm');
  assert.deepEqual(d.target, [4, 64, 2]);
});

test('fallback: membuat cangkul jika ada bibit tetapi belum punya cangkul', () => {
  const d = fallbackDecision(base({
    inventory: [...stonePick, { name: 'iron_sword', count: 1, durability: 200 }, { name: 'wheat_seeds', count: 8 }],
    craftable: ['wooden_hoe'],
    nearbyBlocks: { ores: [], crops: [], farmland: [], tillable: [{ pos: [4, 64, 2], distance: 3 }] },
  }));
  assert.equal(d.action, 'craft');
  assert.equal(d.item_to_use, 'wooden_hoe');
});

test('fallback: dengan pickaxe kayu, ore besi dilewati dan hanya coal yang ditambang', () => {
  const s = base({
    inventory: [...wood, { name: 'iron_sword', count: 1, durability: 200 }],
    nearbyBlocks: { ores: [{ name: 'iron_ore', pos: [1, 1, 1] }, { name: 'coal_ore', pos: [2, 2, 2] }], crops: [], farmland: [], tillable: [] },
  });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'mine');
  assert.deepEqual(d.target, [2, 2, 2]);
});

test('fallback: setelah menjelajah, bot berhenti dan menoleh (idle)', () => {
  const s = base({ inventory: [...stonePick, { name: 'iron_sword', count: 1, durability: 200 }], recentActions: [{ action: 'explore' }] });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'idle');
  assert.ok(d.seconds >= 2 && d.seconds <= 15);
});

test('fallback: keputusan build memberi tahu jenis bangunan lewat say', () => {
  const s = base({
    inventory: [...stonePick, { name: 'iron_sword', count: 1, durability: 200 }, { name: 'oak_planks', count: 80 }, { name: 'cobblestone', count: 20 }],
    nearbyResources: [{ name: 'stone', count: 5, distance: 3 }],
  });
  const d = fallbackDecision(s);
  assert.equal(d.action, 'build');
  assert.equal(d.structure, 'shelter');
  assert.match(d.say, /rumah/);
});

test('pickAccent memilih blok aksen dari inventaris, bukan blok utama dan bukan dirt', () => {
  const inv = [
    { name: 'oak_planks', count: 40 },
    { name: 'cobblestone', count: 12 },
    { name: 'dirt', count: 60 },
  ];
  assert.equal(pickAccent(inv, 'oak_planks'), 'cobblestone');
  assert.equal(pickAccent([{ name: 'oak_planks', count: 40 }], 'oak_planks'), null);
});
