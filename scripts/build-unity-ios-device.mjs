import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_CONFIGURATION = 'Release';
export const DEFAULT_DERIVED_DATA_PATH = '/tmp/HabitHeroUnityDeviceBuild';

function readPlatformContract(repositoryRoot) {
  const contractPath = path.join(repositoryRoot, 'config/platform-contract.json');
  return JSON.parse(readFileSync(contractPath, 'utf8'));
}

/**
 * Returns the xcodebuild arguments for the generated Unity iOS project.
 *
 * PRODUCT_BUNDLE_IDENTIFIER is intentionally not included. Unity generates a
 * separate UnityFramework target, so setting that value globally can make the
 * app target and framework target share an invalid bundle identifier.
 */
export function getXcodebuildArguments({
  projectPath,
  derivedDataPath,
  developmentTeam,
  codeSignIdentity,
  buildNumber,
  marketingVersion,
  configuration = DEFAULT_CONFIGURATION,
  scheme = 'Unity-iPhone',
  destination = 'generic/platform=iOS',
}) {
  return [
    '-project',
    projectPath,
    '-scheme',
    scheme,
    '-configuration',
    configuration,
    '-sdk',
    'iphoneos',
    '-destination',
    destination,
    '-derivedDataPath',
    derivedDataPath,
    `DEVELOPMENT_TEAM=${developmentTeam}`,
    'CODE_SIGN_STYLE=Automatic',
    `CODE_SIGN_IDENTITY=${codeSignIdentity}`,
    `CURRENT_PROJECT_VERSION=${buildNumber}`,
    `MARKETING_VERSION=${marketingVersion}`,
    'build',
  ];
}

function runCommand(command, argumentsList, label) {
  const result = spawnSync(command, argumentsList, { stdio: 'inherit' });
  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function findBuiltApplication(productsPath) {
  if (!existsSync(productsPath)) {
    throw new Error(`找不到 iOS 建置輸出目錄：${productsPath}`);
  }

  const applications = readdirSync(productsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    .map((entry) => path.join(productsPath, entry.name));

  if (applications.length !== 1) {
    throw new Error(
      `iOS 建置輸出應該只有一個 App，實際找到 ${applications.length} 個：${productsPath}`,
    );
  }

  return applications[0];
}

function readBundleIdentifier(applicationPath) {
  const plistPath = path.join(applicationPath, 'Info.plist');
  return execFileSync(
    '/usr/libexec/PlistBuddy',
    ['-c', 'Print :CFBundleIdentifier', plistPath],
    { encoding: 'utf8' },
  ).trim();
}

function validateBundleIdentities(applicationPath, expectedApplicationId) {
  const applicationId = readBundleIdentifier(applicationPath);
  const frameworkPath = path.join(applicationPath, 'Frameworks/UnityFramework.framework');
  const frameworkId = readBundleIdentifier(frameworkPath);

  if (applicationId !== expectedApplicationId) {
    throw new Error(
      `iOS App Bundle ID 不符合平台契約：expected ${expectedApplicationId}, got ${applicationId}.`,
    );
  }

  if (frameworkId === applicationId) {
    throw new Error(
      `UnityFramework Bundle ID 不可與 App 相同：${frameworkId}.`,
    );
  }

  return { applicationId, frameworkId };
}

function buildAndVerify(repositoryRoot) {
  const contract = readPlatformContract(repositoryRoot);
  const iosProjectPath = path.join(
    repositoryRoot,
    'unity/HabitHero/Builds/iOS/Unity-iPhone.xcodeproj',
  );

  if (!existsSync(iosProjectPath)) {
    throw new Error(
      '找不到 Unity iOS Xcode 專案，請先執行 npm run build:unity:ios。',
    );
  }

  const developmentTeam = process.env.HABITHERO_IOS_DEVELOPMENT_TEAM
    || process.env.DEVELOPMENT_TEAM;
  if (!developmentTeam) {
    throw new Error(
      '缺少簽署團隊，請設定 HABITHERO_IOS_DEVELOPMENT_TEAM。',
    );
  }

  const codeSignIdentity = process.env.CODE_SIGN_IDENTITY || 'Apple Development';
  const configuration = process.env.HABITHERO_IOS_CONFIGURATION || DEFAULT_CONFIGURATION;
  const derivedDataPath = process.env.HABITHERO_IOS_DERIVED_DATA_PATH
    || DEFAULT_DERIVED_DATA_PATH;
  const release = contract.unityRelease ?? {};

  runCommand(
    'xcodebuild',
    getXcodebuildArguments({
      projectPath: iosProjectPath,
      derivedDataPath,
      developmentTeam,
      codeSignIdentity,
      buildNumber: release.buildNumber,
      marketingVersion: release.bundleVersion,
      configuration,
    }),
    'xcodebuild',
  );

  const applicationPath = findBuiltApplication(
    path.join(derivedDataPath, 'Build/Products', `${configuration}-iphoneos`),
  );
  runCommand(
    'codesign',
    ['--verify', '--deep', '--strict', applicationPath],
    'codesign verification',
  );
  const bundleIds = validateBundleIdentities(applicationPath, contract.iosBundleId);

  return { applicationPath, bundleIds };
}

function installOnConnectedDevice(applicationPath) {
  const deviceId = process.env.HABITHERO_IOS_DEVICE_ID;
  if (!deviceId) return;

  runCommand(
    'xcrun',
    ['devicectl', 'device', 'install', 'app', '--device', deviceId, applicationPath],
    'iOS device installation',
  );

  if (process.env.HABITHERO_IOS_LAUNCH !== '1') return;

  runCommand(
    'xcrun',
    [
      'devicectl',
      'device',
      'process',
      'launch',
      '--device',
      deviceId,
      'com.vvstudiocode.habithero',
    ],
    'iOS device launch',
  );
}

export function main(repositoryRoot = process.cwd()) {
  const result = buildAndVerify(repositoryRoot);
  installOnConnectedDevice(result.applicationPath);

  console.log(`iOS App 已完成簽署與 Bundle ID 驗證：${result.applicationPath}`);
  console.log(`App Bundle ID：${result.bundleIds.applicationId}`);
  console.log(`UnityFramework Bundle ID：${result.bundleIds.frameworkId}`);
  if (!process.env.HABITHERO_IOS_DEVICE_ID) {
    console.log(
      '未安裝到真機；若要安裝，請設定 HABITHERO_IOS_DEVICE_ID 後重新執行。',
    );
  }
}

const currentModulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentModulePath) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
