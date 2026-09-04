import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  STAR_SAND_WASTELAND_ENTRY_POSITION,
  STAR_SAND_WASTELAND_GATE_MODULE_ID,
  STAR_SAND_WASTELAND_GATE_POSITION,
  STAR_SAND_WASTELAND_GROUND_Y,
  STAR_SAND_WASTELAND_NOTICE_BOARD_POSITION,
  STAR_SAND_WASTELAND_NOTICE_BOARD_PROMPT_OFFSET_Y,
  STAR_SAND_WASTELAND_NOTICE_BOARD_SCALE,
  STAR_SAND_WASTELAND_SKYBOX_URL,
  STAR_SAND_WASTELAND_MODULE_ASSETS,
  STAR_SAND_WASTELAND_MODULE_PLACEMENTS,
  STAR_SAND_WASTELAND_MOVEMENT_BOUNDARY,
  STAR_SAND_WASTELAND_SCENE_TRANSFORM,
  STAR_SAND_WASTELAND_SPAWN_ANCHOR,
  SUNRISE_VILLAGE_STAR_SAND_WASTELAND_ENTRY_POSITION,
  SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT,
} from '../src/features/world/star-sand-wasteland';

interface GlbJson {
  images?: Array<{ bufferView?: number; mimeType?: string }>;
  bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
  extensionsRequired?: string[];
  extensionsUsed?: string[];
  textures?: Array<{ extensions?: Record<string, { source?: number }> }>;
}

function readGlbJsonAndBinary(assetPath: URL): { json: GlbJson; binary: Buffer } {
  const buffer = readFileSync(assetPath);
  let offset = 12;
  let json: GlbJson | undefined;
  let binary: Buffer | undefined;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    offset += 8 + chunkLength;
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8').replace(/\0+$/, '')) as GlbJson;
    if (chunkType === 0x004e4942) binary = chunk;
  }
  assert.ok(json && binary);
  return { json, binary };
}

function readKtx2Dimensions(ktx2: Buffer) {
  assert.deepEqual(ktx2.subarray(0, 12), Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: ktx2.readUInt32LE(20), height: ktx2.readUInt32LE(24) };
}

