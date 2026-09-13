import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getXcodebuildArguments } from '../scripts/build-unity-ios-device.mjs';

test('iOS device build signs the app without overriding UnityFramework bundle identity', () => {
  const argumentsList = getXcodebuildArguments({
    projectPath: '/tmp/Unity-iPhone.xcodeproj',
    derivedDataPath: '/tmp/HabitHeroUnityDeviceBuild',
    developmentTeam: '94HYTX75L9',
    codeSignIdentity: 'Apple Development',
    buildNumber: '49',
    marketingVersion: '1.44',
  });

  assert.deepEqual(
    argumentsList.filter((argument) => argument.startsWith('PRODUCT_BUNDLE_IDENTIFIER=')),
    [],
  );
  assert.ok(argumentsList.includes('DEVELOPMENT_TEAM=94HYTX75L9'));
  assert.ok(argumentsList.includes('CODE_SIGN_IDENTITY=Apple Development'));
  assert.ok(argumentsList.includes('CURRENT_PROJECT_VERSION=49'));
  assert.ok(argumentsList.includes('MARKETING_VERSION=1.44'));
});
