import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = process.cwd();
const contractPath = path.join(repositoryRoot, 'config', 'platform-contract.json');

function readContract(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(contractPath, 'utf8')) as Record<string, unknown>;
}

test('platform contract is present before client migration starts', () => {
  assert.ok(fs.existsSync(contractPath));

  const contract = readContract();
  assert.equal(contract.productName, 'HabitHero');
  assert.equal(contract.webHosting, 'vercel');
  assert.equal(contract.unityProjectPath, 'unity/HabitHero');
});

test('production mobile identities stay aligned with the existing app', () => {
  const contract = readContract() as {
    iosBundleId?: string;
    androidApplicationId?: string;
  };
  const capacitorConfig = fs.readFileSync(path.join(repositoryRoot, 'capacitor.config.ts'), 'utf8');
  const androidBuild = fs.readFileSync(
    path.join(repositoryRoot, 'android/app/build.gradle'),
    'utf8',
  );

  assert.equal(contract.iosBundleId, 'com.vvstudiocode.habithero');
  assert.equal(contract.androidApplicationId, 'com.vvstudiocode.habithero');
  assert.match(capacitorConfig, /appId:\s*'com\.vvstudiocode\.habithero'/);
  assert.match(androidBuild, /applicationId\s+"com\.vvstudiocode\.habithero"/);
});

test('client configuration names only the publishable Supabase boundary', () => {
  const contract = readContract() as {
    publicSupabaseEnv?: string[];
    forbiddenClientSecrets?: string[];
  };

  assert.deepEqual(contract.publicSupabaseEnv, [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ]);
  assert.deepEqual(contract.forbiddenClientSecrets, [
    'SUPABASE_SERVICE_ROLE_KEY',
  ]);
});

test('Unity migration shell has an explicit owner document', () => {
  const unityReadme = path.join(repositoryRoot, 'unity/HabitHero/README.md');

  assert.ok(fs.existsSync(unityReadme));
  assert.match(fs.readFileSync(unityReadme, 'utf8'), /Supabase backend remains shared/);
});
