/**
 * Sensor status internal bot: HP, rasa lapar, inventaris, dan kondisi alat.
 */
export class SelfSensor {
  constructor(bot) {
    this.bot = bot;
    this.hp = 20;
    this.maxHp = 20;
    this.hunger = 20;
    this.hpRatio = 1;
    this.hasFood = false;
    this.inventoryFull = false;
    this.needsEssentialTool = false;
  }

  update() {
    const bot = this.bot;
    this.hp = bot.health ?? 20;
    this.maxHp = 20;
    this.hpRatio = this.hp / this.maxHp;
    this.hunger = bot.food ?? 20;

    const items = bot.inventory?.items?.() ?? [];
    const foods = bot.registry?.foodsByName ?? {};

    // Fallback deteksi makanan jika registry foodsByName kosong atau belum dimuat
    this.hasFood = items.some((item) => {
      if (foods[item.name]) return true;
      return /^(bread|cooked_|baked_potato|apple|golden_apple|carrot|melon_slice|beef|porkchop|mutton|chicken)/.test(
        item.name
      );
    });

    // Inventaris penuh jika slot kosong kurang dari 2
    const emptySlots =
      typeof bot.inventory?.emptySlotCount === 'function'
        ? bot.inventory.emptySlotCount()
        : Math.max(0, 36 - items.length);
    this.inventoryFull = emptySlots < 2;

    // Evaluasi alat esensial (minimal butuh pickaxe)
    const hasPickaxe = items.some((i) => i.name.endsWith('_pickaxe'));
    this.needsEssentialTool = !hasPickaxe;
  }

  /**
   * Mengembalikan item makanan terbaik di inventaris (saturasi/food points tertinggi).
   */
  bestFood() {
    const items = this.bot.inventory?.items?.() ?? [];
    const foods = this.bot.registry?.foodsByName ?? {};
    const foodItems = items.filter((item) => {
      if (foods[item.name]) return true;
      return /^(bread|cooked_|baked_potato|apple|golden_apple|carrot|melon_slice|beef|porkchop|mutton|chicken)/.test(
        item.name
      );
    });

    if (foodItems.length === 0) return null;

    return foodItems.sort((a, b) => {
      const satA = foods[a.name]?.saturation ?? 5;
      const satB = foods[b.name]?.saturation ?? 5;
      return satB - satA;
    })[0];
  }

  /**
   * Menemukan alat dengan sisa durabilitas di bawah ambang batas.
   * @param {number} threshold
   */
  lowDurabilityTools(threshold = 15) {
    const items = this.bot.inventory?.items?.() ?? [];
    return items.filter((item) => {
      if (typeof item.durabilityUsed === 'number' && typeof item.maxDurability === 'number') {
        const remaining = item.maxDurability - item.durabilityUsed;
        return remaining < threshold;
      }
      return false;
    });
  }
}
