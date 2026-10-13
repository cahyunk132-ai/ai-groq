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
   * Merespons chat dari pemain.
   * @param {string} username
   * @param {string} message
   * @returns {Promise<string>}
   */
  async respondToChat(username, message) {
    if (!config.groq.apiKey) {
      return `Halo ${username}!`;
    }

    try {
      const prompt = `Pemain ${username} berkata: "${message}". Balaslah dengan singkat, ramah, dan manusiawi dalam bahasa Indonesia (maksimal 1 kalimat untuk chat Minecraft). Output JSON: {"reply": "..."}`;
      const res = await this.askFn([
        { role: 'system', content: 'Kamu adalah OmniBot, bot Minecraft yang ramah dan suka membantu.' },
        { role: 'user', content: prompt },
      ]);
      return res?.reply || `Halo ${username}!`;
    } catch (err) {
      this.log(`[advisor] Error chat LLM: ${err.message}`);
      return `Halo ${username}!`;
    }
  }
}
