import { Vec3 } from 'vec3';
import { OPTIMAL_MINING_Y, TORCH_LIGHT_THRESHOLD } from '../constants.js';

/**
 * Handler penambangan cerdas:
 * - Strip mining terarah (tunnel 1x2)
 * - Deteksi bahaya (lava, gravel gantung)
 * - Pemasangan obor otomatis berdasarkan tingkat cahaya dan interval
 * - Pemilihan pickaxe terbaik
 */
export class MiningHandler {
  constructor(bot, { log = console.log } = {}) {
    this.bot = bot;
    this.log = log;
    this.blocksMinedSinceTorch = 0;
  }

  /**
   * Menggali blok spesifik pada koordinat tertentu.
   * @param {Vec3|number[]} pos
   */
  async mineBlockAt(pos) {
    const p = Array.isArray(pos) ? new Vec3(pos[0], pos[1], pos[2]) : pos;
    const block = this.bot.blockAt(p);
    if (!block || block.name === 'air') return false;

    await this.equipBestPickaxe();

    // Pastikan bot mendekat jika di luar jangkauan (> 4.5 blok)
    const dist = this.bot.entity.position.distanceTo(p);
    if (dist > 4.5 && this.bot.pathfinder) {
      const { goals } = await import('mineflayer-pathfinder');
      try {
        await this.bot.pathfinder.goto(new goals.GoalLookAtBlock(p, this.bot.world));
      } catch {}
    }

    try {
      await this.bot.dig(block);
      this.blocksMinedSinceTorch++;
      return true;
    } catch (err) {
      this.log(`[mining] Gagal menambang di ${p}: ${err.message}`);
      return false;
    }
  }

  /**
   * Menjalankan satu langkah strip mining ke arah tertentu.
   * Membuat terowongan 1x2 (ketinggian mata dan kaki bot).
   * @param {Vec3} [direction] - Vektor arah horisontal (default: arah hadap bot)
   */
  async stripMineStep(direction = null) {
    const bot = this.bot;
    const myPos = bot.entity.position.floored();

    let dir = direction;
    if (!dir) {
      const yaw = bot.entity.yaw;
      // Normalisasi arah ke mata angin (N, S, E, W)
      const dx = -Math.sin(yaw);
      const dz = -Math.cos(yaw);
      if (Math.abs(dx) > Math.abs(dz)) {
        dir = new Vec3(dx > 0 ? 1 : -1, 0, 0);
      } else {
        dir = new Vec3(0, 0, dz > 0 ? 1 : -1);
      }
    }

    const headPos = myPos.plus(dir).offset(0, 1, 0);
    const footPos = myPos.plus(dir);

    // Cek bahaya sebelum menggali
    const hazard = this.detectHazard(headPos, footPos);
    if (hazard) {
      this.log(`[mining] Terdeteksi bahaya: ${hazard.type} di ${hazard.pos}`);
      return { blocked: true, hazard };
    }

    // Gali blok atas (mata) lalu blok bawah (kaki)
    const headBlock = bot.blockAt(headPos);
    if (headBlock && headBlock.name !== 'air') {
      await this.mineBlockAt(headPos);
    }

    const footBlock = bot.blockAt(footPos);
    if (footBlock && footBlock.name !== 'air') {
      await this.mineBlockAt(footPos);
    }

    // Cek apakah perlu pasang obor
    const currentLight = bot.blockAt(myPos)?.light ?? 15;
    if (currentLight <= TORCH_LIGHT_THRESHOLD || this.blocksMinedSinceTorch >= 8) {
      await this.placeTorch();
      this.blocksMinedSinceTorch = 0;
    }

    return { blocked: false };
  }

  /**
   * Mendeteksi bahaya (lava, gravel/sand jatuh).
   */
  detectHazard(headPos, footPos) {
    const bot = this.bot;

    // Cek lava di depan
    const head = bot.blockAt(headPos);
    const foot = bot.blockAt(footPos);
    if (head?.name?.includes('lava')) return { type: 'lava', pos: headPos };
    if (foot?.name?.includes('lava')) return { type: 'lava', pos: footPos };

    // Cek blok atas dari headPos (apakah ada pasir/gravel yang bisa runtuh)
    const above = bot.blockAt(headPos.offset(0, 1, 0));
    if (above && /^(gravel|sand|suspicious_sand|suspicious_gravel)$/.test(above.name)) {
      return { type: 'falling_block', pos: above.position };
    }

    return null;
  }

  /**
   * Menempatkan obor pada lantai atau dinding terdekat jika ada obor di inventaris.
   */
  async placeTorch() {
    const bot = this.bot;
    const torchItem = bot.inventory.items().find((i) => i.name === 'torch');
    if (!torchItem) return false;

    const floor = bot.blockAt(bot.entity.position.floored().offset(0, -1, 0));
    if (floor && floor.name !== 'air') {
      try {
        await bot.equip(torchItem, 'hand');
        await bot.placeBlock(floor, new Vec3(0, 1, 0));
        return true;
      } catch {}
    }
    return false;
  }

  /**
   * Memasang pickaxe terbaik yang tersedia di inventory.
   */
  async equipBestPickaxe() {
    const items = this.bot.inventory.items();
    const order = [
      'netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'
    ];
    for (const name of order) {
      const tool = items.find((i) => i.name === name);
      if (tool) {
        try {
          await this.bot.equip(tool, 'hand');
          return;
        } catch {}
      }
    }
  }
}
