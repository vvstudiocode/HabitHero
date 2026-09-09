import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectUnityNativeModules } from '../scripts/unity-release-contract.mjs';

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

test('release preflight detects native modules beside the Unity app bundle', () => {
  const installationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'habithero-unity-'));
  const editorPath = path.join(installationRoot, 'Unity.app', 'Contents', 'MacOS', 'Unity');
  const playbackEnginesRoot = path.join(installationRoot, 'PlaybackEngines');

  try {
    fs.mkdirSync(path.dirname(editorPath), { recursive: true });
    fs.writeFileSync(editorPath, '');
    fs.mkdirSync(path.join(playbackEnginesRoot, 'iOSSupport'), { recursive: true });
    fs.mkdirSync(path.join(playbackEnginesRoot, 'AndroidPlayer'), { recursive: true });

    const modules = detectUnityNativeModules(editorPath);

    assert.equal(modules.ios, true);
    assert.equal(modules.android, true);
    assert.equal(modules.paths.ios, path.join(playbackEnginesRoot, 'iOSSupport'));
    assert.equal(modules.paths.android, path.join(playbackEnginesRoot, 'AndroidPlayer'));
  } finally {
    fs.rmSync(installationRoot, { recursive: true, force: true });
  }
});

test('Unity runtime references mobile notification assemblies for native builds', () => {
  const asmdefPath = path.join(
    repositoryRoot,
    'unity/HabitHero/Assets/Scripts/HabitHero.Runtime.asmdef',
  );
  const asmdef = JSON.parse(fs.readFileSync(asmdefPath, 'utf8')) as {
    references?: string[];
  };

  for (const reference of [
    'Unity.Notifications.Unified',
    'Unity.Notifications.iOS',
    'Unity.Notifications.Android',
  ]) {
    assert.ok(asmdef.references?.includes(reference), `Missing asmdef reference: ${reference}`);
  }
});

test('Unity notification bridge qualifies Unified query operation types', () => {
  const bridgePath = path.join(
    repositoryRoot,
    'unity/HabitHero/Assets/Scripts/Platform/HabitHeroMobileNotificationBridge.cs',
  );
  const bridgeSource = fs.readFileSync(bridgePath, 'utf8');

  assert.match(
    bridgeSource,
    /Unity\.Notifications\.QueryLastRespondedNotificationOp\s+operation/u,
  );
  assert.match(
    bridgeSource,
    /Unity\.Notifications\.QueryLastRespondedNotificationState\.HaveRespondedNotification/u,
  );
});

test('Vercel keeps the Vite SPA build and history fallback explicit', () => {
  const vercelConfigPath = path.join(repositoryRoot, 'vercel.json');
  assert.ok(fs.existsSync(vercelConfigPath));

  const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8')) as {
    buildCommand?: string;
    outputDirectory?: string;
    rewrites?: Array<{ source?: string; destination?: string }>;
  };

  assert.equal(vercelConfig.buildCommand, 'npm run build');
  assert.equal(vercelConfig.outputDirectory, 'dist');
  assert.deepEqual(vercelConfig.rewrites, [{ source: '/(.*)', destination: '/index.html' }]);
});

test('GitHub platform workflow does not require production secrets in pull requests', () => {
  const workflowPath = path.join(repositoryRoot, '.github/workflows/platform-contract.yml');
  assert.ok(fs.existsSync(workflowPath));

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run security:check/);
  assert.match(workflow, /tests\/platform-migration-contract\.test\.ts/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD/);
});
