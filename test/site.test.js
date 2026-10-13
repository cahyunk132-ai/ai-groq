import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSite, isValidSite } from '../src/site.js';

/** Dunia sederhana: tanah padat di y=63 untuk x,z dalam rentang, udara di atasnya. */
function flatWorld({ minX = -20, maxX = 20, minZ = -20, maxZ = 20, overrides = {} } = {}) {
  return (x, y, z) => {
    const key = `${x},${y},${z}`;
    if (key in overrides) return { name: overrides[key] };
    if (x < minX || x > maxX || z < minZ || z > maxZ) return { name: 'air' };
    if (y === 63) return { name: 'grass_block' };
    return { name: 'air' };
  };
}

test('lahan datar: platform dan shelter ditemukan dekat bot', () => {
  const getBlock = flatWorld();
  const origin = findSite({ getBlock, from: [0, 64, 0], structure: 'shelter' });
  assert.ok(origin, 'harus ada lokasi');
  assert.equal(origin[1], 64); // berdiri di atas tanah y=63
  assert.ok(Math.abs(origin[0]) <= 10 && Math.abs(origin[2]) <= 10);
});

test('air di pondasi membuat lokasi tidak valid', () => {
  const getBlock = flatWorld({ overrides: { '0,63,0': 'water', '1,63,1': 'water' } });
  assert.equal(isValidSite(getBlock, [0, 64, 0], 'platform', [99, 64, 99]), false);
});

test('tanah tidak rata (pondasi di level berbeda) tidak valid', () => {
  // Tanah di y=63 kecuali satu kolom di y=62 (lubang).
  const getBlock = flatWorld({ overrides: { '1,63,0': 'air', '1,62,0': 'grass_block' } });
  assert.equal(isValidSite(getBlock, [0, 64, 0], 'platform', [99, 64, 99]), false);
});

test('ruang bangunan yang terhalang blok tidak valid', () => {
  const getBlock = flatWorld({ overrides: { '1,64,1': 'oak_log' } }); // sudut dinding
  assert.equal(isValidSite(getBlock, [0, 64, 0], 'shelter', [99, 64, 99]), false);
});

test('lokasi bot sendiri tidak boleh dipakai untuk bangunan', () => {
  const getBlock = flatWorld();
  assert.equal(isValidSite(getBlock, [0, 64, 0], 'platform', [0, 64, 0]), false);
});

test('anchor membuat lokasi berikutnya dekat bangunan sebelumnya', () => {
  const getBlock = flatWorld();
  const near = findSite({ getBlock, from: [0, 64, 0], structure: 'platform', anchor: [8, 64, 0] });
  assert.ok(near);
  assert.ok(Math.abs(near[0] - 8) <= 2, `dekat anchor, dapat ${near}`);
});

test('tidak ada lahan cocok mengembalikan null', () => {
  const getBlock = () => ({ name: 'water' });
  assert.equal(findSite({ getBlock, from: [0, 64, 0], structure: 'platform' }), null);
});
