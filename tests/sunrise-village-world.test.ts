import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT,
  SUNRISE_VILLAGE_FOREST_VALLEY_ENTRY_POSITION,
  SUNRISE_VILLAGE_FOREST_VALLEY_GATE_POSITION,
  SUNRISE_VILLAGE_GROUND_Y,
  SUNRISE_VILLAGE_MODULE_PLACEMENTS,
} from '../src/features/world/sunrise-village-manifest';
import { SUNRISE_VILLAGE_SKYBOX_URL } from '../src/features/world/world-runtime-assets';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const moduleAssets = [
  'island.glb',
  'market-stall.glb',
  'notice-board.glb',
  'golden-tree-house.glb',
  'rooster-house.glb',
  'forest-house.glb',
  'straight-stone-road.glb',
  'golden-tree.glb',
  'round-stone-road.glb',
] as const;
const forestValleyModuleAssets = [
  'root-gate.glb',
  'multi-tree-stone-gate.glb',
  'purple-mushroom-tree.glb',
  'moon-spring.glb',
  'tree-hollow-one.glb',
  'tree-hollow-two.glb',
  'tree-hollow-three.glb',
  'tree-hollow-house-one.glb',
  'tree-hollow-house-two.glb',
  'circular-boardwalk.glb',
] as const;

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

