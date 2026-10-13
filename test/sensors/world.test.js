import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { WorldSensor } from '../../src/sensors/world.js';
import { fakeBot } from '../helpers.js';

test('WorldSensor scans ores and identifies light level requirements', () => {
  const bot = fakeBot({
    me: [0, 64, 0],
    blocks: {
      '1,64,0': 'diamond_ore',
      '2,64,0': 'iron_ore',
      '0,63,0': 'stone',
      '0,64,1': 'wheat:7', // mature wheat
      '0,64,2': 'wheat:3', // immature wheat
    },
  });

  const sensor = new WorldSensor(bot);
  sensor.update(10);

  // Ores should be sorted: diamond first
  assert.ok(sensor.ores.length >= 2);
  assert.equal(sensor.ores[0].name, 'diamond_ore');
  assert.equal(sensor.ores[1].name, 'iron_ore');

  // Crops
  const mature = sensor.crops.find((c) => c.mature);
  assert.ok(mature);
  assert.equal(mature.age, 7);

  // Light level
  sensor.lightLevel = 5;
  assert.equal(sensor.needsTorch(), true);
  sensor.lightLevel = 10;
  assert.equal(sensor.needsTorch(), false);
});
