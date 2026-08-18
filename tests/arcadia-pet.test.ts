import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { getLocalGameAsset } from '../src/features/world/game-content-assets';
import { getPetModelUrl } from '../src/features/world/pet-model-assets';
import { getPetGroundOffset, getPetVisualScaleMultiplier } from '../src/features/world/prototype-world-runtime';
import { getRequiredWorldPetCatalogItems } from '../src/features/world/world-scene-data';
import type { ChildGameData, GameCatalogItem } from '../src/features/world/contracts';

const root = new URL('../', import.meta.url);

function arcadiaCatalogItem(): GameCatalogItem {
  return {
    id: 'pet-arcadia',
    itemType: 'pet',
    name: '阿卡迪亞',
    description: '',
    scrollPrice: 24,
    assetKey: 'pet.arcadia',
    thumbnailUrl: '/assets/pets/arcadia-thumbnail.webp',
    isActive: true,
    isStarter: false,
    isStackable: false,
    collisionRadius: 0.48,
    minScale: 0.8,
    maxScale: 1.2,
    sortOrder: 42,
    metadata: {
      model: '/assets/pets/arcadia.glb',
      visualScaleMultiplier: 6.8,
    },
  };
}

function arcadiaGameData(overrides: Partial<ChildGameData> = {}): ChildGameData {
  return {
    walletBalance: 0,
    catalog: [arcadiaCatalogItem()],
    prices: {},
    inventory: [{ id: 'inventory-arcadia', catalogItemId: 'pet-arcadia', quantity: 1, acquiredVia: 'purchase', acquiredAt: '' }],
    loadout: { equippedCharacterInventoryId: null, followingPetInventoryId: null, followingPetInventoryIds: [] },
    worldEntities: [],
    worldRevision: 1,
    ...overrides,
  };
}

test('ships Arcadia as a compact animated pet asset', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260816065247_add_arcadia_pet.sql', root), 'utf8');
  const model = new URL('public/assets/pets/arcadia.glb', root);
  const thumbnail = new URL('public/assets/pets/arcadia-thumbnail.webp', root);

  await access(model);
  await access(thumbnail);

  const modelStats = await stat(model);
  const modelContents = await readFile(model);
  const thumbnailContents = await readFile(thumbnail);

  assert.ok(modelStats.size > 100_000, 'Arcadia GLB should contain the mesh and animations');
  assert.ok(modelStats.size < 2.5 * 1024 * 1024, 'Arcadia GLB should stay small for mobile delivery');
  assert.equal(modelContents.toString('ascii', 0, 4), 'glTF');
  assert.match(modelContents.toString('latin1'), /Walk_InPlace/);
  assert.match(modelContents.toString('latin1'), /Idle/);
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.equal(thumbnailContents.toString('ascii', 0, 4), 'RIFF');
  assert.equal(thumbnailContents.toString('ascii', 8, 12), 'WEBP');

  assert.deepEqual(getLocalGameAsset('pet', 'pet.arcadia'), {
    modelUrl: '/assets/pets/arcadia.glb',
    thumbnailUrl: '/assets/pets/arcadia-thumbnail.webp',
  });
  assert.equal(getPetModelUrl({ assetKey: 'pet.arcadia', metadata: {} }), '/assets/pets/arcadia.glb');
  assert.match(migration, /pet\.arcadia/);
  assert.match(migration, /阿卡迪亞/u);
  assert.match(migration, /\/assets\/pets\/arcadia\.glb/);
  assert.match(migration, /\/assets\/pets\/arcadia-thumbnail\.webp/);
  assert.match(migration, /'animation', 'Walk_InPlace'/);
  assert.match(migration, /'idleAnimation', 'Idle'/);
  assert.match(migration, /'rootMotion', 'in-place'/);
  assert.match(migration, /'compression', 'Draco mesh compression \+ 1024px WebP texture \+ mobile mesh simplification'/);
});

