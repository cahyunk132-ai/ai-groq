// Memori jangka pendek bot: tindakan terakhir, tujuan yang sedang dikerjakan, dan chat yang belum dijawab.

const MAX_ACTIONS = 6;
const MAX_PENDING_CHAT = 5;
const MAX_GOAL_LENGTH = 120;

export class Memory {
  constructor() {
    this.recentActions = [];
    this.pendingChat = [];
    this.goal = null;
    this.buildOrigin = null; // pusat bangunan terakhir; bangunan baru didekatkan ke sini
  }

  recordAction({ action, target = null, result = '', detail = null }) {
    this.recentActions.push({ action, target, result: String(result).slice(0, 160), detail });
    if (this.recentActions.length > MAX_ACTIONS) {
      this.recentActions.splice(0, this.recentActions.length - MAX_ACTIONS);
    }
  }

  setBuildOrigin(origin) {
    if (Array.isArray(origin) && origin.length === 3) this.buildOrigin = origin.slice();
  }

  /** Titik acuan untuk bangunan berikutnya, atau null jika belum pernah membangun. */
  buildAnchor() {
    return this.buildOrigin ? this.buildOrigin.slice() : null;
  }

  setGoal(goal) {
    if (typeof goal !== 'string' || !goal.trim()) return;
    this.goal = goal.trim().slice(0, MAX_GOAL_LENGTH);
  }

  recordChat(username, message) {
    this.pendingChat.push({ from: String(username), message: String(message).slice(0, 200) });
    if (this.pendingChat.length > MAX_PENDING_CHAT) {
      this.pendingChat.splice(0, this.pendingChat.length - MAX_PENDING_CHAT);
    }
  }

  /** Chat dianggap sudah diproses setelah keputusan dijalankan. */
  clearPendingChat() {
    this.pendingChat = [];
  }

  snapshot() {
    return {
      currentGoal: this.goal,
      recentActions: this.recentActions.slice(),
      pendingChat: this.pendingChat.slice(),
    };
  }
}
