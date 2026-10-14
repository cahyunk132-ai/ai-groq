// Runner untuk menjalankan 2 bot sekaligus (bot_adminv2 & bot_admin) di satu mesin / VPS
import { config } from './config.js';
import { createOmniBot } from './botFactory.js';

console.log(`${new Date().toISOString()} [DualRunner] Memulai inisialisasi 2 bot: ${config.mc.username} & ${config.mc.username2}`);

function startManagedBot(username, initialDelayMs = 0) {
  let active = true;
  let currentInstance = null;

  const launch = () => {
    if (!active) return;
    console.log(`${new Date().toISOString()} [DualRunner] Menghubungkan bot: ${username}`);
    currentInstance = createOmniBot({
      username,
      prefix: `[${username}]`,
    });

    currentInstance.bot.on('end', () => {
      if (!active) return;
      console.log(`${new Date().toISOString()} [DualRunner] Bot "${username}" terputus. Reconnect dalam 15 detik...`);
      setTimeout(launch, 15000);
    });
  };

  setTimeout(launch, initialDelayMs);

  return {
    stop: () => {
      active = false;
      if (currentInstance) currentInstance.stop();
    },
  };
}

// 1. Jalankan Bot 1 segera
const bot1 = startManagedBot(config.mc.username, 0);

// 2. Beri jeda 10 detik sebelum Bot 2 login agar melewati throttle server
const bot2 = startManagedBot(config.mc.username2, 10000);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`Menerima ${sig}, menghentikan kedua bot...`);
    bot1.stop();
    bot2.stop();
    process.exit(0);
  });
}
