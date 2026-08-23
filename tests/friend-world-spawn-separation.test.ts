import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getFriendWorldMultiplayerSpawnPosition,
} from '../src/features/friends/friend-world-visit';
import { CHARACTER_COLLISION_RADIUS, CHARACTER_SPAWN, WORLD_BOUNDARY } from '../src/features/world/world-collision';

describe('friend world multiplayer spawn separation', () => {
  it('keeps owner and visitor apart with stable child-profile-derived positions', () => {
    const owner = getFriendWorldMultiplayerSpawnPosition({
      mode: 'owner',
      childProfileId: 'owner-child',
    });
    const visitor = getFriendWorldMultiplayerSpawnPosition({
      mode: 'visitor',
      childProfileId: 'visitor-child',
    });
    const visitorAgain = getFriendWorldMultiplayerSpawnPosition({
      mode: 'visitor',
      childProfileId: 'visitor-child',
    });

    assert.deepEqual(visitor, visitorAgain);
    assert.ok(Math.hypot(owner.x - visitor.x, owner.z - visitor.z) > 1.2);
    assert.ok(Math.abs(visitor.x) + CHARACTER_COLLISION_RADIUS <= WORLD_BOUNDARY);
    assert.ok(Math.abs(visitor.z) + CHARACTER_COLLISION_RADIUS <= WORLD_BOUNDARY);
    assert.ok(Math.hypot(visitor.x - CHARACTER_SPAWN.x, visitor.z - CHARACTER_SPAWN.z) > CHARACTER_SPAWN.radius + CHARACTER_COLLISION_RADIUS);
  });

  it('derives different stable sides from role and child profile identity', () => {
    const owner = getFriendWorldMultiplayerSpawnPosition({
      mode: 'owner',
      childProfileId: 'visitor-child',
    });
    const visitor = getFriendWorldMultiplayerSpawnPosition({
      mode: 'visitor',
      childProfileId: 'visitor-child',
    });
    assert.ok(owner.x < 0);
    assert.ok(visitor.x > owner.x);
  });
});
