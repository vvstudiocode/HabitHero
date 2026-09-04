import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  TIDEGLOW_ARCHIPELAGO_ENTRY_INSET,
  TIDEGLOW_ARCHIPELAGO_ENTRY_POSITION,
  TIDEGLOW_ARCHIPELAGO_GATE_MODULE_ID,
  TIDEGLOW_ARCHIPELAGO_GROUND_Y,
  TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS,
  TIDEGLOW_ARCHIPELAGO_MODULE_PLACEMENTS,
  TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_COLLISION_FOOTPRINT_SCALE,
  TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION,
  TIDEGLOW_ARCHIPELAGO_MOVEMENT_BOUNDARY,
  TIDEGLOW_ARCHIPELAGO_SCENE_TRANSFORM,
  TIDEGLOW_ARCHIPELAGO_SCENE_VERTICAL_OFFSET,
  TIDEGLOW_ARCHIPELAGO_SKYBOX_OFFSET,
  TIDEGLOW_ARCHIPELAGO_SKYBOX_URL,
  TIDEGLOW_ARCHIPELAGO_SPAWN_ANCHOR,
  TIDEGLOW_NOTICE_BOARD_SCALE,
} from '../src/features/world/tideglow-archipelago';

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

describe('Tideglow Archipelago authored world', () => {
  it('registers the Blend-authored modules plus one shared-size notice board', () => {
    assert.deepEqual(Object.keys(TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS), [
      'island',
      'tidalHarbor',
      'lighthouse',
      'harborHuts1',
      'harborHuts2',
      'seasideMarket',
      'glowingCoralReefIsland',
      'mangroveMistIsland',
      'tidalRockPool',
      'navigationConnection',
      'energyCore',
      'noticeBoard',
    ]);
    assert.equal(TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS.seasideMarket, '/assets/world/tideglow-archipelago/seaside-market.glb');
    assert.equal(TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS.noticeBoard, '/assets/world/sunrise-village/notice-board.glb');
    Object.values(TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS).forEach((url) => {
      const assetPath = new URL(`../public${url}`, import.meta.url);
      assert.equal(existsSync(assetPath), true, `missing ${url}`);
      assert.equal(readFileSync(assetPath).subarray(0, 4).toString(), 'glTF');
      assert.ok(statSync(assetPath).size < 8 * 1024 * 1024, `${url} is too large`);
    });
  });

  it('ships Tideglow-owned textures as <=1024px KTX2 with Draco geometry', () => {
    Object.entries(TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS)
      .filter(([, url]) => url.includes('/tideglow-archipelago/'))
      .forEach(([, url]) => {
        const { json, binary } = readGlbJsonAndBinary(new URL(`../public${url}`, import.meta.url));
        assert.ok(json.extensionsRequired?.includes('KHR_draco_mesh_compression'), `${url} must require Draco`);
        assert.ok(json.extensionsRequired?.includes('KHR_texture_basisu'), `${url} must require KTX2/BasisU`);
        assert.ok(!json.extensionsUsed?.includes('EXT_texture_webp'), `${url} must not keep WebP`);
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

  it('ships the Tideglow Archipelago 360-degree skybox alongside its authored modules', () => {
    const skyboxPath = new URL(`../public${TIDEGLOW_ARCHIPELAGO_SKYBOX_URL}`, import.meta.url);
    assert.equal(existsSync(skyboxPath), true);
    assert.ok(statSync(skyboxPath).size > 0);
    assert.match(TIDEGLOW_ARCHIPELAGO_SKYBOX_URL, /^\/assets\/world\/tideglow-archipelago\/tideglow-archipelago-sky\.png$/);
    assert.deepEqual(TIDEGLOW_ARCHIPELAGO_SKYBOX_OFFSET, { x: 0.5, y: 0 });
  });

  it('matches the supplied Blender layout and keeps the notice board the existing world size', () => {
    const placements = new Map(TIDEGLOW_ARCHIPELAGO_MODULE_PLACEMENTS.map((placement) => [placement.id, placement]));
    assert.equal(TIDEGLOW_ARCHIPELAGO_MODULE_PLACEMENTS.length, 11);
    assert.equal(TIDEGLOW_ARCHIPELAGO_SCENE_TRANSFORM.scale, 1);
    assert.equal(TIDEGLOW_ARCHIPELAGO_SCENE_VERTICAL_OFFSET, 3.4);
    assert.equal(TIDEGLOW_ARCHIPELAGO_GROUND_Y, 0.06);
    assert.equal(TIDEGLOW_ARCHIPELAGO_MOVEMENT_BOUNDARY, 6.25);
    assert.deepEqual(TIDEGLOW_ARCHIPELAGO_SPAWN_ANCHOR, TIDEGLOW_ARCHIPELAGO_ENTRY_POSITION);
    assert.equal(TIDEGLOW_ARCHIPELAGO_GATE_MODULE_ID, 'navigation-connection');
    assert.deepEqual(placements.get('main-island')?.position, [0, 0, 0]);
    assert.equal(placements.has('mangrove-mist-island'), false);
    assert.deepEqual(placements.get('navigation-connection')?.position, [3.82, -0.1600015, 4.56]);
    assert.deepEqual(placements.get('navigation-connection')?.rotation, [0.22878, -0.669074, 0.669074, 0.22878]);
    assert.equal(placements.get('navigation-connection')?.collision, true);
    assert.equal(
      placements.get('navigation-connection')?.collisionFootprintScale,
      TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_COLLISION_FOOTPRINT_SCALE,
    );
    assert.equal(TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_COLLISION_FOOTPRINT_SCALE, 0.38);
    assert.deepEqual(placements.get('notice-board')?.scale, TIDEGLOW_NOTICE_BOARD_SCALE);
    assert.equal(placements.get('notice-board')?.collision, true);
    assert.deepEqual(TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION, { x: 3.82, z: 4.56 });
    assert.notEqual(TIDEGLOW_ARCHIPELAGO_ENTRY_POSITION.x, TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION.x);
    assert.ok(TIDEGLOW_ARCHIPELAGO_ENTRY_POSITION.z < TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION.z);
    assert.ok(Math.abs(
      Math.hypot(
        TIDEGLOW_ARCHIPELAGO_ENTRY_POSITION.x - TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION.x,
        TIDEGLOW_ARCHIPELAGO_ENTRY_POSITION.z - TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION.z,
      ) - TIDEGLOW_ARCHIPELAGO_ENTRY_INSET,
    ) < 0.001);
  });

  it('wires the new world, authored loader, and two-way gate prompt', () => {
    const location = readFileSync(new URL('../src/features/world/world-location.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
    const layer = readFileSync(new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url), 'utf8');
    const dashboard = readFileSync(new URL('../src/components/ChildDashboard.tsx', import.meta.url), 'utf8');
    assert.match(location, /tideglow-archipelago/);
    assert.match(runtime, /TIDEGLOW_ARCHIPELAGO_MODULE_PLACEMENTS/);
    assert.match(runtime, /TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS\.navigationConnection/);
    assert.match(runtime, /TIDEGLOW_ARCHIPELAGO_SCENE_VERTICAL_OFFSET/);
    assert.match(runtime, /TIDEGLOW_ARCHIPELAGO_SKYBOX_URL/);
    assert.match(runtime, /skyboxOffset:[\s\S]*tideglowArchipelagoSource\s*\?\s*TIDEGLOW_ARCHIPELAGO_SKYBOX_OFFSET/);
    assert.match(runtime, /getTideglowSurfaceAt/);
    assert.match(runtime, /canTraverseTideglowSurface/);
    assert.match(runtime, /onTideglowGateScreenPositionChange/);
    assert.match(layer, /onTideglowGateScreenPositionChange/);
    assert.match(dashboard, /TideglowGateDialogue/);
    assert.match(dashboard, /潮光群島/);
  });
});
