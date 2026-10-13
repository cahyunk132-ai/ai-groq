// Konstanta game dan ambang batas keputusan.

// Usia maksimum tanaman (saat siap panen) per jenis blok.
export const CROP_MAX_AGE = {
  wheat: 7,
  carrots: 7,
  potatoes: 7,
  beetroots: 3,
};

// Item bibit/benih yang dipakai untuk menanam setiap jenis tanaman.
export const SEED_ITEMS = ['wheat_seeds', 'beetroot_seeds', 'carrot', 'potato'];

// Mob yang diperlakukan sebagai agresif walaupun tipenya "mob".
export const AGGRESSIVE_MOBS = new Set([
  'slime', 'magma_cube', 'ghast', 'phantom', 'shulker', 'ender_dragon', 'blaze',
]);

// Tipe entitas dari minecraft-data yang termasuk mob pasif.
export const PASSIVE_TYPES = new Set(['animal', 'passive', 'water_creature', 'ambient']);

// Urutan prioritas ore (lebih tinggi = lebih berharga).
export const ORE_PRIORITY = [
  'ancient_debris', 'diamond', 'emerald', 'gold', 'iron',
  'lapis', 'redstone', 'copper', 'coal',
];

export const ORE_NAME = /_ore$|^ancient_debris$/;
export const HP_MAX = 20;
export const HP_CRITICAL_RATIO = 0.3;     // di bawah 30% => kondisi kritis
export const HUNGER_LOW = 14;             // di bawah 14/20 => lapar
export const HOSTILE_ENGAGE_DISTANCE = 10;
export const HOSTILE_FLEE_DISTANCE = 4;
export const BLOCK_SCAN_RADIUS = 8;
export const BLOCK_SCAN_COUNT = 12;
