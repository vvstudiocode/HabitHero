import { existsSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_UNITY_EDITOR_PATH =
  '/Applications/Unity/Hub/Editor/6000.6.0f1/Unity.app/Contents/MacOS/Unity';

function unquoteYamlScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }

  return trimmed;
}

function indentationOf(line) {
  return line.match(/^\s*/u)?.[0].length ?? 0;
}

function readTopLevelScalar(source, key) {
  const expression = new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, 'mu');
  const match = source.match(expression);
  return match ? unquoteYamlScalar(match[1]) : null;
}

function readNestedScalar(source, section, key) {
  const lines = source.split(/\r?\n/u);
  const sectionExpression = new RegExp(`^\\s*${section}:\\s*$`, 'u');
  const valueExpression = new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`, 'u');

  for (let index = 0; index < lines.length; index += 1) {
    if (!sectionExpression.test(lines[index])) continue;

    const sectionIndent = indentationOf(lines[index]);
    for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
      const childLine = lines[childIndex];
      if (childLine.trim() === '') continue;
      if (indentationOf(childLine) <= sectionIndent) break;

      const match = childLine.match(valueExpression);
      if (match) return unquoteYamlScalar(match[1]);
    }
  }

  return null;
}

export function parseUnityProjectSettings(source) {
  return {
    companyName: readTopLevelScalar(source, 'companyName'),
    productName: readTopLevelScalar(source, 'productName'),
    bundleVersion: readTopLevelScalar(source, 'bundleVersion'),
    androidApplicationId: readNestedScalar(source, 'applicationIdentifier', 'Android'),
    iosBundleId: readNestedScalar(source, 'applicationIdentifier', 'iPhone'),
    iosBuildNumber: readNestedScalar(source, 'buildNumber', 'iPhone'),
    androidVersionCode: readTopLevelScalar(source, 'AndroidBundleVersionCode'),
  };
}

export function parseEditorBuildSettings(source) {
  const paths = [];
  const expression = /^\s*path:\s*(.+?)\s*$/gmu;

  for (const match of source.matchAll(expression)) {
    paths.push(unquoteYamlScalar(match[1]));
  }

  return paths;
}

function resolveUnityAppRoot(editorPath) {
  const normalizedEditorPath = path.resolve(editorPath);
  return path.resolve(path.dirname(normalizedEditorPath), '..', '..');
}

export function detectUnityNativeModules(editorPath = DEFAULT_UNITY_EDITOR_PATH) {
  const appRoot = resolveUnityAppRoot(editorPath);
  const playbackEnginesRoot = path.join(appRoot, 'Contents', 'PlaybackEngines');
  const iosPath = path.join(playbackEnginesRoot, 'iOSSupport');
  const androidPath = path.join(playbackEnginesRoot, 'AndroidPlayer');

  return {
    ios: existsSync(iosPath),
    android: existsSync(androidPath),
    paths: {
      ios: iosPath,
      android: androidPath,
    },
  };
}

export function scanForbiddenSecrets(files, forbiddenNames) {
  const entries = files instanceof Map ? files.entries() : Object.entries(files);
  const matches = [];

  for (const [filePath, source] of entries) {
    if (forbiddenNames.some((name) => source.includes(name))) {
      matches.push(filePath);
    }
  }

  return matches.sort();
}

function compareValue(issues, label, actual, expected) {
  if (String(actual ?? '') !== String(expected ?? '')) {
    issues.push(`${label} mismatch: expected ${expected}, got ${actual ?? '(missing)'}.`);
  }
}

export function validateUnityRelease({
  contract,
  projectSettings,
  buildScenePaths,
  nativeModules,
  forbiddenSecretMatches,
  authCallbackSource = '',
  requireNativeModules = true,
}) {
  const issues = [];
  const warnings = [];
  const release = contract.unityRelease ?? {};

  compareValue(
    issues,
    'iOS Bundle ID',
    projectSettings.iosBundleId,
    contract.iosBundleId,
  );
  compareValue(
    issues,
    'Android application ID',
    projectSettings.androidApplicationId,
    contract.androidApplicationId,
  );
  compareValue(issues, 'company name', projectSettings.companyName, release.companyName);
  compareValue(issues, 'product name', projectSettings.productName, release.productName);
  compareValue(issues, 'bundle version', projectSettings.bundleVersion, release.bundleVersion);
  compareValue(issues, 'iOS build number', projectSettings.iosBuildNumber, release.buildNumber);
  compareValue(
    issues,
    'Android version code',
    projectSettings.androidVersionCode,
    release.buildNumber,
  );

  if (!buildScenePaths.includes(release.bootstrapScene)) {
    issues.push(`Bootstrap scene is not enabled in Build Settings: ${release.bootstrapScene}.`);
  }

  if (authCallbackSource) {
    const callbackMatch = authCallbackSource.match(
      /AppUrlScheme\s*=\s*"([^"\r\n]+)"/u,
    );
    const expectedScheme = contract.authCallbackScheme ?? contract.iosBundleId;
    if (!callbackMatch) {
      issues.push('Auth callback scheme constant is missing from AuthCallbackParser.cs.');
    } else if (callbackMatch[1] !== expectedScheme) {
      issues.push(
        `Auth callback scheme mismatch: expected ${expectedScheme}, got ${callbackMatch[1]}.`,
      );
    }
  }

  if (forbiddenSecretMatches.length > 0) {
    issues.push(
      `Forbidden client secret name found in Unity files: ${forbiddenSecretMatches.join(', ')}.`,
    );
  }

  const missingModuleMessages = [
    ['ios', 'iOS', 'iOSSupport'],
    ['android', 'Android', 'AndroidPlayer'],
  ];
  for (const [key, label, moduleName] of missingModuleMessages) {
    if (nativeModules[key]) continue;
    const message = `${label} module (${moduleName}) is not installed in this Unity Editor.`;
    (requireNativeModules ? issues : warnings).push(message);
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
  };
}
