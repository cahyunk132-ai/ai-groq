import { State } from '../fsm/State.js';

export class MiningState extends State {
  constructor(bot, miningHandler, worldSensor) {
    super(bot, 'mining');
    this.mining = miningHandler;
    this.world = worldSensor;
    this.stepsRemaining = 10;
  }

  async onEnter(context) {
    const task = context?.taskQueue?.currentTask?.();
    this.stepsRemaining = task?.params?.steps ?? 10;
    this.mining?.log?.(`[state:mining] Memulai penambangan (${this.stepsRemaining} langkah)`);
  }

  async onUpdate(context) {
    const worldSensor = context?.sensors?.world ?? this.world;

    // Prioritaskan ore yang terlihat di dinding / sekitar bot
    if (worldSensor?.ores?.length > 0) {
      const targetOre = worldSensor.ores[0];
      this.mining?.log?.(`[state:mining] Menambang ore terlihat: ${targetOre.name} di ${targetOre.pos}`);
      await this.mining.mineBlockAt(targetOre.pos);
      return false;
    }

    if (this.stepsRemaining <= 0) {
      context?.taskQueue?.dequeue?.();
      return true; // Selesai
    }

    const result = await this.mining.stripMineStep();
    if (result.blocked) {
      this.mining?.log?.(`[state:mining] Jalur terhalang ${result.hazard?.type ?? 'blok'}, berhenti`);
      context?.taskQueue?.dequeue?.();
      return true;
    }

    this.stepsRemaining--;
    return false;
  }

  async onExit(context) {
    this.mining?.log?.('[state:mining] Penambangan selesai / diinterupsi');
  }
}
