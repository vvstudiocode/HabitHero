import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFriendWorldGameData } from '../src/features/friends/friend-world-game-data';

describe('friend-world decoration presentation', () => {
  it('keeps rug masks pass-through and fire-pit lights when a friend snapshot only has asset keys', () => {
    const gameData = buildFriendWorldGameData({
      worldOwnerChildProfileId: 'owner-child',
      displayName: '小華',
      characterAssetKey: 'character.noah',
      revision: 1,
      entities: [
        { id: 'rug', entityKind: 'decoration', assetKey: 'decoration.blue-rug', x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'static', placementScope: 'shared', canTransform: false, canRemove: false, sharedByMe: false },
        { id: 'fire', entityKind: 'decoration', assetKey: 'decoration.stone-fire-pit', x: 2, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1, behaviorMode: 'static', placementScope: 'shared', canTransform: false, canRemove: false, sharedByMe: false },
      ],
    });

    const rug = gameData.catalog.find((item) => item.assetKey === 'decoration.blue-rug');
    const fire = gameData.catalog.find((item) => item.assetKey === 'decoration.stone-fire-pit');
    assert.equal(rug?.metadata.passThrough, true);
    assert.equal(rug?.metadata.groundCoverWidth, 1.96);
    assert.equal(fire?.metadata.pointLight, true);
    assert.equal(fire?.metadata.groundCoverShape, 'circle');
    assert.equal(fire?.collisionRadius, 0.65);
  });
});
