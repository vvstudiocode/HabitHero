import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_UNITY_EDITOR_PATH,
  detectUnityNativeModules,
  parseEditorBuildSettings,
  parseUnityProjectSettings,
  scanForbiddenSecrets,
  validateUnityRelease,
} from './unity-release-contract.mjs';

const repositoryRoot = process.cwd();
const allowMissingNative = process.argv.includes('--allow-missing-native');
const jsonOutput = process.argv.includes('--json');
const unityEditorPath = process.env.HABITHERO_UNITY_EDITOR_PATH || DEFAULT_UNITY_EDITOR_PATH;
const contractPath = path.join(repositoryRoot, 'config/platform-contract.json');
const unityProjectPath = path.join(repositoryRoot, 'unity/HabitHero');
const projectSettingsPath = path.join(unityProjectPath, 'ProjectSettings/ProjectSettings.asset');
const buildSettingsPath = path.join(
  unityProjectPath,
  'ProjectSettings/EditorBuildSettings.asset',
);
const authCallbackPath = path.join(
  unityProjectPath,
  'Assets/Scripts/Platform/AuthCallbackParser.cs',
);

function readTrackedUnityFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--', 'unity/HabitHero/Assets', 'unity/HabitHero/ProjectSettings'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  const files = {};

  for (const relativePath of output.split('\0').filter(Boolean)) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    if (existsSync(absolutePath)) {
      files[relativePath] = readFileSync(absolutePath, 'utf8');
    }
  }

  return files;
}

function createReport() {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const projectSettingsSource = readFileSync(projectSettingsPath, 'utf8');
  const buildSettingsSource = readFileSync(buildSettingsPath, 'utf8');
  const nativeModules = detectUnityNativeModules(unityEditorPath);
  const forbiddenSecretMatches = scanForbiddenSecrets(
    readTrackedUnityFiles(),
    contract.forbiddenClientSecrets ?? [],
  );
  const result = validateUnityRelease({
    contract,
    projectSettings: parseUnityProjectSettings(projectSettingsSource),
    buildScenePaths: parseEditorBuildSettings(buildSettingsSource),
    nativeModules,
    forbiddenSecretMatches,
    authCallbackSource: readFileSync(authCallbackPath, 'utf8'),
    requireNativeModules: !allowMissingNative,
  });

  if (!existsSync(unityEditorPath)) {
    const message = `Unity Editor executable was not found: ${unityEditorPath}.`;
    (allowMissingNative ? result.warnings : result.issues).unshift(message);
  }

  result.ok = result.issues.length === 0;

  return {
    ...result,
    editor: unityEditorPath,
    nativeModules,
  };
}

try {
  const report = createReport();
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Unity release preflight: ${report.ok ? 'passed' : 'blocked'}.`);
    for (const issue of report.issues) console.error(`- ${issue}`);
    for (const warning of report.warnings) console.warn(`- warning: ${warning}`);
  }

  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  console.error(
    `Unity release preflight could not run: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
}
