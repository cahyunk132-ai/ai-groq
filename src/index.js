// Entry point OmniBot: boot bot, load plugins, init FSM, handlers, sensors, and loop.
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { config } from './config.js';

// FSM
import { StateMachine } from './fsm/StateMachine.js';
import { buildTransitions } from './fsm/transitions.js';

// Sensors
import { SelfSensor } from './sensors/self.js';
import { ThreatSensor } from './sensors/threat.js';
import { WorldSensor } from './sensors/world.js';

// Handlers
import { CombatHandler } from './handlers/combat.js';
import { MiningHandler } from './handlers/mining.js';
import { FarmingHandler } from './handlers/farming.js';
import { CraftingHandler } from './handlers/crafting.js';
import { BuildingHandler } from './handlers/building.js';
import { InventoryHandler } from './handlers/inventory.js';

// States
import { IdleState } from './states/IdleState.js';
import { CombatState } from './states/CombatState.js';
import { EatingState } from './states/EatingState.js';
import { MiningState } from './states/MiningState.js';
import { FarmingState } from './states/FarmingState.js';
import { CraftingState } from './states/CraftingState.js';
import { BuildingState } from './states/BuildingState.js';
import { GatheringState } from './states/GatheringState.js';
import { InventoryState } from './states/InventoryState.js';
import { ExploringState } from './states/ExploringState.js';
import { SocializingState } from './states/SocializingState.js';

// Brain & Memory
import { Advisor } from './brain/advisor.js';
import { Memory } from './memory/Memory.js';
import { TaskQueue } from './memory/TaskQueue.js';

const { pathfinder, Movements } = pathfinderPkg;
const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const controller = new AbortController();

const memory = new Memory();
const taskQueue = new TaskQueue();
const advisor = new Advisor({ log });

const botOptions = {
  host: config.mc.host,
  port: config.mc.port,
  username: config.mc.username,
  auth: config.mc.auth,
};
if (config.mc.version) botOptions.version = config.mc.version;

const bot = mineflayer.createBot(botOptions);
bot.loadPlugin(pathfinder);

// Load optional plugins safely
import('mineflayer-armor-manager')
  .then((m) => bot.loadPlugin(m.default || m))
  .catch(() => log('[plugins] mineflayer-armor-manager tidak dimuat'));

import('mineflayer-pvp')
  .then((m) => bot.loadPlugin(m.default || m))
  .catch(() => log('[plugins] mineflayer-pvp tidak dimuat'));

// Server 26.x menendang client yang tidak mengirim paket tick_end setiap tick
bot.on('physicsTick', () => {
  if (!bot.entity || !bot._client) return;
  try {
    bot._client.write('tick_end', {});
  } catch {}
});

// Chat listener: catat pesan pemain dan proses perintah cepat
bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  log(`[chat] <${username}> ${message}`);

  // Perintah cepat melalui chat
  const trimmed = message.trim().toLowerCase();
  if (trimmed === '!mine') {
    taskQueue.enqueue({ type: 'mining', priority: 4, params: { steps: 16 } });
    bot.chat(`Menerima perintah mining dari ${username}`);
  } else if (trimmed === '!farm') {
    taskQueue.enqueue({ type: 'farming', priority: 4 });
    bot.chat(`Menerima perintah farming dari ${username}`);
  } else if (trimmed === '!build') {
    taskQueue.enqueue({ type: 'building', priority: 4, params: { structure: 'shelter' } });
    bot.chat(`Menerima perintah membangun shelter dari ${username}`);
  } else if (trimmed === '!clear') {
    taskQueue.clear();
    bot.chat('Antrean tugas dibersihkan.');
  } else {
    memory.recordChat(username, message);
  }
});

function isReady(bot) {
  return typeof bot.health === 'number' && bot.health > 0 && bot.isAlive !== false;
}

bot.once('spawn', async () => {
  bot.pathfinder.setMovements(new Movements(bot));
  log(`OmniBot "${bot.username}" online di ${config.mc.host}:${config.mc.port}`);

  // Inisialisasi sensor
  const sensors = {
    self: new SelfSensor(bot),
    threat: new ThreatSensor(bot),
    world: new WorldSensor(bot),
  };

  // Inisialisasi handler
  const handlers = {
    combat: new CombatHandler(bot, { log }),
    mining: new MiningHandler(bot, { log }),
    farming: new FarmingHandler(bot, { log }),
    crafting: new CraftingHandler(bot, { log }),
    building: new BuildingHandler(bot, { log }),
    inventory: new InventoryHandler(bot, { log }),
  };

  // Inisialisasi FSM
  const fsm = new StateMachine(bot, { log });

  // Daftarkan seluruh State
  fsm.register(new IdleState(bot))
    .register(new CombatState(bot, handlers.combat, sensors.threat, sensors.self))
    .register(new EatingState(bot, sensors.self))
    .register(new MiningState(bot, handlers.mining, sensors.world))
    .register(new FarmingState(bot, handlers.farming, sensors.world))
    .register(new CraftingState(bot, handlers.crafting))
    .register(new BuildingState(bot, handlers.building))
    .register(new GatheringState(bot))
    .register(new InventoryState(bot, handlers.inventory))
    .register(new ExploringState(bot))
    .register(new SocializingState(bot, memory, advisor));

  // Daftarkan transisi prioritas
  for (const transition of buildTransitions(sensors)) {
    fsm.addTransition(transition);
  }

  // Loop utama FSM
  const tickMs = config.loop.tickMs || 3000;
  while (!controller.signal.aborted) {
    try {
      if (isReady(bot)) {
        // 1. Perbarui sensor
        sensors.self.update();
        sensors.threat.update(config.loop.senseRadius || 16);
        sensors.world.update(config.loop.senseRadius || 16);

        // 2. Evaluasi FSM
        const context = {
          sensors,
          handlers,
          memory,
          taskQueue,
          tick: fsm.tick,
        };
        await fsm.evaluate(context);
      }
    } catch (err) {
      log(`[FSM loop error] ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, tickMs));
  }
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
