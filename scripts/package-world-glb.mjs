import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [inputPath, outputPath, maxDimensionArg = '1024'] = process.argv.slice(2);
const maxDimension = Number(maxDimensionArg);

if (!inputPath || !outputPath || !Number.isInteger(maxDimension) || maxDimension < 1) {
  throw new Error('Usage: node scripts/package-world-glb.mjs <input.glb> <output.glb> [maxDimension]');
}

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'habithero-world-glb-'));
const resizedPath = path.join(temporaryDirectory, 'resized.glb');
const compressedPath = path.join(temporaryDirectory, 'compressed.glb');

function runTransform(command, args) {
  const result = spawnSync('npx', ['--yes', '@gltf-transform/cli@4.2.1', command, ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`gltf-transform ${command} failed.`);
}

try {
  // Resize first so the resampler sees the original source pixels directly.
  runTransform('resize', [
    inputPath,
    resizedPath,
    '--width',
    String(maxDimension),
    '--height',
    String(maxDimension),
    '--filter',
    'lanczos3',
  ]);

  // KTX2/UASTC preserves a compressed GPU representation instead of expanding
  // every texture to an uncompressed RGBA allocation at upload time.
  runTransform('uastc', [
    resizedPath,
    compressedPath,
    '--level',
    '3',
    '--rdo',
    '--rdo-lambda',
    '0.5',
    '--zstd',
    '18',
    '--jobs',
    '2',
  ]);

  // Draco must be the final transform: texture transforms can decode a Draco
  // mesh while rewriting the GLB, so doing Draco last keeps the extension.
  runTransform('draco', [
    compressedPath,
    outputPath,
    '--method',
    'edgebreaker',
    '--encode-speed',
    '5',
    '--decode-speed',
    '5',
    '--quantize-position',
    '14',
    '--quantize-normal',
    '10',
    '--quantize-texcoord',
    '12',
  ]);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
