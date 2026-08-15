import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import {
  getPetNameLabelLocalScale,
  getPetNameLabelY,
  PET_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER,
  PET_NAME_LABEL_HEAD_GAP,
  getPetVisualScaleMultiplier,
} from '../src/features/world/prototype-world-runtime';

const root = new URL('../', import.meta.url);

test('keeps pet name labels unified above each model head', () => {
  assert.equal(PET_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER, 0.55);
  assert.equal(PET_NAME_LABEL_HEAD_GAP, 0.22);
  assert.equal(getPetNameLabelY(2), 2.22);
  const tinySkeletonModelScale = 2500;
  const tinySkeletonLabelY = getPetNameLabelY(0.0002, tinySkeletonModelScale);
  assert.ok(Math.abs(tinySkeletonLabelY * tinySkeletonModelScale - 0.72) < 0.000001);
  assert.equal(getPetNameLabelLocalScale(0.5, 0.55), 1.1);
  assert.equal(getPetNameLabelLocalScale(2, 0.55), 0.275);
});

test('uses the requested visual scale for Moko, Kaldo, and Orian', () => {
  assert.equal(getPetVisualScaleMultiplier('pet.moko', { visualScaleMultiplier: 2 }), 2.6);
  assert.equal(getPetVisualScaleMultiplier('pet.kaldo', { visualScaleMultiplier: 4 }), 5.2);
  assert.equal(getPetVisualScaleMultiplier('pet.orian', { visualScaleMultiplier: 2 }), 2.6);
});

test('persists unified head labels and selected pet resizing in Supabase metadata', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('resize_selected_pets_and_unify_name_labels') && name.endsWith('.sql'));
  assert.ok(migrationName, 'selected pet resize and name-label migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');

  assert.match(migration, /'nameLabelPlacement', 'above-head'/);
  assert.match(migration, /'nameLabelScaleMultiplier', 0\.55/);
  assert.match(migration, /item_type = 'pet'/);
  assert.match(migration, /asset_key = 'pet\.moko'/);
  assert.match(migration, /'visualScaleMultiplier', 2/);
  assert.match(migration, /asset_key = 'pet\.kaldo'/);
  assert.match(migration, /'visualScaleMultiplier', 4/);
  assert.match(migration, /asset_key = 'pet\.orian'/);
  assert.match(migration, /asset_key in \('pet\.star-diver', 'pet\.christo', 'pet\.nibus'\)/);
});

test('renames the Belilos fox catalog entry without changing its asset key', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('rename_belilos_fox_to_belilos') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Belilos fox rename migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');

  assert.match(migration, /set name = '貝里洛斯'/u);
  assert.match(migration, /asset_key = 'pet\.belilos-fox'/);
});
