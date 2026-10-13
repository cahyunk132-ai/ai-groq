import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCells, footprintOf, clearCellsOf, plan, blocksNeeded, FACE_DIRECTIONS } from '../src/build.js';
import { pickReference, isSolid } from '../src/executor.js';

const ORIGIN = [0, 64, 0];

test('platform: lantai 5x5 di level origin, sudut berupa blok aksen', () => {
  const p = plan('platform', ORIGIN);
  assert.equal(p.place.length, 25);
  assert.ok(p.place.every(({ pos }) => pos[1] === 64));
  assert.equal(p.place.filter((x) => x.role === 'accent').length, 4);
  assert.equal(footprintOf('platform', ORIGIN).length, 25);
});

test('jumlah blok sesuai desain: platform 25, shelter 69, tower 98, wall 25', () => {
  assert.equal(blocksNeeded('platform'), 25);
  assert.equal(blocksNeeded('shelter'), 69);
  assert.equal(blocksNeeded('tower'), 98);
  assert.equal(blocksNeeded('wall'), 25);
});

test('shelter: pintu dan jendela kosong, interior kosong, atap di y+3', () => {
  const cells = buildCells('shelter', ORIGIN);
  const clear = clearCellsOf('shelter', ORIGIN);
  // Pintu di tengah sisi +z (selatan) pada dua lapisan bawah harus kosong.
  assert.ok(!cells.some(([x, y, z]) => x === 0 && z === 2 && (y === 64 || y === 65)));
  assert.ok(clear.some(([x, y, z]) => x === 0 && z === 2 && y === 64));
  // Jendela di sisi barat dan timur pada lapisan kedua.
  assert.ok(clear.some(([x, y, z]) => x === -2 && z === 0 && y === 65));
  assert.ok(clear.some(([x, y, z]) => x === 2 && z === 0 && y === 65));
  // Interior 3x3 kosong di tiga lapisan bawah.
  assert.ok(clear.some(([x, y, z]) => x === 0 && z === 0 && y === 66));
  // Atap di y+3 berisi 25 blok.
  assert.equal(cells.filter(([, y]) => y === 67).length, 25);
});

test('tower: 7 tinggi, pita di y+3, benteng di y+6 berselang-seling', () => {
  const p = plan('tower', ORIGIN);
  const top = p.place.filter(({ pos }) => pos[1] === 70).map(({ pos }) => pos);
  assert.equal(top.length, 8); // 8 blok benteng
  // Tidak ada dua blok benteng bersebelahan di keliling.
  assert.ok(!top.some(([x, , z]) => top.some(([x2, , z2]) => Math.abs(x - x2) + Math.abs(z - z2) === 1)));
  const band = p.place.filter(({ pos }) => pos[1] === 67);
  assert.ok(band.every((x) => x.role === 'accent'), 'pita memakai blok aksen');
});

test('wall: panjang 7, pilar setiap 3 blok, benteng di atas', () => {
  const p = plan('wall', ORIGIN);
  assert.equal(footprintOf('wall', ORIGIN).length, 7);
  const pillars = p.place.filter(({ pos, role }) => pos[1] === 64 && role === 'accent');
  assert.ok(pillars.length >= 2);
  assert.equal(p.place.filter(({ pos }) => pos[1] === 67).length, 4);
});

test('urutan pemasangan dari bawah ke atas', () => {
  for (const s of ['shelter', 'tower', 'wall', 'platform']) {
    const cells = buildCells(s, ORIGIN);
    for (let i = 1; i < cells.length; i++) {
      assert.ok(cells[i][1] >= cells[i - 1][1], `${s}: urut berdasarkan y`);
    }
  }
});

test('struktur tidak dikenal ditolak', () => {
  assert.throws(() => buildCells('castle', [0, 0, 0]), /tidak dikenal/);
});

test('pickReference memilih blok padat dan memberi vektor sisi yang benar', () => {
  const world = { '10,63,10': { name: 'grass_block' } };
  const getBlock = (c) => world[c.join(',')] ?? { name: 'air' };
  const ref = pickReference(getBlock, [10, 64, 10]);
  assert.equal(ref.block.name, 'grass_block');
  assert.deepEqual(ref.face, [0, 1, 0]); // dari referensi di bawah, menghadap ke atas
});

test('pickReference mengembalikan null jika tidak ada tumpuan', () => {
  assert.equal(pickReference(() => ({ name: 'air' }), [0, 0, 0]), null);
});

test('isSolid menolak udara dan cairan', () => {
  assert.equal(isSolid({ name: 'air' }), false);
  assert.equal(isSolid({ name: 'water' }), false);
  assert.equal(isSolid(null), false);
  assert.equal(isSolid({ name: 'stone' }), true);
  assert.equal(FACE_DIRECTIONS.length, 6);
});
