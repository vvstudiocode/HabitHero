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
  it('keeps the private world entities out of the shared Sunrise Village', () => {
    const privateEntity = {
      id: 'private-decoration',
      inventoryItemId: 'private-inventory',
      entityKind: 'decoration' as const,
      worldLayoutVersion: 1,
      behaviorMode: 'static' as const,
      roamingSlot: null,
      isActive: true,
      catalogItemId: 'private-decoration-item',
      assetKey: 'decoration.private',
      x: 1,
      y: 0,
      z: 1,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
    };
    const privateWorld = createTerrainWorldSceneInput({
      gameData: { ...gameData, worldEntities: [privateEntity] },
      worldLocation: 'my-world',
      placementValid: false,
      showPetNames: false,
      dayNightEnabled: true,
      getEquippedCatalogItem: () => undefined,
      getCharacterRenderMode: () => 'procedural',
      getWorldCharacterModelUrl: () => undefined,
    });
    const village = createTerrainWorldSceneInput({
      gameData: { ...gameData, worldEntities: [privateEntity] },
      worldLocation: 'sunrise-village',
      placementValid: false,
      showPetNames: false,
      dayNightEnabled: true,
      getEquippedCatalogItem: () => undefined,
      getCharacterRenderMode: () => 'procedural',
      getWorldCharacterModelUrl: () => undefined,
    });

    assert.equal(privateWorld.gameData.worldEntities.length, 1);
    assert.equal(village.gameData.worldEntities.length, 0);
  });

  it('keeps private world entities out of Forest Valley as well', () => {
    const privateEntity = {
      id: 'private-decoration',
      inventoryItemId: 'private-inventory',
      entityKind: 'decoration' as const,
      worldLayoutVersion: 1,
      behaviorMode: 'static' as const,
      roamingSlot: null,
      isActive: true,
      catalogItemId: 'private-decoration-item',
      assetKey: 'decoration.private',
      x: 1,
      y: 0,
      z: 1,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
    };
    const forestValley = createTerrainWorldSceneInput({
      gameData: { ...gameData, worldEntities: [privateEntity] },
      worldLocation: 'forest-valley',
      placementValid: false,
      showPetNames: false,
      dayNightEnabled: true,
      getEquippedCatalogItem: () => undefined,
      getCharacterRenderMode: () => 'procedural',
      getWorldCharacterModelUrl: () => undefined,
    });

    assert.equal(forestValley.gameData.worldEntities.length, 0);
  });

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

  it('carries a one-time authored-world entry position without changing the scene coordinates', () => {
    const entryPosition = { x: -8.9, z: 5.5 };
    const input = createTerrainWorldSceneInput({
      gameData,
      worldLocation: 'sunrise-village',
      entryPosition,
      entryFacingY: Math.PI,
      entryCameraYaw: 0,
      placementValid: false,
      showPetNames: false,
      dayNightEnabled: true,
      getEquippedCatalogItem: () => undefined,
      getCharacterRenderMode: () => 'procedural',
      getWorldCharacterModelUrl: () => undefined,
    });

    assert.deepEqual(input.entryPosition, entryPosition);
    assert.equal(input.entryFacingY, Math.PI);
    assert.equal(input.entryCameraYaw, 0);
  });
});
