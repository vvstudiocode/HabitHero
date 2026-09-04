import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { FOREST_VALLEY_MODULE_ASSETS } from '../src/features/world/forest-valley';

const forestValleyAssets = Object.entries(FOREST_VALLEY_MODULE_ASSETS)
  .filter(([key]) => key !== 'island' && key !== 'noticeBoard')
  .map(([, url]) => url.replace(/^\//, ''));

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

  assert.ok(json, `${assetPath.pathname} is missing a JSON chunk`);
  assert.ok(binary, `${assetPath.pathname} is missing a BIN chunk`);
  return { json, binary };
}

function readKtx2Dimensions(ktx2: Buffer) {
  assert.deepEqual(
    ktx2.subarray(0, 12),
    Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  return { width: ktx2.readUInt32LE(20), height: ktx2.readUInt32LE(24) };
}

describe('Forest Valley mobile assets', () => {
  it('keeps Forest Valley-owned modules isolated from Sunrise Village paths', () => {
    assert.ok(forestValleyAssets.length > 0);
    forestValleyAssets.forEach((asset) => assert.match(asset, /^assets\/world\/forest-valley\//));
  });

  it('ships every Forest Valley-owned texture as <=1024px KTX2 with BasisU', () => {
    forestValleyAssets.forEach((asset) => {
      const { json, binary } = readGlbJsonAndBinary(new URL(`../public/${asset}`, import.meta.url));
      assert.ok(json.extensionsRequired?.includes('KHR_draco_mesh_compression'), `${asset} must keep Draco geometry compression`);
      assert.ok(json.extensionsRequired?.includes('KHR_texture_basisu'), `${asset} must require KTX2 texture support`);
      assert.ok(!json.extensionsUsed?.includes('EXT_texture_webp'), `${asset} must not keep WebP texture extension`);
      assert.equal(json.textures?.length, json.images?.length, `${asset} texture/image count must stay aligned`);

      (json.images ?? []).forEach((image, index) => {
        const view = json.bufferViews?.[image.bufferView ?? -1];
        assert.ok(view, `${asset} image ${index} is missing a buffer view`);
        const start = view.byteOffset ?? 0;
        assert.equal(image.mimeType, 'image/ktx2', `${asset} image ${index} must be KTX2`);
        const dimensions = readKtx2Dimensions(binary.subarray(start, start + view.byteLength));
        assert.ok(dimensions.width <= 1024 && dimensions.height <= 1024, `${asset} image ${index} is ${dimensions.width}x${dimensions.height}`);
      });

      (json.textures ?? []).forEach((texture, index) => {
        assert.ok(texture.extensions?.KHR_texture_basisu?.source !== undefined, `${asset} texture ${index} must point to KTX2`);
      });
    });
  });
});
