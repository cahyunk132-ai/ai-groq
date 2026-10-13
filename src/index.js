// Titik masuk: menghubungkan bot Mineflayer ke loop OODA dengan Groq sebagai otak.
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { config } from './config.js';
import { buildState } from './state.js';
import { createBrain } from './brain.js';
import { execute } from './executor.js';
import { runOodaLoop } from './loop.js';
import { Memory } from './memory.js';
import { GroqBudget, fileStore } from './budget.js';
import { createMovements } from './movements.js';

const { pathfinder } = pathfinderPkg;

if (!config.groq.apiKey) {
  console.error('GROQ_API_KEY belum diset. Salin .env.example ke .env lalu isi kuncinya.');
  process.exit(1);
}

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const controller = new AbortController();
const memory = new Memory();

const botOptions = {
  host: config.mc.host,
  port: config.mc.port,
  username: config.mc.username,
  auth: config.mc.auth,
};
if (config.mc.version) botOptions.version = config.mc.version;

const bot = mineflayer.createBot(botOptions);
bot.loadPlugin(pathfinder);

// Server 26.3 menendang client yang tidak mengirim paket tick_end setiap tick
// (multiplayer.disconnect.invalid_player_movement). Mineflayer belum mengirimnya,
// jadi kita kirim sendiri setiap physics tick, seperti yang dilakukan client vanilla.
bot.on('physicsTick', () => {
  if (!bot.entity || !bot._client) return;
  try {
    bot._client.write('tick_end', {});
  } catch (err) {
    log(`gagal mengirim tick_end: ${err.message}`);
  }
});

// Chat pemain lain dicatat agar AI bisa menjawab.
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  memory.recordChat(username, message);
});

// Groq hanya dipanggil sesuai jadwal dan kuota; di antaranya bot memakai kebijakan cadangan.
const budget = new GroqBudget({
  dailyCallCap: config.groq.dailyCallCap,
  planIntervalMs: config.groq.planIntervalMs,
  chatIntervalMs: config.groq.chatIntervalMs,
  store: fileStore(config.groq.usageFile),
});
const decide = createBrain({ log, budget });

/** Bot siap jika sudah menerima data HP dari server dan HP-nya di atas 0. */
function isReady(bot) {
  return typeof bot.health === 'number' && bot.health > 0 && bot.isAlive !== false;
}

bot.once('spawn', () => {
  bot.pathfinder.setMovements(createMovements(bot));
  log(`Bot "${bot.username}" masuk ke ${config.mc.host}:${config.mc.port}`);
  runOodaLoop({
    // Jangan mengambil keputusan saat bot belum menerima data HP atau sedang mati.
    observe: () => (isReady(bot) ? buildState(bot, config.loop.senseRadius, memory) : null),
    decide,
    act: async (d) => {
      if (d.goal) memory.setGoal(d.goal);
      const result = await execute(bot, d, { anchor: memory.buildAnchor() });
      if (result?.origin) memory.setBuildOrigin(result.origin);
      memory.recordAction({
        action: d.action,
        target: d.target,
        result: result?.message,
        detail: result?.structure ?? null,
      });
      memory.clearPendingChat();
      return result;
    },
    tickMs: config.loop.tickMs,
    signal: controller.signal,
    log,
  });
});

bot.on('kicked', (reason) => log(`Di-kick: ${JSON.stringify(reason)}`));
bot.on('error', (err) => log(`Error bot: ${err.message}`));
bot.on('end', (reason) => {
  log(`Koneksi berakhir: ${reason}`);
  controller.abort();
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log(`Menerima ${sig}, menghentikan bot...`);
    controller.abort();
    bot.quit();
    process.exit(0);
  });
}
