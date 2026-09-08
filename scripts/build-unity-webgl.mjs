import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repositoryRoot = process.cwd();
const unityProjectPath = path.join(repositoryRoot, 'unity/HabitHero');
const unityEditorPath = process.env.HABITHERO_UNITY_EDITOR_PATH
  || '/Applications/Unity/Hub/Editor/6000.6.0f1/Unity.app/Contents/MacOS/Unity';

if (!existsSync(unityEditorPath)) {
  console.error(`找不到 Unity Editor：${unityEditorPath}`);
  process.exit(1);
}

const result = spawnSync(
  unityEditorPath,
  [
    '-batchmode',
    '-nographics',
    '-projectPath',
    unityProjectPath,
    '-buildTarget',
    'WebGL',
    '-executeMethod',
    'HabitHero.Editor.BuildHabitHero.BuildWebGL',
    '-quit',
    '-logFile',
    '-',
  ],
  { stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
