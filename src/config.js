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
    username2: process.env.MC_USERNAME_2 || 'bot_admin',
    auth: process.env.MC_AUTH || 'offline',
    version: process.env.MC_VERSION || undefined,
  },
  social: {
    friendBots: (process.env.FRIEND_BOTS || 'bot_admin,bot_adminv2')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    interactWithPlayers: process.env.INTERACT_WITH_PLAYERS !== 'false',
    encounterRadius: num('ENCOUNTER_RADIUS', 6),
    encounterCooldownMs: num('ENCOUNTER_COOLDOWN_MS', 60000),
    chatCooldownMs: num('CHAT_COOLDOWN_MS', 10000),
    friendChatCooldownMs: num('FRIEND_CHAT_COOLDOWN_MS', 45000),
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    timeoutMs: num('GROQ_TIMEOUT_MS', 8000),
  },
  loop: {
    tickMs: num('LOOP_TICK_MS', 3000),
    senseRadius: num('SENSE_RADIUS', 16),
  },
};
