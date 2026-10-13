import { State } from '../fsm/State.js';

export class BuildingState extends State {
  constructor(bot, buildingHandler) {
    super(bot, 'building');
    this.building = buildingHandler;
  }

  async onEnter(context) {
    this.building?.log?.('[state:building] Mempersiapkan konstruksi');
  }

  async onUpdate(context) {
    const task = context?.taskQueue?.currentTask?.();
    const structure = task?.params?.structure ?? 'platform';
    const origin = task?.params?.origin ?? [
      Math.floor(this.bot.entity.position.x) + 2,
      Math.floor(this.bot.entity.position.y),
      Math.floor(this.bot.entity.position.z) + 2,
    ];

    const success = await this.building.build(structure, origin);
    if (success && context?.memory) {
      context.memory.setBuildOrigin(origin);
    }

    context?.taskQueue?.dequeue?.();
    return true;
  }
}
