import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const previewSource = readFileSync(new URL('../src/features/world/components/GameItemImagePreview.tsx', import.meta.url), 'utf8');
const worldStyles = readFileSync(new URL('../src/styles/world.css', import.meta.url), 'utf8');

test('pet previews no longer apply pixel-only rendering', () => {
  assert.doesNotMatch(previewSource, /hh-game-item-preview--pixel/);
  assert.doesNotMatch(previewSource, /hh-game-item-lightbox-image--pixel/);
  assert.match(worldStyles, /\.hh-game-item-preview[\s\S]*object-fit: contain/);
});
