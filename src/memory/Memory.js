import { Memory as BaseMemory } from '../memory.js';

/**
 * Memori OmniBot yang diperluas dengan titik acuan (waypoints/home/chest).
 */
export class Memory extends BaseMemory {
  constructor() {
    super();
    this.home = null;
    this.knownChests = [];
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
}
