import 'dotenv/config';

function num(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} harus berupa angka, dapat "${raw}"`);
  return n;
}

export const config = {
  mc: {
    host: process.env.MC_HOST || 'localhost',
    port: num('MC_PORT', 25565),
    username: process.env.MC_USERNAME || 'GroqBot',
    auth: process.env.MC_AUTH || 'offline',
    version: process.env.MC_VERSION || undefined,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    timeoutMs: num('GROQ_TIMEOUT_MS', 8000),
    // Pembatas panggilan untuk free tier (8000 TPM, 200K token/hari).
    dailyCallCap: num('GROQ_DAILY_CALL_CAP', 50),
    planIntervalMs: num('GROQ_PLAN_INTERVAL_MS', 300000),
    chatIntervalMs: num('GROQ_CHAT_INTERVAL_MS', 60000),
    usageFile: process.env.GROQ_USAGE_FILE || '.groq-usage.json',
  },
  loop: {
    tickMs: num('LOOP_TICK_MS', 3000),
    senseRadius: num('SENSE_RADIUS', 16),
  },
};
