import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repositoryRoot = process.cwd();
const unityProjectPath = path.join(repositoryRoot, 'unity/HabitHero');
const defaultUnityEditorPath =
  '/Applications/Unity/Hub/Editor/6000.6.0f1/Unity.app/Contents/MacOS/Unity';
const unityEditorPath = process.env.UNITY_EDITOR_PATH || defaultUnityEditorPath;
const resultDirectory = mkdtempSync(path.join(tmpdir(), 'habithero-unity-editmode-'));
const resultPath = path.join(resultDirectory, 'test-results.xml');

if (!existsSync(unityEditorPath)) {
  console.error(
    `找不到 Unity Editor：${unityEditorPath}\n` +
      '可用 UNITY_EDITOR_PATH 指定其他 Unity 6 Editor 路徑。',
  );
  rmSync(resultDirectory, { recursive: true, force: true });
  process.exit(1);
}

let exitCode = 1;

try {
  const result = spawnSync(
    unityEditorPath,
    [
      '-batchmode',
      '-nographics',
      '-projectPath',
      unityProjectPath,
      '-runTests',
      '-testPlatform',
      'editmode',
      '-testFilter',
      'HabitHero.Tests.PlatformContractTests',
      '-testResults',
      resultPath,
      '-logFile',
      '-',
    ],
    { stdio: 'inherit' },
  );

  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} finally {
  rmSync(resultDirectory, { recursive: true, force: true });
}

process.exit(exitCode);
