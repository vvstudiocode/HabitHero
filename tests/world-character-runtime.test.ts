import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
  groundWorldCharacter,
  mountWorldCharacterModel,
} from '../src/features/world/world-character-runtime';
import { CHARACTER_GROUND_CONTACT_Y } from '../src/features/world/world-runtime-geometry';

function createTestCharacter(): THREE.Group {
  const model = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
  body.position.y = 1;
  model.add(body);

  const toe = new THREE.Object3D();
  toe.name = 'mixamorig:LeftToe_End';
  toe.position.set(-0.25, -0.2, 0);
  model.add(toe);
  return model;
}

describe('world character runtime', () => {
  it('gives local and remote models the same centered scale and foot contact', () => {
    const localRoot = new THREE.Group();
    localRoot.position.y = -0.12;
    const remoteRoot = new THREE.Group();

    const localMount = mountWorldCharacterModel(THREE, {
      root: localRoot,
      model: createTestCharacter(),
      targetHeight: 0.5,
    });
    const remoteMount = mountWorldCharacterModel(THREE, {
      root: remoteRoot,
      model: createTestCharacter(),
      targetHeight: 0.5,
    });

    assert.equal(localMount.footNodes.length, 1);
    assert.equal(remoteMount.footNodes.length, 1);
    assert.equal(localMount.scale, remoteMount.scale);
    assert.ok(Math.abs(localRoot.position.y - remoteRoot.position.y) < 0.0001);

    groundWorldCharacter(THREE, {
      root: localRoot,
      model: localRoot.children[0],
      footNodes: localMount.footNodes,
    });
    groundWorldCharacter(THREE, {
      root: remoteRoot,
      model: remoteRoot.children[0],
      footNodes: remoteMount.footNodes,
    });

    const localFootY = localMount.footNodes[0].getWorldPosition(new THREE.Vector3()).y;
    const remoteFootY = remoteMount.footNodes[0].getWorldPosition(new THREE.Vector3()).y;
    assert.ok(Math.abs(localFootY - CHARACTER_GROUND_CONTACT_Y) < 0.0001);
    assert.ok(Math.abs(remoteFootY - CHARACTER_GROUND_CONTACT_Y) < 0.0001);
    assert.ok(Math.abs(localRoot.position.y - remoteRoot.position.y) < 0.0001);
  });
});
