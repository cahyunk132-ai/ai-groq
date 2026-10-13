import { State } from '../fsm/State.js';
import * as C from '../constants.js';

export class CombatState extends State {
  constructor(bot, combatHandler, threatSensor, selfSensor) {
    super(bot, 'combat');
    this.combat = combatHandler;
    this.threat = threatSensor;
    this.self = selfSensor;
  }

  async onEnter(context) {
    this.combat?.log?.('[state:combat] Memasuki pertempuran!');
  }

  async onUpdate(context) {
    const threatSensor = context?.sensors?.threat ?? this.threat;
    const selfSensor = context?.sensors?.self ?? this.self;

    const target = threatSensor?.highestThreat() ?? threatSensor?.nearestHostile(C.HOSTILE_ENGAGE_DISTANCE);
    if (!target) {
      // Tidak ada musuh lagi di sekitar
      return true;
    }

    // Cek kondisi HP kritis
    if (selfSensor?.hpRatio < C.HP_CRITICAL_RATIO && target.distance <= C.HOSTILE_FLEE_DISTANCE) {
      this.combat?.log?.(`[state:combat] HP kritis (${selfSensor.hp}/20)! Melakukan kiting/flee dari ${target.name}`);
      await this.combat.fleeFrom(target.entity, 8);
      return false;
    }

    // Bertarung melawan target
    await this.combat.attack(target.entity);
    return false;
  }

  async onExit(context) {
    this.combat?.unblock?.();
    if (this.bot?.clearControlStates) {
      this.bot.clearControlStates();
    }
  }
}