function readPngDimensions(png: Buffer) {
  assert.deepEqual(png.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('Star Sand Wasteland authored world', () => {
  it('registers a dedicated 2:1 Star Sand skybox preview at 1024px', () => {
    const skyboxPath = new URL(`../public${STAR_SAND_WASTELAND_SKYBOX_URL}`, import.meta.url);
    assert.equal(existsSync(skyboxPath), true);
    assert.deepEqual(readPngDimensions(readFileSync(skyboxPath)), { width: 1024, height: 512 });
  });

  it('registers every supplied desert module and ships mobile-ready GLBs', () => {
    assert.deepEqual(Object.keys(STAR_SAND_WASTELAND_MODULE_ASSETS), [
      'island',
      'windbreakTent',
      'councilTent',
      'desertDomeHouse',
      'caravanSunshade',
      'weatheredPillar1',
      'boulder',
      'luminousStarSand',
      'ancientCityEntrance',
      'caravanRest',
      'weatheredPillar',
      'noticeBoard',
    ]);
    Object.entries(STAR_SAND_WASTELAND_MODULE_ASSETS).forEach(([, url]) => {
      const assetPath = new URL(`../public${url}`, import.meta.url);
      assert.equal(existsSync(assetPath), true, `missing ${url}`);
      assert.equal(readFileSync(assetPath).subarray(0, 4).toString(), 'glTF');
      assert.ok(statSync(assetPath).size < 8 * 1024 * 1024, `${url} is too large`);
      const { json, binary } = readGlbJsonAndBinary(assetPath);
      assert.ok(json.extensionsRequired?.includes('KHR_draco_mesh_compression'), `${url} must require Draco`);
      assert.ok(json.extensionsRequired?.includes('KHR_texture_basisu'), `${url} must require KTX2/BasisU`);
      assert.equal(json.textures?.length, json.images?.length);
      (json.images ?? []).forEach((image, index) => {
        const view = json.bufferViews?.[image.bufferView ?? -1];
        assert.ok(view, `${url} image ${index} is missing a buffer view`);
        const dimensions = readKtx2Dimensions(binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
        assert.equal(image.mimeType, 'image/ktx2');
        assert.ok(dimensions.width <= 1024 && dimensions.height <= 1024, `${url} image ${index} exceeds 1024px`);
      });
    });
  });

  it('copies the supplied Blend layout into the runtime coordinate system', () => {
    const placements = new Map(STAR_SAND_WASTELAND_MODULE_PLACEMENTS.map((placement) => [placement.id, placement]));
    assert.equal(STAR_SAND_WASTELAND_MODULE_PLACEMENTS.length, 12);
    assert.equal(STAR_SAND_WASTELAND_SCENE_TRANSFORM.scale, 1.7);
    assert.equal(STAR_SAND_WASTELAND_GROUND_Y, 0.06);
    assert.equal(STAR_SAND_WASTELAND_MOVEMENT_BOUNDARY, 4.25 * STAR_SAND_WASTELAND_SCENE_TRANSFORM.scale);
    assert.deepEqual(STAR_SAND_WASTELAND_SPAWN_ANCHOR, STAR_SAND_WASTELAND_ENTRY_POSITION);
    assert.equal(STAR_SAND_WASTELAND_GATE_MODULE_ID, 'ancient-city-entrance');
    assert.deepEqual(placements.get('star-sand-island')?.position, [-0.03590448200702667, 0.01598811149597168, 0.1313418745994568]);
    assert.deepEqual(placements.get('ancient-city-entrance')?.position, [-0.03590448200702667, 0.474254846572876, 3.9487998485565186]);
    assert.deepEqual(placements.get('ancient-city-entrance')?.rotation, [0.003966282121837139, -0.7070956826210022, 0.7070956826210022, 0.003966282121837139]);
    assert.deepEqual(placements.get('ancient-city-entrance')?.scale, [2.5135140419006348, 2.5244271755218506, 3.817413568496704]);
    assert.equal(placements.get('ancient-city-entrance')?.collision, true);
    assert.deepEqual(placements.get('notice-board')?.asset, 'noticeBoard');
    assert.deepEqual(placements.get('notice-board')?.position, [
      STAR_SAND_WASTELAND_NOTICE_BOARD_POSITION.x,
      STAR_SAND_WASTELAND_NOTICE_BOARD_POSITION.y,
      STAR_SAND_WASTELAND_NOTICE_BOARD_POSITION.z,
    ]);
    assert.deepEqual(placements.get('notice-board')?.scale, STAR_SAND_WASTELAND_NOTICE_BOARD_SCALE);
    assert.equal(placements.get('notice-board')?.collision, true);
    assert.equal(STAR_SAND_WASTELAND_NOTICE_BOARD_PROMPT_OFFSET_Y, -0.35);
    assert.ok(STAR_SAND_WASTELAND_NOTICE_BOARD_PROMPT_OFFSET_Y < 0);
    assert.equal(STAR_SAND_WASTELAND_GATE_POSITION.x, -0.03590448200702667 * STAR_SAND_WASTELAND_SCENE_TRANSFORM.scale);
    assert.equal(STAR_SAND_WASTELAND_GATE_POSITION.z, 3.9487998485565186 * STAR_SAND_WASTELAND_SCENE_TRANSFORM.scale);
    assert.equal(STAR_SAND_WASTELAND_ENTRY_POSITION.x, STAR_SAND_WASTELAND_GATE_POSITION.x);
    assert.ok(STAR_SAND_WASTELAND_ENTRY_POSITION.z < STAR_SAND_WASTELAND_GATE_POSITION.z);
    assert.deepEqual(SUNRISE_VILLAGE_STAR_SAND_WASTELAND_ENTRY_POSITION, {
      x: SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT.position[0]
        + Math.cos(SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT.rotation.y) * 1.8,
      z: SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT.position[2]
        + Math.sin(SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT.rotation.y) * 1.8,
    });
  });

  it('wires the desert world, ancient-city two-way gate, and grounded character path', () => {
    const location = readFileSync(new URL('../src/features/world/world-location.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
    const weatherRuntime = readFileSync(new URL('../src/features/world/world-weather-runtime.ts', import.meta.url), 'utf8');
    const layer = readFileSync(new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url), 'utf8');
    const dashboard = readFileSync(new URL('../src/components/ChildDashboard.tsx', import.meta.url), 'utf8');
    assert.match(location, /star-sand-wasteland/);
    assert.match(runtime, /STAR_SAND_WASTELAND_MODULE_PLACEMENTS/);
    assert.match(runtime, /STAR_SAND_WASTELAND_MODULE_ASSETS\.ancientCityEntrance/);
    assert.match(runtime, /STAR_SAND_WASTELAND_GROUND_Y/);
    assert.match(runtime, /notice-board/);
    assert.match(runtime, /STAR_SAND_WASTELAND_NOTICE_BOARD_PROMPT_OFFSET_Y/);
    assert.match(runtime, /adventureLandmarkPromptOffsetY/);
    assert.match(runtime, /STAR_SAND_WASTELAND_SKYBOX_URL/);
    assert.match(runtime, /skyboxUrl/);
    assert.doesNotMatch(runtime, /STAR_SAND_WASTELAND_SKYBOX_PITCH|backgroundPitch/);
    assert.match(runtime, /skyboxOffset/);
    assert.match(weatherRuntime, /skyboxOffset/);
    assert.match(weatherRuntime, /SphereGeometry/);
    assert.match(weatherRuntime, /texture\.offset/);
    assert.doesNotMatch(weatherRuntime, /backgroundPitch/);
    assert.match(runtime, /starSandWastelandSource/);
    assert.match(runtime, /groundCharacterOnGrass/);
    assert.match(runtime, /WORLD_GLTF_LOAD_CONCURRENCY = 2/);
    assert.match(runtime, /createGltfUrlCache/);
    assert.match(runtime, /source\.clone\(true\)/);
    assert.match(runtime, /onStarSandWastelandGateScreenPositionChange/);
    assert.match(layer, /onStarSandWastelandGateScreenPositionChange/);
    assert.match(dashboard, /StarSandWastelandGateDialogue/);
    assert.match(dashboard, /星砂荒原/);
  });
});
