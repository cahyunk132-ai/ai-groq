import { Vec3 } from 'vec3';
import { State } from '../fsm/State.js';

export class GatheringState extends State {
  constructor(bot) {
    super(bot, 'gathering');
  }

  async onEnter(context) {
    // Memulai pengumpulan resource
  }

  async onUpdate(context) {
    const worldSensor = context?.sensors?.world;
    if (worldSensor?.resources?.length > 0) {
      const res = worldSensor.resources[0];
      const targetPos = new Vec3(res.pos[0], res.pos[1], res.pos[2]);
      const block = this.bot.blockAt(targetPos);
      if (block && block.name !== 'air') {
        try {
          if (this.bot.pathfinder) {
            const { goals } = await import('mineflayer-pathfinder');
            await this.bot.pathfinder.goto(new goals.GoalLookAtBlock(targetPos, this.bot.world));
          }
          await this.bot.dig(block);
        } catch {}
      }
    }

    context?.taskQueue?.dequeue?.();
    return true;
  }
}
