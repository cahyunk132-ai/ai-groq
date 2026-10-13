import { State } from '../fsm/State.js';

export class EatingState extends State {
  constructor(bot, selfSensor) {
    super(bot, 'eating');
    this.self = selfSensor;
  }

  get interruptible() {
    return false; // Jangan diinterupsi saat sedang menelan makanan
  }

  async onEnter(context) {
    const selfSensor = context?.sensors?.self ?? this.self;
    const food = selfSensor?.bestFood();
    if (!food) return;

    try {
      await this.bot.equip(food, 'hand');
      await this.bot.consume();
    } catch {}
  }

  async onUpdate(context) {
    // Selesai setelah makan
    return true;
  }
}
