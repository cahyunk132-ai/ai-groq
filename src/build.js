// Template bangunan. Fungsi di sini murni (tanpa bot) agar mudah diuji.
//
// Konvensi: `origin` = [x, y, z] posisi berdiri di dalam/di pusat bangunan.
// Sel bangunan dimulai dari y origin ke atas. Tanah pondasi ada di y - 1.

export const STRUCTURES = ['platform', 'shelter', 'tower', 'wall'];

/** Kolom [x, z] yang butuh tanah padat di bawahnya (y - 1). */
export function footprintOf(structure, [ox, , oz]) {
  if (structure === 'wall') {
    return [-2, -1, 0, 1, 2].map((dx) => [ox + dx, oz]);
  }
  const cols = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) cols.push([ox + dx, oz + dz]);
  }
  return cols;
}

/** Sel dinding (cincin 3x3 tanpa tengah) untuk satu lapisan, dengan pintu di sisi -Z. */
function ringWithDoor(ox, y, oz, withDoor) {
  const cells = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const onRing = Math.abs(dx) === 1 || Math.abs(dz) === 1;
      if (!onRing) continue;
      if (withDoor && dx === 0 && dz === -1) continue;
      cells.push([ox + dx, y, oz + dz]);
    }
  }
  return cells;
}

function roof3x3(ox, y, oz) {
  const cells = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) cells.push([ox + dx, y, oz + dz]);
  }
  return cells;
}

/**
 * Semua sel yang harus diisi blok, diurutkan aman untuk dipasang
 * (bawah ke atas; di tiap lapisan sisi luar dulu, bagian tengah terakhir).
 */
export function buildCells(structure, origin) {
  const [ox, oy, oz] = origin;
  let cells;

  if (structure === 'platform') {
    cells = roof3x3(ox, oy, oz);
  } else if (structure === 'shelter') {
    // Dinding 3 tinggi dengan pintu 2 tinggi, lalu atap.
    cells = [];
    for (let dy = 0; dy <= 2; dy++) cells.push(...ringWithDoor(ox, oy + dy, oz, dy <= 1));
    cells.push(...roof3x3(ox, oy + 3, oz));
  } else if (structure === 'tower') {
    // Menara 5 tinggi dengan pintu, lalu atap.
    cells = [];
    for (let dy = 0; dy <= 4; dy++) cells.push(...ringWithDoor(ox, oy + dy, oz, dy <= 1));
    cells.push(...roof3x3(ox, oy + 5, oz));
  } else if (structure === 'wall') {
    // Dinding lurus 5 blok, 2 tinggi.
    cells = [];
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) cells.push([ox + dx, oy + dy, oz]);
    }
  } else {
    throw new Error(`struktur tidak dikenal: ${structure}`);
  }

  return cells.sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1];
    const da = Math.abs(a[0] - ox) + Math.abs(a[2] - oz);
    const db = Math.abs(b[0] - ox) + Math.abs(b[2] - oz);
    return db - da;
  });
}

/** Jumlah blok yang dibutuhkan untuk satu struktur. */
export function blocksNeeded(structure) {
  return buildCells(structure, [0, 0, 0]).length;
}

/** Arah sisi yang dicoba untuk mencari blok referensi, dengan urutan prioritas bawah dulu. */
export const FACE_DIRECTIONS = [
  [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0],
];
