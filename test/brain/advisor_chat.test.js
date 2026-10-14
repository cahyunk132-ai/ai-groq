import test from 'node:test';
import assert from 'node:assert/strict';
import { Advisor } from '../../src/brain/advisor.js';

test('Advisor: fallbackReply memberikan jawaban relevan berdasarkan pertanyaan pemain', () => {
  const advisor = new Advisor({ log: () => {} });
  const gameContext = {
    x: 100,
    y: 64,
    z: -200,
    health: 18,
    food: 19,
    currentTask: 'menambang batu bara',
  };

  // 1. Tanya koordinat / posisi
  const replyPos = advisor.fallbackReply('steve', 'bot posisi kamu di mana?', gameContext);
  assert.ok(replyPos.includes('100') && replyPos.includes('64') && replyPos.includes('-200'));

  // 2. Tanya HP / darah
  const replyHp = advisor.fallbackReply('steve', 'berapa darahmu?', gameContext);
  assert.ok(replyHp.includes('18/20'));

  // 3. Tanya tugas / lagi apa
  const replyTask = advisor.fallbackReply('steve', 'kamu lagi apa?', gameContext);
  assert.ok(replyTask.includes('menambang batu bara'));

  // 4. Sapaan halo
  const replyHalo = advisor.fallbackReply('steve', 'halo bot', gameContext);
  assert.ok(replyHalo.includes('Halo @steve'));

  // 5. Help / bantuan
  const replyHelp = advisor.fallbackReply('steve', '!help', gameContext);
  assert.ok(replyHelp.includes('!mine') && replyHelp.includes('!farm'));
});

test('Advisor: respondToChat memanggil LLM jika API key diset', async () => {
  let askedPrompt = null;
  const mockAsk = async (messages) => {
    askedPrompt = messages;
    return { reply: 'Halo steve, aku sedang bersantai di base!' };
  };

  const advisor = new Advisor({ log: () => {}, askFn: mockAsk });
  const gameContext = { x: 50, y: 70, z: 80, health: 20, food: 20 };

  const reply = await advisor.respondToChat('steve', 'halo bot', gameContext);
  assert.equal(reply, 'Halo steve, aku sedang bersantai di base!');
  assert.ok(askedPrompt);
  assert.ok(askedPrompt[0].content.includes('OmniBot'));
});
