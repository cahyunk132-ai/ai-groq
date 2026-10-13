import test from 'node:test';
import assert from 'node:assert/strict';
import { State } from '../../src/fsm/State.js';
import { StateMachine } from '../../src/fsm/StateMachine.js';

class MockState extends State {
  constructor(bot, name, { interruptible = true, autoFinish = false } = {}) {
    super(bot, name);
    this._interruptible = interruptible;
    this.autoFinish = autoFinish;
    this.enterCalls = 0;
    this.updateCalls = 0;
    this.exitCalls = 0;
  }

  get interruptible() {
    return this._interruptible;
  }

  async onEnter(context) {
    this.enterCalls++;
  }

  async onUpdate(context) {
    this.updateCalls++;
    return this.autoFinish;
  }

  async onExit(context) {
    this.exitCalls++;
  }
}

test('StateMachine transitions to target state when condition matches', async () => {
  const fsm = new StateMachine(null, { log: () => {} });
  const idle = new MockState(null, 'idle');
  const combat = new MockState(null, 'combat');

  fsm.register(idle).register(combat);
  fsm.addTransition({
    priority: 1,
    target: 'combat',
    condition: (ctx) => ctx.hasThreat === true,
  });

  const ctx = { hasThreat: false };
  await fsm.evaluate(ctx);
  assert.equal(fsm.currentState.name, 'idle');

  ctx.hasThreat = true;
  await fsm.evaluate(ctx);
  assert.equal(fsm.currentState.name, 'combat');
  assert.equal(combat.enterCalls, 1);
});

test('StateMachine supports priority interrupt and state stack restoration', async () => {
  const fsm = new StateMachine(null, { log: () => {} });
  const mining = new MockState(null, 'mining', { autoFinish: false });
  const combat = new MockState(null, 'combat', { autoFinish: true }); // finishes immediately

  fsm.register(mining).register(combat);
  fsm.addTransition({
    priority: 5,
    target: 'mining',
    condition: (ctx) => ctx.wantMine === true,
  });
  fsm.addTransition({
    priority: 1,
    target: 'combat',
    condition: (ctx) => ctx.underAttack === true,
    pushStack: true,
  });

  // Start mining
  await fsm.evaluate({ wantMine: true, underAttack: false });
  assert.equal(fsm.currentState.name, 'mining');

  // Combat interrupts mining (priority 1 > 5)
  await fsm.evaluate({ wantMine: true, underAttack: true });
  assert.equal(combat.enterCalls, 1);
  // Since combat autoFinish=true, onUpdate finishes and pops back to mining
  assert.equal(fsm.currentState.name, 'mining');
});

test('StateMachine respects uninterruptible states', async () => {
  const fsm = new StateMachine(null, { log: () => {} });
  const eating = new MockState(null, 'eating', { interruptible: false, autoFinish: false });
  const combat = new MockState(null, 'combat');

  fsm.register(eating).register(combat);
  fsm.addTransition({
    priority: 1,
    target: 'combat',
    condition: () => true,
  });

  // Set eating as current state
  await fsm.transitionTo(eating, {});
  assert.equal(fsm.currentState.name, 'eating');

  // Evaluate should not switch because eating is not interruptible
  await fsm.evaluate({});
  assert.equal(fsm.currentState.name, 'eating');
});
