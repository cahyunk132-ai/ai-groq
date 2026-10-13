import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../src/memory.js';

test('recordAction hanya menyimpan beberapa tindakan terakhir', () => {
  const m = new Memory();
  for (let i = 0; i < 10; i++) m.recordAction({ action: 'explore', result: `r${i}` });
  const snap = m.snapshot();
  assert.equal(snap.recentActions.length, 6);
  assert.equal(snap.recentActions[5].result, 'r9');
});

test('setGoal menyimpan tujuan dan mengabaikan teks kosong', () => {
  const m = new Memory();
  m.setGoal('  build shelter  ');
  assert.equal(m.snapshot().currentGoal, 'build shelter');
  m.setGoal('   ');
  assert.equal(m.snapshot().currentGoal, 'build shelter');
});

test('chat pending dibersihkan setelah diproses', () => {
  const m = new Memory();
  m.recordChat('Steve', 'halo');
  m.recordChat('Alex', 'bantu dong');
  assert.equal(m.snapshot().pendingChat.length, 2);
  m.clearPendingChat();
  assert.equal(m.snapshot().pendingChat.length, 0);
});

test('buildAnchor menyimpan pusat bangunan terakhir', () => {
  const m = new Memory();
  assert.equal(m.buildAnchor(), null);
  m.setBuildOrigin([10, 64, -3]);
  assert.deepEqual(m.buildAnchor(), [10, 64, -3]);
});

test('recordAction menyimpan jenis bangunan sebagai detail', () => {
  const m = new Memory();
  m.recordAction({ action: 'build', result: 'ok', detail: 'tower' });
  assert.equal(m.snapshot().recentActions[0].detail, 'tower');
});
