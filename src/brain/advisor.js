import { askGroq } from '../groq.js';
import { config } from '../config.js';

/**
 * Advisor cerdas menggunakan Groq LLM:
 * - Menanggapi chat pemain dengan bahasa yang santai dan ramah
 * - Memberi rekomendasi prioritas tugas jika kondisi ambigu
 */
export class Advisor {
  constructor({ log = console.log, askFn = askGroq } = {}) {
    this.log = log;
    this.askFn = askFn;
  }

  /**
   * Merespons chat dari pemain atau rekan bot.
   * @param {string} username
   * @param {string} message
   * @param {object} [gameContext]
   * @returns {Promise<string>}
   */
  async respondToChat(username, message, gameContext = {}) {
    const rawMsg = String(message || '').trim();
    const lower = rawMsg.toLowerCase();

    // Coba gunakan Groq jika API key tersedia
    if (config.groq.apiKey) {
      try {
        const ctxInfo = [
          `Posisi bot: X=${gameContext.x ?? '?'}, Y=${gameContext.y ?? '?'}, Z=${gameContext.z ?? '?'}`,
          `HP: ${gameContext.health ?? '?'}/20, Lapar: ${gameContext.food ?? '?'}/20`,
          `Aktivitas sekarang: ${gameContext.currentTask ?? 'idle/menjelajah'}`,
          gameContext.inventorySummary ? `Inventory: ${gameContext.inventorySummary}` : null,
        ].filter(Boolean).join(' | ');

        const systemPrompt = `Kamu adalah OmniBot, asisten dan teman Minecraft yang ramah, santai, dan cerdas. Kamu membalas dalam Bahasa Indonesia santai (maksimal 1-2 kalimat ringkas untuk chat Minecraft, tanpa tanda kutip berlebihan). Konteks kamu saat ini: [${ctxInfo}].`;
        const userPrompt = `Pemain ${username} berkata: "${rawMsg}". Balas dengan ramah dan relevan. Format JSON: {"reply": "..."}`;

        const res = await this.askFn([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        if (res?.reply && typeof res.reply === 'string') {
          return res.reply.trim().slice(0, 240);
        }
      } catch (err) {
        this.log(`[advisor] Error chat LLM: ${err.message}. Menggunakan fallback.`);
      }
    }

    // Rule-Based Fallback
    return this.fallbackReply(username, lower, gameContext);
  }

  /**
   * Jawaban cadangan cerdas jika LLM tidak tersedia atau timeout.
   */
  fallbackReply(username, lower, gameContext = {}) {
    if (lower.includes('posisi') || lower.includes('koordinat') || lower.includes('dimana') || lower.includes('di mana')) {
      const { x, y, z } = gameContext;
      if (x !== undefined && y !== undefined && z !== undefined) {
        return `@${username} Posisi saya di X: ${x}, Y: ${y}, Z: ${z}`;
      }
      return `@${username} Saya sedang menjelajah di sekitar sini.`;
    }

    if (lower.includes('hp') || lower.includes('darah') || lower.includes('sehat') || lower.includes('health')) {
      const hp = gameContext.health ?? 20;
      const food = gameContext.food ?? 20;
      return `@${username} HP saya ${hp}/20, tingkat kenyang ${food}/20!`;
    }

    if (lower.includes('lagi apa') || lower.includes('sedang apa') || lower.includes('tugas') || lower.includes('status')) {
      const task = gameContext.currentTask || 'menjelajah area';
      return `@${username} Saya sedang ${task}. Ketik !mine, !farm, atau !build untuk beri tugas!`;
    }

    if (lower.includes('halo') || lower.includes('hai') || lower.includes('hey') || lower.includes('hello')) {
      return `Halo @${username}! Ada yang bisa saya bantu?`;
    }

    if (lower.includes('makasih') || lower.includes('terima kasih') || lower.includes('thanks')) {
      return `Sama-sama @${username}! Senang bisa membantu.`;
    }

    if (lower.includes('help') || lower.includes('bantuan') || lower.includes('perintah')) {
      return `@${username} Perintah cepat: !mine, !farm, !build, !clear, atau tanya koordinat/HP saya!`;
    }

    return `Halo @${username}! Saya mendengarmu. Ada yang bisa kubantu?`;
  }
}
