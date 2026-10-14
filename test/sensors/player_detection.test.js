import test from 'node:test';
import assert from 'node:assert/strict';
import { ThreatSensor } from '../../src/sensors/threat.js';

test('ThreatSensor: deteksi pemain terdekat dan rekan bot', () => {
  const fakeBot = {
    entity: {
      position: {
        distanceTo: (pos) => Math.hypot(pos.x, pos.y, pos.z),
      },
    },
    entities: {
      1: {
        type: 'player',
        username: 'bot_admin',
        position: { x: 3, y: 0, z: 4 }, // dist = 5
      },
      2: {
        type: 'player',
        username: 'pemain_jauh',
        position: { x: 10, y: 0, z: 10 }, // dist = ~14.14
      },
      3: {
        type: 'hostile',
        name: 'zombie',
        position: { x: 2, y: 0, z: 0 },
      },
    },
  };

  const threat = new ThreatSensor(fakeBot);
  threat.update(16);

  // nearestPlayer dalam radius 6 harus mendeteksi bot_admin
  const near = threat.nearestPlayer(6);
  assert.ok(near);
  assert.equal(near.username, 'bot_admin');
  assert.equal(near.distance, 5);

  // nearestPlayer dalam radius 3 harus mengembalikan null
  const tooClose = threat.nearestPlayer(3);
  assert.equal(tooClose, null);

  // isFriendBot case-insensitivity
  const friends = ['bot_admin', 'bot_adminv2'];
  assert.equal(threat.isFriendBot('bot_admin', friends), true);
  assert.equal(threat.isFriendBot('BOT_ADMIN', friends), true);
  assert.equal(threat.isFriendBot('pemain_jauh', friends), false);
  assert.equal(threat.isFriendBot(null, friends), false);
});
