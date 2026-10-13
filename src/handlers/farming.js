import { Vec3 } from 'vec3';
import { BREED_FOOD, MAX_ANIMAL_POPULATION, CROP_MAX_AGE } from '../constants.js';

const SEED_FOR_CROP = {
  wheat: 'wheat_seeds',
  carrots: 'carrot',
  potatoes: 'potato',
  beetroots: 'beetroot_seeds',
};

/**
 * Handler pertanian dan peternakan cerdas:
 * - Panen tanaman matang dan penanaman ulang bibit secara otomatis
 * - Breeding hewan ternak sesuai jenis pakan dan kuota populasi
 * - Pencukuran wol domba dengan gunting (shears)
 */
export class FarmingHandler {
  constructor(bot, { log = console.log } = {}) {
    this.bot = bot;
    this.log = log;
  }

  /**
   * Memanen tanaman pada koordinat tertentu dan langsung menanam ulang jika bibit tersedia.
   * @param {Vec3|number[]} cropPos
   */
  async harvestAndReplant(cropPos) {
    const bot = this.bot;
    const p = Array.isArray(cropPos) ? new Vec3(cropPos[0], cropPos[1], cropPos[2]) : cropPos;
    const block = bot.blockAt(p);
    if (!block) return false;

    const cropName = block.name;
    const seedName = SEED_FOR_CROP[cropName] || 'wheat_seeds';

    // Dekati tanaman jika perlu
    const dist = bot.entity.position.distanceTo(p);
    if (dist > 4 && bot.pathfinder) {
      const { goals } = await import('mineflayer-pathfinder');
      try {
        await bot.pathfinder.goto(new goals.GoalNear(p.x, p.y, p.z, 2));
      } catch {}
    }

    // Panen (gali)
    try {
      await bot.dig(block);
    } catch (err) {
      this.log(`[farming] Gagal memanen di ${p}: ${err.message}`);
      return false;
    }

    // Tunggu sedikit agar drop item benih masuk atau cek inventory
    await new Promise((r) => setTimeout(r, 200));

    // Tanam ulang jika ada bibit dan farmland di bawahnya masih ada
    const seed = bot.inventory.items().find((i) => i.name === seedName);
    const farmland = bot.blockAt(p.offset(0, -1, 0));
    if (seed && farmland && farmland.name === 'farmland') {
      try {
        await bot.equip(seed, 'hand');
        await bot.placeBlock(farmland, new Vec3(0, 1, 0));
        return true;
      } catch (err) {
        this.log(`[farming] Gagal menanam ulang ${seedName}: ${err.message}`);
      }
    }

    return true;
  }

  /**
   * Mengelola breeding hewan ternak.
   * @param {string} animalType - 'cow', 'sheep', 'pig', 'chicken', 'rabbit'
   */
  async breedAnimals(animalType) {
    const bot = this.bot;
    const allowedFoods = BREED_FOOD[animalType];
    const maxPop = MAX_ANIMAL_POPULATION[animalType] || 10;
    if (!allowedFoods) return false;

    // Hitung populasi saat ini
    const animals = Object.values(bot.entities).filter(
      (e) => e && e.name === animalType && e.position
    );

    if (animals.length >= maxPop) {
      this.log(`[farming] Populasi ${animalType} mencapai batas (${animals.length}/${maxPop})`);
      return false;
    }

    if (animals.length < 2) return false;

    // Cari makanan yang cocok di inventory
    const foodItem = bot.inventory.items().find((i) => allowedFoods.includes(i.name));
    if (!foodItem || foodItem.count < 2) {
      return false;
    }

    try {
      await bot.equip(foodItem, 'hand');
      // Beri makan 2 hewan pertama
      await bot.activateEntity(animals[0]);
      await new Promise((r) => setTimeout(r, 300));
      await bot.activateEntity(animals[1]);
      this.log(`[farming] Berhasil memberi makan pasangan ${animalType}`);
      return true;
    } catch (err) {
      this.log(`[farming] Gagal breeding ${animalType}: ${err.message}`);
      return false;
    }
  }

  /**
   * Mencukur domba jika domba memiliki wol dan bot membawa gunting.
   */
  async shearSheep() {
    const bot = this.bot;
    const shears = bot.inventory.items().find((i) => i.name === 'shears');
    if (!shears) return false;

    const sheep = Object.values(bot.entities).find((e) => {
      if (!e || e.name !== 'sheep' || !e.position) return false;
      // Di Mineflayer, metadata sheep bisa dicek apakah berbulu
      return e.metadata?.[16] !== undefined ? !(e.metadata[16] & 16) : true;
    });

    if (!sheep) return false;

    try {
      await bot.equip(shears, 'hand');
      await bot.activateEntity(sheep);
      this.log('[farming] Berhasil mencukur domba');
      return true;
    } catch {
      return false;
    }
  }
}
