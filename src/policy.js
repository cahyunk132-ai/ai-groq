// Kebijakan cadangan (berbasis aturan) dan penyaring keselamatan.
// Dipakai saat Groq tidak dipanggil (kuota/jeda), gagal, atau keputusannya tidak valid.
// Tujuannya: bot tetap punya kegiatan yang masuk akal (bertani, menambang, membangun,
// membuat alat, bertarung, mengobrol) tanpa perlu LLM.
import { STRUCTURES, blocksNeeded } from './build.js';
import {
  HP_CRITICAL_RATIO, HOSTILE_ENGAGE_DISTANCE, HOSTILE_FLEE_DISTANCE, HUNGER_LOW, HP_MAX,
  SEED_ITEMS, LOG_NAME, BUILD_MATERIAL_NAME, BUILD_MATERIAL_MIN,
} from './constants.js';
import { hasUsableTool, currentTask } from './state.js';

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

/** Label bahasa Indonesia untuk tugas, dipakai di chat. */
const TASK_LABEL = {
  Fighting: 'jaga diri',
  Eating: 'makan dulu',
  Crafting: 'bikin alat',
  Farming: 'ngurus kebun',
  Socializing: 'ngobrol',
  Gathering: 'ngumpulin bahan',
  Building: 'bangun-bangun',
  Mining: 'nambang',
  Exploring: 'jalan-jalan',
};

const STRUCTURE_LABEL = {
  shelter: 'rumah',
  tower: 'menara',
  platform: 'pelataran',
  wall: 'tembok',
};

// Ore yang butuh pickaxe batu atau lebih baik (pickaxe kayu hanya bisa coal).
const STONE_TIER_ORE = /(iron|gold|diamond|redstone|lapis|emerald|copper|ancient_debris)/;

/**
 * Struktur berikutnya yang bahannya cukup dan tidak sama dengan bangunan terakhir.
 * Urutan dimulai dari yang paling berguna untuk perlindungan.
 */
export function nextStructure(materialCount, lastStructure) {
  const order = ['shelter', 'tower', 'platform', 'wall'].filter((s) => STRUCTURES.includes(s));
  return order.find((s) => s !== lastStructure && materialCount >= blocksNeeded(s)) || null;
}

function bestFood(state) {
  return state.inventory.find((i) => i.isFood) || null;
}

function countMatching(inventory, pattern) {
  return inventory.filter((i) => pattern.test(i.name)).reduce((sum, i) => sum + i.count, 0);
}

/** Alat terbaik yang bisa dibuat dari daftar prioritas, atau null. */
function craftFirst(craftable, names) {
  return names.find((n) => craftable.includes(n)) || null;
}

/** Ore yang bisa ditambang dengan pickaxe yang dimiliki. */
function mineableOres(state) {
  const stoneOrBetter = state.inventory.some((i) => /^(stone|iron|golden|diamond|netherite)_pickaxe$/.test(i.name)
    && (i.durability === undefined || i.durability >= 10));
  return (state.nearbyBlocks.ores || []).filter((o) => stoneOrBetter || !STONE_TIER_ORE.test(o.name));
}

