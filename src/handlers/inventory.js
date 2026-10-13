import { Vec3 } from 'vec3';

const ESSENTIAL_ITEMS = /^(.*_sword|.*_pickaxe|.*_axe|shield|torch|bread|cooked_.*|baked_potato|apple)$/;

/**
 * Handler pengelolaan inventaris:
 * - Menemukan dan membuka chest
 * - Menyortir dan mendepositkan item non-esensial ke chest
 * - Mengambil item dari chest
 * - Manajemen auto-equip armor
 */
export class InventoryHandler {
  constructor(bot, { log = console.log } = {}) {
    this.bot = bot;
    this.log = log;
  }

  /**
   * Menemukan chest terdekat dalam radius.
   * @param {number} radius
   */
  findNearestChest(radius = 16) {
    const bot = this.bot;
    if (typeof bot.findBlocks !== 'function') return null;

    const chestIds = [];
    const byName = bot.registry?.blocksByName ?? {};
    if (byName.chest) chestIds.push(byName.chest.id);
    if (byName.trapped_chest) chestIds.push(byName.trapped_chest.id);

    if (chestIds.length === 0) return null;

    const positions = bot.findBlocks({ matching: chestIds, maxDistance: radius, count: 1 });
    if (positions.length === 0) return null;

    return bot.blockAt(positions[0]);
  }

  /**
   * Menyimpan item berlebih ke chest terdekat untuk mengosongkan inventaris.
   */
  async depositExcessItems() {
    const bot = this.bot;
    const chestBlock = this.findNearestChest();
    if (!chestBlock) {
      this.log('[inventory] Tidak ada chest di dekat bot untuk menyimpan item');
      return false;
    }

    // Dekati chest jika jauh
    const dist = bot.entity.position.distanceTo(chestBlock.position);
    if (dist > 3.5 && bot.pathfinder) {
      const { goals } = await import('mineflayer-pathfinder');
      try {
        await bot.pathfinder.goto(
          new goals.GoalLookAtBlock(chestBlock.position, bot.world)
        );
      } catch {}
    }

    try {
      const chestWindow = await bot.openChest(chestBlock);
      const items = bot.inventory.items();

      for (const item of items) {
        // Jangan deposit alat dan makanan esensial
        if (ESSENTIAL_ITEMS.test(item.name)) continue;

        try {
          await chestWindow.deposit(item.type, null, item.count);
        } catch {}
      }

      chestWindow.close();
      this.log('[inventory] Berhasil menyimpan item berlebih ke chest');
      return true;
    } catch (err) {
      this.log(`[inventory] Gagal menyimpan ke chest: ${err.message}`);
      return false;
    }
  }

  /**
   * Mengambil item tertentu dari chest.
   * @param {string} itemName
   * @param {number} count
   */
  async retrieveItem(itemName, count = 1) {
    const bot = this.bot;
    const chestBlock = this.findNearestChest();
    if (!chestBlock) return false;

    try {
      const chestWindow = await bot.openChest(chestBlock);
      const targetItem = chestWindow.items().find((i) => i.name === itemName);

      if (targetItem) {
        const withdrawAmount = Math.min(count, targetItem.count);
        await chestWindow.withdraw(targetItem.type, null, withdrawAmount);
        chestWindow.close();
        this.log(`[inventory] Mengambil ${withdrawAmount}x ${itemName} dari chest`);
        return true;
      }

      chestWindow.close();
      return false;
    } catch (err) {
      this.log(`[inventory] Gagal mengambil item dari chest: ${err.message}`);
      return false;
    }
  }

  /**
   * Memasang armor terbaik yang ada di inventory.
   */
  async equipBestArmor() {
    const bot = this.bot;
    if (bot.armorManager && typeof bot.armorManager.equipAll === 'function') {
      try {
        bot.armorManager.equipAll();
        return;
      } catch {}
    }

    const slots = ['head', 'torso', 'legs', 'feet'];
    const armorTypes = {
      head: ['netherite_helmet', 'diamond_helmet', 'iron_helmet', 'chainmail_helmet', 'golden_helmet', 'leather_helmet'],
      torso: ['netherite_chestplate', 'diamond_chestplate', 'iron_chestplate', 'chainmail_chestplate', 'golden_chestplate', 'leather_chestplate'],
      legs: ['netherite_leggings', 'diamond_leggings', 'iron_leggings', 'chainmail_leggings', 'golden_leggings', 'leather_leggings'],
      feet: ['netherite_boots', 'diamond_boots', 'iron_boots', 'chainmail_boots', 'golden_boots', 'leather_boots'],
    };

    const items = bot.inventory.items();
    for (const [slot, candidates] of Object.entries(armorTypes)) {
      for (const pieceName of candidates) {
        const piece = items.find((i) => i.name === pieceName);
        if (piece) {
          try {
            await bot.equip(piece, slot);
            break;
          } catch {}
        }
      }
    }
  }
}
