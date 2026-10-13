// ACT: menerjemahkan keputusan tervalidasi menjadi perintah Mineflayer.
// Pathfinding memakai mineflayer-pathfinder; AI hanya memilih apa yang dilakukan, bukan cara bergerak.
import pathfinderPkg from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import { CROP_MAX_AGE, SEED_ITEMS, HOSTILE_FLEE_DISTANCE, MIN_TOOL_DURABILITY, toolKindFor } from './constants.js';
import { cropAge } from './state.js';
import { buildCells, FACE_DIRECTIONS } from './build.js';
import { findSite, isValidSite } from './site.js';

const { goals } = pathfinderPkg;

const MOVE_TIMEOUT_MS = 15000;
const ATTACK_TIMEOUT_MS = 8000;
const FLEE_DISTANCE = 12;
const MAX_CHAT_LENGTH = 200;
const MAX_PLACEMENTS = 80; // cukup untuk struktur terbesar (tower 47 blok)
const TOOL_TIERS = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden'];
const NON_SOLID = new Set(['air', 'cave_air', 'void_air', 'water', 'lava']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, bot) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      bot.pathfinder.stop();
      reject(new Error(`timeout ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Memilih alat terbaik (pickaxe/sword/axe/shovel) berdasarkan tingkat material. */
export function bestTool(bot, kind) {
  const tools = bot.inventory.items().filter((i) => i.name.endsWith(`_${kind}`));
  const rank = (i) => {
    const tier = TOOL_TIERS.findIndex((t) => i.name.startsWith(`${t}_`));
    return tier === -1 ? TOOL_TIERS.length : tier;
  };
  // Alat yang masih layak pakai diutamakan, lalu tingkat material.
  const broken = (i) => (i.maxDurability && i.maxDurability - (i.durabilityUsed || 0) < MIN_TOOL_DURABILITY ? 1 : 0);
  return tools.sort((a, b) => broken(a) - broken(b) || rank(a) - rank(b))[0] || null;
}

async function equipTool(bot, kind) {
  const tool = bestTool(bot, kind);
  if (!tool) throw new Error(`tidak punya ${kind}`);
  await bot.equip(tool, 'hand');
  return tool;
}

async function moveNear(bot, pos, range = 3) {
  const goal = new goals.GoalNear(pos[0], pos[1], pos[2], range);
  await withTimeout(bot.pathfinder.goto(goal), MOVE_TIMEOUT_MS, bot);
}

function blockAtPos(bot, pos) {
  return bot.blockAt(new Vec3(pos[0], pos[1], pos[2]));
}

/** Blok padat (bukan udara/air/cairan), agar bisa dijadikan tumpuan. */
export function isSolid(block) {
  return Boolean(block) && !NON_SOLID.has(block.name);
}

/**
 * Mencari blok tetangga padat untuk menaruh blok di `cell`.
 * Mengembalikan blok referensi dan vektor sisi (dari referensi ke cell), atau null.
 * `getBlock` dipisah agar fungsi ini bisa diuji tanpa bot.
 */
export function pickReference(getBlock, cell) {
  for (const [dx, dy, dz] of FACE_DIRECTIONS) {
    const n = [cell[0] + dx, cell[1] + dy, cell[2] + dz];
    const block = getBlock(n);
    if (isSolid(block)) {
      return { block, face: [-dx || 0, -dy || 0, -dz || 0] }; // `|| 0` menghindari -0
    }
  }
  return null;
}

/** Menaruh satu blok dari inventory di posisi `cell`. Mengembalikan true jika berhasil. */
async function placeAt(bot, itemName, cell) {
  const item = bot.inventory.items().find((i) => i.name === itemName);
  if (!item) return false;
  const ref = pickReference((c) => bot.blockAt(new Vec3(c[0], c[1], c[2])), cell);
  if (!ref) return false;
  await bot.equip(item, 'hand');
  await bot.placeBlock(ref.block, new Vec3(...ref.face));
  return true;
}

async function doExplore(bot) {
  // Jarak dan arah acak agar tidak selalu berjalan lurus.
  const p = bot.entity.position;
  const angle = Math.random() * Math.PI * 2;
  const dist = 6 + Math.random() * 10;
  const goal = new goals.GoalNearXZ(
    Math.floor(p.x + Math.cos(angle) * dist),
    Math.floor(p.z + Math.sin(angle) * dist),
    2,
  );
  await withTimeout(bot.pathfinder.goto(goal), MOVE_TIMEOUT_MS, bot);
  return { message: 'menjelajah selesai' };
}

async function doMine(bot, d) {
  const block = blockAtPos(bot, d.target);
  if (!block || block.name === 'air') throw new Error(`blok di ${d.target} tidak ada`);
  const pick = bestTool(bot, 'pickaxe');
  if (!pick) throw new Error('tidak punya pickaxe');
  if (pick.maxDurability && pick.maxDurability - (pick.durabilityUsed || 0) < MIN_TOOL_DURABILITY) {
    throw new Error('pickaxe hampir hancur, perlu diganti');
  }
  await moveNear(bot, d.target, 3);
  await equipTool(bot, 'pickaxe');
  const target = blockAtPos(bot, d.target);
  if (!target || !bot.canDigBlock(target)) throw new Error(`tidak bisa menambang ${block.name}`);
  await bot.dig(target);
  return { message: `menambang ${block.name} di ${d.target}` };
}

async function doGather(bot, d) {
  const name = d.item_to_use;
  const blockType = bot.registry.blocksByName[name];
  if (!blockType) throw new Error(`blok ${name} tidak dikenal`);
  const kind = toolKindFor(name);
  let collected = 0;
  for (let i = 0; i < d.count; i++) {
    const block = bot.findBlock({ matching: blockType.id, maxDistance: 32 });
    if (!block) break;
    const pos = [block.position.x, block.position.y, block.position.z];
    await moveNear(bot, pos, 3);
    if (kind) {
      await equipTool(bot, kind).catch(() => bot.unequip('hand'));
    }
    const target = blockAtPos(bot, pos);
    if (!target || target.name !== name || !bot.canDigBlock(target)) continue;
    await bot.dig(target);
    collected += 1;
  }
  if (collected === 0) throw new Error(`tidak ada ${name} yang bisa dikumpulkan`);
  return { message: `mengumpulkan ${collected} ${name}` };
}

/** Memasang meja kerja di dekat bot, lalu mengembalikan blok mejanya. */
async function placeTableNear(bot) {
  const p = bot.entity.position;
  const base = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const cell = [base[0] + dx, base[1], base[2] + dz];
    const here = blockAtPos(bot, cell);
    if (!here || here.name !== 'air') continue;
    if (await placeAt(bot, 'crafting_table', cell)) {
      return bot.findBlock({ matching: bot.registry.blocksByName.crafting_table.id, maxDistance: 6 });
    }
  }
  throw new Error('tidak menemukan tempat untuk meja kerja');
}

async function doCraft(bot, d) {
  const item = bot.registry.itemsByName[d.item_to_use];
  if (!item) throw new Error(`item ${d.item_to_use} tidak dikenal`);

  const tableId = bot.registry.blocksByName.crafting_table?.id;
  let table = tableId !== undefined ? bot.findBlock({ matching: tableId, maxDistance: 32 }) : null;
  if (table) {
    const tp = [table.position.x, table.position.y, table.position.z];
    if (bot.entity.position.distanceTo(table.position) > 3) await moveNear(bot, tp, 2);
  } else if (bot.inventory.items().some((i) => i.name === 'crafting_table')) {
    table = await placeTableNear(bot);
  }

  let recipe = bot.recipesFor(item.id, null, d.count, table)[0];
  let times = 1;
  if (recipe) {
    times = Math.ceil(d.count / recipe.result.count);
  } else {
    recipe = bot.recipesFor(item.id, null, 1, table)[0];
  }
  if (!recipe) throw new Error(`bahan ${d.item_to_use} belum cukup`);

  await bot.craft(recipe, times, table || undefined);
  return { message: `membuat ${d.item_to_use} x${times * recipe.result.count}` };
}

/**
 * Membangun satu struktur. Jika AI tidak memberi target, bot mencari lahan datar
 * di dekat bangunan terakhir (atau di dekat dirinya). Blok yang tidak punya tumpuan dilewati.
 */
async function doBuild(bot, d, ctx = {}) {
  const structure = d.structure || 'platform';
  const at = (x, y, z) => bot.blockAt(new Vec3(x, y, z));
  const getBlock = (x, y, z) => at(x, y, z);
  const p = bot.entity.position;
  const from = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];

  let origin = d.target;
  if (origin) {
    if (!isValidSite(getBlock, origin, structure, from)) {
      throw new Error(`lokasi ${origin} tidak cocok untuk ${structure} (tanah tidak rata atau ruang terhalang)`);
    }
  } else {
    origin = findSite({ getBlock, from, structure, anchor: ctx.anchor ?? null });
    if (!origin) throw new Error(`tidak ada lahan datar untuk ${structure} di dekat sini`);
  }

  const cells = buildCells(structure, origin);
  const getCell = (c) => at(c[0], c[1], c[2]);
  let placed = 0;
  let attempted = 0;
  for (const cell of cells) {
    if (attempted >= MAX_PLACEMENTS) break;
    if (!bot.inventory.items().some((i) => i.name === d.item_to_use)) break;
    const here = getCell(cell);
    if (here && here.name !== 'air') continue;
    if (!pickReference(getCell, cell)) continue;

    attempted += 1;
    if (bot.entity.position.distanceTo(new Vec3(...cell)) > 4) {
      await moveNear(bot, cell, 3).catch(() => {});
    }
    try {
      if (await placeAt(bot, d.item_to_use, cell)) placed += 1;
    } catch {
      // Satu blok gagal (misalnya ada entitas di posisi itu); lanjut ke blok berikutnya.
    }
  }
  if (placed === 0) throw new Error(`tidak ada blok yang berhasil dipasang (${cells.length} sel)`);
  return {
    message: `membangun ${structure} di ${origin}: ${placed}/${cells.length} blok`,
    origin,
    structure,
  };
}

async function doAttack(bot, d) {
  const entity = bot.entities[d.target];
  if (!entity) throw new Error(`entity ${d.target} sudah tidak ada`);
  try {
    await equipTool(bot, 'sword');
  } catch {
    await equipTool(bot, 'axe').catch(() => {});
  }
  const deadline = Date.now() + ATTACK_TIMEOUT_MS;
  let hits = 0;
  bot.pathfinder.setGoal(new goals.GoalFollow(entity, 2), true);
  try {
    while (Date.now() < deadline && bot.entities[entity.id] && bot.health > 0) {
      if (bot.entity.position.distanceTo(entity.position) <= 3.2) {
        bot.lookAt(entity.position.offset(0, entity.height * 0.8, 0));
        bot.attack(entity);
        hits += 1;
        await sleep(600);
        if (bot.health <= 6) break; // biarkan AI memutuskan untuk kabur
      } else {
        await sleep(200);
      }
    }
  } finally {
    bot.pathfinder.setGoal(null);
  }
  return { message: `menyerang ${entity.name ?? entity.id} (${hits} pukulan)` };
}

async function doFarm(bot, d) {
  const block = blockAtPos(bot, d.target);
  if (!block) throw new Error(`blok di ${d.target} tidak dimuat`);
  await moveNear(bot, d.target, 3);

  const cropMax = CROP_MAX_AGE[block.name];
  if (cropMax !== undefined) {
    const age = cropAge(block);
    if (age === null || age < cropMax) throw new Error(`${block.name} belum siap (age ${age})`);
    const crop = blockAtPos(bot, d.target);
    await bot.dig(crop);
    return { message: `memanen ${block.name}` };
  }

  if (block.name === 'farmland') {
    const seed = bot.inventory.items().find((i) => SEED_ITEMS.includes(i.name));
    if (!seed) throw new Error('tidak ada bibit');
    await bot.equip(seed, 'hand');
    const land = blockAtPos(bot, d.target);
    await bot.placeBlock(land, new Vec3(0, 1, 0));
    return { message: `menanam ${seed.name}` };
  }
  throw new Error(`${block.name} tidak bisa dipanen/ditanami`);
}

async function doEat(bot, d) {
  const foods = bot.registry.foodsByName || {};
  const item = bot.inventory.items().find(
    (i) => (d.item_to_use ? i.name === d.item_to_use : foods[i.name]) && foods[i.name],
  );
  if (!item) throw new Error(`tidak ada makanan ${d.item_to_use ?? ''}`.trim());
  await bot.equip(item, 'hand');
  await bot.consume();
  return { message: `makan ${item.name}` };
}

async function doFlee(bot, d) {
  let goal;
  if (Array.isArray(d.target)) {
    goal = new goals.GoalNear(d.target[0], d.target[1], d.target[2], 2);
  } else {
    const me = bot.entity.position;
    const threat = bot.nearestEntity((e) => e.type === 'hostile' && e.position.distanceTo(me) <= HOSTILE_FLEE_DISTANCE * 3);
    let dir = new Vec3(Math.random() - 0.5, 0, Math.random() - 0.5);
    if (threat) dir = me.minus(threat.position);
    dir.y = 0;
    const len = Math.hypot(dir.x, dir.z) || 1;
    goal = new goals.GoalNearXZ(
      Math.floor(me.x + (dir.x / len) * FLEE_DISTANCE),
      Math.floor(me.z + (dir.z / len) * FLEE_DISTANCE),
      2,
    );
  }
  await withTimeout(bot.pathfinder.goto(goal), MOVE_TIMEOUT_MS, bot);
  return { message: 'kabur ke area aman' };
}

/** Diam sebentar dan menoleh ke sekitar, seperti pemain yang sedang berpikir. */
async function doIdle(bot, d) {
  const end = Date.now() + d.seconds * 1000;
  while (Date.now() < end) {
    const yaw = bot.entity.yaw + (Math.random() - 0.5) * 1.2;
    const pitch = (Math.random() - 0.5) * 0.4;
    await bot.look(yaw, pitch, false).catch(() => {});
    await sleep(1200);
  }
  return { message: `diam ${d.seconds} detik` };
}

/** Mengirim teks ke chat game. Dipotong agar tidak melebihi batas server. */
export function say(bot, text) {
  if (!text) return;
  try {
    bot.chat(String(text).slice(0, MAX_CHAT_LENGTH));
  } catch (err) {
    console.error(`gagal chat: ${err.message}`);
  }
}

/**
 * Menjalankan satu keputusan. Error ditangkap dan dikembalikan sebagai pesan
 * agar loop tidak berhenti.
 */
export async function execute(bot, d, ctx = {}) {
  say(bot, d.say);
  try {
    switch (d.action) {
      case 'explore': return await doExplore(bot);
      case 'mine': return await doMine(bot, d);
      case 'attack': return await doAttack(bot, d);
      case 'farm': return await doFarm(bot, d);
      case 'eat': return await doEat(bot, d);
      case 'flee': return await doFlee(bot, d);
      case 'gather': return await doGather(bot, d);
      case 'craft': return await doCraft(bot, d);
      case 'build': return await doBuild(bot, d, ctx);
      case 'idle': return await doIdle(bot, d);
      case 'chat': return { message: `bilang: ${d.say}` };
      default: throw new Error(`aksi tidak dikenal: ${d.action}`);
    }
  } catch (err) {
    return { message: `aksi ${d.action} gagal: ${err.message}` };
  }
}
