// Pembatas pemanggilan Groq agar tetap di dalam kuota free tier.
// Free tier gpt-oss-20b: 8000 TPM dan 200K token per hari. Satu panggilan ~3100 token
// (prompt + max_tokens), jadi sekitar 60 panggilan per hari adalah batas atasnya.
// Di antara panggilan, bot memakai kebijakan cadangan (fallback) yang berbasis aturan.
import { readFileSync, writeFileSync } from 'node:fs';

/** Penyimpanan sederhana ke file JSON, agar kuota harian tetap terhitung setelah restart. */
export function fileStore(path) {
  return {
    load() {
      try {
        return JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        writeFileSync(path, JSON.stringify(data));
      } catch {
        // Gagal menulis tidak boleh menghentikan bot; hitungan tetap di memori.
      }
    },
  };
}

export class GroqBudget {
  /**
   * @param {object} [opts]
   * @param {number} [opts.dailyCallCap]     maksimal panggilan per hari (UTC)
   * @param {number} [opts.planIntervalMs]   jeda minimal antar panggilan untuk rencana biasa
   * @param {number} [opts.chatIntervalMs]   jeda minimal antar panggilan jika ada chat yang belum dijawab
   * @param {number} [opts.cooldownMs]       jeda setelah HTTP 429
   * @param {Function} [opts.now]
   * @param {{load:Function, save:Function}} [opts.store]
   */
  constructor({
    dailyCallCap = 50,
    planIntervalMs = 5 * 60 * 1000,
    chatIntervalMs = 60 * 1000,
    cooldownMs = 60 * 1000,
    now = () => Date.now(),
    store = null,
  } = {}) {
    this.dailyCallCap = dailyCallCap;
    this.planIntervalMs = planIntervalMs;
    this.chatIntervalMs = chatIntervalMs;
    this.cooldownMs = cooldownMs;
    this.now = now;
    this.store = store;
    const saved = store?.load?.() || {};
    this.day = saved.day ?? null;
    this.callsToday = saved.callsToday ?? 0;
    this.lastCallAt = saved.lastCallAt ?? -Infinity;
    this.cooldownUntil = saved.cooldownUntil ?? 0;
    this.rollDay();
  }

  dayKey(t) {
    return new Date(t).toISOString().slice(0, 10);
  }

  rollDay() {
    const key = this.dayKey(this.now());
    if (key !== this.day) {
      this.day = key;
      this.callsToday = 0;
    }
  }

  persist() {
    this.store?.save?.({
      day: this.day,
      callsToday: this.callsToday,
      lastCallAt: this.lastCallAt,
      cooldownUntil: this.cooldownUntil,
    });
  }

  /**
   * Apakah boleh memanggil Groq sekarang.
   * @param {object} state hasil buildState (dipakai untuk melihat pendingChat)
   * @returns {{ok: boolean, reason: string}}
   */
  check(state = {}) {
    const t = this.now();
    this.rollDay();
    if (t < this.cooldownUntil) return { ok: false, reason: 'cooldown setelah 429' };
    if (this.callsToday >= this.dailyCallCap) return { ok: false, reason: 'kuota harian habis' };
    const since = t - this.lastCallAt;
    const pending = (state.pendingChat || []).length > 0;
    if (pending && since >= this.chatIntervalMs) return { ok: true, reason: 'chat' };
    if (since >= this.planIntervalMs) return { ok: true, reason: 'rencana' };
    return { ok: false, reason: 'menunggu jadwal' };
  }

  /** Dipanggil tepat sebelum request dikirim (request yang gagal tetap dihitung). */
  recordCall() {
    this.rollDay();
    this.callsToday += 1;
    this.lastCallAt = this.now();
    this.persist();
  }

  /** Dipanggil saat Groq membalas 429: berhenti memanggil sebentar. */
  recordRateLimit() {
    this.cooldownUntil = this.now() + this.cooldownMs;
    this.persist();
  }

  snapshot() {
    this.rollDay();
    return { day: this.day, callsToday: this.callsToday, dailyCallCap: this.dailyCallCap };
  }
}
