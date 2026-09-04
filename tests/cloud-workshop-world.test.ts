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
  CLOUD_WORKSHOP_NOTICE_BOARD_PROMPT_OFFSET_Y,
  CLOUD_WORKSHOP_SCENE_TRANSFORM,
  CLOUD_WORKSHOP_SKYBOX_URL,
  CLOUD_WORKSHOP_SPAWN_ANCHOR,
  SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_FORWARD_OFFSET,
  SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_POSITION,
  SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT,
  getCloudWorkshopGatePromptHeight,
  isCloudWorkshopGateNearby,
} from '../src/features/world/cloud-workshop';

function readGlbJsonAndBinary(assetPath: URL) {
  const binary = readFileSync(assetPath);
  let offset = 12;
  let json: {
    images?: Array<{ bufferView?: number; mimeType?: string }>;
    bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
    extensionsRequired?: string[];
    extensionsUsed?: string[];
    textures?: Array<{ extensions?: Record<string, { source?: number }> }>;
  } | undefined;
  let binaryChunk: Buffer | undefined;
  while (offset < binary.length) {
    const chunkLength = binary.readUInt32LE(offset);
    const chunkType = binary.readUInt32LE(offset + 4);
    const chunk = binary.subarray(offset + 8, offset + 8 + chunkLength);
    offset += 8 + chunkLength;
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8').replace(/\0+$/, '')) as typeof json;
    if (chunkType === 0x004e4942) binaryChunk = chunk;
  }
  assert.ok(json && binaryChunk);
  return { json, binary: binaryChunk };
}

function readKtx2Dimensions(ktx2: Buffer) {
  assert.deepEqual(ktx2.subarray(0, 12), Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: ktx2.readUInt32LE(20), height: ktx2.readUInt32LE(24) };
}

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
  'noticeBoard',
] as const;

