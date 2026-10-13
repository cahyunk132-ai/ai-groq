import test from 'node:test';
import assert from 'node:assert/strict';
import { SelfSensor } from '../../src/sensors/self.js';

test('SelfSensor accurately detects health, food, and tool requirements', () => {
  const fakeBot = {
    health: 4,
    food: 12,
    inventory: {
      items: () => [
        { name: 'bread', count: 5 },
        { name: 'iron_sword', durabilityUsed: 240, maxDurability: 250 },
      ],
      emptySlotCount: () => 1,
    },
    registry: {
      foodsByName: {
        bread: { saturation: 6 },
      },
    },
  };

  const sensor = new SelfSensor(fakeBot);
  sensor.update();

  assert.equal(sensor.hp, 4);
  assert.equal(sensor.hpRatio, 0.2);
  assert.equal(sensor.hunger, 12);
  assert.equal(sensor.hasFood, true);
  assert.equal(sensor.inventoryFull, true);
  // No pickaxe in inventory -> needsEssentialTool should be true
  assert.equal(sensor.needsEssentialTool, true);

  const best = sensor.bestFood();
  assert.equal(best.name, 'bread');

  const lowDurability = sensor.lowDurabilityTools(15);
  assert.equal(lowDurability.length, 1);
  assert.equal(lowDurability[0].name, 'iron_sword');
});
