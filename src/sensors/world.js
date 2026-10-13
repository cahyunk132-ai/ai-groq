import {
  CROP_MAX_AGE,
  ORE_NAME,
  ORE_PRIORITY,
  RESOURCE_NAME,
  BLOCK_SCAN_RADIUS,
  BLOCK_SCAN_COUNT,
  RESOURCE_SCAN_RADIUS,
  RESOURCE_SCAN_COUNT,
  TORCH_LIGHT_THRESHOLD,
} from '../constants.js';

const round1 = (n) => Math.round(n * 10) / 10;
const toPos = (v) => [Math.floor(v.x), Math.floor(v.y), Math.floor(v.z)];

function priorityOf(name) {
  const idx = ORE_PRIORITY.findIndex((key) => name.includes(key));
  return idx === -1 ? ORE_PRIORITY.length : idx;
}

export function cropAge(block) {
  try {
    const props = typeof block.getProperties === 'function' ? block.getProperties() : null;
    const age = props && props.age !== undefined ? Number(props.age) : NaN;
    return Number.isFinite(age) ? age : null;
  } catch {
    return null;
  }
}

/**
 * Sensor lingkungan dunia: memindai blok ore, tanaman, sumber daya, tingkat cahaya, dan bahaya.
 */
export class WorldSensor {
  constructor(bot) {
    this.bot = bot;
    this.ores = [];
    this.crops = [];
    this.farmland = [];
    this.resources = [];
    this.hazards = [];
    this.lightLevel = 15;
  }

  /**
   * Mengambil ID blok dari registry yang cocok dengan pola regex.
   */
  blockIdsMatching(pattern) {
    const byName = this.bot.registry?.blocksByName || {};
    return Object.values(byName)
      .filter((b) => pattern.test(b.name))
      .map((b) => b.id);
  }

  /**
   * Menemukan posisi blok terdekat yang cocok dengan IDs.
   */
  findNearest(ids, maxDistance, count) {
    if (!ids.length || typeof this.bot.findBlocks !== 'function') return [];
    try {
      const positions = this.bot.findBlocks({ matching: ids, maxDistance, count });
      const me = this.bot.entity?.position;
      if (!me) return [];
      return positions
        .map((p) => ({ pos: p, distance: p.distanceTo(me) }))
        .sort((a, b) => a.distance - b.distance);
    } catch {
      return [];
    }
  }

  update(radius = BLOCK_SCAN_RADIUS) {
    const me = this.bot.entity?.position;
    if (!me) return;

    // 1. Light level pada posisi bot
    const currentBlock = typeof this.bot.blockAt === 'function' ? this.bot.blockAt(me) : null;
    this.lightLevel = currentBlock?.light ?? 15;

    // 2. Scan Ore
    const oreIds = this.blockIdsMatching(ORE_NAME);
    this.ores = this.findNearest(oreIds, radius, BLOCK_SCAN_COUNT)
      .map(({ pos, distance }) => {
        const block = this.bot.blockAt(pos);
        return { name: block?.name, pos: toPos(pos), distance: round1(distance) };
      })
      .filter((o) => o.name)
      .sort((a, b) => priorityOf(a.name) - priorityOf(b.name) || a.distance - b.distance);

    // 3. Scan Tanaman
    const cropPattern = new RegExp(`^(${Object.keys(CROP_MAX_AGE).join('|')})$`);
    const cropIds = this.blockIdsMatching(cropPattern);
    this.crops = this.findNearest(cropIds, radius, BLOCK_SCAN_COUNT)
      .map(({ pos, distance }) => {
        const block = this.bot.blockAt(pos);
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
      })
      .filter((c) => c.name);

    // 4. Scan Farmland
    const farmlandIds = this.blockIdsMatching(/^farmland$/);
    this.farmland = this.findNearest(farmlandIds, radius, BLOCK_SCAN_COUNT)
      .map(({ pos, distance }) => {
        const block = this.bot.blockAt(pos);
        return { name: block?.name, pos: toPos(pos), distance: round1(distance) };
      })
      .filter((f) => f.name);

    // 5. Scan Resources (kayu, batu, pasir, dll)
    const resIds = this.blockIdsMatching(RESOURCE_NAME);
    this.resources = this.findNearest(resIds, RESOURCE_SCAN_RADIUS, RESOURCE_SCAN_COUNT)
      .map(({ pos, distance }) => {
        const block = this.bot.blockAt(pos);
        return { name: block?.name, pos: toPos(pos), distance: round1(distance) };
      })
      .filter((r) => r.name);

    // 6. Scan Hazards (lava, air dalam)
    const hazardIds = this.blockIdsMatching(/^(lava|flowing_lava)$/);
    this.hazards = this.findNearest(hazardIds, 6, 8)
      .map(({ pos, distance }) => ({
        type: 'lava',
        pos: toPos(pos),
        distance: round1(distance),
      }));
  }

  /**
   * Cek apakah lokasi bot membutuhkan obor.
   */
  needsTorch() {
    return this.lightLevel <= TORCH_LIGHT_THRESHOLD;
  }
}
