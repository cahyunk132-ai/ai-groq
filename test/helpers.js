import { Vec3 } from 'vec3';

/** Bot palsu minimal untuk menguji buildState tanpa server Minecraft. */
export function fakeBot({ health = 20, food = 20, items = [], entities = [], blocks = {}, me = [0, 64, 0] } = {}) {
  const grid = new Map(Object.entries(blocks).map(([k, v]) => [k, v]));
  const key = (v) => `${Math.floor(v.x)},${Math.floor(v.y)},${Math.floor(v.z)}`;
  const registry = {
    blocksByName: {
      diamond_ore: { id: 1, name: 'diamond_ore' },
      iron_ore: { id: 2, name: 'iron_ore' },
      stone: { id: 3, name: 'stone' },
      wheat: { id: 4, name: 'wheat' },
      farmland: { id: 5, name: 'farmland' },
      air: { id: 0, name: 'air' },
    },
    foodsByName: { baked_potato: { id: 1 }, bread: { id: 2 } },
  };
  const bot = {
    health,
    food,
    registry,
    entity: { id: 999, position: new Vec3(...me) },
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    inventory: { items: () => items },
    blockAt(pos) {
      const name = grid.get(key(pos)) ?? 'air';
      const meta = name.startsWith('wheat') ? { age: name.split(':')[1] ?? '0' } : {};
      return { name: name.split(':')[0], position: pos, getProperties: () => meta };
    },
    findBlocks({ matching, maxDistance, count }) {
      const out = [];
      for (const [k, v] of grid) {
        const [x, y, z] = k.split(',').map(Number);
        const p = new Vec3(x, y, z);
        const name = v.split(':')[0];
        if (!matching.includes(registry.blocksByName[name]?.id)) continue;
        if (p.distanceTo(new Vec3(...me)) > maxDistance) continue;
        out.push(p);
        if (out.length >= count) break;
      }
      return out;
    },
  };
  return bot;
}
