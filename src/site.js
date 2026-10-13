// Pemilihan lokasi bangunan. Murni: menerima getBlock(x, y, z) dan mengembalikan blok atau null.
import { footprintOf, buildCells } from './build.js';

const AIR_LIKE = new Set(['air', 'cave_air', 'void_air']);
// Tanah yang tidak boleh dijadikan pondasi.
const BLOCKED_GROUND = new Set([
  'water', 'lava', 'farmland', 'wheat', 'carrots', 'potatoes', 'beetroots', 'cactus', 'bedrock',
]);

/** Apakah origin ini bisa dibangun: pondasi padat dan rata, dan semua sel bangunan kosong. */
export function isValidSite(getBlock, origin, structure, from) {
  const [ox, oy, oz] = origin;

  for (const [x, z] of footprintOf(structure, origin)) {
    const ground = getBlock(x, oy - 1, z);
    if (!ground || BLOCKED_GROUND.has(ground.name) || AIR_LIKE.has(ground.name)) return false;
  }

  const cells = buildCells(structure, origin);
  for (const [x, y, z] of cells) {
    // Jangan membangun di atas posisi bot sendiri.
    if (from && x === from[0] && z === from[2] && (y === from[1] || y === from[1] + 1)) return false;
    const block = getBlock(x, y, z);
    if (!block || !AIR_LIKE.has(block.name)) return false;
  }
  return true;
}

/**
 * Mencari lokasi terbaik di sekitar `from`.
 * Lokasi diutamakan dekat `anchor` (bangunan terakhir) jika ada, jika tidak dekat `from`.
 * @returns {number[] | null} origin [x, y, z] atau null jika tidak ada lokasi cocok.
 */
export function findSite({ getBlock, from, structure, anchor = null, radius = 10 }) {
  const [fx, fy, fz] = from.map(Math.floor);
  const center = anchor ?? [fx, fy, fz];
  let best = null;
  let bestScore = Infinity;

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        const origin = [fx + dx, fy + dy, fz + dz];
        if (!isValidSite(getBlock, origin, structure, [fx, fy, fz])) continue;
        // Skor: jarak ke pusat (anchor), sedikit dihukum jika harus naik/turun.
        const score = Math.hypot(origin[0] - center[0], origin[2] - center[2]) + Math.abs(dy) * 2;
        if (score < bestScore) {
          bestScore = score;
          best = origin;
        }
      }
    }
  }
  return best;
}
