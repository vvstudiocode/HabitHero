import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  detectUnityNativeModules,
  parseEditorBuildSettings,
  parseUnityProjectSettings,
  scanForbiddenSecrets,
  validateUnityRelease,
} from '../scripts/unity-release-contract.mjs';

const contract = {
  iosBundleId: 'com.vvstudiocode.habithero',
  androidApplicationId: 'com.vvstudiocode.habithero',
  unityRelease: {
    companyName: 'vvstudiocode',
    productName: '習慣冒險島',
    bundleVersion: '1.44',
    buildNumber: 49,
    bootstrapScene: 'Assets/Scenes/Bootstrap.unity',
  },
};

const projectSettings = `
  companyName: vvstudiocode
  productName: "\\u7FD2\\u6163\\u5192\\u96AA\\u5CF6"
  bundleVersion: 1.44
  applicationIdentifier:
    Android: com.vvstudiocode.habithero
    iPhone: com.vvstudiocode.habithero
  buildNumber:
    iPhone: 49
  AndroidBundleVersionCode: 49
`;

const buildSettings = `
  m_Scenes:
  - enabled: 1
    path: Assets/Scenes/Bootstrap.unity
`;

test('Unity ProjectSettings values are parsed across nested YAML sections', () => {
  assert.deepEqual(parseUnityProjectSettings(projectSettings), {
    companyName: 'vvstudiocode',
    productName: '習慣冒險島',
    bundleVersion: '1.44',
    androidApplicationId: 'com.vvstudiocode.habithero',
    iosBundleId: 'com.vvstudiocode.habithero',
    iosBuildNumber: '49',
    androidVersionCode: '49',
  });
});

test('Build Settings parser keeps the Bootstrap scene path explicit', () => {
  assert.deepEqual(parseEditorBuildSettings(buildSettings), [
    'Assets/Scenes/Bootstrap.unity',
  ]);
});

test('matching Unity release identity passes with native modules installed', () => {
  const result = validateUnityRelease({
    contract,
    projectSettings: parseUnityProjectSettings(projectSettings),
    buildScenePaths: parseEditorBuildSettings(buildSettings),
    nativeModules: { ios: true, android: true },
    forbiddenSecretMatches: [],
    requireNativeModules: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.warnings, []);
});

test('release validation reports identity drift, missing scene, modules, and secrets', () => {
  const result = validateUnityRelease({
    contract,
    projectSettings: {
      ...parseUnityProjectSettings(projectSettings),
      androidApplicationId: 'com.example.wrong',
      bundleVersion: '1.43',
    },
    buildScenePaths: [],
    nativeModules: { ios: false, android: false },
    forbiddenSecretMatches: ['unity/HabitHero/Assets/Scripts/Leaked.cs'],
    requireNativeModules: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.issues.join('\n'), /Android application ID/);
  assert.match(result.issues.join('\n'), /bundle version/);
  assert.match(result.issues.join('\n'), /Bootstrap scene/);
  assert.match(result.issues.join('\n'), /iOS module/);
  assert.match(result.issues.join('\n'), /Android module/);
  assert.match(result.issues.join('\n'), /forbidden client secret name/i);
});

test('development validation can be explicit about missing native modules', () => {
  const result = validateUnityRelease({
    contract,
    projectSettings: parseUnityProjectSettings(projectSettings),
    buildScenePaths: parseEditorBuildSettings(buildSettings),
    nativeModules: { ios: false, android: false },
    forbiddenSecretMatches: [],
    requireNativeModules: false,
  });

  assert.equal(result.ok, true);
  assert.match(result.warnings.join('\n'), /iOS module/);
  assert.match(result.warnings.join('\n'), /Android module/);
});

test('forbidden secret scan returns only matching tracked files', () => {
  const matches = scanForbiddenSecrets(
    {
      'Assets/Scripts/Public.cs': 'VITE_SUPABASE_PUBLISHABLE_KEY',
      'Assets/Scripts/Leaked.cs': 'SUPABASE_SERVICE_ROLE_KEY = "secret"',
    },
    ['SUPABASE_SERVICE_ROLE_KEY'],
  );

  assert.deepEqual(matches, ['Assets/Scripts/Leaked.cs']);
});

test('native module detection follows the Unity editor installation root', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'habithero-unity-'));
  const editorPath = path.join(
    temporaryRoot,
    'Unity.app',
    'Contents',
    'MacOS',
    'Unity',
  );

  try {
    mkdirSync(path.join(temporaryRoot, 'Unity.app/Contents/PlaybackEngines/iOSSupport'), {
      recursive: true,
    });
    mkdirSync(path.join(temporaryRoot, 'Unity.app/Contents/PlaybackEngines/AndroidPlayer'), {
      recursive: true,
    });

    assert.deepEqual(detectUnityNativeModules(editorPath), {
      ios: true,
      android: true,
      paths: {
        ios: path.join(temporaryRoot, 'Unity.app/Contents/PlaybackEngines/iOSSupport'),
        android: path.join(temporaryRoot, 'Unity.app/Contents/PlaybackEngines/AndroidPlayer'),
      },
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
