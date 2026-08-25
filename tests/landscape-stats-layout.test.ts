import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const characterStyles = readFileSync(
  new URL('../src/styles/character.css', import.meta.url),
  'utf8',
);

test('landscape HUD keeps stats and actions anchored inside the top safe area', () => {
  const landscapeBlock = [...characterStyles.matchAll(/@media \(orientation: landscape\)\s*\{([\s\S]*?)\n\}/g)]
    .map((match) => match[1])
    .find((block) => block.includes('.hh-character-stats')) ?? '';

  assert.match(landscapeBlock, /\.hh-character-stats,\s*\.hh-character-hero-panel\s*>\s*\.hh-character-dashboard-actions\s*\{/);
  assert.match(landscapeBlock, /top:\s*max\(16px,\s*calc\(env\(safe-area-inset-top,\s*0px\) \+ 16px\)\);/);
});
