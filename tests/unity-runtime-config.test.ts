import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';

import {
  DEFAULT_GAME_ASSET_BASE_URL,
  loadUnityRuntimeEnvironment,
  validateUnityRuntimeEnvironment,
} from '../scripts/unity-runtime-config.mjs';

test('Unity runtime environment prefers production local values and shell overrides', async () => {
  const root = await mkdtemp(join(tmpdir(), 'habithero-unity-config-'));
  try {
    await writeFile(
      join(root, '.env.production'),
      [
        'VITE_SUPABASE_URL=https://production.supabase.co',
        'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_production',
        'HABITHERO_GAME_ASSET_BASE_URL=https://production.example.com',
      ].join('\n'),
    );
    await writeFile(
      join(root, '.env.production.local'),
      [
        'VITE_SUPABASE_URL=https://local-production.supabase.co',
        'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local',
      ].join('\n'),
    );

    const environment = loadUnityRuntimeEnvironment(root, {
      HABITHERO_GAME_ASSET_BASE_URL: 'https://shell.example.com',
    });

    assert.equal(environment.VITE_SUPABASE_URL, 'https://local-production.supabase.co');
    assert.equal(environment.VITE_SUPABASE_PUBLISHABLE_KEY, 'sb_publishable_local');
    assert.equal(environment.HABITHERO_GAME_ASSET_BASE_URL, 'https://shell.example.com');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Unity runtime validation supplies the public asset origin without secrets', () => {
  const environment = validateUnityRuntimeEnvironment({
    VITE_SUPABASE_URL: 'https://rqofqnoyxnmlsuejeyld.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  });

  assert.equal(environment.HABITHERO_GAME_ASSET_BASE_URL, DEFAULT_GAME_ASSET_BASE_URL);
  assert.equal(environment.VITE_SUPABASE_PUBLISHABLE_KEY, 'sb_publishable_test');
});

test('Unity runtime validation rejects server secrets and non-production URLs', () => {
  assert.throws(
    () => validateUnityRuntimeEnvironment({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'service_role_secret',
    }),
    /HTTPS|server secret/i,
  );
});

test('Unity export scripts configure runtime settings before building', () => {
  const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { scripts: Record<string, string> };

  for (const scriptName of ['build:unity-webgl', 'build:unity:ios', 'build:unity:android']) {
    assert.match(packageJson.scripts[scriptName], /configure:unity-runtime/);
  }
});
