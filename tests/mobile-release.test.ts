import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Android release version matches the current iOS test version', () => {
  const iosProject = read('../ios/App/App.xcodeproj/project.pbxproj');
  const androidProject = read('../android/app/build.gradle');
  const iosBuild = iosProject.match(/CURRENT_PROJECT_VERSION = (\d+);/)?.[1];
  const iosVersion = iosProject.match(/MARKETING_VERSION = ([^;]+);/)?.[1];
  const androidBuild = androidProject.match(/versionCode (\d+)/)?.[1];
  const androidVersion = androidProject.match(/versionName "([^"]+)"/)?.[1];

  assert.equal(androidBuild, iosBuild);
  assert.equal(androidVersion, iosVersion);
});
