import { State } from '../fsm/State.js';
import { config } from '../config.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * State untuk interaksi visual dan sapaan saat bertemu rekan bot atau pemain.
 */
export class EncounterState extends State {
  constructor(bot) {
    super(bot, 'encounter');
  }

  async onEnter(context) {
    const threat = context?.sensors?.threat;
    const targetPlayer = context?.targetPlayer || threat?.nearestPlayer(config.social.encounterRadius);
    if (!targetPlayer || !targetPlayer.entity) return;

    const { entity, username } = targetPlayer;

    // 1. Hentikan gerakan sejenak
    if (this.bot.pathfinder && typeof this.bot.pathfinder.stop === 'function') {
      try {
        this.bot.pathfinder.stop();
      } catch {}
    }

    // 2. Arahkan pandangan ke kepala target
    if (entity.position && typeof this.bot.lookAt === 'function') {
      try {
        const eyePos = entity.position.offset(0, entity.height || 1.6, 0);
        await this.bot.lookAt(eyePos, true);
      } catch {}
    }

    // 3. Gestur Minecraft khas: crouch 2x berturut-turut
    if (typeof this.bot.setControlState === 'function') {
      try {
        this.bot.setControlState('sneak', true);
        await sleep(200);
        this.bot.setControlState('sneak', false);
        await sleep(150);
        this.bot.setControlState('sneak', true);
        await sleep(200);
        this.bot.setControlState('sneak', false);
      } catch {}
    }

    // 4. Ayunkan tangan (swing arm)
    if (typeof this.bot.swingArm === 'function') {
      try {
        this.bot.swingArm('right-hand');
      } catch {}
    }

    // 5. Sapaan ramah di chat jika memenuhi cooldown
    const memory = context?.memory;
    const isFriend = threat?.isFriendBot?.(username, config.social.friendBots) ?? false;
    const cooldownMs = isFriend ? config.social.friendChatCooldownMs : config.social.chatCooldownMs;

    if (memory?.canChat?.(username, cooldownMs)) {
      let greeting;
      if (isFriend) {
        greeting = `Halo rekan ${username}! Senang melihatmu bertualang di sini.`;
      } else {
        greeting = `Halo @${username}! Salam kenal.`;
      }

      if (typeof this.bot.chat === 'function') {
        try {
          this.bot.chat(greeting);
        } catch {}
      }

      memory.recordChatTime?.(username);
    }

    // 6. Catat cooldown pertemuan fisik
    memory?.recordEncounter?.(username);
  }

  async onUpdate(context) {
    return true; // Selesai dalam satu evaluasi
  }
}
