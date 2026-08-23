import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTerrainWorldSceneInput } from '../src/features/world/world-scene-input';
import { getFriendWorldMultiplayerSpawnPosition } from '../src/features/friends/friend-world-visit';
import type { ChildGameData } from '../src/features/world/contracts';

const gameData: ChildGameData = {
  walletBalance: 0,
  catalog: [],
  prices: {},
  inventory: [],
  loadout: null,
  worldEntities: [],
  worldRevision: 0,
};

describe('world scene multiplayer input', () => {
  it('applies the stable visitor spawn carried by the multiplayer session', () => {
    const input = createTerrainWorldSceneInput({
      gameData,
      session: {
        fixedSpawn: { x: 0, z: 2.08 },
        multiplayer: {
          childProfileId: 'visitor-child',
          worldOwnerChildProfileId: 'owner-child',
          remoteAvatars: [],
          broadcastState: () => false,
        },
      },
      placementValid: false,
      showPetNames: false,
      dayNightEnabled: true,
      getEquippedCatalogItem: () => undefined,
      getCharacterRenderMode: () => 'procedural',
      getWorldCharacterModelUrl: () => undefined,
    });

    assert.deepEqual(input.session?.fixedSpawn, getFriendWorldMultiplayerSpawnPosition({
      mode: 'visitor',
      childProfileId: 'visitor-child',
      worldOwnerChildProfileId: 'owner-child',
      fixedSpawn: { x: 0, z: 2.08 },
    }));
  });
});
