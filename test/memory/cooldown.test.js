import test from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../../src/memory/Memory.js';

test('Memory: pelacakan cooldown sapaan fisik dan chat anti-spam', () => {
  const memory = new Memory();
  const player = 'bot_admin';

  // 1. Awalnya canEncounter harus true
  assert.equal(memory.canEncounter(player, 60000), true);

  // 2. Setelah dicatat, canEncounter harus false
  memory.recordEncounter(player);
  assert.equal(memory.canEncounter(player, 60000), false);
  // Case-insensitive check
  assert.equal(memory.canEncounter('BOT_ADMIN', 60000), false);

  // 3. canChat awalnya true
  assert.equal(memory.canChat(player, 10000), true);

  // 4. Setelah kirim chat, canChat harus false
  memory.recordChatTime(player);
  assert.equal(memory.canChat(player, 10000), false);
  assert.equal(memory.canChat('bot_admin', 10000), false);

  // 5. Pemain lain tidak terpengaruh
  assert.equal(memory.canEncounter('pemain_lain', 60000), true);
  assert.equal(memory.canChat('pemain_lain', 10000), true);

  // 6. Null/undefined aman
  assert.equal(memory.canEncounter(null, 60000), false);
  assert.equal(memory.canChat(null, 10000), false);
});
