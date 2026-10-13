// ACT (validasi): memeriksa JSON dari Groq sebelum dieksekusi.
// Keputusan yang tidak valid ditolak, bukan dijalankan apa adanya.
import { HUNGER_LOW, SEED_ITEMS } from './constants.js';

export const ACTIONS = Object.freeze(['explore', 'mine', 'attack', 'farm', 'eat', 'flee']);

export class DecisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DecisionError';
  }
}

const samePos = (a, b) => Array.isArray(a) && a.length === 3 && a.every((v, i) => v === b[i]);

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
        const hasSeeds = state.inventory.some((i) => SEED_ITEMS.includes(i.name));
        if (!hasSeeds) throw new DecisionError('tidak ada bibit untuk ditanam');
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

    default:
      throw new DecisionError(`aksi tidak ditangani: ${action}`);
  }
}
