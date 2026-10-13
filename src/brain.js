// DECIDE: menggabungkan state -> (Groq jika kuota mengizinkan) -> validasi -> penyaring keselamatan.
// Jika Groq tidak dipanggil, gagal, atau keluarannya tidak valid, kebijakan cadangan dipakai.
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';
import { validateDecision } from './actions.js';
import { fallbackDecision, applySafetyOverrides } from './policy.js';
import { askGroq } from './groq.js';

/**
 * Membuat fungsi decide(state) yang selalu mengembalikan keputusan yang bisa dijalankan.
 * @param {object} deps
 * @param {Function} [deps.ask] fungsi pemanggil LLM (default: askGroq)
 * @param {Function} [deps.log]
 * @param {import('./budget.js').GroqBudget|null} [deps.budget] pembatas panggilan (null = selalu boleh)
 */
export function createBrain({ ask = askGroq, log = console.log, budget = null } = {}) {
  return async function decide(state) {
    let decision;
    let source = 'groq';
    const gate = budget ? budget.check(state) : { ok: true, reason: '' };

    if (!gate.ok) {
      // Belum waktunya memanggil Groq: pakai kebijakan cadangan yang berbasis aturan.
      source = 'fallback';
      decision = fallbackDecision(state);
    } else {
      try {
        budget?.recordCall();
        const raw = await ask([
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(state) },
        ]);
        decision = validateDecision(raw, state);
      } catch (err) {
        source = 'fallback';
        if (/HTTP 429/.test(err.message)) budget?.recordRateLimit();
        log(`[brain] Groq gagal/tidak valid (${err.message}); memakai kebijakan cadangan`);
        decision = fallbackDecision(state);
      }
    }
    const safe = applySafetyOverrides(decision, state);
    if (safe !== decision) source += '+override';
    return { ...safe, source };
  };
}