describe('Sunrise Village world', () => {
  it('ships compressed independent GLBs and removes the retired composite scene', () => {
    moduleAssets.forEach((asset) => {
      const assetPath = new URL(`../public/assets/world/sunrise-village/${asset}`, import.meta.url);
      assert.equal(existsSync(assetPath), true, `missing ${asset}`);
      assert.equal(readFileSync(assetPath).subarray(0, 4).toString(), 'glTF');
      assert.ok(statSync(assetPath).size < 8 * 1024 * 1024, `${asset} is too large`);
    });
    assert.equal(existsSync(new URL('../public/assets/world/sunrise-village.glb', import.meta.url)), false);
  });

  it('ships high-quality GPU-compressed Sunrise Village textures within a 1024px mobile budget', () => {
    assert.equal(existsSync(new URL('../public/basis/basis_transcoder.js', import.meta.url)), true);
    assert.equal(existsSync(new URL('../public/basis/basis_transcoder.wasm', import.meta.url)), true);
    moduleAssets.forEach((asset) => {
      const assetPath = new URL(`../public/assets/world/sunrise-village/${asset}`, import.meta.url);
      const { json, binary } = readGlbJsonAndBinary(assetPath);
      assert.ok(json.extensionsRequired?.includes('KHR_draco_mesh_compression'), `${asset} must keep Draco geometry compression`);
      assert.ok(json.extensionsRequired?.includes('KHR_texture_basisu'), `${asset} must require KTX2 texture support`);
      assert.ok(!json.extensionsUsed?.includes('EXT_texture_webp'), `${asset} must not keep the uncompressed WebP texture extension`);
      assert.equal(json.textures?.length, json.images?.length);
      (json.images ?? []).forEach((image, index) => {
        const view = json.bufferViews?.[image.bufferView ?? -1];
        assert.ok(view, `${asset} image ${index} is missing a buffer view`);
        const start = view.byteOffset ?? 0;
        assert.equal(image.mimeType, 'image/ktx2', `${asset} image ${index} must be KTX2`);
        const dimensions = readKtx2Dimensions(binary.subarray(start, start + view.byteLength));
        assert.ok(dimensions.width <= 1024 && dimensions.height <= 1024, `${asset} image ${index} is ${dimensions.width}x${dimensions.height}`);
      });
      (json.textures ?? []).forEach((texture, index) => {
        assert.ok(texture.extensions?.KHR_texture_basisu?.source !== undefined, `${asset} texture ${index} must point to a KTX2 image`);
      });
    });
  });

  it('ships the Sunrise Village 360-degree skybox alongside its authored modules', () => {
    const skyboxPath = new URL(`../public${SUNRISE_VILLAGE_SKYBOX_URL}`, import.meta.url);
    assert.equal(existsSync(skyboxPath), true);
    assert.ok(statSync(skyboxPath).size > 0);
    assert.match(SUNRISE_VILLAGE_SKYBOX_URL, /^\/assets\/world\/sunrise-village\/sunrise-village-sky\.png$/);
  });

  it('ships the independent compressed Forest Valley modules', () => {
    forestValleyModuleAssets.forEach((asset) => {
      const assetPath = new URL(`../public/assets/world/forest-valley/${asset}`, import.meta.url);
      assert.equal(existsSync(assetPath), true, `missing ${asset}`);
      assert.equal(readFileSync(assetPath).subarray(0, 4).toString(), 'glTF');
      assert.ok(statSync(assetPath).size < 8 * 1024 * 1024, `${asset} is too large`);
    });
  });

  it('ships the purple mushroom tree as a compact tangent-ready Draco/KTX2 GLB', () => {
    const modelPath = new URL('../public/assets/world/forest-valley/purple-mushroom-tree.glb', import.meta.url);
    const binary = readFileSync(modelPath).toString('latin1');
    assert.ok(statSync(modelPath).size < 3 * 1024 * 1024, 'purple mushroom tree should stay below 3 MB');
    assert.match(binary, /KHR_draco_mesh_compression/);
    assert.match(binary, /KHR_texture_basisu/);
    assert.match(binary, /TANGENT/);
  });

  it('registers independent authored assets and mounts them only for Sunrise Village', () => {
    const assets = read('../src/features/world/world-runtime-assets.ts');
    const runtime = read('../src/features/world/prototype-world-runtime.ts');
    const manifest = read('../src/features/world/sunrise-village-manifest.ts');
    assert.match(assets, /SUNRISE_VILLAGE_MODULE_ASSETS/);
    assert.match(manifest, /straightStoneRoad/);
    assert.match(runtime, /SUNRISE_VILLAGE_MODULE_PLACEMENTS/);
    assert.match(assets, /SUNRISE_VILLAGE_TREE_SPAWN_ANCHOR/);
    assert.match(runtime, /options\.worldLocation\s*===\s*['"]sunrise-village['"]/);
    assert.match(runtime, /sunrise-village-scene/);
    assert.match(runtime, /getAuthoredSceneCollisionProxies/);
    assert.match(runtime, /getAuthoredSceneSpawnPosition/);
    assert.match(runtime, /getAuthoredSceneRadialBoundary/);
    assert.match(runtime, /movementBoundary/);
    assert.match(runtime, /alignAuthoredSceneToGround/);
    assert.match(runtime, /KTX2Loader/);
    assert.match(runtime, /setTranscoderPath\(['"]\/basis\/['"]\)/);
    assert.match(runtime, /groundY: worldGroundY/);
  });

  it('keeps Sunrise Village on its original fixed daytime lighting', () => {
    const runtime = read('../src/features/world/prototype-world-runtime.ts');
    assert.match(runtime, /dayNightEnabled:\s*\(sunriseVillageSource\s*\|\|\s*cloudWorkshopSource\s*\|\|\s*forestValleySource\)\s*\?\s*false\s*:\s*options\.dayNightEnabled/);
    assert.match(runtime, /weatherRuntime\.setDayNightEnabled\(\s*\(options\.worldLocation\s*===\s*['"]sunrise-village['"]\s*\|\|\s*options\.worldLocation\s*===\s*['"]cloud-workshop['"]\s*\|\|\s*options\.worldLocation\s*===\s*['"]forest-valley['"]\)\s*\?\s*false\s*:\s*next\.dayNightEnabled\s*\)/);
  });

  it('places the Forest Valley entrance at the far end of the south road', () => {
    assert.equal(SUNRISE_VILLAGE_GROUND_Y, 0.107);
    assert.deepEqual(SUNRISE_VILLAGE_FOREST_VALLEY_GATE_POSITION, { x: -9.67, z: 6.06 });
    assert.deepEqual(SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT.position, [-9.67, 0, 6.06]);
    assert.equal(SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT.rotation.y, -Math.PI / 4);
    assert.equal(SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT.rotation.x, Math.PI / 2);
    assert.equal(SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT.rotation.z, 0);
    assert.equal(SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT.scale, 3.6);
    assert.equal(SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT.groundY, SUNRISE_VILLAGE_GROUND_Y);
    assert.deepEqual(SUNRISE_VILLAGE_FOREST_VALLEY_ENTRY_POSITION, { x: -8.9, z: 5.5 });
  });

  it('keeps authored building collision footprints close to the visible models', () => {
    const buildingAssets = new Set(['forestHouse', 'roosterHouse', 'goldenTreeHouse', 'noticeBoard', 'marketStall']);
    const buildingPlacements = SUNRISE_VILLAGE_MODULE_PLACEMENTS.filter((placement) => buildingAssets.has(placement.asset));
    assert.equal(buildingPlacements.length, buildingAssets.size);
    assert.ok(buildingPlacements.every((placement) => placement.collisionFootprintScale === 0.62));
    assert.equal(SUNRISE_VILLAGE_MODULE_PLACEMENTS.find((placement) => placement.asset === 'goldenTree')?.collisionFootprintScale, 0.45);
  });

  it('keeps Sunrise Village portal placement independent from Forest Valley placement', () => {
    const runtime = read('../src/features/world/prototype-world-runtime.ts');
    const sunriseManifest = read('../src/features/world/sunrise-village-manifest.ts');
    assert.match(sunriseManifest, /SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT/);
    assert.match(runtime, /SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT/);
    assert.match(runtime, /forestValleyGateObject\.rotation\.order = 'YXZ'/);
    assert.doesNotMatch(runtime, /FOREST_VALLEY_MODULE_PLACEMENTS\.find\(\(placement\) => placement\.asset === 'rootGate'\)/);
  });

  it('registers Forest Valley, its root gate, and the proximity prompt callback', () => {
    const assets = read('../src/features/world/forest-valley.ts');
    const location = read('../src/features/world/world-location.ts');
    const runtime = read('../src/features/world/prototype-world-runtime.ts');
    const terrain = read('../src/features/world/TerrainWorldLayer.tsx');
    const dashboard = read('../src/components/ChildDashboard.tsx');
    const gateDialogue = read('../src/features/world/components/ForestValleyGateDialogue.tsx');
    assert.match(assets, /FOREST_VALLEY_MODULE_ASSETS/);
    assert.match(assets, /FOREST_VALLEY_SPAWN_ANCHOR/);
    assert.match(location, /'forest-valley'/);
    assert.match(runtime, /FOREST_VALLEY_MODULE_PLACEMENTS/);
    assert.match(runtime, /onForestValleyGateScreenPositionChange/);
    assert.match(terrain, /onForestValleyGateScreenPositionChange/);
    assert.match(dashboard, /ForestValleyGateDialogue/);
    assert.match(gateDialogue, /進入森語谷/);
    assert.match(runtime, /SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT/);
  });

  it('lets each authored world override a stale social fixed spawn unless a transition entry is provided', () => {
    const runtime = read('../src/features/world/prototype-world-runtime.ts');
    assert.match(runtime, /if \(options\.worldLocation === ['"]sunrise-village['"] && sunriseVillageSource\)/);
    assert.match(runtime, /const initialFixedSpawn = options\.entryPosition\s*\n\s*\?\?\s*\(options\.worldLocation === ['"]sunrise-village['"] \? undefined : options\.session\?\.fixedSpawn\);/);
    assert.match(runtime, /const fixedSpawn = \(next\.worldLocation \?\? options\.worldLocation\) === ['"]sunrise-village['"]\s*\? undefined\s*:\s*next\.session\?\.fixedSpawn;/);
    assert.doesNotMatch(runtime, /if \(!options\.session\?\.fixedSpawn && sunriseVillageSource\)/);
    assert.match(runtime, /options\.entryPosition \?\? SUNRISE_VILLAGE_TREE_SPAWN_ANCHOR/);
    assert.match(runtime, /options\.entryPosition \?\? FOREST_VALLEY_SPAWN_ANCHOR/);
    assert.match(runtime, /characterRoot\.rotation\.y = options\.entryFacingY \?\? 0/);
  });

  it('includes the selected world location in the scene remount contract', () => {
    const terrain = read('../src/features/world/TerrainWorldLayer.tsx');
    const sceneKey = read('../src/features/world/world-scene-key.ts');
    const dashboard = read('../src/components/ChildDashboard.tsx');
    assert.match(terrain, /getTerrainWorldSceneKey\(gameData, worldQuality, showPetNames, runtimeWorldLocation\)/);
    assert.match(sceneKey, /worldLocation/);
    assert.match(dashboard, /getStoredWorldLocation/);
    assert.match(dashboard, /onWorldLocationChange/);
  });

  it('protects world transitions and restores movement focus after loading', () => {
    const terrain = read('../src/features/world/TerrainWorldLayer.tsx');
    const runtime = read('../src/features/world/prototype-world-runtime.ts');
    const worldCss = read('../src/styles/world.css');
    const dashboard = read('../src/components/ChildDashboard.tsx');
    const social = read('../src/features/world-social/WorldSocialLayer.tsx');
    const dock = read('../src/features/world-social/components/MyWorldDock.tsx');

    assert.match(terrain, /useLayoutEffect/);
    assert.match(
      terrain,
      /useLayoutEffect\(\(\) => \{\s*setStatus\('loading'\);[\s\S]*?controllerRef\.current\?\.reset\(\);[\s\S]*?\}, \[childId, runtimeAttempt, sceneKey\]\)/,
    );
    assert.match(terrain, /hh-terrain-world-loading-scrim/);
    assert.match(terrain, /canvas\.focus\(\{ preventScroll: true \}\)/);
    assert.match(terrain, /onWorldTransitionEnd/);
    assert.match(runtime, /options\.controller\?\.reset\(\)/);
    assert.match(runtime, /options\.canvas\.focus\(\{ preventScroll: true \}\)/);
    assert.match(
      worldCss,
      /\.hh-terrain-world-loading-scrim\s*\{[\s\S]*?inset:\s*0[\s\S]*?background:\s*var\(--hh-surface-soft\)/,
    );
    assert.match(dashboard, /setWorldTransitioning\(true\)/);
    assert.match(dashboard, /worldTransitioning=\{worldTransitioning\}/);
    assert.match(social, /worldTransitioning\?: boolean/);
    assert.match(social, /transitioning=\{worldTransitioning\}/);
    assert.match(dock, /disabled=\{transitioning\}/);
  });
});
