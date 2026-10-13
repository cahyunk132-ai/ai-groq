// ACT (validasi): memeriksa JSON dari Groq sebelum dieksekusi.
// Keputusan yang tidak valid ditolak, bukan dijalankan apa adanya.
import { HUNGER_LOW, SEED_ITEMS } from './constants.js';
import { STRUCTURES } from './build.js';

export const ACTIONS = Object.freeze([
  'explore', 'mine', 'attack', 'farm', 'eat', 'flee',
  'gather', 'craft', 'build', 'idle', 'chat',
]);

const MAX_SAY_LENGTH = 200;
const MAX_GOAL_LENGTH = 120;
const BUILD_REACH = 16;

export class DecisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DecisionError';
  }
}

const samePos = (a, b) => Array.isArray(a) && a.length === 3 && a.every((v, i) => v === b[i]);
const clampInt = (v, lo, hi, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
};

/** Mengurai target menjadi { pos: [x,y,z] } atau { id: number } atau null. */
export function parseTarget(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (Array.isArray(raw)) {
    if (raw.length === 3 && raw.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return { pos: raw.map(Math.floor) };
    }
    throw new DecisionError('target koordinat harus berupa [x, y, z] angka');
  }
  if (typeof raw === 'number' && Number.isInteger(raw)) return { id: raw };
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return { id: Number(raw.trim()) };
  throw new DecisionError(`target tidak dikenali: ${JSON.stringify(raw)}`);
}

/** Teks untuk di-chat: satu baris, dipotong. Null jika kosong. */
export function sanitizeSay(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_SAY_LENGTH);
  return text || null;
}

/**
 * Memvalidasi dan menormalkan keputusan terhadap state saat ini.
 * Melempar DecisionError jika keputusan tidak bisa dijalankan.
 */
export function validateDecision(raw, state) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DecisionError('respons bukan objek JSON');
  }
  const action = typeof raw.action === 'string' ? raw.action.trim().toLowerCase() : '';
  if (!ACTIONS.includes(action)) {
    throw new DecisionError(`aksi tidak dikenal: ${JSON.stringify(raw.action)}`);
  }

  const decision = {
    thought: typeof raw.thought === 'string' ? raw.thought.slice(0, 500) : '',
    action,
    target: null,
    item_to_use: null,
    count: 1,
    structure: null,
    seconds: null,
    say: sanitizeSay(raw.say),
    goal: typeof raw.goal === 'string' && raw.goal.trim() ? raw.goal.trim().slice(0, MAX_GOAL_LENGTH) : null,
  };
  const target = parseTarget(raw.target);
  const itemName = typeof raw.item_to_use === 'string' && raw.item_to_use.trim()
    ? raw.item_to_use.trim().toLowerCase()
    : null;

  switch (action) {
    case 'explore':
      return decision;

    case 'mine': {
      if (!target?.pos) throw new DecisionError('mine butuh target [x, y, z]');
      const ore = state.nearbyBlocks.ores.find((o) => samePos(o.pos, target.pos));
      if (!ore) throw new DecisionError(`tidak ada ore di ${target.pos}`);
      decision.target = target.pos;
      return decision;
    }

    case 'farm': {
      if (!target?.pos) throw new DecisionError('farm butuh target [x, y, z]');
      const crop = state.nearbyBlocks.crops.find((c) => samePos(c.pos, target.pos));
      const land = state.nearbyBlocks.farmland.find((f) => samePos(f.pos, target.pos));
      if (crop) {
        if (!crop.mature) throw new DecisionError(`tanaman di ${target.pos} belum siap panen`);
      } else if (land) {
        if (!state.inventory.some((i) => SEED_ITEMS.includes(i.name))) {
          throw new DecisionError('tidak ada bibit untuk ditanam');
        }
      } else {
        throw new DecisionError(`tidak ada tanaman atau farmland di ${target.pos}`);
      }
      decision.target = target.pos;
      return decision;
    }

    case 'attack': {
      if (!target?.id && target?.id !== 0) throw new DecisionError('attack butuh entity id');
      const entity = state.nearbyEntities.find((e) => e.id === target.id);
      if (!entity) throw new DecisionError(`entity ${target.id} tidak ada di sekitar`);
      if (entity.intent === 'Player') throw new DecisionError('dilarang menyerang pemain');
      if (entity.intent === 'Neutral') throw new DecisionError('target bukan mob agresif');
      if (entity.intent === 'Passive' && state.hunger >= HUNGER_LOW) {
        throw new DecisionError('jangan menyerang mob pasif saat tidak lapar');
      }
      decision.target = target.id;
      return decision;
    }

    case 'eat': {
      const foods = state.inventory.filter((i) => i.isFood);
      const food = itemName
        ? foods.find((i) => i.name === itemName)
        : foods[0];
      if (!food) throw new DecisionError(`tidak ada makanan${itemName ? ` "${itemName}"` : ''} di inventory`);
      decision.item_to_use = food.name;
      return decision;
    }

    case 'flee': {
      if (target?.pos) decision.target = target.pos;
      return decision;
    }

    case 'gather': {
      if (!itemName) throw new DecisionError('gather butuh item_to_use berisi nama blok');
      const resource = (state.nearbyResources || []).find((r) => r.name === itemName);
      if (!resource) throw new DecisionError(`tidak ada ${itemName} di sekitar`);
      decision.item_to_use = itemName;
      decision.count = clampInt(raw.count, 1, 8, 1);
      return decision;
    }

    case 'craft': {
      if (!itemName) throw new DecisionError('craft butuh item_to_use berisi nama item');
      if (!(state.craftable || []).includes(itemName)) {
        throw new DecisionError(`${itemName} tidak bisa dibuat sekarang`);
      }
      decision.item_to_use = itemName;
      decision.count = clampInt(raw.count, 1, 16, 1);
      return decision;
    }

    case 'build': {
      if (!itemName) throw new DecisionError('build butuh item_to_use berisi nama blok bahan');
      const material = state.inventory.find((i) => i.name === itemName && i.count > 0);
      if (!material) throw new DecisionError(`tidak punya ${itemName} untuk membangun`);
      const structure = typeof raw.structure === 'string' ? raw.structure.trim().toLowerCase() : 'platform';
      if (!STRUCTURES.includes(structure)) {
        throw new DecisionError(`struktur tidak dikenal: ${JSON.stringify(raw.structure)}`);
      }
      if (target?.pos) {
        const [px, py, pz] = state.position;
        const [tx, ty, tz] = target.pos;
        const dist = Math.max(Math.abs(tx - px), Math.abs(ty - py), Math.abs(tz - pz));
        if (dist > BUILD_REACH) throw new DecisionError(`target build terlalu jauh (${dist} blok)`);
      }
      decision.item_to_use = itemName;
      decision.structure = structure;
      decision.target = target?.pos ?? null;
      return decision;
    }

    case 'idle': {
      decision.seconds = clampInt(raw.seconds, 2, 15, 5);
      return decision;
    }

    case 'chat': {
      if (!decision.say) throw new DecisionError('chat butuh field say yang berisi teks');
      return decision;
    }

    default:
      throw new DecisionError(`aksi tidak ditangani: ${action}`);
  }
}
