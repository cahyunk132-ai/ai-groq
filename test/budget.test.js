import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GroqBudget } from '../src/budget.js';

function clock(start = Date.UTC(2026, 9, 13, 10, 0, 0)) {
  const c = { t: start, now: () => c.t, advance: (ms) => { c.t += ms; } };
  return c;
}

const quiet = { pendingChat: [] };
const chat = { pendingChat: [{ from: 'Budi', message: 'halo' }] };

test('panggilan pertama selalu boleh; setelah dipanggil harus menunggu jadwal', () => {
  const c = clock();
  const b = new GroqBudget({ now: c.now });
  assert.equal(b.check(quiet).ok, true);
  b.recordCall();
  assert.equal(b.check(quiet).ok, false);
  c.advance(5 * 60 * 1000);
  assert.equal(b.check(quiet).ok, true);
});

test('chat yang belum dijawab boleh memicu Groq lebih cepat (1 menit)', () => {
  const c = clock();
  const b = new GroqBudget({ now: c.now });
  b.recordCall();
  assert.equal(b.check(chat).ok, false);
  c.advance(60 * 1000);
  assert.deepEqual(b.check(chat), { ok: true, reason: 'chat' });
});

test('kuota harian habis menghentikan panggilan sampai hari berikutnya', () => {
  const c = clock();
  const b = new GroqBudget({ now: c.now, dailyCallCap: 2, planIntervalMs: 1000 });
  b.recordCall();
  c.advance(1000); b.recordCall();
  c.advance(1000);
  assert.equal(b.check(quiet).reason, 'kuota harian habis');
  c.advance(24 * 60 * 60 * 1000);
  assert.equal(b.check(quiet).ok, true);
  assert.equal(b.snapshot().callsToday, 0);
});

test('HTTP 429 memberi jeda cooldown', () => {
  const c = clock();
  const b = new GroqBudget({ now: c.now, cooldownMs: 60000 });
  b.recordRateLimit();
  assert.equal(b.check(quiet).reason, 'cooldown setelah 429');
  c.advance(60000);
  assert.equal(b.check(quiet).ok, true);
});

test('hitungan disimpan lewat store dan dibaca ulang setelah restart', () => {
  const c = clock();
  let saved = null;
  const store = { load: () => saved, save: (d) => { saved = d; } };
  const b = new GroqBudget({ now: c.now, store });
  b.recordCall(); b.recordCall();
  const again = new GroqBudget({ now: c.now, store });
  assert.equal(again.snapshot().callsToday, 2);
  assert.equal(again.check(quiet).ok, false, 'jadwal tetap dihormati setelah restart');
});
