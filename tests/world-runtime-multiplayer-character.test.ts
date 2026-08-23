import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { createRemoteAvatarRuntimeManager } from '../src/features/world/world-runtime-multiplayer';
import { CHARACTER_GROUND_CONTACT_Y, PROTOTYPE_WORLD_CONFIG } from '../src/features/world/world-runtime-geometry';
import type { RemoteAvatarStateSnapshot } from '../src/features/world-multiplayer/remote-avatar-state';

function snapshot(characterAssetKey?: string, motion: RemoteAvatarStateSnapshot['motion'] = 'idle', seq = 1, emote: RemoteAvatarStateSnapshot['emote'] = 'none'): RemoteAvatarStateSnapshot {
  return {
    v: 1,
    connectionId: 'connection-1',
    childProfileId: 'child-1',
    seq,
    x: 0,
    z: 0,
    rotationY: 0,
    motion,
    emote,
    characterAssetKey,
    sentAt: 0,
    receivedAt: 0,
  };
}

describe('remote avatar runtime characters', () => {
  it('loads the remote selected character independently of the visitor backpack', async () => {
    const scene = new THREE.Scene();
    const loadedKeys: string[] = [];
    const manager = createRemoteAvatarRuntimeManager({
      THREE,
      scene,
      createCharacter: () => {
        const fallback = new THREE.Group();
        fallback.name = 'procedural-fallback';
        fallback.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
        return fallback;
      },
      loadCharacter: async (assetKey) => {
        loadedKeys.push(assetKey);
        const model = new THREE.Group();
        model.name = assetKey;
        model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
        const toe = new THREE.Object3D();
        toe.name = 'toe_end';
        toe.position.y = -0.25;
        model.add(toe);
      return {
        model,
        animations: [new THREE.AnimationClip('Idle', 1, [
          new THREE.NumberKeyframeTrack('.rotation[y]', [0, 1], [0, 0.6]),
          new THREE.NumberKeyframeTrack('.position[y]', [0, 1], [0, 0.1]),
        ])],
      };
    },
      disposeRoot: () => undefined,
    });

    manager.update([snapshot('character.noah')]);
    await Promise.resolve();
    manager.render(0);
    manager.render(500);

    assert.deepEqual(loadedKeys, ['character.noah']);
    assert.equal(scene.children[0]?.getObjectByName('character.noah')?.name, 'character.noah');
    assert.ok(Math.abs((scene.children[0]?.scale.x ?? 0) - PROTOTYPE_WORLD_CONFIG.characterTargetHeight) < 0.001);
    const footY = () => scene.children[0]?.getObjectByName('toe_end')?.getWorldPosition(new THREE.Vector3()).y ?? Number.NaN;
    assert.ok(Math.abs(footY() - CHARACTER_GROUND_CONTACT_Y) < 0.001);
    assert.ok((scene.children[0]?.getObjectByName('character.noah')?.rotation.y ?? 0) > 0);

    manager.update([snapshot('character.noah', 'walk', 2)]);
    manager.render(750);
    manager.render(1000);
    assert.ok(Math.abs(footY() - CHARACTER_GROUND_CONTACT_Y) < 0.001);
    manager.dispose();
  });

  it('plays a remote character action when the visitor broadcasts an emote', async () => {
    const scene = new THREE.Scene();
    const manager = createRemoteAvatarRuntimeManager({
      THREE,
      scene,
      createCharacter: () => new THREE.Group(),
      loadCharacter: async () => {
        const model = new THREE.Group();
        model.name = 'character.noah';
        return {
          model,
          animations: [
            new THREE.AnimationClip('Idle', 1, [
              new THREE.NumberKeyframeTrack('.rotation[y]', [0, 1], [0, 0]),
            ]),
            new THREE.AnimationClip('Wave', 1, [
              new THREE.NumberKeyframeTrack('.rotation[y]', [0, 1], [0, 1]),
            ]),
          ],
        };
      },
      disposeRoot: () => undefined,
    });

    manager.update([snapshot('character.noah', 'idle', 1, 'wave')]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    manager.render(0);
    for (let time = 50; time <= 500; time += 50) manager.render(time);

    const model = scene.children[0]?.getObjectByName('character.noah');
    assert.ok((model?.rotation.y ?? 0) > 0.1);
    manager.dispose();
  });
});
