import { State } from '../fsm/State.js';

export class CraftingState extends State {
  constructor(bot, craftingHandler) {
    super(bot, 'crafting');
    this.crafting = craftingHandler;
  }

  async onEnter(context) {
    this.crafting?.log?.('[state:crafting] Mempersiapkan pembuatan item');
  }

  async onUpdate(context) {
    const selfSensor = context?.sensors?.self;
    const task = context?.taskQueue?.currentTask?.();

    const targetItem = task?.params?.item ?? (selfSensor?.needsEssentialTool ? 'wooden_pickaxe' : 'stick');
    await this.crafting.craftItem(targetItem, 1);

    context?.taskQueue?.dequeue?.();
    return true; // Selesai
  }
}
