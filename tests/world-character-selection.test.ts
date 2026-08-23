import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyChildGameData, type GameCatalogItem } from '../src/features/world/contracts';
import { getEquippedCharacterCatalogItem } from '../src/features/world/world-character-loadout';

function character(id: string, assetKey: string): GameCatalogItem {
  return {
    id,
    itemType: 'character',
    name: id,
    description: '',
    scrollPrice: 0,
    assetKey,
    thumbnailUrl: null,
    isActive: true,
    isStarter: true,
    isStackable: false,
    collisionRadius: 0.3,
    minScale: 0.25,
    maxScale: 1,
    sortOrder: 0,
    metadata: {},
  };
}

describe('world character selection', () => {
  it('keeps the local child loadout when the social world has a different character', () => {
    const local = character('local-character', 'character.elina');
    const friend = character('friend-character', 'character.noah');
    const gameData = {
      ...emptyChildGameData(),
      catalog: [local],
      inventory: [{ id: 'local-inventory', catalogItemId: local.id, quantity: 1, acquiredVia: 'starter' as const, acquiredAt: new Date(0).toISOString() }],
      loadout: { equippedCharacterInventoryId: 'local-inventory', followingPetInventoryId: null, followingPetInventoryIds: [] },
    };
    const socialGameData = {
      ...emptyChildGameData(),
      catalog: [friend],
      inventory: [{ id: 'friend-inventory', catalogItemId: friend.id, quantity: 1, acquiredVia: 'starter' as const, acquiredAt: new Date(0).toISOString() }],
      loadout: { equippedCharacterInventoryId: 'friend-inventory', followingPetInventoryId: null, followingPetInventoryIds: [] },
    };

    assert.equal(getEquippedCharacterCatalogItem(gameData)?.assetKey, 'character.elina');
    assert.notEqual(getEquippedCharacterCatalogItem(gameData)?.assetKey, getEquippedCharacterCatalogItem(socialGameData)?.assetKey);
  });
});
