import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { AnimationClip, VectorKeyframeTrack } from 'three';
import { createInPlaceAnimationClip } from '../src/features/world/prototype-world-runtime';
import {
  getPetMovementSpeedMultiplier,
  getPetNameLabelScale,
  getPetVisualScaleMultiplier,
  getPetGroundShadowScale,
  getPetGroundOffset,
  shouldHidePetGroundMarker,
} from '../src/features/world/prototype-world-runtime';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';
import type { GameCatalogItem } from '../src/features/world/contracts';

const root = new URL('../', import.meta.url);

function makePet(assetKey: string, model: string): GameCatalogItem {
  return {
    id: assetKey,
    itemType: 'pet',
    name: assetKey,
    description: '',
    scrollPrice: 1,
    assetKey,
    thumbnailUrl: null,
    isActive: true,
    isStarter: false,
    isStackable: false,
    collisionRadius: 0.3,
    minScale: 0.8,
    maxScale: 1.2,
    sortOrder: 1,
    metadata: { model },
  };
}

function readGlbJson(path: URL): { json: Record<string, any>; bytes: Buffer; binaryOffset: number } {
  const bytes = readFileSync(path);
  const jsonLength = bytes.readUInt32LE(12);
  const jsonStart = 20;
  return {
    json: JSON.parse(bytes.subarray(jsonStart, jsonStart + jsonLength).toString('utf8').trim()),
    bytes,
    binaryOffset: jsonStart + jsonLength + 8,
  };
}

function readAccessorVectors(
  glb: { json: Record<string, any>; bytes: Buffer; binaryOffset: number },
  accessorIndex: number,
): number[][] {
  const accessor = glb.json.accessors[accessorIndex];
  assert.equal(accessor.componentType, 5126, 'animation output should use float values');
  const bufferView = glb.json.bufferViews[accessor.bufferView];
  const componentCount = accessor.type === 'VEC3' ? 3 : 1;
  const stride = bufferView.byteStride ?? componentCount * 4;
  const start = glb.binaryOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, index) => Array.from({ length: componentCount }, (_, component) => (
    glb.bytes.readFloatLE(start + index * stride + component * 4)
  )));
}

function getAnimationHorizontalRanges(path: URL): Array<{ animation: string; node: string; x: number; z: number }> {
  const glb = readGlbJson(path);
  const ranges: Array<{ animation: string; node: string; x: number; z: number }> = [];
  for (const animation of glb.json.animations ?? []) {
    if (!/walk|run/i.test(animation.name ?? '')) continue;
    for (const channel of animation.channels ?? []) {
      if (channel.target?.path !== 'translation') continue;
      const nodeName = glb.json.nodes[channel.target.node]?.name ?? '';
      if (!/root|armature|hips|pelvis/i.test(nodeName)) continue;
      const sampler = animation.samplers[channel.sampler];
      const vectors = readAccessorVectors(glb, sampler.output);
      const xValues = vectors.map((vector) => vector[0]);
      const zValues = vectors.map((vector) => vector[2]);
      ranges.push({
        animation: animation.name,
        node: nodeName,
        x: Math.max(...xValues) - Math.min(...xValues),
        z: Math.max(...zValues) - Math.min(...zValues),
      });
    }
  }
  return ranges;
}

function getAnimationVerticalRanges(path: URL): Array<{ animation: string; node: string; y: number }> {
  const glb = readGlbJson(path);
  const ranges: Array<{ animation: string; node: string; y: number }> = [];
  for (const animation of glb.json.animations ?? []) {
    if (!/walk|run/i.test(animation.name ?? '')) continue;
    for (const channel of animation.channels ?? []) {
      if (channel.target?.path !== 'translation') continue;
      const nodeName = glb.json.nodes[channel.target.node]?.name ?? '';
      if (!/root|armature|hips|pelvis/i.test(nodeName)) continue;
      const sampler = animation.samplers[channel.sampler];
      const vectors = readAccessorVectors(glb, sampler.output);
      const yValues = vectors.map((vector) => vector[1]);
      ranges.push({
        animation: animation.name,
        node: nodeName,
        y: Math.max(...yValues) - Math.min(...yValues),
      });
    }
  }
  return ranges;
}

