import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  CLOUD_WORKSHOP_ENTRY_POSITION,
  CLOUD_WORKSHOP_GATE_ENTER_RADIUS,
  CLOUD_WORKSHOP_GATE_EXIT_RADIUS,
  CLOUD_WORKSHOP_GROUND_Y,
  CLOUD_WORKSHOP_MODULE_ASSETS,
  CLOUD_WORKSHOP_MODULE_PLACEMENTS,
  CLOUD_WORKSHOP_MOVEMENT_BOUNDARY,
  CLOUD_WORKSHOP_SCENE_TRANSFORM,
  CLOUD_WORKSHOP_SPAWN_ANCHOR,
  SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_FORWARD_OFFSET,
  SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_POSITION,
  SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT,
  getCloudWorkshopGatePromptHeight,
  isCloudWorkshopGateNearby,
} from '../src/features/world/cloud-workshop';

const expectedAssetKeys = [
  'cloudStairRailing1',
  'cloudStairRailing2',
  'cloudStairRailing3',
  'skyGarden1',
  'skyGarden2',
  'skyGarden3',
  'cloudMaterialHut1',
  'cloudMaterialHut2',
  'smallCloudAirship1',
  'smallCloudAirship2',
  'smallCloudAirship3',
  'smallCloudAirship4',
  'smallCloudAirship5',
  'airshipDock1',
  'airshipDock2',
  'windmillHighland1',
  'windmillHighland2',
  'cloudCoreWorkshop1',
  'cloudCoreWorkshop2',
  'cloudBridge1',
  'cloudBridge2',
  'cloudGround1',
  'cloudGround2',
  'cloudGround3',
] as const;

describe('Cloud Workshop authored world', () => {
  it('registers every supplied GLB as an independently loadable optimized asset', () => {
    assert.deepEqual(Object.keys(CLOUD_WORKSHOP_MODULE_ASSETS), expectedAssetKeys);
    Object.values(CLOUD_WORKSHOP_MODULE_ASSETS).forEach((url) => {
      const assetPath = new URL(`../public${url}`, import.meta.url);
      assert.equal(existsSync(assetPath), true, `missing ${url}`);
      assert.equal(readFileSync(assetPath).subarray(0, 4).toString(), 'glTF');
      assert.ok(statSync(assetPath).size < 8 * 1024 * 1024, `${url} is too large`);
      const jsonLength = readFileSync(assetPath).readUInt32LE(12);
      const gltf = JSON.parse(readFileSync(assetPath).toString('utf8', 20, 20 + jsonLength).trim());
      assert.ok(gltf.extensionsUsed?.includes('KHR_draco_mesh_compression'));
      assert.ok(gltf.extensionsUsed?.includes('EXT_texture_webp'));
    });
  });

  it('keeps the authored Blender layout in an isolated local coordinate space', () => {
    assert.equal(CLOUD_WORKSHOP_SCENE_TRANSFORM.scale, 0.6);
    assert.equal(CLOUD_WORKSHOP_GROUND_Y, 0.06);
    assert.equal(CLOUD_WORKSHOP_MOVEMENT_BOUNDARY, 18.9);
    assert.deepEqual(CLOUD_WORKSHOP_SPAWN_ANCHOR, CLOUD_WORKSHOP_ENTRY_POSITION);
    assert.deepEqual(CLOUD_WORKSHOP_ENTRY_POSITION, { x: 0, z: 0 });
    assert.equal(CLOUD_WORKSHOP_MODULE_PLACEMENTS.length, 22);
    assert.equal(
      SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_POSITION.x,
      SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT.position[0],
    );
    assert.ok(
      SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_POSITION.z
      < SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT.position[2],
    );
    assert.ok(
      Math.abs(
        SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_POSITION.z
        - (SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT.position[2] - SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_FORWARD_OFFSET)
      ) < 0.0001,
    );

    const entrance = CLOUD_WORKSHOP_MODULE_PLACEMENTS.find((placement) => placement.asset === 'airshipDock1');
    assert.ok(entrance);
    assert.equal(entrance.id, 'airship-dock-1');
    assert.equal(entrance.asset, 'airshipDock1');
    assert.equal(entrance.position.length, 3);
    assert.ok(entrance.position.every((value) => Number.isFinite(value)));
    assert.deepEqual(entrance?.rotation, [0.541033, 0.455284, -0.455284, 0.541033]);
    assert.deepEqual(entrance?.scale, [5.295177, 5.264868, 6.265191]);
    assert.equal(entrance?.collision, true);
  });

  it('matches the Blender-exported reference anchors without a manual vertical offset', () => {
    const placementById = new Map(CLOUD_WORKSHOP_MODULE_PLACEMENTS.map((placement) => [placement.id, placement]));

    assert.deepEqual(placementById.get('cloud-ground-1')?.position, [-0.054438, -8.434945, -0.407657]);
    assert.deepEqual(placementById.get('sky-garden-3')?.position, [13.600777, 6.06283, -38.944847]);
    assert.deepEqual(placementById.get('cloud-stair-railing-2')?.rotation, [0.299787, 0.640412, -0.640412, 0.299787]);
  });

  it('lifts the authored cloud workshop scene while leaving the player world height unchanged', () => {
    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(runtime, /cloudWorkshopSource \? \{ preserveGroundModulePosition: true \}/);
    assert.match(runtime, /CLOUD_WORKSHOP_GROUND_Y/);
    assert.match(runtime, /getAuthoredSceneSurfaceY/);
  });

  it('keeps authored dock height editable instead of overriding it during grounding', () => {
    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(runtime, /const cloudWorkshopGateBounds = new THREE\.Box3\(\)\.setFromObject\(cloudWorkshopGateObject\);\s*cloudWorkshopGateObject\.position\.y \+= \(\s*CLOUD_WORKSHOP_GROUND_Y/);
    assert.match(runtime, /SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT\.position\[1\]/);
  });

  it('uses hysteresis for the dock entrance prompt', () => {
    assert.equal(isCloudWorkshopGateNearby(CLOUD_WORKSHOP_GATE_ENTER_RADIUS, false), true);
    assert.equal(isCloudWorkshopGateNearby(3, true), true);
    assert.equal(isCloudWorkshopGateNearby(CLOUD_WORKSHOP_GATE_EXIT_RADIUS + 0.01, true), false);
    assert.equal(isCloudWorkshopGateNearby(Number.NaN, false), false);
    assert.equal(getCloudWorkshopGatePromptHeight(10, 0), 2.5);
  });

  it('wires the dock prompt through the runtime and child world surface', () => {
    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
    const layer = readFileSync(new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url), 'utf8');
    const dashboard = readFileSync(new URL('../src/components/ChildDashboard.tsx', import.meta.url), 'utf8');
    assert.match(runtime, /CLOUD_WORKSHOP_MODULE_PLACEMENTS/);
    assert.match(runtime, /SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT/);
    assert.match(runtime, /onCloudWorkshopGateScreenPositionChange/);
    assert.match(layer, /onCloudWorkshopGateScreenPositionChange/);
    assert.match(dashboard, /CloudWorkshopGateDialogue/);
    assert.match(dashboard, /進入雲工房/);
  });
});
