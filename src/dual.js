// Runner untuk menjalankan 2 bot sekaligus (bot_adminv2 & bot_admin) di satu mesin / VPS
import { config } from './config.js';
import { createOmniBot } from './botFactory.js';

console.log(`${new Date().toISOString()} [DualRunner] Memulai inisialisasi 2 bot: ${config.mc.username} & ${config.mc.username2}`);

// 1. Jalankan Bot 1 (misal: bot_adminv2)
const bot1 = createOmniBot({
  username: config.mc.username,
  prefix: `[${config.mc.username}]`,
});

// 2. Beri jeda 4 detik sebelum Bot 2 login agar handshake server stabil
setTimeout(() => {
  console.log(`${new Date().toISOString()} [DualRunner] Memulai bot ke-2: ${config.mc.username2}`);
  const bot2 = createOmniBot({
    username: config.mc.username2,
    prefix: `[${config.mc.username2}]`,
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      console.log(`Menerima ${sig}, menghentikan kedua bot...`);
      bot1.stop();
      bot2.stop();
      process.exit(0);
    });
  }
}, 4000);
