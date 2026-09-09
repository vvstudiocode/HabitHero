import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

export const DEFAULT_GAME_ASSET_BASE_URL = 'https://habit-hero-gilt.vercel.app';

const RUNTIME_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'HABITHERO_GAME_ASSET_BASE_URL',
  'VITE_PUBLIC_WEB_ORIGIN',
];

export function loadUnityRuntimeEnvironment(
  repositoryRoot,
  shellEnvironment = process.env,
) {
  const values = {};
  const productionFiles = [
    path.join(repositoryRoot, '.env.production'),
    path.join(repositoryRoot, '.env.production.local'),
  ];
  const files = productionFiles.some(file => existsSync(file))
    ? productionFiles
    : [path.join(repositoryRoot, '.env.local')];

  for (const file of files) {
    if (!existsSync(file)) continue;
    Object.assign(values, dotenv.parse(readFileSync(file, 'utf8')));
  }

  for (const key of RUNTIME_ENV_KEYS) {
    if (shellEnvironment[key] !== undefined) {
      values[key] = shellEnvironment[key];
    }
  }

  return values;
}

export function validateUnityRuntimeEnvironment(environment) {
  const supabaseUrl = environment.VITE_SUPABASE_URL?.trim();
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      'Unity runtime configuration needs VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  let parsedSupabaseUrl;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid URL.');
  }
  if (parsedSupabaseUrl.protocol !== 'https:') {
    throw new Error('Unity release runtime configuration must use an HTTPS Supabase URL.');
  }
  if (/service_role|sb_secret_/i.test(publishableKey)) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY cannot contain a server secret.');
  }
  if (/PASTE_|CHANGE_ME|YOUR_/i.test(publishableKey)) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is still an example value.');
  }

  const assetBaseUrl = (
    environment.HABITHERO_GAME_ASSET_BASE_URL
    || environment.VITE_PUBLIC_WEB_ORIGIN
    || DEFAULT_GAME_ASSET_BASE_URL
  ).trim().replace(/\/+$/, '');
  let parsedAssetBaseUrl;
  try {
    parsedAssetBaseUrl = new URL(assetBaseUrl);
  } catch {
    throw new Error('HABITHERO_GAME_ASSET_BASE_URL must be a valid URL.');
  }
  if (parsedAssetBaseUrl.protocol !== 'https:') {
    throw new Error('Unity public game assets must use an HTTPS URL.');
  }

  return {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    HABITHERO_GAME_ASSET_BASE_URL: assetBaseUrl,
  };
}

export function createUnityProcessEnvironment(
  repositoryRoot,
  shellEnvironment = process.env,
) {
  const loaded = loadUnityRuntimeEnvironment(repositoryRoot, shellEnvironment);
  const validated = validateUnityRuntimeEnvironment(loaded);
  return { ...shellEnvironment, ...validated };
}

export function configureUnityRuntime({
  repositoryRoot = process.cwd(),
  unityEditorPath = process.env.HABITHERO_UNITY_EDITOR_PATH
    || '/Applications/Unity/Hub/Editor/6000.6.0f1/Unity.app/Contents/MacOS/Unity',
  shellEnvironment = process.env,
} = {}) {
  if (!existsSync(unityEditorPath)) {
    throw new Error(`Unity Editor executable was not found: ${unityEditorPath}`);
  }

  const environment = createUnityProcessEnvironment(repositoryRoot, shellEnvironment);
  console.log('Configuring Unity public runtime settings from the deployment environment.');
  const result = spawnSync(
    unityEditorPath,
    [
      '-batchmode',
      '-nographics',
      '-projectPath',
      path.join(repositoryRoot, 'unity/HabitHero'),
      '-executeMethod',
      'HabitHero.Editor.ConfigureSupabaseRuntime.Apply',
      '-quit',
      '-logFile',
      '-',
    ],
    { stdio: 'inherit', env: environment },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function isMainModule() {
  return process.argv[1]
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  try {
    process.exitCode = configureUnityRuntime();
  } catch (error) {
    console.error(
      `Unity runtime configuration failed: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  }
}
