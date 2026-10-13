import { Vec3 } from 'vec3';

/**
 * Handler pembuatan item cerdas (crafting):
 * - Dynamic recipe tree (multi-langkah: logs -> planks -> sticks -> tools)
 * - Pemantauan durabilitas dan auto-replacement
 * - Pencarian dan penempatan crafting_table otomatis
 */
export class CraftingHandler {
  constructor(bot, { log = console.log } = {}) {
    this.bot = bot;
    this.log = log;
  }

  /**
   * Mencari atau menavigasi ke crafting table terdekat jika resep membutuhkannya.
   */
  async findCraftingTable(radius = 16) {
    const bot = this.bot;
    const tableId = bot.registry?.blocksByName?.crafting_table?.id;
    if (!tableId || typeof bot.findBlocks !== 'function') return null;

    const tables = bot.findBlocks({ matching: tableId, maxDistance: radius, count: 1 });
    if (tables.length > 0) {
      return bot.blockAt(tables[0]);
    }

    // Jika tidak ada di dunia, cek apakah ada di inventaris untuk ditaruh
    const tableItem = bot.inventory.items().find((i) => i.name === 'crafting_table');
    if (tableItem) {
      const floor = bot.blockAt(bot.entity.position.floored().offset(0, -1, 0));
      if (floor && floor.name !== 'air') {
        try {
          await bot.equip(tableItem, 'hand');
          await bot.placeBlock(floor, new Vec3(0, 1, 0));
          return bot.blockAt(floor.position.offset(0, 1, 0));
        } catch {}
      }
    }

    return null;
  }

  /**
   * Membuat item dengan resolusi resep dinamis (termasuk bahan perantara).
   * @param {string} itemName - Nama item target, misal 'iron_pickaxe', 'wooden_pickaxe'
   * @param {number} count - Jumlah target
   */
  async craftItem(itemName, count = 1) {
    const bot = this.bot;
    const itemData = bot.registry?.itemsByName?.[itemName];
    if (!itemData) {
      this.log(`[crafting] Item tidak dikenal: ${itemName}`);
      return false;
    }

    // 1. Cek apakah bahan dasar perlu diolah dulu (misal: butuh planks dari logs, butuh stick dari planks)
    await this.preparePrerequisites(itemName);

    // 2. Cari resep yang valid
    const recipes = bot.recipesFor(itemData.id, null, 1, true);
    if (!recipes || recipes.length === 0) {
      // Coba cari resep dengan crafting table
      const dummyTable = { name: 'crafting_table' };
      const tableRecipes = bot.recipesFor(itemData.id, null, 1, dummyTable);
      if (!tableRecipes || tableRecipes.length === 0) {
        this.log(`[crafting] Resep atau bahan untuk ${itemName} tidak mencukupi`);
        return false;
      }
    }

    // 3. Tentukan apakah butuh meja kerja 3x3
    let craftingTable = null;
    const is3x3 = bot.recipesAll(itemData.id, null, true).some((r) => r.requiresTable);
    if (is3x3) {
      craftingTable = await this.findCraftingTable();
      if (!craftingTable) {
        // Coba buat crafting table terlebih dahulu
        await this.craftItem('crafting_table', 1);
        craftingTable = await this.findCraftingTable();
      }
      if (!craftingTable) {
        this.log(`[crafting] Tidak dapat menemukan crafting table untuk ${itemName}`);
        return false;
      }

      // Dekati crafting table jika jauh
      const dist = bot.entity.position.distanceTo(craftingTable.position);
      if (dist > 4 && bot.pathfinder) {
        const { goals } = await import('mineflayer-pathfinder');
        try {
          await bot.pathfinder.goto(
            new goals.GoalLookAtBlock(craftingTable.position, bot.world)
          );
        } catch {}
      }
    }

    const availableRecipes = bot.recipesFor(itemData.id, null, 1, craftingTable);
    if (!availableRecipes || availableRecipes.length === 0) {
      this.log(`[crafting] Bahan tidak cukup saat mencoba membuat ${itemName}`);
      return false;
    }

    try {
      await bot.craft(availableRecipes[0], count, craftingTable);
      this.log(`[crafting] Berhasil membuat ${count}x ${itemName}`);
      return true;
    } catch (err) {
      this.log(`[crafting] Gagal crafting ${itemName}: ${err.message}`);
      return false;
    }
  }

  /**
   * Menyiapkan bahan perantara jika memungkinkan (misal kayu menjadi papan, papan menjadi stik).
   */
  async preparePrerequisites(targetItem) {
    const bot = this.bot;
    const items = bot.inventory.items();

    // Jika target butuh stik (alat/senjata/obor) dan stik < 2
    if (
      /(pickaxe|axe|sword|shovel|hoe|torch)$/.test(targetItem) &&
      !items.some((i) => i.name === 'stick' && i.count >= 2)
    ) {
      // Cek apakah punya planks
      const hasPlanks = items.some((i) => i.name.endsWith('_planks') && i.count >= 2);
      if (!hasPlanks) {
        // Coba buat planks dari log
        const logItem = items.find((i) => /(_log|_wood)$/.test(i.name));
        if (logItem) {
          const plankName = logItem.name.replace(/_log|_wood/, '_planks');
          await this.craftSimple(plankName, 1);
        }
      }
      // Buat stik dari planks
      await this.craftSimple('stick', 1);
    }
  }

  /**
   * Craft sederhana 2x2 tanpa crafting table.
   */
  async craftSimple(itemName, count = 1) {
    const bot = this.bot;
    const itemData = bot.registry?.itemsByName?.[itemName];
    if (!itemData) return false;
    const recipes = bot.recipesFor(itemData.id, null, 1, null);
    if (recipes && recipes.length > 0) {
      try {
        await bot.craft(recipes[0], count, null);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
