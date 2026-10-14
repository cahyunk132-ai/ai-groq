// Entry point OmniBot: boot bot tunggal (mode produksi / single VPS)
import { config } from './config.js';
import { createOmniBot } from './botFactory.js';

const instance = createOmniBot({
  username: config.mc.username,
  prefix: `[${config.mc.username}]`,
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`Menerima ${sig}, menghentikan bot...`);
    instance.stop();
    process.exit(0);
  });
}
