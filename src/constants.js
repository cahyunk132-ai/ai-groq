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

// Blok yang bisa dikumpulkan (dipakai untuk kayu dan bahan bangunan dasar).
export const RESOURCE_NAME = /(_log|_wood)$|^(stone|cobblestone|sand|gravel|dirt|clay)$/;
export const LOG_NAME = /(_log|_wood)$/;

// Item yang dianggap bahan bangunan (dipakai untuk memutuskan kapan membangun).
export const BUILD_MATERIAL_NAME = /(_planks|^cobblestone$|^dirt$|^stone$)/;
// Blok aksen (pilar/sudut) yang diambil dari inventaris selain blok utama.
export const ACCENT_NAME = /(_planks|^cobblestone$|^stone$)/;
export const BUILD_MATERIAL_MIN = 25; // cukup untuk satu platform 5x5

// Item yang dicoba dibuat oleh bot. Hanya yang bisa dibuat sekarang yang dikirim ke Groq.
export const CRAFT_CANDIDATES = [
  'crafting_table', 'stick', 'torch', 'chest', 'furnace', 'bread', 'shears',
  'wooden_pickaxe', 'wooden_axe', 'wooden_shovel', 'wooden_sword', 'wooden_hoe',
  'stone_pickaxe', 'stone_axe', 'stone_shovel', 'stone_sword', 'stone_hoe',
  'iron_pickaxe', 'iron_axe', 'iron_shovel', 'iron_sword',
  'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks',
  'dark_oak_planks', 'mangrove_planks', 'cherry_planks', 'bamboo_planks',
];

// Tanah yang bisa dicangkul menjadi farmland (perlu cangkul dan bibit).
export const TILLABLE_NAME = /^(dirt|grass_block)$/;

export const MIN_TOOL_DURABILITY = 10; // alat di bawah ini dianggap hampir hancur
export const HP_MAX = 20;
export const HP_CRITICAL_RATIO = 0.3;     // di bawah 30% => kondisi kritis
export const HUNGER_LOW = 14;             // di bawah 14/20 => lapar
export const HOSTILE_ENGAGE_DISTANCE = 10;
export const HOSTILE_FLEE_DISTANCE = 4;
export const BLOCK_SCAN_RADIUS = 8;
export const BLOCK_SCAN_COUNT = 12;
export const RESOURCE_SCAN_RADIUS = 16;
export const RESOURCE_SCAN_COUNT = 64;

/** Jenis alat yang dibutuhkan untuk menggali sebuah blok, atau null jika tidak perlu. */
export function toolKindFor(blockName) {
  if (/(_log|_wood|_planks|_stem|crafting_table|chest|_fence)$/.test(blockName)) return 'axe';
  if (/(stone|cobble|_ore|deepslate|brick|obsidian|andesite|diorite|granite|tuff|furnace|netherrack|terracotta|concrete)/.test(blockName)) return 'pickaxe';
  if (/^(dirt|grass_block|sand|gravel|clay|snow|soul_sand|podzol|mycelium|farmland|coarse_dirt|rooted_dirt)$/.test(blockName)) return 'shovel';
  return null;
}

// Penambangan: ore dalam jangkauan ini (blok dari telapak kaki bot) ditambang langsung.
// Ore lebih dalam dicapai dengan tangga menurun, bukan lubang vertikal.
export const MINE_REACH_DY = 2;
// Ore lebih dalam dari ini (blok dari kaki bot) tidak diambil.
export const MINE_MAX_DEPTH = 12;
