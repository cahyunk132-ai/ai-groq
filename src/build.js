// Template bangunan. Fungsi di sini murni (tanpa bot) agar mudah diuji.
//
// Desain mengikuti pola bangunan survival yang umum: rumah kecil simetris dengan pintu
// di tengah dinding dan jendela di sisi, pilar/sudut dari blok aksen, menara dengan
// "pita" pemisah tingkat dan benteng (crenellation) di atas, serta tembok dengan pilar.
//
// Format template: array lapisan dari bawah ke atas. Setiap lapisan adalah grid baris
// string (baris = sumbu z, kolom = sumbu x). Karakter:
//   '#' blok utama (bahan yang dipilih AI / bot)
//   'A' blok aksen (pilar, sudut, pita); memakai blok lain jika tersedia, jika tidak utama
//   '.' ruang yang harus kosong (interior)
//   'D' pintu (kosong, 2 tinggi)           'W' jendela (kosong)
// Konvensi: `origin` = [x, y, z] titik acuan di pusat lapisan pertama (y origin = lapisan 0).
// Tanah pondasi ada di y - 1 dan harus padat untuk seluruh area lapisan 0.

const SHELTER_BASE = ['A###A', '#...#', '#...#', '#...#', 'A#D#A'];
const SHELTER_WINDOW = ['A###A', '#...#', 'W...W', '#...#', 'A#D#A'];
const SHELTER_UPPER = ['A###A', '#...#', '#...#', '#...#', 'A###A'];
const SHELTER_ROOF = ['A###A', '#####', '#####', '#####', 'A###A'];

const TOWER_DOOR = ['A###A', '#...#', '#...#', '#...#', 'A#D#A'];
const TOWER_WALL = ['A###A', '#...#', '#...#', '#...#', 'A###A'];
const TOWER_WINDOW = ['A###A', '#...#', 'W...W', '#...#', 'A###A'];
const TOWER_BAND = ['AAAAA', 'A...A', 'A...A', 'A...A', 'AAAAA'];
// Benteng: blok selang-seling di keliling (sudut dan tengah sisi), celah di antaranya.
const TOWER_MERLON = ['#.#.#', '.....', '#...#', '.....', '#.#.#'];

const TEMPLATES = {
  // Lantai 5x5 dengan sudut aksen.
  platform: {
    center: [2, 2],
    layers: [['A###A', '#####', '#####', '#####', 'A###A']],
  },
  // Rumah 5x5, 3 tinggi di dalam, pintu di sisi selatan (+z), jendela di sisi barat dan timur, atap datar.
  shelter: {
    center: [2, 2],
    layers: [SHELTER_BASE, SHELTER_WINDOW, SHELTER_UPPER, SHELTER_ROOF],
  },
  // Menara 5x5 setinggi 7: pintu di bawah, pita di tengah, jendela sempit, benteng di atas.
  tower: {
    center: [2, 2],
    layers: [TOWER_DOOR, TOWER_DOOR, TOWER_WINDOW, TOWER_BAND, TOWER_WINDOW, TOWER_WALL, TOWER_MERLON],
  },
  // Tembok 7 panjang, 3 tinggi, pilar tiap 3 blok, benteng di atas.
  wall: {
    center: [3, 0],
    layers: [['A##A##A'], ['A##A##A'], ['A##A##A'], ['#.#.#.#']],
  },
};

export const STRUCTURES = Object.keys(TEMPLATES);

function templateOf(structure) {
  const t = TEMPLATES[structure];
  if (!t) throw new Error(`struktur tidak dikenal: ${structure}`);
  return t;
}

/**
 * Semua sel template dalam koordinat dunia.
 * @returns {{ place: Array<{pos:number[], role:'main'|'accent'}>, clear: number[][], footprint: number[][] }}
 */
export function plan(structure, origin) {
  const { center, layers } = templateOf(structure);
  const [ox, oy, oz] = origin;
  const [cx, cz] = center;
  const place = [];
  const clear = [];
  const footprint = [];

  layers.forEach((rows, li) => {
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const pos = [ox + (c - cx), oy + li, oz + (r - cz)];
        const ch = row[c];
        if (li === 0) footprint.push([pos[0], pos[2]]);
        if (ch === '#') place.push({ pos, role: 'main' });
        else if (ch === 'A') place.push({ pos, role: 'accent' });
        else if (ch === '.' || ch === 'D' || ch === 'W') clear.push(pos);
      }
    });
  });

  // Urutan aman: bawah ke atas; di tiap lapisan blok terluar dulu, blok tengah terakhir
  // (agar setiap blok punya tumpuan saat dipasang).
  place.sort((a, b) => {
    if (a.pos[1] !== b.pos[1]) return a.pos[1] - b.pos[1];
    const da = Math.abs(a.pos[0] - ox) + Math.abs(a.pos[2] - oz);
    const db = Math.abs(b.pos[0] - ox) + Math.abs(b.pos[2] - oz);
    return db - da;
  });
  return { place, clear, footprint };
}

/** Kolom [x, z] yang butuh tanah padat di bawahnya (y - 1): seluruh area lapisan dasar. */
export function footprintOf(structure, origin) {
  return plan(structure, origin).footprint;
}

/** Sel yang harus diisi blok, diurutkan aman untuk dipasang (bawah ke atas). */
export function buildCells(structure, origin) {
  return plan(structure, origin).place.map((p) => p.pos);
}

/** Semua sel yang harus kosong (interior, pintu, jendela) di atas tanah. */
export function clearCellsOf(structure, origin) {
  return plan(structure, origin).clear;
}

/** Jumlah blok yang dibutuhkan untuk satu struktur. */
export function blocksNeeded(structure) {
  return plan(structure, [0, 0, 0]).place.length;
}

/** Arah sisi yang dicoba untuk mencari blok referensi, dengan urutan prioritas bawah dulu. */
export const FACE_DIRECTIONS = [
  [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0],
];
