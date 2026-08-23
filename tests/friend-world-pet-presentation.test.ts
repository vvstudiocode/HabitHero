import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('friend world pet presentation', () => {
  it('keeps friend-world pet labels in Chinese and bounds the synthetic shadow', async () => {
    const { getFriendWorldPetPresentation } = await import('../src/features/friends/friend-world-pet-presentation');
    const { getPetGroundShadowScale, getPetVisualScaleMultiplier, shouldHidePetGroundMarker } = await import('../src/features/world/prototype-world-runtime');

    const oum = getFriendWorldPetPresentation('pet.oum');
    assert.equal(oum.displayName, '歐姆');
    assert.equal(oum.metadata.groundShadowScaleMultiplier, 0.22);
    assert.equal(oum.metadata.hideGroundMarker, true);
    assert.equal(getPetGroundShadowScale(oum.metadata), 0.22);
    assert.equal(shouldHidePetGroundMarker(oum.metadata), true);

    const starDiver = getFriendWorldPetPresentation('pet.star-diver');
    assert.equal(starDiver.displayName, '星辰潛者');
    assert.equal(starDiver.metadata.hideGroundShadow, true);

    const arcadia = getFriendWorldPetPresentation('pet.arcadia');
    assert.equal(arcadia.metadata.groundOffset, -0.44);
    assert.equal(getPetVisualScaleMultiplier('pet.arcadia', arcadia.metadata), 1.3 * 6.8);

    const unknown = getFriendWorldPetPresentation('pet.future-companion');
    assert.equal(unknown.displayName, '寵物夥伴');
  });

  it('applies the presentation to the friend-world scene catalog and entity', async () => {
    const { buildFriendWorldGameData } = await import('../src/features/friends/friend-world-game-data');

    const gameData = buildFriendWorldGameData({
      worldOwnerChildProfileId: 'owner-child',
      displayName: '星芽',
      characterAssetKey: 'character.anime-maiden',
      revision: 1,
      entities: [{
        id: 'pet-entity',
        entityKind: 'pet',
        assetKey: 'pet.murphy-bear',
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
        behaviorMode: 'idle',
      }],
    });

    assert.equal(gameData.worldEntities[0]?.name, '墨菲熊');
    assert.equal(gameData.catalog.find((item) => item.itemType === 'pet')?.name, '墨菲熊');
    assert.equal(gameData.catalog.find((item) => item.itemType === 'pet')?.metadata.groundShadowScaleMultiplier, 0.22);
  });
});
