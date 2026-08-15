import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('mobile interaction guard preserves editing targets', () => {
  const source = read('../src/lib/mobile-interaction.ts');

  assert.match(source, /'input'/);
  assert.match(source, /'textarea'/);
  assert.match(source, /'select'/);
  assert.match(source, /\[contenteditable="true"\]/);
  assert.match(source, /data-allow-text-selection/);
  assert.match(source, /isEditableInteractionTarget/);
  assert.match(source, /preventDefault\(\)/);
});

test('parent and child dashboards guard app surfaces without blocking editable fields', () => {
  const parent = read('../src/components/ParentDashboard.tsx');
  const child = read('../src/components/ChildDashboard.tsx');

  for (const source of [parent, child]) {
    assert.match(source, /preventNativeAppContextMenu/);
    assert.match(source, /preventNativeAppTextSelection/);
    assert.match(source, /preventNativeAppDragStart/);
    assert.match(source, /hh-app-interaction-surface/);
  }
});

test('app interaction CSS disables accidental selection while keeping form editing available', () => {
  const base = read('../src/styles/base.css');

  assert.match(base, /\.hh-app-interaction-surface[\s\S]*?user-select:\s*none/);
  assert.match(base, /\.hh-app-interaction-surface[\s\S]*?-webkit-user-select:\s*none/);
  assert.match(base, /\.hh-app-interaction-surface[\s\S]*?-webkit-touch-callout:\s*none/);
  assert.match(base, /\.hh-app-interaction-surface button[\s\S]*?touch-action:\s*manipulation/);
  assert.match(base, /\.hh-app-interaction-surface input[\s\S]*?user-select:\s*text/);
  assert.match(base, /\.hh-app-interaction-surface textarea[\s\S]*?-webkit-user-select:\s*text/);
  assert.match(base, /\.hh-app-interaction-surface img[\s\S]*?-webkit-user-drag:\s*none/);
});

test('world and feature surfaces preserve gesture ownership', () => {
  const world = read('../src/styles/world.css');
  const overlays = read('../src/styles/overlays.css');

  assert.match(world, /\.hh-terrain-world[\s\S]*?touch-action:\s*none/);
  assert.match(world, /\.hh-terrain-world[\s\S]*?-webkit-user-select:\s*none/);
  assert.match(world, /\.hh-terrain-world[\s\S]*?-webkit-touch-callout:\s*none/);
  assert.match(overlays, /\.hh-parent-content-modal[\s\S]*?touch-action:\s*pan-y/);
});
