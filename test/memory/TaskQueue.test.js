import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskQueue } from '../../src/memory/TaskQueue.js';

test('TaskQueue sorts tasks by priority and enqueues/dequeues correctly', () => {
  const queue = new TaskQueue();

  queue.enqueue({ type: 'exploring', priority: 10 });
  queue.enqueue({ type: 'mining', priority: 3 });
  queue.enqueue({ type: 'combat', priority: 1 });

  assert.equal(queue.hasTask(), true);
  assert.equal(queue.currentTask().type, 'combat');

  const t1 = queue.dequeue();
  assert.equal(t1.type, 'combat');

  const t2 = queue.dequeue();
  assert.equal(t2.type, 'mining');

  const t3 = queue.dequeue();
  assert.equal(t3.type, 'exploring');

  assert.equal(queue.hasTask(), false);
});
