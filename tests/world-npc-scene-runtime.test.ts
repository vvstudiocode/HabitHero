import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  createWorldNpcSceneRuntime,
} from '../src/features/world/world-npc-scene-runtime';
import type { WorldNpcSummary } from '../src/features/world/contracts';

test('stationary character vendors reuse their terrain height while keeping animation grounding', async () => {
  const scene = new THREE.Group();
  const npc: WorldNpcSummary = {
    id: 'npc.test-vendor',
    sceneId: 'sunrise-village',
    npcType: 'character_vendor',
    name: '測試商人',
    assetKey: 'character.test-vendor',
    catalogItemId: null,
    position: { x: 0, y: 0, z: 0 },
    behaviorMode: 'dance_anchor',
    animationName: 'Dance',
    roamBounds: null,
    isActive: true,
  };
  let groundQueries = 0;
  const createModel = () => {
    const model = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    body.position.y = 1;
    model.add(body);
    return model;
  };
  const runtime = await createWorldNpcSceneRuntime({
    THREE,
    scene,
    sceneId: 'sunrise-village',
    npcs: [npc],
    catalog: [],
    characterHeight: 1,
    groundY: 0,
    wanderObstacles: [],
    showNames: false,
    cloneSkinnedObject: (source) => source.clone(true),
    loadCharacterModel: async () => ({ scene: createModel(), animations: [] }),
    loadPetModel: async () => undefined,
    createFallbackCharacter: () => createModel(),
    getNpcGroundY: () => {
      groundQueries += 1;
      return 0.35;
    },
  });

  assert.equal(groundQueries, 1);
  runtime.update(1 / 60, 1, false);
  runtime.update(1 / 60, 2, false);
  assert.equal(groundQueries, 1);
});
