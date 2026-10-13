import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCells, FACE_DIRECTIONS } from '../src/build.js';
import { pickReference, isSolid } from '../src/executor.js';

test('platform: lantai 3x3 di bawah origin', () => {
  const cells = buildCells('platform', [10, 64, 10]);
  assert.equal(cells.length, 9);
  assert.ok(cells.every(([, y]) => y === 63));
});

test('shelter: 31 blok (dinding dengan pintu, atap 3x3)', () => {
  const cells = buildCells('shelter', [0, 64, 0]);
  assert.equal(cells.length, 31);
  // Pintu di sisi -Z pada dua lapisan bawah harus kosong.
  assert.ok(!cells.some(([x, y, z]) => x === 0 && z === -1 && (y === 64 || y === 65)));
  // Atap ada di y+3.
  assert.equal(cells.filter(([, y]) => y === 67).length, 9);
});

test('urutan pemasangan dari bawah ke atas, dan atap tengah terakhir', () => {
  const cells = buildCells('shelter', [0, 64, 0]);
  for (let i = 1; i < cells.length; i++) {
    assert.ok(cells[i][1] >= cells[i - 1][1], 'urut berdasarkan y');
  }
  const last = cells[cells.length - 1];
  assert.deepEqual(last, [0, 67, 0]);
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
