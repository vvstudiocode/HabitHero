import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = join(repoRoot, 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);
const resolutionExtensions = ['', '.ts', '.tsx', '.js', '.jsx'];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
      continue;
    }
    if (sourceExtensions.has(extname(path))) files.push(path);
  }
  return files;
}

function sourcePath(file) {
  return relative(repoRoot, file).split('\\').join('/');
}

function candidatePaths(basePath) {
  return resolutionExtensions.flatMap((extension) => [
    `${basePath}${extension}`,
    `${basePath}/index${extension}`,
  ]);
}

function resolveImport(importer, specifier) {
  let basePath;
  if (specifier.startsWith('@/')) {
    basePath = join(repoRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    basePath = resolve(dirname(importer), specifier);
  } else {
    return null;
  }

  return candidatePaths(basePath).find((candidate) => existsSync(candidate) && !candidate.endsWith('/')) ?? null;
}

function lineNumber(content, offset) {
  return content.slice(0, offset).split(/\r?\n/).length;
}

function parseImports(content) {
  const imports = [];
  const seen = new Set();
  const patterns = [
    /^\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      const key = `${match.index}:${specifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      imports.push({ specifier, line: lineNumber(content, match.index ?? 0) });
    }
  }
  return imports;
}

function isDashboardPage(path) {
  return /^src\/components\/(?:ParentDashboard|ChildDashboard)\.(?:ts|tsx)$/.test(path);
}

function isPureRuntime(path) {
  return (
    path.startsWith('src/features/') &&
    path.endsWith('.ts') &&
    (path.includes('/runtime/') || path.endsWith('-runtime.ts') || path.endsWith('/runtime.ts'))
  );
}

function isReactImport(specifier, resolvedPath) {
  return (
    specifier === 'react' ||
    specifier.startsWith('react/') ||
    specifier === 'react-dom' ||
    specifier.startsWith('react-dom/') ||
    resolvedPath?.endsWith('.tsx')
  );
}

if (!existsSync(sourceRoot)) {
  console.error(`FAIL import-boundaries: source root not found: ${sourceRoot}`);
  process.exit(1);
}

const violations = [];
const files = walk(sourceRoot).sort();

console.log('Import-boundary governance (static local imports only)');
console.log('features → page, lib → UI, and pure runtime → React/TSX are checked.');

for (const importer of files) {
  const importerPath = sourcePath(importer);
  const content = readFileSync(importer, 'utf8');
  for (const { specifier, line } of parseImports(content)) {
    const resolved = resolveImport(importer, specifier);
    const importedPath = resolved ? sourcePath(resolved) : null;

    if (importerPath.startsWith('src/features/') && importedPath && isDashboardPage(importedPath)) {
      violations.push(`${importerPath}:${line} imports dashboard page ${importedPath}`);
      continue;
    }

    if (importerPath.startsWith('src/lib/') && importedPath?.startsWith('src/components/')) {
      violations.push(`${importerPath}:${line} imports UI component ${importedPath}`);
      continue;
    }

    if (isPureRuntime(importerPath) && isReactImport(specifier, importedPath)) {
      violations.push(
        `${importerPath}:${line} imports React/UI dependency ${importedPath ?? specifier}; keep pure runtime logic framework-free`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(`\nFAIL import-boundaries: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`PASS import-boundaries: ${files.length} source files checked; no forbidden dependency direction.`);
