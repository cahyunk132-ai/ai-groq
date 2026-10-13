// OBSERVE + STATE PARSER: mengubah kondisi bot menjadi objek JSON ringkas untuk Groq.
import {
  AGGRESSIVE_MOBS, PASSIVE_TYPES, CROP_MAX_AGE, ORE_NAME, ORE_PRIORITY,
  HP_MAX, HP_CRITICAL_RATIO, HUNGER_LOW, HOSTILE_ENGAGE_DISTANCE,
  BLOCK_SCAN_RADIUS, BLOCK_SCAN_COUNT,
} from './constants.js';

const round1 = (n) => Math.round(n * 10) / 10;
const toPos = (v) => [Math.floor(v.x), Math.floor(v.y), Math.floor(v.z)];

/** Label niat entitas untuk prompt. */
export function intentOf(entity) {
  if (entity.type === 'player') return 'Player';
  if (entity.type === 'hostile' || AGGRESSIVE_MOBS.has(entity.name)) return 'Aggressive';
  if (PASSIVE_TYPES.has(entity.type)) return 'Passive';
  return 'Neutral';
}

/** Membaca umur tanaman dari properti blok; null jika tidak tersedia. */
export function cropAge(block) {
  try {
    const props = typeof block.getProperties === 'function' ? block.getProperties() : null;
    const age = props && props.age !== undefined ? Number(props.age) : NaN;
    return Number.isFinite(age) ? age : null;
  } catch {
    return null;
  }
}

/** Mengubah daftar entitas di sekitar menjadi array ringkas, diurutkan dari yang terdekat. */
export function summarizeEntities(bot, radius, limit = 10) {
  const me = bot.entity.position;
  const out = [];
  for (const entity of Object.values(bot.entities)) {
    if (!entity || entity.id === bot.entity.id || !entity.position) continue;
    const distance = entity.position.distanceTo(me);
    if (distance > radius) continue;
    out.push({
      id: entity.id,
      name: entity.name || entity.username || entity.type,
      intent: intentOf(entity),
      distance: round1(distance),
    });
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

/** Mengambil ID blok dari registry yang namanya cocok dengan pola. */
function blockIdsMatching(bot, pattern) {
  const byName = bot.registry?.blocksByName || {};
  return Object.values(byName)
    .filter((b) => pattern.test(b.name))
    .map((b) => b.id);
}

function findNearest(bot, ids, maxDistance, count) {
  if (!ids.length) return [];
  const positions = bot.findBlocks({ matching: ids, maxDistance, count });
  const me = bot.entity.position;
  return positions
    .map((p) => ({ pos: p, distance: p.distanceTo(me) }))
    .sort((a, b) => a.distance - b.distance);
}

/** Memindai ore, tanaman, dan farmland kosong di sekitar bot. */
export function scanBlocks(bot, radius = BLOCK_SCAN_RADIUS) {
  const maxDistance = Math.min(radius, BLOCK_SCAN_RADIUS);
  const count = BLOCK_SCAN_COUNT;
  const me = bot.entity.position;

  // Ore, diurutkan berdasarkan prioritas lalu jarak.
  const oreIds = blockIdsMatching(bot, ORE_NAME);
  const ores = findNearest(bot, oreIds, maxDistance, count)
    .map(({ pos, distance }) => {
      const block = bot.blockAt(pos);
      return { name: block?.name, pos: toPos(pos), distance: round1(distance) };
    })
    .filter((o) => o.name)
    .sort((a, b) => priorityOf(a.name) - priorityOf(b.name) || a.distance - b.distance);

  // Tanaman dan farmland.
  const cropIds = blockIdsMatching(bot, new RegExp(`^(${Object.keys(CROP_MAX_AGE).join('|')})$`));
  const crops = findNearest(bot, cropIds, maxDistance, count).map(({ pos, distance }) => {
    const block = bot.blockAt(pos);
    const maxAge = CROP_MAX_AGE[block?.name];
    const age = block ? cropAge(block) : null;
    return {
      name: block?.name,
      pos: toPos(pos),
      age,
      maxAge,
      mature: age !== null && age >= maxAge,
      distance: round1(distance),
    };
  }).filter((c) => c.name);

  const farmlandIds = blockIdsMatching(bot, /^farmland$/);
  const farmland = findNearest(bot, farmlandIds, maxDistance, count)
    .filter(({ pos }) => bot.blockAt(pos.offset(0, 1, 0))?.name === 'air')
    .map(({ pos, distance }) => ({ pos: toPos(pos), distance: round1(distance) }));

  return { ores, crops, farmland };
}

function priorityOf(name) {
  const idx = ORE_PRIORITY.findIndex((key) => name.includes(key));
  return idx === -1 ? ORE_PRIORITY.length : idx;
}

/** Ringkasan inventaris: nama, jumlah, sisa durabilitas, dan apakah item bisa dimakan. */
export function summarizeInventory(bot) {
  const foods = bot.registry?.foodsByName || {};
  return bot.inventory.items().map((item) => {
    const entry = { slot: item.slot, name: item.name, count: item.count, isFood: Boolean(foods[item.name]) };
    if (item.maxDurability) {
      entry.durability = item.maxDurability - (item.durabilityUsed || 0);
    }
    return entry;
  });
}

/** Menentukan prioritas tugas dari state (logika berbasis aturan). */
export function currentTask(state) {
  const hpRatio = state.health / state.maxHealth;
  const hostileNear = state.nearbyEntities.some(
    (e) => e.intent === 'Aggressive' && e.distance <= HOSTILE_ENGAGE_DISTANCE,
  );
  if (hpRatio < HP_CRITICAL_RATIO || hostileNear) return 'Fighting';

  const hasFood = state.inventory.some((i) => i.isFood);
  if (state.hunger < HUNGER_LOW && hasFood) return 'Eating';

  const { crops, farmland } = state.nearbyBlocks;
  if (crops.some((c) => c.mature) || farmland.length) return 'Farming';
  if (state.nearbyBlocks.ores.length) return 'Mining';
  return 'Exploring';
}

/**
 * Membangun state lengkap dari bot Mineflayer.
 * @param {object} bot instance Mineflayer
 * @param {number} radius radius sensor entitas (blok)
 */
export function buildState(bot, radius = 16) {
  const p = bot.entity.position;
  const scan = scanBlocks(bot, radius);
  const state = {
    health: bot.health ?? 0,
    maxHealth: HP_MAX,
    hunger: bot.food ?? 0,
    position: toPos(p),
    inventory: summarizeInventory(bot),
    nearbyEntities: summarizeEntities(bot, radius),
    nearbyBlocks: {
      ores: scan.ores,
      crops: scan.crops,
      farmland: scan.farmland,
    },
  };
  state.currentTaskPriority = currentTask(state);
  return state;
}

