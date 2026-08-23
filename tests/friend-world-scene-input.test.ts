import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTerrainWorldSceneInput } from '../src/features/world/world-scene-input';
import { emptyChildGameData } from '../src/features/world/contracts';
import { applyFixedSpawnIfChanged } from '../src/features/world/world-runtime-multiplayer';
import type { Object3D } from 'three';

describe('friend world scene input', () => {
  it('projects the multiplayer role/profile spawn into the runtime session', () => {
    const session = {
      fixedSpawn: { x: 0, z: 2.08 },
      worldOwnerChildProfileId: 'child-owner',
      multiplayer: {
        childProfileId: 'child-visitor',
        worldOwnerChildProfileId: 'child-owner',
        remoteAvatars: [],
        broadcastState: () => true,
      },
    };

    const sceneInput = createTerrainWorldSceneInput({
      gameData: emptyChildGameData(),
      session,
      placementValid: true,
      showPetNames: false,
      dayNightEnabled: true,
      getEquippedCatalogItem: () => undefined,
      getCharacterRenderMode: () => 'procedural',
      getWorldCharacterModelUrl: () => undefined,
    });

    assert.ok(sceneInput.session);
    assert.notDeepEqual(sceneInput.session.fixedSpawn, session.fixedSpawn);
    assert.ok((sceneInput.session.fixedSpawn?.x ?? 0) > 0);

    const position = { x: 0, y: 0, z: 0 };
    const root = { position: { set: (x: number, _y: number, z: number) => { position.x = x; position.z = z; } } } as unknown as Object3D;
    let resetCount = 0;
    const applied = applyFixedSpawnIfChanged(root, sceneInput.session.fixedSpawn, null, () => { resetCount += 1; });
    const reapplied = applyFixedSpawnIfChanged(root, sceneInput.session.fixedSpawn, applied, () => { resetCount += 1; });
    assert.deepEqual(reapplied, applied);
    assert.deepEqual(position, { x: sceneInput.session.fixedSpawn?.x, y: 0, z: sceneInput.session.fixedSpawn?.z });
    assert.equal(resetCount, 1);
  });

  it('uses local game data for the equipped character while social data supplies world entities', () => {
    const localCharacter = {
      id: 'local-character', itemType: 'character' as const, name: '本地角色', description: '', scrollPrice: 0,
      assetKey: 'local-character', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false,
      collisionRadius: 0.3, minScale: 0.25, maxScale: 1, sortOrder: 0, metadata: {},
    };
    const friendPet = {
      id: 'friend-pet', itemType: 'pet' as const, name: '好友寵物', description: '', scrollPrice: 0,
      assetKey: 'friend-pet', thumbnailUrl: null, isActive: true, isStarter: true, isStackable: false,
      collisionRadius: 0.3, minScale: 0.25, maxScale: 1, sortOrder: 0, metadata: {},
    };
    const gameData = {
      ...emptyChildGameData(),
      catalog: [localCharacter],
      inventory: [{ id: 'local-inventory', catalogItemId: localCharacter.id, quantity: 1, acquiredVia: 'starter' as const, acquiredAt: new Date(0).toISOString() }],
      loadout: { equippedCharacterInventoryId: 'local-inventory', followingPetInventoryId: null, followingPetInventoryIds: [] },
    };
    const socialGameData = {
      ...emptyChildGameData(),
      catalog: [friendPet],
      inventory: [{ id: 'friend-inventory', catalogItemId: friendPet.id, quantity: 1, acquiredVia: 'starter' as const, acquiredAt: new Date(0).toISOString() }],
      worldEntities: [{ id: 'friend-entity', inventoryItemId: 'friend-inventory', entityKind: 'pet' as const, worldLayoutVersion: 1, behaviorMode: 'static' as const, roamingSlot: null, isActive: true, catalogItemId: friendPet.id, assetKey: 'friend-pet', x: 1, y: 0, z: 1, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 }],
    };
    const sceneInput = createTerrainWorldSceneInput({
      gameData,
      socialGameData,
      placementValid: true,
      showPetNames: false,
      dayNightEnabled: true,
      getEquippedCatalogItem: (receivedGameData) => {
        assert.equal(receivedGameData, gameData);
        return localCharacter;
      },
      getCharacterRenderMode: (item) => {
        assert.equal(item, localCharacter);
        return 'world-glb';
      },
      getWorldCharacterModelUrl: (item) => {
        assert.equal(item, localCharacter);
        return '/local-character.glb';
      },
    });

    assert.equal(sceneInput.equippedCatalogItem, localCharacter);
    assert.equal(sceneInput.characterModelUrl, '/local-character.glb');
    assert.equal(sceneInput.gameData.worldEntities[0]?.assetKey, 'friend-pet');
  });
});
