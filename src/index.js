// Titik masuk: menghubungkan bot Mineflayer ke loop OODA dengan Groq sebagai otak.
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { config } from './config.js';
import { buildState } from './state.js';
import { createBrain } from './brain.js';
import { execute } from './executor.js';
import { runOodaLoop } from './loop.js';

const { pathfinder, Movements } = pathfinderPkg;

if (!config.groq.apiKey) {
  console.error('GROQ_API_KEY belum diset. Salin .env.example ke .env lalu isi kuncinya.');
  process.exit(1);
}

/** Bot siap jika sudah menerima data HP dari server dan HP-nya di atas 0. */
function isReady(bot) {
  return typeof bot.health === 'number' && bot.health > 0 && bot.isAlive !== false;
}

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const controller = new AbortController();

const botOptions = {
  host: config.mc.host,
  port: config.mc.port,
  username: config.mc.username,
  auth: config.mc.auth,
};
if (config.mc.version) botOptions.version = config.mc.version;

const bot = mineflayer.createBot(botOptions);
bot.loadPlugin(pathfinder);

const decide = createBrain({ log });

bot.once('spawn', () => {
  bot.pathfinder.setMovements(new Movements(bot));
  log(`Bot "${bot.username}" masuk ke ${config.mc.host}:${config.mc.port}`);
  runOodaLoop({
    // Jangan mengambil keputusan saat bot belum menerima data HP atau sedang mati.
    observe: () => (isReady(bot) ? buildState(bot, config.loop.senseRadius) : null),
    decide,
    act: (d) => execute(bot, d),
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
