import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);

test('ships Murphy Bear as a compact animated pet shop asset', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260812175812_add_murphy_bear_pet.sql', root), 'utf8');
  const model = new URL('public/assets/pets/murphy-bear.glb', root);

  await access(model);
  const modelStats = await stat(model);
  assert.ok(modelStats.size > 100_000);
  assert.ok(modelStats.size < 4 * 1024 * 1024, 'pet GLB should stay small enough for mobile app delivery');
  const modelContents = (await readFile(model)).toString('latin1');
  assert.equal(modelContents.slice(0, 4), 'glTF');
  assert.match(modelContents, /Murphy_Walk_Cycle/);
  assert.match(migration, /pet\.murphy-bear/);
  assert.match(migration, /墨菲熊/);
  assert.match(migration, /\/assets\/pets\/murphy-bear\.glb/);
  assert.match(migration, /\/assets\/pets\/murphy-bear-thumbnail\.png/);
  assert.match(migration, /Draco mesh compression \+ WebP textures/);
});

test('ships a transparent RGBA Murphy Bear shop thumbnail', async () => {
  const thumbnail = await readFile(new URL('public/assets/pets/murphy-bear-thumbnail.png', root));
  assert.equal(thumbnail.toString('ascii', 1, 4), 'PNG');
  assert.equal(thumbnail[25], 6, 'thumbnail PNG must use RGBA color type');
});
