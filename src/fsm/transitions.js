import * as C from '../constants.js';

/**
 * Membangun aturan transisi FSM berbasis prioritas.
 * Prioritas angka lebih kecil = urgensi lebih tinggi (1 = kelangsungan hidup tertinggi).
 *
 * @param {object} [sensors] - Sensor opsional jika ingin ditutup dalam closure
 * @returns {Array<{ priority: number, target: string, condition: (ctx: object) => boolean, pushStack?: boolean }>}
 */
export function buildTransitions(sensors = null) {
  const getSensors = (ctx) => ctx?.sensors ?? sensors ?? {};

  return [
    // P1: HP kritis + musuh dekat => Combat (CombatState akan mengarahkan ke flee)
    {
      priority: 1,
      target: 'combat',
      pushStack: true,
      condition: (ctx) => {
        const s = getSensors(ctx);
        const self = s.self;
        const threat = s.threat;
        if (!self || !threat) return false;
        return (
          self.hpRatio < C.HP_CRITICAL_RATIO &&
          threat.nearestHostile(C.HOSTILE_FLEE_DISTANCE) !== null
        );
      },
    },

    // P2: HP kritis + ada makanan + tidak ada musuh dekat => Makan untuk regenerasi
    {
      priority: 2,
      target: 'eating',
      pushStack: true,
      condition: (ctx) => {
        const s = getSensors(ctx);
        const self = s.self;
        const threat = s.threat;
        if (!self || !threat) return false;
        return (
          self.hpRatio < C.HP_CRITICAL_RATIO &&
          self.hasFood &&
          threat.nearestHostile(C.HOSTILE_FLEE_DISTANCE) === null
        );
      },
    },

    // P3: Musuh agresif terdeteksi dalam jarak tempur => Combat
    {
      priority: 3,
      target: 'combat',
      pushStack: true,
      condition: (ctx) => {
        const s = getSensors(ctx);
        const threat = s.threat;
        if (!threat) return false;
        return threat.nearestHostile(C.HOSTILE_ENGAGE_DISTANCE) !== null;
      },
    },

    // P4: Lapar & ada makanan di inventory => Makan
    {
      priority: 4,
      target: 'eating',
      pushStack: true,
      condition: (ctx) => {
        const s = getSensors(ctx);
        const self = s.self;
        if (!self) return false;
        return self.hunger < C.HUNGER_LOW && self.hasFood;
      },
    },

    // P5: Inventaris penuh => Manajemen inventaris / simpan ke chest
    {
      priority: 5,
      target: 'inventory',
      pushStack: false,
      condition: (ctx) => {
        const s = getSensors(ctx);
        const self = s.self;
        return Boolean(self?.inventoryFull);
      },
    },

    // P6: Alat esensial rusak atau tidak tersedia => Crafting
    {
      priority: 6,
      target: 'crafting',
      pushStack: true,
      condition: (ctx) => {
        const s = getSensors(ctx);
        const self = s.self;
        return Boolean(self?.needsEssentialTool);
      },
    },

    // P7: Ada tugas aktif dalam antrean TaskQueue
    {
      priority: 7,
      target: 'mining', // dynamically resolved jika state terdaftar atau per-task condition
      pushStack: false,
      condition: (ctx) => {
        const task = ctx?.taskQueue?.currentTask?.();
        return task?.type === 'mining';
      },
    },
    {
      priority: 7,
      target: 'farming',
      pushStack: false,
      condition: (ctx) => {
        const task = ctx?.taskQueue?.currentTask?.();
        return task?.type === 'farming';
      },
    },
    {
      priority: 7,
      target: 'building',
      pushStack: false,
      condition: (ctx) => {
        const task = ctx?.taskQueue?.currentTask?.();
        return task?.type === 'building';
      },
    },
    {
      priority: 7,
      target: 'gathering',
      pushStack: false,
      condition: (ctx) => {
        const task = ctx?.taskQueue?.currentTask?.();
        return task?.type === 'gathering';
      },
    },

    // P8: Pesan obrolan pemain belum dijawab => Socializing
    {
      priority: 8,
      target: 'socializing',
      pushStack: false,
      condition: (ctx) => {
        return Boolean(ctx?.memory?.pendingChat);
      },
    },

    // P9: Tanpa tugas eksplisit => Jelajah / mencari sumber daya
    {
      priority: 9,
      target: 'exploring',
      pushStack: false,
      condition: (ctx) => {
        // Eksplorasi saat idle dan tidak ada antrean
        return !ctx?.taskQueue?.hasTask?.() && !ctx?.memory?.pendingChat;
      },
    },
  ];
}
