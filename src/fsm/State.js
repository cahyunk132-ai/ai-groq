/**
 * Base class untuk semua state dalam FSM OmniBot.
 * Setiap state memiliki lifecycle: onEnter -> onUpdate (berulang per tick) -> onExit
 */
export class State {
  constructor(bot, name) {
    this.bot = bot;
    this.name = name;
    this.active = false;
  }

  /**
   * Dipanggil saat state dimasuki. Setup awal atau persiapan aksi.
   * @param {object} context - Global runtime context (sensors, handlers, memory, dll)
   */
  async onEnter(context) {}

  /**
   * Dipanggil setiap tick saat state aktif.
   * @param {object} context - Global runtime context
   * @returns {Promise<boolean>} true jika state telah selesai dan siap kembali ke idle/previous state
   */
  async onUpdate(context) {
    return true;
  }

  /**
   * Dipanggil saat state ditinggalkan. Membersihkan timer, goal pathfinder, dsb.
   * @param {object} context - Global runtime context
   */
  async onExit(context) {}

  /**
   * Menentukan apakah state ini dapat di-interrupt oleh prioritas yang lebih tinggi.
   */
  get interruptible() {
    return true;
  }
}
