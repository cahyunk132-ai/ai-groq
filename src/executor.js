// ACT: menerjemahkan keputusan tervalidasi menjadi perintah Mineflayer.
// Pathfinding memakai mineflayer-pathfinder; AI hanya memilih apa yang dilakukan, bukan cara bergerak.
import pathfinderPkg from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import { CROP_MAX_AGE, SEED_ITEMS, HOSTILE_FLEE_DISTANCE } from './constants.js';
import { cropAge } from './state.js';

const { goals } = pathfinderPkg;

const MOVE_TIMEOUT_MS = 15000;
const ATTACK_TIMEOUT_MS = 8000;
const EXPLORE_RADIUS = 12;
const FLEE_DISTANCE = 12;
const TOOL_TIERS = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden'];
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

/** Memilih alat terbaik (pickaxe/sword/axe) berdasarkan tingkat material. */
export function bestTool(bot, kind) {
  const tools = bot.inventory.items().filter((i) => i.name.endsWith(`_${kind}`));
  const rank = (i) => {
    const tier = TOOL_TIERS.findIndex((t) => i.name.startsWith(`${t}_`));
    return tier === -1 ? TOOL_TIERS.length : tier;
  };
  return tools.sort((a, b) => rank(a) - rank(b))[0] || null;
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

async function doExplore(bot) {
  const p = bot.entity.position;
  const dx = (Math.random() * 2 - 1) * EXPLORE_RADIUS;
  const dz = (Math.random() * 2 - 1) * EXPLORE_RADIUS;
  const goal = new goals.GoalNearXZ(Math.floor(p.x + dx), Math.floor(p.z + dz), 2);
  await withTimeout(bot.pathfinder.goto(goal), MOVE_TIMEOUT_MS, bot);
  return { message: 'menjelajah selesai' };
}

async function doMine(bot, d) {
  const block = blockAtPos(bot, d.target);
  if (!block || block.name === 'air') throw new Error(`blok di ${d.target} tidak ada`);
  const pick = bestTool(bot, 'pickaxe');
  if (!pick) throw new Error('tidak punya pickaxe');
  if (pick.maxDurability && pick.maxDurability - (pick.durabilityUsed || 0) < 10) {
    throw new Error('pickaxe hampir hancur, perlu diganti');
  }
  await moveNear(bot, d.target, 3);
  await equipTool(bot, 'pickaxe');
  const target = blockAtPos(bot, d.target);
  if (!target || !bot.canDigBlock(target)) throw new Error(`tidak bisa menambang ${block.name}`);
  await bot.dig(target);
  return { message: `menambang ${block.name} di ${d.target}` };
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

/**
 * Menjalankan satu keputusan. Error ditangkap dan dikembalikan sebagai pesan
 * agar loop tidak berhenti.
 */
export async function execute(bot, d) {
  try {
    switch (d.action) {
      case 'explore': return await doExplore(bot);
      case 'mine': return await doMine(bot, d);
      case 'attack': return await doAttack(bot, d);
      case 'farm': return await doFarm(bot, d);
      case 'eat': return await doEat(bot, d);
      case 'flee': return await doFlee(bot, d);
      default: throw new Error(`aksi tidak dikenal: ${d.action}`);
    }
  } catch (err) {
    return { message: `aksi ${d.action} gagal: ${err.message}` };
  }
}
