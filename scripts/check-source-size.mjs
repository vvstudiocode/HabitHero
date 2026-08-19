import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = join(repoRoot, 'src');
const sourceExtensions = new Set(['.ts', '.tsx', '.css']);

const policies = {
  component: { label: 'React component/hook', warning: 300, hard: 400 },
  module: { label: 'domain service/utility/repository', warning: 300, hard: 400 },
  runtime: { label: 'runtime coordinator', warning: 500, hard: 600 },
  css: { label: 'CSS owner', warning: 800, hard: null },
};

// Existing hotspots are intentionally frozen at their current size until their
// owner has characterization evidence and a single-responsibility extraction.
// Removing an entry is part of the extraction/cleanup commit, not a way to hide
// growth. Keep the values in sync with `docs/code-maintainability.md`.
const baselineAllowlist = new Map([
  ['src/features/world/prototype-world-runtime.ts', 2648],
  ['src/components/ParentDashboard.tsx', 1890],
  ['src/components/ChildDashboard.tsx', 1564],
  ['src/styles/modals.css', 1736],
  ['src/styles/character.css', 1476],
  ['src/styles/world.css', 1022],
  ['src/store.tsx', 995],
  ['src/features/world/TerrainWorldLayer.tsx', 923],
  ['src/lib/data-access.ts', 882],
  ['src/styles/overlays.css', 842],
  ['src/types.ts', 698],
  ['src/styles/neutral-theme.css', 670],
  ['src/styles/login.css', 634],
  ['src/styles/world-controls.css', 605],
  ['src/features/world/components/ChildGamePanel.tsx', 600],
  ['src/lib/adventure-store-actions.ts', 531],
  ['src/features/world/components/GameItem3DPreview.tsx', 408],
  ['src/features/growth/components/GrowthSummaryPanel.tsx', 406],
  ['src/features/adventures/components/ParentAdventureWorkspace.tsx', 388],
  ['src/features/world/world-roaming.ts', 381],
  ['src/features/adventures/components/AdventureRewardCelebration.tsx', 336],
  ['src/features/world/world-collision.ts', 331],
  ['src/styles/dashboard.css', 304],
]);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
      continue;
    }
    if (sourceExtensions.has(path.slice(path.lastIndexOf('.')))) files.push(path);
  }
  return files;
}

function lineCount(content) {
  if (content.length === 0) return 0;
  return content.split(/\r?\n/).length - (content.endsWith('\n') || content.endsWith('\r') ? 1 : 0);
}

function classify(relativePath) {
  if (relativePath.endsWith('.css')) return 'css';
  if (
    relativePath.startsWith('src/features/') &&
    (relativePath.includes('/runtime/') || relativePath.endsWith('-runtime.ts') || relativePath.endsWith('/runtime.ts'))
  ) {
    return 'runtime';
  }
  if (relativePath.endsWith('.tsx')) return 'component';
  return 'module';
}

function formatPolicy(policy) {
  const hard = policy.hard === null ? 'n/a' : `${policy.hard}`;
  return `${policy.label}; warning ${policy.warning}, hard ${hard}`;
}

if (!existsSync(sourceRoot)) {
  console.error(`FAIL source-size: source root not found: ${sourceRoot}`);
  process.exit(1);
}

const failures = [];
const warnings = [];
const files = walk(sourceRoot).sort();
const seen = new Set();

console.log('Source-size governance (src/**/*.ts, src/**/*.tsx, src/**/*.css)');
console.log('Existing hotspots are ratcheted by exact baseline; new over-limit files block.');

for (const file of files) {
  const relativePath = relative(repoRoot, file).split('\\').join('/');
  const lines = lineCount(readFileSync(file, 'utf8'));
  const policy = policies[classify(relativePath)];
  const baseline = baselineAllowlist.get(relativePath);
  if (baseline !== undefined) seen.add(relativePath);

  if (baseline !== undefined) {
    if (lines > baseline) {
      failures.push(`${relativePath}: ${lines} lines > baseline ${baseline} (${formatPolicy(policy)})`);
      console.log(`FAIL  ${relativePath} ${lines} lines (baseline ${baseline}; grew by ${lines - baseline})`);
      continue;
    }
    if (lines > policy.warning) {
      console.log(`PASS  ${relativePath} ${lines} lines (baseline ${baseline}; ratchet ${baseline - lines >= 0 ? `↓${baseline - lines}` : 'unchanged'})`);
    }
    continue;
  }

  if (policy.hard !== null && lines > policy.hard) {
    failures.push(`${relativePath}: ${lines} lines > hard limit ${policy.hard} (${formatPolicy(policy)}); split before merge or add a reviewed baseline`);
    console.log(`FAIL  ${relativePath} ${lines} lines (hard ${policy.hard})`);
    continue;
  }
  if (lines > policy.warning) {
    failures.push(`${relativePath}: ${lines} lines > warning ${policy.warning}; add a reviewed baseline with an owner or split the file`);
    console.log(`FAIL  ${relativePath} ${lines} lines (warning ${policy.warning}; no baseline)`);
    continue;
  }
  console.log(`PASS  ${relativePath} ${lines} lines (${policy.label})`);
}

for (const [relativePath, baseline] of baselineAllowlist) {
  if (!seen.has(relativePath)) {
    failures.push(`${relativePath}: baseline entry is missing from source; remove or update it in the same reviewed cleanup commit (expected ${baseline} lines)`);
  }
}

if (warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN  ${warning}`);
}

if (failures.length > 0) {
  console.error(`\nFAIL source-size: ${failures.length} violation(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS source-size: ${files.length} source files checked; no baseline growth or unreviewed over-limit file.`);
