import { Vec3 } from 'vec3';

/**
 * Handler pertempuran canggih:
 * - Mekanik critical hit (melompat sebelum menyerang)
 * - Pemblokiran dengan perisai (shield)
 * - Taktik kiting (mundur menjaga jarak) saat HP rendah
 * - Menggunakan plugin pvp jika ada, atau fallback native mineflayer
 */
export class CombatHandler {
  constructor(bot, { log = console.log } = {}) {
    this.bot = bot;
    this.log = log;
    this.isBlocking = false;
  }

  /**
   * Menyerang target dengan mempertimbangkan posisi dan critical hit.
   * @param {object} target - Entitas target
   */
  async attack(target) {
    if (!target || !target.isValid) return;

    // Persiapkan senjata terbaik
    await this.equipBestWeapon();

    const bot = this.bot;
    const dist = bot.entity.position.distanceTo(target.position);

    // Jika bot punya plugin pvp aktif
    if (bot.pvp && typeof bot.pvp.attack === 'function') {
      try {
        bot.pvp.attack(target);
        return;
      } catch (err) {
        this.log(`[combat] pvp plugin attack fallback: ${err.message}`);
      }
    }

    // Native attack logic
    await bot.lookAt(target.position.offset(0, target.height ? target.height * 0.8 : 1.4, 0));

    // Lakukan critical hit jika berada dalam jarak jangkau dekat (jump & hit saat jatuh)
    if (dist <= 3.5 && bot.entity.onGround) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 250);
    }

    bot.attack(target);
  }

  /**
   * Melakukan manuver kabur (kiting/flee) menjauhi entitas ancaman.
   * @param {object} threatEntity
   * @param {number} distance - Jarak aman yang ditargetkan
   */
  async fleeFrom(threatEntity, distance = 8) {
    if (!threatEntity || !threatEntity.position) return;
    const bot = this.bot;
    const myPos = bot.entity.position;
    const threatPos = threatEntity.position;

    // Vektor menjauhi musuh
    const diff = myPos.minus(threatPos);
    diff.y = 0; // tetap horizontal
    if (diff.norm() === 0) {
      diff.x = 1;
    }
    const fleeTarget = myPos.plus(diff.normalize().scaled(distance));

    // Sprint
    bot.setControlState('sprint', true);

    if (bot.pathfinder) {
      try {
        const { goals } = await import('mineflayer-pathfinder');
        await bot.pathfinder.goto(new goals.GoalNear(fleeTarget.x, fleeTarget.y, fleeTarget.z, 2));
      } catch (e) {
        // Fallback navigasi sederhana
        bot.lookAt(fleeTarget);
        bot.setControlState('forward', true);
        setTimeout(() => {
          bot.setControlState('forward', false);
          bot.setControlState('sprint', false);
        }, 1500);
      }
    }
  }

  /**
   * Menggunakan perisai untuk memblokir serangan.
   */
  async blockWithShield() {
    const bot = this.bot;
    const shield = bot.inventory.items().find((i) => i.name === 'shield');
    if (!shield) return false;

    try {
      await bot.equip(shield, 'off-hand');
      bot.activateItem(true); // gunakan item di off-hand
      this.isBlocking = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Melepas blokir perisai.
   */
  unblock() {
    if (this.isBlocking) {
      this.bot.deactivateItem();
      this.isBlocking = false;
    }
  }

  /**
   * Memasang senjata terbaik (sword > axe) dari inventory ke main hand.
   */
  async equipBestWeapon() {
    const items = this.bot.inventory.items();
    const weaponOrder = [
      'netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword',
      'netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe'
    ];

    for (const name of weaponOrder) {
      const weapon = items.find((i) => i.name === name);
      if (weapon) {
        try {
          await this.bot.equip(weapon, 'hand');
          return;
        } catch {}
      }
    }
  }
}
