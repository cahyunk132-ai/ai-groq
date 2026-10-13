import { State } from '../fsm/State.js';

export class IdleState extends State {
  constructor(bot) {
    super(bot, 'idle');
  }

  async onEnter(context) {
    if (this.bot?.clearControlStates) {
      this.bot.clearControlStates();
    }
  }

  async onUpdate(context) {
    // Idle berdiam sejenak lalu siap dievaluasi kembali
    return true;
  }
}
