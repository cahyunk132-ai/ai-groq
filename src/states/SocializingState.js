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

    // Bangun gameContext
    const pos = this.bot?.entity?.position;
    const gameContext = {
      x: pos ? Math.round(pos.x) : undefined,
      y: pos ? Math.round(pos.y) : undefined,
      z: pos ? Math.round(pos.z) : undefined,
      health: this.bot?.health,
      food: this.bot?.food,
      currentTask: context?.taskQueue?.currentTask?.()?.type || 'menjelajah area',
    };

    // Arahkan pandangan ke pengirim chat jika berada di dekat bot
    if (this.bot?.entities && pos && typeof this.bot.lookAt === 'function') {
      try {
        const sender = Object.values(this.bot.entities).find(
          (e) => (e.username || e.name) === latest.from && e.position
        );
        if (sender) {
          await this.bot.lookAt(sender.position.offset(0, sender.height || 1.6, 0), true);
        }
      } catch {}
    }

    let reply = `Halo ${latest.from}!`;

    if (this.advisor && typeof this.advisor.respondToChat === 'function') {
      try {
        reply = await this.advisor.respondToChat(latest.from, latest.message, gameContext);
      } catch {}
    } else {
      const msg = latest.message.toLowerCase();
      if (msg.includes('halo') || msg.includes('hai')) {
        reply = `Halo ${latest.from}! Ada yang bisa dibantu?`;
      } else if (msg.includes('status') || msg.includes('hp')) {
        reply = `HP: ${this.bot?.health ?? 20}/20, Lapar: ${this.bot?.food ?? 20}/20.`;
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
