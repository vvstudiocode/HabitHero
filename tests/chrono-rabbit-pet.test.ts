import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const runtimeSource = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');

test('ships the Chrono rabbit GLB and connects it to the pet shop catalog', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260812191500_add_chrono_rabbit_pet.sql', root), 'utf8');
  const model = new URL('public/assets/pets/chrono-rabbit.glb', root);

  await access(model);
  const modelStats = await stat(model);
  assert.ok(modelStats.size > 100_000);
  assert.ok(modelStats.size < 3 * 1024 * 1024, 'pet GLB should stay texture-compressed');
  assert.equal((await readFile(model)).toString('ascii', 0, 4), 'glTF');
  assert.match((await readFile(model)).toString('ascii'), /Rabbit_Walk_Cycle/);
  assert.match(migration, /pet\.chrono-rabbit/);
  assert.match(migration, /克羅諾/);
  assert.match(migration, /\/assets\/pets\/chrono-rabbit\.glb/);
  assert.match(migration, /\/assets\/pets\/chrono-rabbit-thumbnail\.png/);
  assert.match(runtimeSource, /DRACOLoader/);
  assert.match(runtimeSource, /setDecoderPath\('\/draco\/'\)/);
});

test('ships a transparent RGBA thumbnail for the Chrono rabbit', async () => {
  const thumbnail = await readFile(new URL('public/assets/pets/chrono-rabbit-thumbnail.png', root));
  assert.equal(thumbnail.subarray(25, 26)[0], 6, 'thumbnail PNG must use RGBA color type');
});
