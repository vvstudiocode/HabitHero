import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('character catalog exposes a representative accent color', async () => {
  const { CHARACTER_CATALOG } = await import('../src/features/characters/catalog.ts');

  assert.equal(CHARACTER_CATALOG[0]?.accentColor, '#f472b6');
});

test('shared hero resolves a child theme from its character image without caller changes', () => {
  const hero = read('../src/components/DashboardCharacterHero.tsx');

  assert.match(hero, /getCharacterByImageUrl\(sceneImage\)/);
  assert.match(hero, /character\?\.accentColor/);
});

test('shared hero exposes one theme color for all dashboard controls', () => {
  const hero = read('../src/components/DashboardCharacterHero.tsx');
  const characterStyles = read('../src/styles/character.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(hero, /--hh-character-theme-color/);
  assert.match(hero, /data-theme-color/);
  assert.doesNotMatch(characterStyles, /var\(--hh-character-glow\)/);
  assert.match(neutralTheme, /--hh-character-glow/);
  assert.match(neutralTheme, /box-shadow:[^;]*var\(--hh-character-glow\)/);
  assert.match(neutralTheme, /\.hh-character-icon-button:hover[\s\S]*?var\(--hh-character-glow\)/);
  assert.match(neutralTheme, /\.hh-character-menu-action:focus-visible[\s\S]*?var\(--hh-character-glow\)/);
  assert.doesNotMatch(neutralTheme, /rgba\(255, 177, 205, 0\.68\)/);
});

test('shared hero allows persisted theme values to override catalog defaults', () => {
  const source = read('../src/components/DashboardCharacterHero.tsx');
  assert.match(source, /theme\?\.accentColor \?\?/);
  assert.match(source, /theme\?\.mobileBackgroundImageUrl \?\?/);
  assert.match(source, /theme\?\.desktopBackgroundImageUrl \?\?/);
});
