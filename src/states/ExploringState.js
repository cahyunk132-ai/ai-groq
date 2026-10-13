import { Vec3 } from 'vec3';
import { State } from '../fsm/State.js';

export class ExploringState extends State {
  constructor(bot) {
    super(bot, 'exploring');
  }

  async onEnter(context) {
    // Navigasi eksplorasi acak
    const bot = this.bot;
    if (!bot?.entity?.position) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 8; // 8 - 16 blok
    const targetX = bot.entity.position.x + Math.cos(angle) * dist;
    const targetZ = bot.entity.position.z + Math.sin(angle) * dist;

    if (bot.pathfinder) {
      try {
        const { goals } = await import('mineflayer-pathfinder');
        // GoalNear horizontal
        await bot.pathfinder.goto(new goals.GoalXZ(targetX, targetZ));
      } catch {}
    }
  }

  async onUpdate(context) {
    return true; // Selesai eksplorasi langkah ini
  }
}