test('ships Arcadia with all five supplied actions in one compact GLB', async () => {
  const migrationNames = await readdir(new URL('supabase/migrations/', root));
  const migrationName = migrationNames.find((name) => name.includes('replace_arcadia_with_preserved_walk_source'));
  assert.ok(migrationName, 'Arcadia five-action migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  const exporter = await readFile(new URL('tools/export_arcadia_action_assets.py', root), 'utf8');
  const modelContents = await readFile(new URL('public/assets/pets/arcadia.glb', root));
  const modelStats = await stat(new URL('public/assets/pets/arcadia.glb', root));
  const jsonLength = modelContents.readUInt32LE(12);
  const gltf = JSON.parse(modelContents.subarray(20, 20 + jsonLength).toString('utf8').trim()) as {
    animations?: Array<{ name?: string }>;
  };

  assert.ok(modelStats.size < 2.5 * 1024 * 1024, 'Arcadia GLB should stay compact for mobile delivery');
  assert.deepEqual(
    (gltf.animations ?? []).map((animation) => animation.name).sort(),
    ['Dance', 'Idle', 'Sit', 'Walk_InPlace', 'Wave'],
  );
  assert.match(modelContents.toString('latin1'), /KHR_draco_mesh_compression/);
  assert.match(modelContents.toString('latin1'), /EXT_texture_webp/);
  assert.match(migration, /阿卡迪亞\.fbx \+ 阿卡迪亞Idle\.fbx \+ 阿卡迪亞坐下\.fbx \+ 阿卡迪亞揮手\.fbx \+ 阿卡迪亞跳舞/u);
  assert.match(migration, /'animationClips', jsonb_build_array\('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'\)/);
  assert.match(migration, /'modelBytes', 954316/);
  assert.match(migration, /'walkRootVerticalMotion', 'source-preserved'/);
  assert.match(exporter, /阿卡迪亞\.fbx.*Walk_InPlace/su);
  assert.doesNotMatch(exporter, /normalize_walk_root_motion/u);
});

test('uses the 6.8x visual tuning for both following and roaming Arcadia', async () => {
  const migrationNames = await readdir(new URL('supabase/migrations/', root));
  const tuningMigrationName = migrationNames.find((name) => name.includes('tune_arcadia_pet_visual_scale_6_8'));
  const tuningMigration = tuningMigrationName
    ? await readFile(new URL(`supabase/migrations/${tuningMigrationName}`, root), 'utf8')
    : '';

  assert.ok(tuningMigrationName, 'Arcadia visual-scale tuning migration should exist');
  assert.match(tuningMigration, /asset_key = 'pet\.arcadia'/);
  assert.match(tuningMigration, /\{visualScaleMultiplier\}/);
  assert.match(tuningMigration, /'6\.8'::jsonb/);
  assert.equal(
    getPetVisualScaleMultiplier('pet.arcadia', { visualScaleMultiplier: 6.8 }),
    1.3 * 6.8,
  );

  const roamingData = arcadiaGameData({
    worldEntities: [{
      id: 'entity-arcadia',
      inventoryItemId: 'inventory-arcadia',
      entityKind: 'pet',
      worldLayoutVersion: 1,
      x: 0,
      y: 0,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
      behaviorMode: 'wander',
      roamingSlot: 1,
      isActive: true,
      catalogItemId: 'pet-arcadia',
      assetKey: 'pet.arcadia',
    }],
  });
  assert.deepEqual(
    getRequiredWorldPetCatalogItems(roamingData).map((item) => item.assetKey),
    ['pet.arcadia'],
  );

  const followingData = arcadiaGameData({
    loadout: {
      equippedCharacterInventoryId: null,
      followingPetInventoryId: 'inventory-arcadia',
      followingPetInventoryIds: ['inventory-arcadia'],
    },
  });
  assert.deepEqual(
    getRequiredWorldPetCatalogItems(followingData).map((item) => item.assetKey),
    ['pet.arcadia'],
  );
});

test('lowers Arcadia a little more and brings Oum down from the grass tips', async () => {
  const migrationNames = await readdir(new URL('supabase/migrations/', root));
  const groundingMigrationName = migrationNames.find((name) => name.includes('tune_arcadia_oum_ground_contact'));
  const groundingMigration = groundingMigrationName
    ? await readFile(new URL(`supabase/migrations/${groundingMigrationName}`, root), 'utf8')
    : '';

  assert.ok(groundingMigrationName, 'Arcadia and Oum grounding migration should exist');
  assert.match(groundingMigration, /asset_key = 'pet\.arcadia'/);
  assert.match(groundingMigration, /asset_key = 'pet\.oum'/);
  assert.match(groundingMigration, /'-0\.50'::jsonb/);
  assert.match(groundingMigration, /'-0\.32'::jsonb/);
  assert.equal(getPetGroundOffset('pet.arcadia', { groundOffset: -0.50 }), -0.50);
  assert.equal(getPetGroundOffset('pet.oum', { groundOffset: -0.32 }), -0.32);
});
