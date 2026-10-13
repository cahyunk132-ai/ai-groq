import { State } from '../fsm/State.js';

export class InventoryState extends State {
  constructor(bot, inventoryHandler) {
    super(bot, 'inventory');
    this.inventory = inventoryHandler;
  }

  async onEnter(context) {
    this.inventory?.log?.('[state:inventory] Memproses penataan inventaris');
  }

  async onUpdate(context) {
    await this.inventory.depositExcessItems();
    await this.inventory.equipBestArmor();
    return true; // Selesai
  }
}