describe('Cloud Workshop authored world', () => {
  it('registers every supplied GLB as an independently loadable optimized asset', () => {
    assert.deepEqual(Object.keys(CLOUD_WORKSHOP_MODULE_ASSETS), expectedAssetKeys);
    Object.values(CLOUD_WORKSHOP_MODULE_ASSETS).forEach((url) => {
      const assetPath = new URL(`../public${url}`, import.meta.url);
      assert.equal(existsSync(assetPath), true, `missing ${url}`);
      assert.equal(readFileSync(assetPath).subarray(0, 4).toString(), 'glTF');
      assert.ok(statSync(assetPath).size < 8 * 1024 * 1024, `${url} is too large`);
      const { json } = readGlbJsonAndBinary(assetPath);
      assert.ok(json.extensionsUsed?.includes('KHR_draco_mesh_compression'));
    });
  });

  it('ships GPU-compressed textures within the 1024px mobile budget', () => {
    Object.values(CLOUD_WORKSHOP_MODULE_ASSETS).forEach((url) => {
      const assetPath = new URL(`../public${url}`, import.meta.url);
      const { json, binary } = readGlbJsonAndBinary(assetPath);
      assert.ok(json.extensionsRequired?.includes('KHR_draco_mesh_compression'), `${url} must keep Draco geometry compression`);
      assert.ok(json.extensionsRequired?.includes('KHR_texture_basisu'), `${url} must require KTX2 texture support`);
      assert.ok(!json.extensionsUsed?.includes('EXT_texture_webp'), `${url} must not keep the WebP texture extension`);
      assert.equal(json.textures?.length, json.images?.length);
      (json.images ?? []).forEach((image, index) => {
        const view = json.bufferViews?.[image.bufferView ?? -1];
        assert.ok(view, `${url} image ${index} is missing a buffer view`);
        const start = view.byteOffset ?? 0;
        assert.equal(image.mimeType, 'image/ktx2', `${url} image ${index} must be KTX2`);
        const dimensions = readKtx2Dimensions(binary.subarray(start, start + view.byteLength));
        assert.ok(dimensions.width <= 1024 && dimensions.height <= 1024, `${url} image ${index} is ${dimensions.width}x${dimensions.height}`);
      });
      (json.textures ?? []).forEach((texture, index) => {
        assert.ok(texture.extensions?.KHR_texture_basisu?.source !== undefined, `${url} texture ${index} must point to a KTX2 image`);
      });
    });
  });

  it('ships the Cloud Workshop 360-degree skybox alongside its authored modules', () => {
    const skyboxPath = new URL(`../public${CLOUD_WORKSHOP_SKYBOX_URL}`, import.meta.url);
    assert.equal(existsSync(skyboxPath), true);
    assert.ok(statSync(skyboxPath).size > 0);
    assert.match(CLOUD_WORKSHOP_SKYBOX_URL, /^\/assets\/world\/cloud-workshop\/cloud-workshop-sky\.png$/);
  });

  it('keeps Cloud Workshop on fixed daytime lighting and raises its skybox to reveal distant islands', () => {
    const cloudSource = readFileSync(new URL('../src/features/world/cloud-workshop.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
    assert.match(cloudSource, /CLOUD_WORKSHOP_SKYBOX_OFFSET\s*=\s*Object\.freeze\(\{\s*x:\s*0,\s*y:\s*0\.18\s*\}\)/);
    assert.match(cloudSource, /CLOUD_WORKSHOP_SUN_POSITION\s*=\s*Object\.freeze\(\[\s*5\.5,\s*11\.5,\s*-3\.5\s*\]\s*as\s*const\)/);
    assert.match(runtime, /dayNightEnabled:\s*\(sunriseVillageSource\s*\|\|\s*cloudWorkshopSource\s*\|\|\s*forestValleySource\)\s*\?\s*false\s*:\s*options\.dayNightEnabled/);
    assert.match(runtime, /weatherRuntime\.setDayNightEnabled\(\s*\(options\.worldLocation\s*===\s*['"]sunrise-village['"]\s*\|\|\s*options\.worldLocation\s*===\s*['"]cloud-workshop['"]\s*\|\|\s*options\.worldLocation\s*===\s*['"]forest-valley['"]\)\s*\?\s*false\s*:\s*next\.dayNightEnabled\s*\)/);
    assert.match(runtime, /sun\.position\.fromArray\(options\.worldLocation\s*===\s*['"]cloud-workshop['"]\s*\?\s*CLOUD_WORKSHOP_SUN_POSITION\s*:\s*visualSettings\.sunPosition\)/);
    assert.match(runtime, /skyboxOffset:\s*cloudWorkshopSource\s*\?\s*CLOUD_WORKSHOP_SKYBOX_OFFSET/);
  });

  it('keeps the authored Blender layout in an isolated local coordinate space', () => {
    assert.equal(CLOUD_WORKSHOP_SCENE_TRANSFORM.scale, 0.6);
    assert.equal(CLOUD_WORKSHOP_GROUND_Y, 0.06);
    assert.equal(CLOUD_WORKSHOP_MOVEMENT_BOUNDARY, 18.9);
    assert.deepEqual(CLOUD_WORKSHOP_SPAWN_ANCHOR, CLOUD_WORKSHOP_ENTRY_POSITION);
    assert.deepEqual(CLOUD_WORKSHOP_ENTRY_POSITION, { x: 0, z: 0 });
    assert.equal(CLOUD_WORKSHOP_MODULE_PLACEMENTS.length, 23);
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

    const noticeBoard = CLOUD_WORKSHOP_MODULE_PLACEMENTS.find((placement) => placement.asset === 'noticeBoard');
    assert.ok(noticeBoard);
    assert.equal(noticeBoard.id, 'notice-board');
    assert.equal(noticeBoard.collision, true);
    assert.equal(noticeBoard.collisionFootprintScale, 0.62);
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

  it('uses the Cloud Workshop notice board as the adventure landmark', () => {
    const cloudSource = readFileSync(new URL('../src/features/world/cloud-workshop.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');

    assert.equal(CLOUD_WORKSHOP_NOTICE_BOARD_PROMPT_OFFSET_Y, -1.8);
    assert.match(cloudSource, /CLOUD_WORKSHOP_NOTICE_BOARD_PROMPT_OFFSET_Y\s*=\s*-1\.8/);
    assert.match(runtime, /cloudWorkshopSource\s*\?\s*getAuthoredSceneModule\(cloudWorkshopSource,\s*['"]notice-board['"]\)/);
    assert.match(runtime, /CLOUD_WORKSHOP_NOTICE_BOARD_PROMPT_OFFSET_Y\s*\*\s*sceneTransform\.scale/);
  });
});
