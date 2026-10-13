// Konstanta game dan ambang batas keputusan OmniBot.

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

// Prioritas ancaman mob (angka lebih besar = bahaya lebih tinggi)
export const THREAT_PRIORITY = {
  creeper: 10,
  skeleton: 8,
  witch: 7,
  blaze: 7,
  vindicator: 7,
  phantom: 6,
  pillager: 6,
  spider: 5,
  cave_spider: 5,
  zombie: 4,
  drowned: 4,
  husk: 4,
  zombified_piglin: 4,
  enderman: 3,
  slime: 2,
  magma_cube: 2,
};

// Urutan prioritas ore (lebih tinggi = lebih berharga).
export const ORE_PRIORITY = [
  'ancient_debris', 'diamond', 'emerald', 'gold', 'iron',
  'lapis', 'redstone', 'copper', 'coal',
];

// Y-level optimal untuk menambang ore tertentu
export const OPTIMAL_MINING_Y = {
  ancient_debris: -15,
  diamond: -59,
  emerald: 100,
  gold: -16,
  iron: 16,
  lapis: 0,
  redstone: -59,
  copper: 48,
  coal: 96,
};

// Makanan untuk breeding hewan
export const BREED_FOOD = {
  cow: ['wheat'],
  sheep: ['wheat'],
  pig: ['carrot', 'potato', 'beetroot'],
  chicken: ['wheat_seeds', 'beetroot_seeds', 'melon_seeds', 'pumpkin_seeds'],
  rabbit: ['carrot', 'golden_carrot', 'dandelion'],
};

// Batas populasi ternak
export const MAX_ANIMAL_POPULATION = {
  cow: 10,
  sheep: 10,
  pig: 8,
  chicken: 12,
  rabbit: 6,
};

export const ORE_NAME = /_ore$|^ancient_debris$/;
export const RESOURCE_NAME = /(_log|_wood)$|^(stone|cobblestone|sand|gravel|dirt|clay)$/;
export const LOG_NAME = /(_log|_wood)$/;
export const BUILD_MATERIAL_NAME = /(_planks|^cobblestone$|^dirt$|^stone$)/;
export const BUILD_MATERIAL_MIN = 31;

export const CRAFT_CANDIDATES = [
  'crafting_table', 'stick', 'torch', 'chest', 'furnace', 'bread', 'shears', 'shield',
  'wooden_pickaxe', 'wooden_axe', 'wooden_shovel', 'wooden_sword',
  'stone_pickaxe', 'stone_axe', 'stone_shovel', 'stone_sword',
  'iron_pickaxe', 'iron_axe', 'iron_shovel', 'iron_sword',
  'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks',
  'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks',
];

export const HP_MAX = 20;
export const HP_CRITICAL_RATIO = 0.3;     // di bawah 30% => kondisi kritis
export const HUNGER_LOW = 14;             // di bawah 14/20 => lapar
export const HOSTILE_ENGAGE_DISTANCE = 10;
export const HOSTILE_FLEE_DISTANCE = 4;
export const BLOCK_SCAN_RADIUS = 8;
export const BLOCK_SCAN_COUNT = 12;
export const RESOURCE_SCAN_RADIUS = 16;
export const RESOURCE_SCAN_COUNT = 64;

export const TORCH_LIGHT_THRESHOLD = 7;

/** Jenis alat yang dibutuhkan untuk menggali sebuah blok, atau null jika tidak perlu. */
export function toolKindFor(blockName) {
  if (/(_log|_wood|_planks|_stem|crafting_table|chest|_fence)$/.test(blockName)) return 'axe';
  if (/(stone|cobble|_ore|deepslate|brick|obsidian|andesite|diorite|granite|tuff|furnace|netherrack|terracotta|concrete)/.test(blockName)) return 'pickaxe';
  if (/^(dirt|grass_block|sand|gravel|clay|snow|soul_sand|podzol|mycelium|farmland|coarse_dirt|rooted_dirt)$/.test(blockName)) return 'shovel';
  return null;
}
