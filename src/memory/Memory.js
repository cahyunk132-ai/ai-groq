import { Memory as BaseMemory } from '../memory.js';

/**
 * Memori OmniBot yang diperluas dengan titik acuan (waypoints/home/chest).
 */
export class Memory extends BaseMemory {
  constructor() {
    super();
    this.home = null;
    this.knownChests = [];
    this.lastEncounters = new Map();
    this.lastChatTimes = new Map();
  }

  setHome(pos) {
    if (pos) this.home = [Math.floor(pos.x ?? pos[0]), Math.floor(pos.y ?? pos[1]), Math.floor(pos.z ?? pos[2])];
  }

  getHome() {
    return this.home ? this.home.slice() : null;
  }

  recordChest(pos) {
    const p = [Math.floor(pos.x ?? pos[0]), Math.floor(pos.y ?? pos[1]), Math.floor(pos.z ?? pos[2])];
    if (!this.knownChests.some((c) => c[0] === p[0] && c[1] === p[1] && c[2] === p[2])) {
      this.knownChests.push(p);
    }
  }

  /**
   * Mengecek apakah bot boleh melakukan sapaan fisik ke username tertentu.
   */
  canEncounter(username, cooldownMs = 60000) {
    if (!username) return false;
    const key = String(username).toLowerCase();
    const last = this.lastEncounters.get(key) || 0;
    return Date.now() - last >= cooldownMs;
  }

  recordEncounter(username, now = Date.now()) {
    if (!username) return;
    this.lastEncounters.set(String(username).toLowerCase(), now);
  }

  /**
   * Mengecek apakah bot boleh mengirim pesan chat ke username tertentu (anti-flood).
   */
  canChat(username, cooldownMs = 10000) {
    if (!username) return false;
    const key = String(username).toLowerCase();
    const last = this.lastChatTimes.get(key) || 0;
    return Date.now() - last >= cooldownMs;
  }

  recordChatTime(username, now = Date.now()) {
    if (!username) return;
    this.lastChatTimes.set(String(username).toLowerCase(), now);
  }
}
