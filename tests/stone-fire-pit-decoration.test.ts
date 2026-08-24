import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';
import {
  getDecorationPointLightConfig,
  getDecorationPointLightDistance,
} from '../src/features/world/world-decoration-effects';
import {
  getDecorationGroundCoverMask,
  getDecorationGroundCoverMaskForTransform,
  getDecorationGroundCoverMasks,
} from '../src/features/world/world-runtime-assets';
import { getGroundCoverMaskVisibility } from '../terrain-prototype/ground-cover-mask.js';

const root = new URL('../', import.meta.url);
const migration = readFileSync(new URL('supabase/migrations/20260824193000_add_stone_fire_pit_decoration.sql', root), 'utf8');
const groundCoverMigration = readFileSync(new URL('supabase/migrations/20260824200000_add_stone_fire_pit_ground_cover.sql', root), 'utf8');
const runtimeSource = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
const groundCoverRuntimeSource = readFileSync(new URL('../src/features/world/world-decoration-ground-cover.ts', import.meta.url), 'utf8');

describe('stone fire pit decoration', () => {
  it('ships a compact compressed GLB and transparent thumbnail', () => {
    const model = new URL('public/assets/decorations/stone-fire-pit.glb', root);
    const thumbnail = new URL('public/assets/decorations/stone-fire-pit-thumbnail.png', root);
    assert.equal(existsSync(model), true);
    assert.equal(existsSync(thumbnail), true);
    assert.ok(statSync(model).size < 500_000);
    const modelContents = readFileSync(model).toString('latin1');
    assert.match(modelContents, /KHR_draco_mesh_compression/);
    assert.match(modelContents, /EXT_texture_webp/);
    const thumbnailContents = readFileSync(thumbnail);
    assert.equal(thumbnailContents.toString('ascii', 1, 4), 'PNG');
    assert.equal(thumbnailContents[25], 6);
  });

  it('registers the fire pit with a scaled point-light contract', () => {
    assert.deepEqual(getLocalGameAsset('decoration', 'decoration.stone-fire-pit'), {
      modelUrl: '/assets/decorations/stone-fire-pit.glb',
      thumbnailUrl: '/assets/decorations/stone-fire-pit-thumbnail.png',
    });
    assert.match(migration, /decoration\.stone-fire-pit/);
    assert.match(migration, /'pointLight', true/);
    assert.match(migration, /'pointLightDistance', 3\.2/);
    assert.match(migration, /'pointLightHeight', 0\.34/);
    const config = getDecorationPointLightConfig({
      itemType: 'decoration',
      metadata: {
        pointLight: true,
        pointLightColor: 16751181,
        pointLightIntensity: 2.2,
        pointLightDistance: 3.2,
        pointLightHeight: 0.34,
      },
    });
    assert.deepEqual(config, { color: 16751181, intensity: 2.2, distance: 3.2, height: 0.34 });
    assert.equal(getDecorationPointLightDistance(config!.distance, 0.5), 1.6);
    assert.ok(Math.abs(getDecorationPointLightDistance(config!.distance, 1.5) - 4.8) < 0.000001);
    assert.equal(getDecorationPointLightConfig({ itemType: 'decoration', metadata: {} }), undefined);
    assert.match(runtimeSource, /addDecorationPointLight/);
    assert.match(runtimeSource, /setDecorationObjectScale\(object, entity\.scale\)/);
  });

  it('suppresses grass and flowers under the fire pit with a soft, transform-aware cover', () => {
    const item = {
      itemType: 'decoration' as const,
      metadata: {
        passThrough: true,
        groundCoverWidth: 1.2,
        groundCoverDepth: 1.2,
        groundCoverEdgeSoftness: 0.1,
        groundCoverShape: 'circle',
      },
    };
    const mask = getDecorationGroundCoverMask(item, {
      x: 1,
      z: -2,
      rotationY: Math.PI / 4,
      scale: 1,
    });
    assert.deepEqual(mask, {
      x: 1,
      z: -2,
      rotationY: Math.PI / 4,
      halfWidth: 0.6,
      halfDepth: 0.6,
      edgeSoftness: 0.1,
      shape: 'circle',
    });
    assert.equal(getGroundCoverMaskVisibility({ x: 1, z: -2 }, [mask!]), 0);
    assert.ok(getGroundCoverMaskVisibility({ x: 1.69, z: -2 }, [mask!]) > 0);
    const transformed = getDecorationGroundCoverMaskForTransform(item, {
      x: 1,
      y: 0,
      z: -2,
      rotationX: 0,
      rotationY: Math.PI / 2,
      rotationZ: 0,
      scale: 1.5,
    });
    assert.equal(transformed?.rotationY, Math.PI / 2);
    assert.ok(Math.abs((transformed?.halfWidth ?? 0) - 0.9) < 0.000001);
    assert.ok(Math.abs((transformed?.edgeSoftness ?? 0) - 0.15) < 0.000001);
    const activeEntity = {
      id: 'fire-pit-entity',
      entityKind: 'decoration' as const,
      isActive: true,
      inventoryItemId: 'fire-pit-inventory',
      worldLayoutVersion: 1,
      behaviorMode: 'static' as const,
      roamingSlot: null,
      catalogItemId: 'fire-pit-catalog',
      x: 1,
      y: 0,
      z: -2,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
    };
    const activeData = {
      worldEntities: [activeEntity],
      catalog: [{ id: 'fire-pit-catalog', ...item }],
      inventory: [],
    } as unknown as Parameters<typeof getDecorationGroundCoverMasks>[0];
    assert.equal(getDecorationGroundCoverMasks(activeData, activeEntity.id).length, 0);
    assert.match(groundCoverMigration, /'passThrough', true/);
    assert.match(groundCoverMigration, /'groundCoverShape', 'circle'/);
    assert.match(groundCoverMigration, /'groundCoverEdgeSoftness', 0\.1/);
    assert.match(runtimeSource, /updateDecorationGroundCoverMasks\(proceduralGrass, proceduralFlowers, nextGameData, latestRuntimeUpdate\.placement\)/);
    assert.match(groundCoverRuntimeSource, /getDecorationGroundCoverMasks\(gameData, placement\?\.entityId\)/);
    assert.match(groundCoverRuntimeSource, /getDecorationGroundCoverMaskForTransform\(placement\.item, placement\.transform\)/);
  });
});
