/**
 * FSM engine untuk OmniBot.
 * Mendukung:
 * - Priority-based interrupts
 * - State stack (resume state sebelumnya setelah interrupt selesai)
 * - Async lifecycle hooks (onEnter, onUpdate, onExit)
 */
export class StateMachine {
  constructor(bot, { log = console.log } = {}) {
    this.bot = bot;
    this.log = log;
    this.states = new Map(); // name -> State
    this.transitions = [];   // Array<{ priority, target, condition, pushStack }>
    this.currentState = null;
    this.stateStack = [];    // string[] stack of state names
    this.tick = 0;
  }

  /**
   * Mendaftarkan state baru ke FSM.
   * @param {import('./State.js').State} state
   */
  register(state) {
    this.states.set(state.name, state);
    return this;
  }

  /**
   * Menambahkan aturan transisi prioritas.
   * @param {{ priority: number, target: string, condition: Function, pushStack?: boolean }} rule
   */
  addTransition(rule) {
    this.transitions.push({
      priority: rule.priority ?? 10,
      target: rule.target,
      condition: rule.condition,
      pushStack: Boolean(rule.pushStack),
    });
    // Urutkan dari prioritas tertinggi ke terendah (angka kecil = prioritas tinggi)
    this.transitions.sort((a, b) => a.priority - b.priority);
    return this;
  }

  /**
   * Mengevaluasi kondisi sensor setiap tick dan memicu transisi jika diperlukan.
   * @param {object} context
   */
  async evaluate(context) {
    this.tick++;

    // Evaluasi aturan transisi berdasarkan prioritas
    for (const rule of this.transitions) {
      if (rule.condition(context)) {
        const targetState = this.states.get(rule.target);
        if (!targetState) continue;

        // Jika sudah berada di state target yang sama, tidak perlu transisi ulang
        if (this.currentState?.name === rule.target) {
          break;
        }

        // Jika state saat ini tidak mengizinkan interrupt, lewati
        if (this.currentState && !this.currentState.interruptible) {
          break;
        }

        await this.transitionTo(targetState, context, rule.pushStack);
        break;
      }
    }

    // Jika belum ada state aktif, default ke 'idle' jika terdaftar
    if (!this.currentState) {
      const idle = this.states.get('idle');
      if (idle) {
        await this.transitionTo(idle, context);
      }
    }

    // Jalankan update pada state saat ini
    if (this.currentState) {
      try {
        const isFinished = await this.currentState.onUpdate(context);
        if (isFinished) {
          await this.popOrIdle(context);
        }
      } catch (err) {
        this.log(`[FSM] Error pada state ${this.currentState.name}: ${err.message}`);
        await this.popOrIdle(context);
      }
    }
  }

  /**
   * Pindah ke state baru dengan memanggil onExit dan onEnter.
   */
  async transitionTo(newState, context, pushStack = false) {
    if (this.currentState) {
      if (pushStack) {
        this.stateStack.push(this.currentState.name);
      }
      try {
        await this.currentState.onExit(context);
      } catch (err) {
        this.log(`[FSM] Error saat onExit ${this.currentState.name}: ${err.message}`);
      }
      this.currentState.active = false;
    }

    const prevName = this.currentState?.name ?? 'none';
    this.currentState = newState;
    this.currentState.active = true;
    this.log(`[FSM] [tick ${this.tick}] Transisi: ${prevName} -> ${newState.name}`);

    try {
      await this.currentState.onEnter(context);
    } catch (err) {
      this.log(`[FSM] Error saat onEnter ${newState.name}: ${err.message}`);
    }
  }

  /**
   * Kembali ke state sebelumnya di stack atau ke idle jika stack kosong.
   */
  async popOrIdle(context) {
    if (this.stateStack.length > 0) {
      const prevName = this.stateStack.pop();
      const prevState = this.states.get(prevName);
      if (prevState && prevState !== this.currentState) {
        await this.transitionTo(prevState, context, false);
        return;
      }
    }

    const idle = this.states.get('idle');
    if (idle && this.currentState !== idle) {
      await this.transitionTo(idle, context, false);
    }
  }
}
