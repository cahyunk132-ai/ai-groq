import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'vec3';
import { ThreatSensor } from '../../src/sensors/threat.js';

test('ThreatSensor prioritizes creepers over skeletons and zombies', () => {
  const fakeBot = {
    entity: { position: new Vec3(0, 64, 0) },
    entities: {
      1: { id: 1, name: 'zombie', type: 'hostile', position: new Vec3(2, 64, 0) }, // dist: 2
      2: { id: 2, name: 'creeper', type: 'hostile', position: new Vec3(5, 64, 0) }, // dist: 5
      3: { id: 3, name: 'skeleton', type: 'hostile', position: new Vec3(4, 64, 0) }, // dist: 4
      4: { id: 4, name: 'cow', type: 'passive', position: new Vec3(1, 64, 0) },
    },
  };

  const sensor = new ThreatSensor(fakeBot);
  sensor.update(16);

  assert.equal(sensor.hostiles.length, 3);
  // Highest threat should be creeper (priority 10)
  assert.equal(sensor.highestThreat().name, 'creeper');
  // Second should be skeleton (priority 8)
  assert.equal(sensor.hostiles[1].name, 'skeleton');
  // Third should be zombie (priority 4)
  assert.equal(sensor.hostiles[2].name, 'zombie');

  // nearestHostile within 3 blocks should be zombie
  const nearestClose = sensor.nearestHostile(3);
  assert.equal(nearestClose.name, 'zombie');
});
