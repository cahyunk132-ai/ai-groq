// Kebijakan cadangan (berbasis aturan) dan penyaring keselamatan.
// Dipakai saat Groq gagal/tidak valid, dan untuk menimpa keputusan berbahaya.
import {
  HP_CRITICAL_RATIO, HOSTILE_ENGAGE_DISTANCE, HOSTILE_FLEE_DISTANCE, HUNGER_LOW, HP_MAX,
  SEED_ITEMS, LOG_NAME, BUILD_MATERIAL_NAME, BUILD_MATERIAL_MIN,
} from './constants.js';

const decision = (action, extra = {}) => ({
  thought: extra.thought || '',
  action,
  target: extra.target ?? null,
  item_to_use: extra.item_to_use ?? null,
  count: extra.count ?? 1,
  structure: extra.structure ?? null,
  seconds: extra.seconds ?? null,
  say: null,
  goal: extra.goal ?? null,
});

function bestFood(state) {
  return state.inventory.find((i) => i.isFood) || null;
}

function countMatching(inventory, pattern) {
  return inventory.filter((i) => pattern.test(i.name)).reduce((sum, i) => sum + i.count, 0);
}

/** Keputusan cadangan tanpa LLM. */
export function fallbackDecision(state) {
  const craftable = state.craftable || [];
  const resources = state.nearbyResources || [];
  const hpCritical = state.health / (state.maxHealth || HP_MAX) < HP_CRITICAL_RATIO;
  const hostile = state.nearbyEntities.find(
    (e) => e.intent === 'Aggressive' && e.distance <= HOSTILE_ENGAGE_DISTANCE,
  );
  const food = bestFood(state);

  if (hpCritical && hostile && hostile.distance <= HOSTILE_FLEE_DISTANCE) {
    return decision('flee', { thought: 'HP kritis dan musuh sangat dekat.' });
  }
  if (hpCritical && food) {
    return decision('eat', { thought: 'HP kritis, makan untuk memulihkan.', item_to_use: food.name });
  }
  if (hostile) {
    return decision('attack', { thought: 'Musuh agresif di dekat bot.', target: hostile.id });
  }
  if (state.hunger < HUNGER_LOW && food) {
    return decision('eat', { thought: 'Lapar.', item_to_use: food.name });
  }

  const matureCrop = state.nearbyBlocks.crops.find((c) => c.mature);
  if (matureCrop) {
    return decision('farm', { thought: 'Ada tanaman siap panen.', target: matureCrop.pos });
  }
  const hasSeeds = state.inventory.some((i) => SEED_ITEMS.includes(i.name));
  if (hasSeeds && state.nearbyBlocks.farmland.length) {
    return decision('farm', { thought: 'Ada farmland kosong dan bibit.', target: state.nearbyBlocks.farmland[0].pos });
  }

  const pickaxeMissing = !state.inventory.some((i) => i.name.endsWith('_pickaxe'));
  const pickaxe = craftable.find((n) => n.endsWith('_pickaxe'));
  if (pickaxeMissing && pickaxe) {
    return decision('craft', { thought: 'Belum punya pickaxe, buat sekarang.', item_to_use: pickaxe });
  }

  const logs = countMatching(state.inventory, LOG_NAME);
  const logSource = resources.find((r) => LOG_NAME.test(r.name));
  if (logs < 8 && logSource) {
    return decision('gather', { thought: 'Kayu masih sedikit, kumpulkan.', item_to_use: logSource.name, count: 8 });
  }

  const materials = countMatching(state.inventory, BUILD_MATERIAL_NAME);
  const recentlyBuilt = (state.recentActions || []).some((a) => a.action === 'build');
  if (materials >= BUILD_MATERIAL_MIN && !recentlyBuilt) {
    const material = state.inventory
      .filter((i) => BUILD_MATERIAL_NAME.test(i.name))
      .sort((a, b) => b.count - a.count)[0];
    return decision('build', { thought: 'Bahan cukup, bangun tempat berlindung.', item_to_use: material.name, structure: 'shelter' });
  }

  if (state.nearbyBlocks.ores.length) {
    return decision('mine', { thought: 'Ore terdekat dengan prioritas tertinggi.', target: state.nearbyBlocks.ores[0].pos });
  }
  const stoneSource = resources.find((r) => r.name === 'stone' || r.name === 'cobblestone');
  if (stoneSource && countMatching(state.inventory, /^cobblestone$/) < 16) {
    return decision('gather', { thought: 'Kumpulkan batu untuk alat dan bangunan.', item_to_use: stoneSource.name, count: 8 });
  }
  return decision('explore', { thought: 'Tidak ada target, menjelajah.' });
}

/**
 * Menimpa keputusan yang berbahaya dengan aturan keselamatan.
 * - HP kritis + musuh dekat => flee.
 * - HP kritis + tidak ada musuh dekat + ada makanan => eat.
 */
export function applySafetyOverrides(d, state) {
  const hpCritical = state.health / (state.maxHealth || HP_MAX) < HP_CRITICAL_RATIO;
  if (!hpCritical) return d;

  const hostileClose = state.nearbyEntities.some(
    (e) => e.intent === 'Aggressive' && e.distance <= HOSTILE_FLEE_DISTANCE,
  );
  if (hostileClose && d.action !== 'flee' && d.action !== 'eat') {
    return { ...decision('flee', { thought: `${d.thought} [override: HP kritis, musuh dekat]` }), say: d.say, goal: d.goal };
  }
  const food = bestFood(state);
  if (!hostileClose && food && d.action !== 'eat' && d.action !== 'flee') {
    return {
      ...decision('eat', { thought: `${d.thought} [override: HP kritis]`, item_to_use: food.name }),
      say: d.say,
      goal: d.goal,
    };
  }
  return d;
}
