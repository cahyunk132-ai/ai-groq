// Template bangunan sederhana. Fungsi di sini murni (tanpa bot) agar mudah diuji.

export const STRUCTURES = ['platform', 'shelter'];

/**
 * Daftar sel [x, y, z] yang akan diisi blok, dengan urutan pemasangan yang aman
 * (bawah ke atas, dan sel tepi sebelum sel tengah atap).
 *
 * origin adalah posisi berdiri di tengah bangunan (satu blok di atas lantai).
 * - platform: lantai 3x3 di bawah origin.
 * - shelter: dinding 3x3 setinggi 3 blok (dengan pintu 2 blok di sisi -Z) dan atap 3x3.
 */
export function buildCells(structure, origin) {
  const [ox, oy, oz] = origin;
  const cells = [];

  if (structure === 'platform') {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        cells.push([ox + dx, oy - 1, oz + dz]);
      }
    }
  } else if (structure === 'shelter') {
    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const onRing = Math.abs(dx) === 1 || Math.abs(dz) === 1;
          if (!onRing) continue;
          const isDoor = dx === 0 && dz === -1 && dy <= 1;
          if (isDoor) continue;
          cells.push([ox + dx, oy + dy, oz + dz]);
        }
      }
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        cells.push([ox + dx, oy + 3, oz + dz]);
      }
    }
  } else {
    throw new Error(`struktur tidak dikenal: ${structure}`);
  }

  // Urutkan: bawah dulu; di tiap lapisan, sel tepi (|dx|+|dz| besar) dulu, sel tengah terakhir.
  return cells.sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1];
    const da = Math.abs(a[0] - ox) + Math.abs(a[2] - oz);
    const db = Math.abs(b[0] - ox) + Math.abs(b[2] - oz);
    return db - da;
  });
}

/** Arah sisi yang dicoba untuk mencari blok referensi, dengan urutan prioritas bawah dulu. */
export const FACE_DIRECTIONS = [
  [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0],
];
