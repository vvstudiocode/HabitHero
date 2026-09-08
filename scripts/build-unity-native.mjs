import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const platform = process.argv[2]?.toLowerCase();
const targets = {
  ios: {
    unityTarget: 'iOS',
    method: 'HabitHero.Editor.BuildHabitHero.BuildiOS',
    output: 'Builds/iOS',
  },
  android: {
    unityTarget: 'Android',
    method: 'HabitHero.Editor.BuildHabitHero.BuildAndroid',
    output: 'Builds/Android/HabitHero.apk',
  },
};
const target = targets[platform];
const repositoryRoot = process.cwd();
const unityProjectPath = path.join(repositoryRoot, 'unity/HabitHero');
const unityEditorPath = process.env.HABITHERO_UNITY_EDITOR_PATH
  || '/Applications/Unity/Hub/Editor/6000.6.0f1/Unity.app/Contents/MacOS/Unity';

if (!target) {
  console.error('Usage: node scripts/build-unity-native.mjs <ios|android>');
  process.exit(1);
}

if (!existsSync(unityEditorPath)) {
  console.error(`找不到 Unity Editor：${unityEditorPath}`);
  process.exit(1);
}

console.log(`Building HabitHero Unity ${platform} output: ${target.output}`);
const result = spawnSync(
  unityEditorPath,
  [
    '-batchmode',
    '-nographics',
    '-projectPath',
    unityProjectPath,
    '-buildTarget',
    target.unityTarget,
    '-executeMethod',
    target.method,
    '-quit',
    '-logFile',
    '-',
  ],
  { stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
