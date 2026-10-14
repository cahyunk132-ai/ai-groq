import { AGGRESSIVE_MOBS, THREAT_PRIORITY } from '../constants.js';

/**
 * Sensor ancaman: mendeteksi dan memprioritaskan entitas musuh di sekitar bot.
 */
export class ThreatSensor {
  constructor(bot) {
    this.bot = bot;
    this.hostiles = [];
    this.players = [];
  }

  /**
   * Memperbarui daftar musuh dan pemain dalam radius tertentu.
   * @param {number} radius
   */
  update(radius = 16) {
    const me = this.bot.entity?.position;
    this.hostiles = [];
    this.players = [];

    if (!me || !this.bot.entities) return;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity || !entity.position) continue;
      const dist = typeof entity.position.distanceTo === 'function'
        ? entity.position.distanceTo(me)
        : (typeof me.distanceTo === 'function'
            ? me.distanceTo(entity.position)
            : Math.hypot((entity.position.x || 0) - (me.x || 0), (entity.position.y || 0) - (me.y || 0), (entity.position.z || 0) - (me.z || 0)));
      if (dist > radius) continue;

      if (entity.type === 'player') {
        this.players.push({ entity, distance: dist, name: entity.username || 'player' });
        continue;
      }

      const name = entity.name?.toLowerCase() || '';
      const isAggressive =
        entity.type === 'hostile' ||
        AGGRESSIVE_MOBS.has(name) ||
        (THREAT_PRIORITY && THREAT_PRIORITY[name] !== undefined);

      if (isAggressive) {
        const priority = (THREAT_PRIORITY && THREAT_PRIORITY[name]) ?? 1;
        this.hostiles.push({
          entity,
          name,
          distance: dist,
          priority,
        });
      }
    }

    // Urutkan: prioritas bahaya tertinggi dulu, lalu jarak terdekat
    this.hostiles.sort((a, b) => b.priority - a.priority || a.distance - b.distance);
    this.players.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Menemukan mob musuh terdekat dalam batas jarak tertentu.
   * @param {number} maxDist
   * @returns {{ entity: object, name: string, distance: number, priority: number } | null}
   */
  nearestHostile(maxDist = 10) {
    return this.hostiles.find((h) => h.distance <= maxDist) ?? null;
  }

  /**
   * Menemukan pemain atau bot lain terdekat dalam batas jarak tertentu.
   * @param {number} maxDist
   * @returns {{ entity: object, distance: number, name: string, username?: string } | null}
   */
  nearestPlayer(maxDist = 6) {
    const found = this.players.find((p) => p.distance <= maxDist);
    if (!found) return null;
    return {
      entity: found.entity,
      distance: found.distance,
      name: found.name,
      username: found.entity.username || found.name,
    };
  }

  /**
   * Memeriksa apakah suatu username merupakan bot rekan.
   * @param {string} username
   * @param {string[]} friendList
   * @returns {boolean}
   */
  isFriendBot(username, friendList = []) {
    if (!username) return false;
    const u = String(username).toLowerCase();
    return friendList.some((f) => f.toLowerCase() === u);
  }

  /**
   * Mengembalikan musuh dengan nilai ancaman tertinggi saat ini.
   */
  highestThreat() {
    return this.hostiles[0] ?? null;
  }
}
