import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  getPetGroundOffset,
  getPetWalkingGroundOffset,
} from '../src/features/world/prototype-world-runtime';

const root = new URL('../', import.meta.url);

test('keeps Moko grounded while walking without changing its idle height', () => {
  assert.equal(getPetGroundOffset('pet.moko', { groundOffset: -0.22 }), -0.22);
  assert.equal(getPetWalkingGroundOffset('pet.moko', { walkingGroundOffset: -0.04 }), -0.04);
  assert.equal(getPetWalkingGroundOffset('pet.kaldo', {}), 0);
});

test('persists the Moko walk correction and Kaldo overall grounding correction', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('tune_moko_kaldo_ground_contact') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Moko and Kaldo ground-contact migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');

  assert.match(migration, /asset_key = 'pet\.moko'/);
  assert.match(migration, /'walkingGroundOffset', -0\.04/);
  assert.match(migration, /asset_key = 'pet\.kaldo'/);
  assert.match(migration, /'groundOffset', -0\.32/);
});

test('lowers Kaldo a little further after the first grounding pass', async () => {
  const migrationName = (await readdir(new URL('supabase/migrations/', root)))
    .find((name) => name.includes('lower_kaldo_a_little_more') && name.endsWith('.sql'));
  assert.ok(migrationName, 'Kaldo follow-up grounding migration should exist');
  const migration = await readFile(new URL(`supabase/migrations/${migrationName}`, root), 'utf8');
  assert.match(migration, /asset_key = 'pet\.kaldo'/);
  assert.match(migration, /'groundOffset', -0\.36/);
});

test('applies walking-only correction after the walk action becomes active', () => {
  const runtime = readFileSync(new URL('src/features/world/prototype-world-runtime.ts', root), 'utf8');
  assert.match(runtime, /walkingGroundOffset/);
  assert.match(runtime, /activeAction === actor\.walkAction && isWalking/);
  assert.match(runtime, /actor\.object\.position\.y = actor\.baseY \+ actor\.walkingGroundOffset/);
});
