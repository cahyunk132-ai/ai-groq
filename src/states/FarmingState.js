import { State } from '../fsm/State.js';

export class FarmingState extends State {
  constructor(bot, farmingHandler, worldSensor) {
    super(bot, 'farming');
    this.farming = farmingHandler;
    this.world = worldSensor;
  }

  async onEnter(context) {
    this.farming?.log?.('[state:farming] Memulai aktivitas tani & ternak');
  }

  async onUpdate(context) {
    const worldSensor = context?.sensors?.world ?? this.world;

    // 1. Panen tanaman matang
    const matureCrops = worldSensor?.crops?.filter((c) => c.mature) ?? [];
    if (matureCrops.length > 0) {
      const target = matureCrops[0];
      await this.farming.harvestAndReplant(target.pos);
      return false;
    }

    // 2. Cek breeding hewan
    for (const animal of ['cow', 'sheep', 'pig', 'chicken']) {
      const bred = await this.farming.breedAnimals(animal);
      if (bred) return false;
    }

    // 3. Cukur domba jika ada
    await this.farming.shearSheep();

    context?.taskQueue?.dequeue?.();
    return true; // Selesai siklus tani
  }
}
