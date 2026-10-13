// Loop OODA: Observe -> Orient -> Decide -> Act, diulang setiap tick.
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * @param {object} p
 * @param {Function} p.observe  () => state
 * @param {Function} p.decide   (state) => decision
 * @param {Function} p.act      (decision, state) => Promise<result>
 * @param {number}   p.tickMs   jeda antar putaran
 * @param {AbortSignal} [p.signal]
 * @param {Function} [p.log]
 */
export async function runOodaLoop({ observe, decide, act, tickMs, signal, log = console.log }) {
  let tick = 0;
  while (!signal?.aborted) {
    tick += 1;
    try {
      const state = observe();                              // Observe + Orient
      const decision = await decide(state);                 // Decide
      log(`[tick ${tick}] task=${state.currentTaskPriority} hp=${state.health} food=${state.hunger} -> ${decision.action} ${JSON.stringify(decision.target)} (${decision.source}) | ${decision.thought}`);
      if (signal?.aborted) break;
      const result = await act(decision, state);            // Act
      if (result?.message) log(`[tick ${tick}] ${result.message}`);
    } catch (err) {
      log(`[tick ${tick}] error: ${err.message}`);
    }
    try {
      await sleep(tickMs, undefined, { signal });
    } catch {
      break; // dibatalkan
    }
  }
}