describe('pet animation delivery rules', () => {
  it('removes horizontal root motion from common Mixamo root track names', () => {
    const clip = new AnimationClip('Walk', 1, [
      new VectorKeyframeTrack('.bones[mixamorigHips].position', [0, 1], [0, 0.9, 0, 0.8, 1.4, 2.5]),
      new VectorKeyframeTrack('Armature.position', [0, 1], [0, 0.1, 0, 1.1, 0.2, 3.5]),
      new VectorKeyframeTrack('.bones[mixamorig:LeftFoot].position', [0, 1], [0, 0, 0, 0.1, 0, 0.2]),
    ]);

    const normalized = createInPlaceAnimationClip(clip);
    assert.deepEqual(Array.from(normalized.tracks[0].values).map((value) => Number(Number(value).toFixed(3))), [0, 0.9, 0, 0, 1.4, 0]);
    assert.deepEqual(Array.from(normalized.tracks[1].values).map((value) => Number(Number(value).toFixed(3))), [0, 0.1, 0, 0, 0.2, 0]);
    assert.deepEqual(Array.from(normalized.tracks[2].values), Array.from(clip.tracks[2].values));
  });

  it('ships Christo and Star Diver walk clips with no authored horizontal root motion', () => {
    for (const pet of [
      { name: '星辰潛者', model: 'public/assets/pets/star-diver.glb' },
      { name: '克里斯多', model: 'public/assets/pets/christo.glb' },
      { name: '莫可', model: 'public/assets/pets/moko.glb' },
      { name: '卡爾多', model: 'public/assets/pets/kaldo.glb' },
      { name: '奧利安', model: 'public/assets/pets/orian.glb' },
    ]) {
      const path = new URL(pet.model, root);
      assert.equal(existsSync(path), true, `${pet.name} model should be present`);
      const maxModelBytes = ['莫可', '奧利安', '卡爾多'].includes(pet.name) ? 2 * 1024 * 1024 : 1.6 * 1024 * 1024;
      assert.ok(statSync(path).size < maxModelBytes, `${pet.name} model should stay compact`);
      const contents = readFileSync(path).toString('latin1');
      assert.equal(contents.slice(0, 4), 'glTF');
      assert.match(contents, /Walk_InPlace/);
      assert.match(contents, /Idle/);
      assert.match(contents, /KHR_draco_mesh_compression/);
      assert.match(contents, /EXT_texture_webp/);
      const ranges = getAnimationHorizontalRanges(path);
      assert.ok(ranges.length > 0, `${pet.name} should expose a walk root translation track`);
      for (const range of ranges) {
        assert.ok(range.x <= 0.0005, `${pet.name} ${range.node} x root motion should be in place`);
        assert.ok(range.z <= 0.0005, `${pet.name} ${range.node} z root motion should be in place`);
      }
    }
  });

  it('keeps Arcadia and Oum source Walk vertical motion in the repacked GLBs', () => {
    for (const pet of [
      { name: '阿卡迪亞', model: 'public/assets/pets/arcadia.glb' },
      { name: '歐姆', model: 'public/assets/pets/oum.glb' },
    ]) {
      const ranges = getAnimationVerticalRanges(new URL(pet.model, root));
      assert.ok(ranges.length > 0, `${pet.name} should expose a walk root translation track`);
      assert.ok(
        ranges.some((range) => range.y > 0.0005),
        `${pet.name} Walk should preserve the authored root vertical motion`,
      );
    }
  });

  it('keeps the Christo model canonical and removes the retired Teddy Sou payload', () => {
    assert.equal(
      getPetModelUrl(makePet('pet.christo', '/assets/pets/wrong.glb')),
      '/assets/pets/christo.glb',
    );
    assert.equal(existsSync(new URL('public/assets/pets/teddy-sou.glb', root)), false);
    assert.equal(existsSync(new URL('public/assets/pets/teddy-sou-thumbnail.webp', root)), false);
  });

  it('applies the Nibus presentation tuning without changing the global pet defaults', () => {
    const metadata = {
      visualScaleMultiplier: 2,
      movementSpeedMultiplier: 0.5,
      groundShadowScaleMultiplier: 0.22,
      nameLabelScaleMultiplier: 0.33,
      hideGroundMarker: true,
      groundOffset: -0.22,
    };
    assert.equal(getPetVisualScaleMultiplier('pet.nibus', metadata), 1.3 * 2);
    assert.equal(getPetMovementSpeedMultiplier('pet.nibus', metadata), 0.5);
    assert.equal(getPetGroundShadowScale(metadata), 0.22);
    assert.equal(getPetNameLabelScale(metadata), 0.33);
    assert.equal(shouldHidePetGroundMarker(metadata), true);
    assert.equal(getPetGroundOffset('pet.nibus', metadata), -0.22);
  });

  it('applies the Christo presentation tuning independently of Nibus', () => {
    const metadata = {
      visualScaleMultiplier: 2,
      groundShadowScaleMultiplier: 0.22,
      nameLabelScaleMultiplier: 0.33,
      hideGroundMarker: true,
      groundOffset: -0.22,
    };
    assert.equal(getPetVisualScaleMultiplier('pet.christo', metadata), 1.3 * 2);
    assert.equal(getPetGroundShadowScale(metadata), 0.22);
    assert.equal(getPetNameLabelScale(metadata), 0.33);
    assert.equal(shouldHidePetGroundMarker(metadata), true);
    assert.equal(getPetGroundOffset('pet.christo', metadata), -0.22);
  });

  it('records the in-place rule, Star Diver repair, Teddy removal, and Christo catalog entry', () => {
    const migrationName = readdirSync(new URL('supabase/migrations/', root))
      .find((name) => name.includes('christo') && name.endsWith('.sql'));
    assert.ok(migrationName, 'Christo catalog migration should exist');
    const migration = readFileSync(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
    assert.match(migration, /pet\.star-diver/);
    assert.match(migration, /Walk_InPlace/);
    assert.match(migration, /pet\.teddy-sou/);
    assert.match(migration, /is_active\s*=\s*false|delete\s+from/i);
    assert.match(migration, /pet\.christo/);
    assert.match(migration, /克里斯多/);
    assert.match(migration, /\/assets\/pets\/christo\.glb/);
    assert.match(migration, /\/assets\/pets\/christo-thumbnail\.(png|webp)/);
    assert.match(migration, /'movementSpeedMultiplier', 0\.5/);
    assert.match(migration, /'groundShadowScaleMultiplier', 0\.33/);
    assert.match(migration, /'nameLabelScaleMultiplier', 0\.33/);
    assert.match(migration, /pet\.nibus/);
    assert.match(migration, /'idlePauseSeconds', 10/);

    const resizeMigrationName = readdirSync(new URL('supabase/migrations/', root))
      .find((name) => name.includes('resize_nibus') && name.endsWith('.sql'));
    assert.ok(resizeMigrationName, 'Nibus resize migration should exist');
    const resizeMigration = readFileSync(new URL(`supabase/migrations/${resizeMigrationName}`, root), 'utf8');
    assert.match(resizeMigration, /'visualScaleMultiplier', 2/);
    assert.match(resizeMigration, /'groundShadowScaleMultiplier', 0\.22/);

    const groundingMigrationName = readdirSync(new URL('supabase/migrations/', root))
      .find((name) => name.includes('align_supplied_pets_to_grass') && name.endsWith('.sql'));
    assert.ok(groundingMigrationName, 'Nibus and Christo grounding migration should exist');
    const groundingMigration = readFileSync(new URL(`supabase/migrations/${groundingMigrationName}`, root), 'utf8');
    assert.match(groundingMigration, /'hideGroundMarker', true/);
    assert.match(groundingMigration, /'groundOffset', -0\.22/);

    const christoResizeMigrationName = readdirSync(new URL('supabase/migrations/', root))
      .find((name) => name.includes('resize_christo') && name.endsWith('.sql'));
    assert.ok(christoResizeMigrationName, 'Christo resize migration should exist');
    const christoResizeMigration = readFileSync(new URL(`supabase/migrations/${christoResizeMigrationName}`, root), 'utf8');
    assert.match(christoResizeMigration, /'visualScaleMultiplier', 2/);
    assert.match(christoResizeMigration, /'groundShadowScaleMultiplier', 0\.22/);
    assert.match(christoResizeMigration, /'nameLabelScaleMultiplier', 0\.33/);

    const guide = readFileSync(new URL('docs/game-assets.md', root), 'utf8');
    assert.match(guide, /walk.*in.?place|原地走路/i);
    assert.match(guide, /root motion|root.*motion/i);
    assert.match(guide, /星辰潛者/);
    assert.match(guide, /3–5 秒|3-5 seconds/i);
  });
});
