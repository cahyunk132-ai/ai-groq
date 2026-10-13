// Logika penambangan yang murni (tanpa bot) agar mudah diuji.
import { MINE_REACH_DY } from './constants.js';

/** Apakah ore di `oreY` perlu dijangkau dengan tangga karena terlalu dalam dari kaki bot. */
export function needsStaircase(feetY, oreY) {
  return feetY - oreY > MINE_REACH_DY;
}

/**
 * Arah horizontal satu langkah tangga menuju ore: sumbu yang selisihnya lebih besar.
 * Jika bot tepat di atas ore, arah dipilih tetap (+x) agar tangga tidak berputar.
 * @returns {{dx:number, dz:number}}
 */
export function stairDirection(feet, ore) {
  const ddx = ore[0] - feet[0];
  const ddz = ore[2] - feet[2];
  if (ddx === 0 && ddz === 0) return { dx: 1, dz: 0 };
  if (Math.abs(ddx) >= Math.abs(ddz)) return { dx: Math.sign(ddx), dz: 0 };
  return { dx: 0, dz: Math.sign(ddz) };
}

/** Cairan atau lava: tidak boleh dibuka ke dalam terowongan. */
export function isHazardName(name) {
  return typeof name === 'string' && /(^|_)(lava|water)$/.test(name);
}
