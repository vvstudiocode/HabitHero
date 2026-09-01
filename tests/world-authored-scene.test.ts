import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
  getAuthoredSceneCollisionProxies,
  getAuthoredSceneRadialBoundary,
  getAuthoredSceneSpawnPosition,
  getAuthoredSceneModule,
  getAuthoredSceneSurfaceY,
  hasAuthoredSceneSurface,
  alignAuthoredSceneToGround,
} from '../src/features/world/world-authored-scene';

describe('authored world spawn', () => {
  it('resolves authored modules by their manifest key', () => {
    const source = new THREE.Group();
    const noticeBoard = new THREE.Group();
    noticeBoard.userData.sunriseVillageModule = 'notice-board';
    source.add(noticeBoard);

    assert.equal(getAuthoredSceneModule(source, 'notice-board'), noticeBoard);
    assert.equal(getAuthoredSceneModule(source, 'adventure-table'), undefined);
  });

  it('does not turn a broad low-height ground slab into an obstacle', () => {
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(20, 1, 20)));
    source.add(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4)));

    const proxies = getAuthoredSceneCollisionProxies(THREE, source);

    assert.equal(proxies.length, 1);
    assert.equal(proxies[0]?.halfWidth, 2);
    assert.equal(proxies[0]?.halfDepth, 2);
  });

  it('uses the authored island as ground even when its imported thickness is above the generic slab threshold', () => {
    const root = new THREE.Group();
    root.position.y = 1.12;
    const source = new THREE.Group();
    const island = new THREE.Mesh(new THREE.BoxGeometry(20, 1, 20));
    island.position.y = 4;
    island.userData.sunriseVillageModule = 'island';
    source.add(island);
    root.add(source);

    alignAuthoredSceneToGround(THREE, root, source, 0, 'island');

    assert.ok(Math.abs(root.position.y - (0.06 - 4.5)) < 0.0001);
    root.updateMatrixWorld(true);
    const groundedBounds = new THREE.Box3().setFromObject(island);
    assert.ok(Math.abs(groundedBounds.max.y - 0.06) < 0.0001);
  });

  it('lifts the authored scene until the cloud workshop ground touches the world ground', () => {
    const root = new THREE.Group();
    root.scale.setScalar(0.6);
    const source = new THREE.Group();
    const ground = new THREE.Group();
    ground.userData.authoredWorldModule = 'cloud-ground-1';
    ground.position.y = -8.435;
    ground.add(new THREE.Mesh(new THREE.BoxGeometry(20, 1, 20)));
    source.add(ground);
    root.add(source);

    alignAuthoredSceneToGround(THREE, root, source, 0, 'cloud-ground-1');

    root.updateMatrixWorld(true);
    const alignedBounds = new THREE.Box3().setFromObject(ground);
    assert.ok(Math.abs(alignedBounds.max.y - 0.06) < 0.0001);
    assert.ok(root.position.y > 4.5);
  });

  it('samples the actual authored ground surface below the player', () => {
    const root = new THREE.Group();
    const source = new THREE.Group();
    const ground = new THREE.Group();
    ground.userData.authoredWorldModule = 'cloud-ground-1';
    ground.position.y = 2;
    ground.add(new THREE.Mesh(new THREE.BoxGeometry(20, 1, 20)));
    source.add(ground);
    root.add(source);
    root.updateMatrixWorld(true);

    assert.equal(getAuthoredSceneSurfaceY(THREE, source, 'cloud-ground-1', 0, 0, -99), 2.5);
    assert.equal(getAuthoredSceneSurfaceY(THREE, source, 'cloud-ground-1', 99, 99, -99), -99);
  });

  it('distinguishes positions on and beyond the authored ground', () => {
    const source = new THREE.Group();
    const ground = new THREE.Group();
    ground.userData.authoredWorldModule = 'cloud-ground-1';
    ground.add(new THREE.Mesh(new THREE.BoxGeometry(20, 1, 20)));
    source.add(ground);

    assert.equal(hasAuthoredSceneSurface(THREE, source, 'cloud-ground-1', 0, 0), true);
    assert.equal(hasAuthoredSceneSurface(THREE, source, 'cloud-ground-1', 99, 99), false);
  });

  it('honors per-module collision flags and shrinks the central tree footprint', () => {
    const source = new THREE.Group();
    const road = new THREE.Group();
    road.userData.sunriseVillageCollision = false;
    road.add(new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 1)));
    const tree = new THREE.Group();
    tree.userData.sunriseVillageCollisionFootprintScale = 0.45;
    tree.add(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4)));
    source.add(road, tree);

    const proxies = getAuthoredSceneCollisionProxies(THREE, source);

    assert.equal(proxies.length, 1);
    assert.equal(proxies[0]?.halfWidth, 0.9);
    assert.equal(proxies[0]?.halfDepth, 0.9);
  });

  it('derives a radial walk boundary from the island module', () => {
    const source = new THREE.Group();
    const island = new THREE.Group();
    island.userData.sunriseVillageModule = 'island';
    island.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 32)));
    source.add(island);

    const boundary = getAuthoredSceneRadialBoundary(THREE, source);

    assert.ok(boundary);
    assert.deepEqual(boundary?.center, { x: 0, z: 0 });
    assert.equal(boundary?.radii.length, 72);
    assert.ok((boundary?.radii[0] ?? 0) < 4);
    assert.ok((boundary?.radii[0] ?? 0) > 3);
  });

  it('finds the first clear plaza square when the center is blocked', () => {
    const spawn = getAuthoredSceneSpawnPosition([{ x: 0, z: 0, radius: 1.1 }], 4.8, 0.35);
    assert.deepEqual(spawn, { x: -1.25, z: -1.25 });
  });

  it('does not return a position outside the authored movement boundary', () => {
    const spawn = getAuthoredSceneSpawnPosition([{ x: 0, z: 0, radius: 20 }], 1, 0.35);
    assert.equal(spawn, undefined);
  });

  it('prefers a clear position near the requested tree anchor', () => {
    const anchor = { x: -0.18, z: -0.95 };
    const spawn = getAuthoredSceneSpawnPosition([{ ...anchor, radius: 1.1 }], 4.8, 0.35, anchor);
    assert.ok(spawn);
    assert.ok(Math.hypot(spawn.x - anchor.x, spawn.z - anchor.z) <= 3);
    assert.notDeepEqual(spawn, anchor);
  });
});
