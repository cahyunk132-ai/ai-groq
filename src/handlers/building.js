import fs from 'node:fs';
import { Vec3 } from 'vec3';
import { STRUCTURES, footprintOf, buildCells } from '../build.js';
import { BUILD_MATERIAL_NAME } from '../constants.js';

/**
 * Handler konstruksi cerdas:
 * - Kalkulasi kekurangan material sebelum konstruksi
 * - Penempatan scaffolding untuk blok tinggi
 * - Integrasi schematic (prismarine-schematic) & struktur prosedural
 */
export class BuildingHandler {
  constructor(bot, { log = console.log } = {}) {
    this.bot = bot;
    this.log = log;
  }

  /**
   * Menghitung kebutuhan material vs apa yang dimiliki di inventory.
   * @param {string} structure - Nama struktur ('shelter', 'platform', 'tower', 'wall')
   * @returns {{ requiredCount: number, availableCount: number, missing: number, canBuild: boolean }}
   */
  calculateDeficiency(structure) {
    const cells = buildCells(structure, [0, 0, 0]);
    const requiredCount = cells.length;

    const items = this.bot.inventory?.items?.() ?? [];
    const availableCount = items
      .filter((i) => BUILD_MATERIAL_NAME.test(i.name))
      .reduce((sum, i) => sum + i.count, 0);

    const missing = Math.max(0, requiredCount - availableCount);
    return {
      requiredCount,
      availableCount,
      missing,
      canBuild: missing === 0,
    };
  }

  /**
   * Membaca file schematic (.schem) menggunakan prismarine-schematic jika tersedia.
   * @param {string} filePath
   */
  async loadSchematic(filePath) {
    if (!fs.existsSync(filePath)) {
      this.log(`[building] File schematic tidak ditemukan: ${filePath}`);
      return null;
    }
    try {
      const { Schematic } = await import('prismarine-schematic');
      const buffer = fs.readFileSync(filePath);
      const schem = await Schematic.read(buffer, this.bot.version);
      return schem;
    } catch (err) {
      this.log(`[building] Gagal membaca schematic: ${err.message}`);
      return null;
    }
  }

  /**
   * Menempatkan satu blok scaffolding di bawah kaki bot untuk menjangkau ketinggian.
   */
  async placeScaffold() {
    const bot = this.bot;
    const scaffoldItem = bot.inventory.items().find((i) =>
      /^(dirt|cobblestone|scaffolding)$/.test(i.name)
    );
    if (!scaffoldItem) return false;

    const underFoot = bot.blockAt(bot.entity.position.floored().offset(0, -1, 0));
    if (!underFoot || underFoot.name === 'air') return false;

    try {
      bot.setControlState('jump', true);
      await new Promise((r) => setTimeout(r, 150));
      await bot.equip(scaffoldItem, 'hand');
      await bot.placeBlock(underFoot, new Vec3(0, 1, 0));
      bot.setControlState('jump', false);
      return true;
    } catch {
      bot.setControlState('jump', false);
      return false;
    }
  }

  /**
   * Membangun struktur prosedural di koordinat origin yang ditentukan.
   * @param {string} structure
   * @param {number[]} origin - [ox, oy, oz]
   */
  async build(structure, origin) {
    const bot = this.bot;
    const def = this.calculateDeficiency(structure);
    if (!def.canBuild) {
      this.log(
        `[building] Material tidak mencukupi untuk ${structure} (kurang ${def.missing} blok)`
      );
      return false;
    }

    const cells = buildCells(structure, origin);
    this.log(`[building] Mulai konstruksi ${structure} (${cells.length} blok) di ${origin}`);

    for (const [x, y, z] of cells) {
      const targetPos = new Vec3(x, y, z);
      const currentBlock = bot.blockAt(targetPos);
      if (currentBlock && currentBlock.name !== 'air') continue;

      // Ambil bahan bangunan yang tersedia
      const material = bot.inventory.items().find((i) => BUILD_MATERIAL_NAME.test(i.name));
      if (!material) {
        this.log('[building] Kehabisan material saat konstruksi berlangsung!');
        return false;
      }

      // Scaffold jika posisi terlalu tinggi (> 3 blok di atas kepala bot)
      if (y > bot.entity.position.y + 3) {
        await this.placeScaffold();
      }

      // Cari blok referensi tumpuan (adjacent solid block)
      const ref = this.findReferenceBlock(targetPos);
      if (ref) {
        try {
          await bot.equip(material, 'hand');
          await bot.placeBlock(ref.block, ref.face);
        } catch (err) {
          // Lewati blok ini jika penempatan terhalang
        }
      }
    }

    this.log(`[building] Konstruksi ${structure} selesai!`);
    return true;
  }

  /**
   * Menemukan blok referensi untuk penempatan blok di targetPos.
   */
  findReferenceBlock(targetPos) {
    const neighbors = [
      { face: new Vec3(0, -1, 0), pos: targetPos.offset(0, -1, 0) },
      { face: new Vec3(0, 1, 0), pos: targetPos.offset(0, 1, 0) },
      { face: new Vec3(-1, 0, 0), pos: targetPos.offset(-1, 0, 0) },
      { face: new Vec3(1, 0, 0), pos: targetPos.offset(1, 0, 0) },
      { face: new Vec3(0, 0, -1), pos: targetPos.offset(0, 0, -1) },
      { face: new Vec3(0, 0, 1), pos: targetPos.offset(0, 0, 1) },
    ];

    for (const n of neighbors) {
      const block = this.bot.blockAt(n.pos);
      if (block && block.name !== 'air' && !block.name.includes('water') && !block.name.includes('lava')) {
        return { block, face: targetPos.minus(n.pos) };
      }
    }
    return null;
  }
}
