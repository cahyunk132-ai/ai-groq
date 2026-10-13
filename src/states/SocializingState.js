import { State } from '../fsm/State.js';

export class SocializingState extends State {
  constructor(bot, memory, advisor = null) {
    super(bot, 'socializing');
    this.memory = memory;
    this.advisor = advisor;
  }

  async onEnter(context) {
    const memory = context?.memory ?? this.memory;
    const chats = memory?.pendingChat ?? [];
    if (chats.length === 0) return;

    const latest = chats[chats.length - 1];
    let reply = `Halo ${latest.from}!`;

    if (this.advisor && typeof this.advisor.respondToChat === 'function') {
      try {
        reply = await this.advisor.respondToChat(latest.from, latest.message);
      } catch {}
    } else {
      const msg = latest.message.toLowerCase();
      if (msg.includes('halo') || msg.includes('hai')) {
        reply = `Halo ${latest.from}! Ada yang bisa dibantu?`;
      } else if (msg.includes('status') || msg.includes('hp')) {
        reply = `HP: ${this.bot.health}/20, Lapar: ${this.bot.food}/20.`;
      }
    }

    if (this.bot && typeof this.bot.chat === 'function') {
      this.bot.chat(reply);
    }

    memory?.clearPendingChat?.();
  }

  async onUpdate(context) {
    return true; // Selesai
  }
}
