/**
 * Antrean tugas (Task Queue) untuk OmniBot.
 * Memungkinkan pemain atau AI memasukkan tugas berurutan.
 */
export class TaskQueue {
  constructor() {
    this.queue = [];
  }

  /**
   * Menambahkan tugas baru ke antrean.
   * @param {{ type: string, priority?: number, params?: object }} task
   */
  enqueue(task) {
    if (!task || !task.type) return;
    this.queue.push({
      id: Math.random().toString(36).substring(2, 9),
      type: task.type,
      priority: task.priority ?? 5,
      params: task.params ?? {},
      createdAt: Date.now(),
    });
    // Urutkan prioritas (angka kecil = prioritas tinggi)
    this.queue.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Mengambil dan menghapus tugas terdepan.
   */
  dequeue() {
    return this.queue.shift() ?? null;
  }

  /**
   * Melihat tugas yang sedang aktif/terdepan tanpa menghapusnya.
   */
  currentTask() {
    return this.queue[0] ?? null;
  }

  /**
   * Memeriksa apakah ada tugas dalam antrean.
   */
  hasTask() {
    return this.queue.length > 0;
  }

  /**
   * Menghapus seluruh tugas dalam antrean.
   */
  clear() {
    this.queue = [];
  }
}