/** Pilihan kegiatan utama, urutan mengikuti prioritas survival lalu produktivitas. */
function chooseActivity(state) {
  const craftable = state.craftable || [];
  const resources = state.nearbyResources || [];
  const inv = state.inventory;
  const hpCritical = state.health / (state.maxHealth || HP_MAX) < HP_CRITICAL_RATIO;
  const hostile = state.nearbyEntities.find(
    (e) => e.intent === 'Aggressive' && e.distance <= HOSTILE_ENGAGE_DISTANCE,
  );
  const food = bestFood(state);
  const last = (state.recentActions || []).slice(-1)[0];

  // 1. Keselamatan.
  if (hpCritical && hostile && hostile.distance <= HOSTILE_FLEE_DISTANCE) {
    return decision('flee', { thought: 'HP kritis dan musuh sangat dekat.', goal: 'stay alive, get away from mobs' });
  }
  if (hpCritical && food) {
    return decision('eat', { thought: 'HP kritis, makan untuk memulihkan.', item_to_use: food.name, goal: 'recover health' });
  }
  if (hostile) {
    return decision('attack', { thought: 'Musuh agresif di dekat bot.', target: hostile.id, goal: 'defend against hostile mobs' });
  }
  if (state.hunger < HUNGER_LOW && food) {
    return decision('eat', { thought: 'Lapar.', item_to_use: food.name, goal: 'recover hunger' });
  }

  // 2. Kebun: panen tanaman matang, tanam bibit, atau bajak tanah jika punya cangkul.
  const matureCrop = state.nearbyBlocks.crops.find((c) => c.mature);
  if (matureCrop) {
    return decision('farm', { thought: 'Ada tanaman siap panen.', target: matureCrop.pos, goal: 'harvest the crops' });
  }
  const hasSeeds = inv.some((i) => SEED_ITEMS.includes(i.name));
  if (hasSeeds && state.nearbyBlocks.farmland.length) {
    return decision('farm', { thought: 'Ada farmland kosong dan bibit.', target: state.nearbyBlocks.farmland[0].pos, goal: 'replant the farm' });
  }
  const hasHoe = hasUsableTool(inv, 'hoe');
  if (hasSeeds && hasHoe && (state.nearbyBlocks.tillable || []).length) {
    const soil = state.nearbyBlocks.tillable[0];
    return decision('farm', { thought: 'Bibit ada dan cangkul siap, bajak tanah jadi kebun.', target: soil.pos, goal: 'turn dirt into farmland' });
  }

  // 3. Alat: pickaxe wajib, lalu pedang dan cangkul, lalu peningkatan ke alat batu.
  const pickaxeMissing = !hasUsableTool(inv, 'pickaxe');
  if (pickaxeMissing) {
    const pick = craftFirst(craftable, ['iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe']);
    if (pick) return decision('craft', { thought: 'Belum punya pickaxe, buat sekarang.', item_to_use: pick, goal: 'get a usable pickaxe' });
  }
  if (!hasUsableTool(inv, 'sword')) {
    const sword = craftFirst(craftable, ['iron_sword', 'stone_sword', 'wooden_sword']);
    if (sword) return decision('craft', { thought: 'Belum punya pedang untuk jaga diri.', item_to_use: sword, goal: 'get a sword for defense' });
  }
  if (hasSeeds && !hasHoe) {
    const hoe = craftFirst(craftable, ['stone_hoe', 'wooden_hoe']);
    if (hoe) return decision('craft', { thought: 'Ada bibit, buat cangkul untuk kebun.', item_to_use: hoe, goal: 'make a hoe for farming' });
  }
  const hasStonePickaxe = inv.some((i) => /^(stone|iron|golden|diamond|netherite)_pickaxe$/.test(i.name));
  if (!pickaxeMissing && !hasStonePickaxe) {
    const upgrade = craftFirst(craftable, ['stone_pickaxe']);
    if (upgrade) return decision('craft', { thought: 'Naikkan pickaxe ke batu agar bisa menambang besi.', item_to_use: upgrade, goal: 'upgrade to stone tools' });
  }

  // 4. Bahan: kayu dulu, lalu batu (butuh pickaxe).
  const logs = countMatching(inv, LOG_NAME);
  const logSource = resources.find((r) => LOG_NAME.test(r.name));
  if (logs < 8 && logSource) {
    return decision('gather', { thought: 'Kayu masih sedikit, kumpulkan.', item_to_use: logSource.name, count: 8, goal: 'collect wood' });
  }
  const stoneSource = resources.find((r) => r.name === 'stone' || r.name === 'cobblestone');
  const cobble = countMatching(inv, /^cobblestone$/);
  if (stoneSource && cobble < 16 && !pickaxeMissing) {
    return decision('gather', { thought: 'Kumpulkan batu untuk alat dan bangunan.', item_to_use: stoneSource.name, count: 8, goal: 'collect stone for building' });
  }

  // 5. Bangun: hanya jika bahan cukup dan belum membangun dalam beberapa aksi terakhir.
  const materials = countMatching(inv, BUILD_MATERIAL_NAME);
  const recentlyBuilt = (state.recentActions || []).some((a) => a.action === 'build');
  if (materials >= BUILD_MATERIAL_MIN && !recentlyBuilt) {
    const material = inv
      .filter((i) => BUILD_MATERIAL_NAME.test(i.name))
      .sort((a, b) => b.count - a.count)[0];
    const lastBuild = (state.recentActions || []).filter((a) => a.action === 'build').pop();
    const structure = nextStructure(material.count, lastBuild?.detail ?? null);
    if (structure) {
      return decision('build', {
        thought: `Bahan cukup, bangun ${structure} dekat bangunan sebelumnya.`,
        item_to_use: material.name,
        structure,
        goal: `build a ${structure} near the base`,
      });
    }
  }

  // 6. Tambang: ore terdekat yang bisa ditambang dengan pickaxe yang dimiliki.
  const ores = mineableOres(state);
  if (ores.length && !pickaxeMissing) {
    return decision('mine', { thought: 'Ore terdekat dengan prioritas tertinggi.', target: ores[0].pos, goal: 'mine valuable ore' });
  }

  // 7. Tidak ada tugas: jalan sebentar, lalu berhenti dan menoleh (jeda seperti pemain).
  if (last?.action === 'explore') {
    return decision('idle', { thought: 'Berhenti sebentar, lihat-lihat sekitar.', seconds: 4, goal: 'look around and plan next step' });
  }
  return decision('explore', { thought: 'Tidak ada target, menjelajah.', goal: 'explore for resources' });
}

/** Balasan singkat untuk chat terakhir, tanpa LLM. */
export function chatReply(entry, task) {
  const label = TASK_LABEL[task] || 'santai';
  const from = entry.from;
  const message = String(entry.message || '');
  if (/\?|gimana|kenapa|kok|dimana|di mana|berapa|bisa/i.test(message)) {
    return `${from}, lagi ${label} nih. Nanti aku kabarin ya.`;
  }
  if (/^(halo|hai|hi|hey|p|pagi|siang|sore|malam|selamat)\b/i.test(message.trim())) {
    return `Halo ${from}! Lagi ${label} nih.`;
  }
  return `Oke ${from}, aku catat.`;
}

/** Menambahkan balasan chat dan tujuan ke keputusan dasar. */
function withChatAndBuildSay(d, state) {
  const out = { ...d };
  const pending = state.pendingChat || [];
  if (pending.length) {
    out.say = chatReply(pending[pending.length - 1], state.currentTaskPriority || currentTask(state));
  } else if (d.action === 'build' && d.structure) {
    out.say = `Oke, aku bangun ${STRUCTURE_LABEL[d.structure] || d.structure} dekat base ya.`;
  }
  return out;
}

/** Keputusan cadangan tanpa LLM. */
export function fallbackDecision(state) {
  return withChatAndBuildSay(chooseActivity(state), state);
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
