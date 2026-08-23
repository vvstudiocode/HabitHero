import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CENTRAL_TREE_KEEP_OUT, CHARACTER_COLLISION_RADIUS, WORLD_BOUNDARY, circlesOverlap, moveWorldCharacter } from '../src/features/world/world-collision';

describe('friend world visit and reload spawn decisions', () => {
  it('marks the owner world as editable and friend worlds as read-only visits', async () => {
    const {
      createFriendWorldOwnerContext,
      getFriendWorldVisitMode,
    } = await import('../src/features/friends/friend-world-visit');

    assert.equal(getFriendWorldVisitMode({
      viewerChildProfileId: 'child-a',
      worldOwnerChildProfileId: 'child-a',
    }), 'owner');
    assert.equal(getFriendWorldVisitMode({
      viewerChildProfileId: 'child-a',
      worldOwnerChildProfileId: 'child-b',
    }), 'visitor');

    assert.deepEqual(createFriendWorldOwnerContext({
      viewerChildProfileId: 'child-a',
      worldOwnerChildProfileId: 'child-b',
    }), {
      viewerChildProfileId: 'child-a',
      worldOwnerChildProfileId: 'child-b',
      mode: 'visitor',
      isOwner: false,
      canMove: true,
      canChat: true,
      canJoinCoopAdventure: true,
      canMutateWorld: false,
      canEditDecorations: false,
      canManagePets: false,
      canUseStore: false,
      canManageDailyAdventures: false,
    });
  });

  it('uses the fixed own-world spawn after a full reload and after leaving a friend world', async () => {
    const { getFriendWorldReloadSpawnDecision } = await import('../src/features/friends/friend-world-visit');
    const fixedSpawn = { x: 0, z: 2.08 };
    const oldMemoryPosition = { x: -2.4, z: -1.5 };

    for (const reason of ['full_reload', 'enter_own_world', 'leave_friend_world'] as const) {
      assert.deepEqual(getFriendWorldReloadSpawnDecision({
        reason,
        fixedSpawn,
        memoryPosition: oldMemoryPosition,
      }), {
        position: fixedSpawn,
        source: 'fixed_spawn',
        clearMemoryPosition: true,
        shouldRebroadcast: true,
      });
    }
  });

  it('preserves an in-memory position only for a short reconnect', async () => {
    const { getFriendWorldReloadSpawnDecision } = await import('../src/features/friends/friend-world-visit');
    const fixedSpawn = { x: 0, z: 2.08 };
    const memoryPosition = { x: 1.25, z: -0.75 };

    assert.deepEqual(getFriendWorldReloadSpawnDecision({
      reason: 'short_reconnect',
      fixedSpawn,
      memoryPosition,
    }), {
      position: memoryPosition,
      source: 'memory',
      clearMemoryPosition: false,
      shouldRebroadcast: true,
    });
    assert.deepEqual(getFriendWorldReloadSpawnDecision({
      reason: 'short_reconnect',
      fixedSpawn,
      memoryPosition: null,
    }), {
      position: fixedSpawn,
      source: 'fixed_spawn',
      clearMemoryPosition: false,
      shouldRebroadcast: true,
    });
  });

  it('does not restore an old memory position when entering a friend world', async () => {
    const { getFriendWorldReloadSpawnDecision } = await import('../src/features/friends/friend-world-visit');

    assert.deepEqual(getFriendWorldReloadSpawnDecision({
      reason: 'enter_friend_world',
      fixedSpawn: { x: 0, z: 2.08 },
      memoryPosition: { x: 4, z: 4 },
    }), {
      position: { x: 0, z: 2.08 },
      source: 'fixed_spawn',
      clearMemoryPosition: true,
      shouldRebroadcast: true,
    });
  });

  it('assigns stable, separated, walkable multiplayer spawns by role and child profile', async () => {
    const { getFriendWorldMultiplayerSpawnPosition } = await import('../src/features/friends/friend-world-visit');
    const ownerInput = { mode: 'owner' as const, childProfileId: 'child-owner' };
    const visitorInput = { mode: 'visitor' as const, childProfileId: 'child-visitor' };
    const ownerSpawn = getFriendWorldMultiplayerSpawnPosition(ownerInput);
    const visitorSpawn = getFriendWorldMultiplayerSpawnPosition(visitorInput);

    assert.deepEqual(getFriendWorldMultiplayerSpawnPosition(ownerInput), ownerSpawn);
    assert.deepEqual(getFriendWorldMultiplayerSpawnPosition(visitorInput), visitorSpawn);
    assert.ok(Math.hypot(ownerSpawn.x - visitorSpawn.x, ownerSpawn.z - visitorSpawn.z) >= 1.2);
    assert.ok(ownerSpawn.x < 0);
    assert.ok(visitorSpawn.x > ownerSpawn.x);

    for (const spawn of [ownerSpawn, visitorSpawn]) {
      assert.ok(Math.abs(spawn.x) + CHARACTER_COLLISION_RADIUS <= WORLD_BOUNDARY);
      assert.ok(Math.abs(spawn.z) + CHARACTER_COLLISION_RADIUS <= WORLD_BOUNDARY);
      assert.equal(circlesOverlap({ ...spawn, radius: CHARACTER_COLLISION_RADIUS }, CENTRAL_TREE_KEEP_OUT), false);
      assert.deepEqual(moveWorldCharacter(spawn, spawn, CHARACTER_COLLISION_RADIUS), spawn);
    }
  });
});
