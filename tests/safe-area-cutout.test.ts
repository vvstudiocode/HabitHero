import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveSafeAreaCutoutSide } from '../src/lib/safe-area-cutout';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('classifies a clearly larger left inset as a left cutout', () => {
  assert.equal(resolveSafeAreaCutoutSide({ left: 58, right: 16 }), 'left');
});

test('classifies a clearly larger right inset as a right cutout', () => {
  assert.equal(resolveSafeAreaCutoutSide({ left: 16, right: 58 }), 'right');
});

test('keeps small or balanced insets on the default left anchor', () => {
  assert.equal(resolveSafeAreaCutoutSide({ left: 18, right: 0 }), 'none');
  assert.equal(resolveSafeAreaCutoutSide({ left: 22, right: 20 }), 'none');
});

test('landscape adventure cards use the cutout side only when it is on the left', () => {
  const characterStyles = read('../src/styles/character.css');
  const childDashboard = read('../src/components/ChildDashboard.tsx');
  const safeAreaHook = read('../src/hooks/useSafeAreaCutoutSide.ts');

  assert.match(safeAreaHook, /resolveSafeAreaCutoutSide/);
  assert.match(childDashboard, /useSafeAreaCutoutSide/);
  assert.match(childDashboard, /data-landscape-cutout-side=\{landscapeCutoutSide\}/);
  assert.match(characterStyles, /\.hh-child-adventure-board\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--hh-adventure-board-max-width\)\)/);
  assert.doesNotMatch(characterStyles, /data-landscape-cutout-side="left".*hh-child-adventure-board/);
});
