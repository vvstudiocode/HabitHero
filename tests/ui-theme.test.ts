import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('world character catalog exposes the current default character', async () => {
  const { CURRENT_WORLD_CHARACTER_ID, WORLD_CHARACTER_CATALOG } = await import('../src/features/characters/world-character-catalog.ts');

  assert.equal(CURRENT_WORLD_CHARACTER_ID, 'character.arthur');
  assert.equal(WORLD_CHARACTER_CATALOG[0]?.id, CURRENT_WORLD_CHARACTER_ID);
});

test('shared hero uses persisted theme values without a legacy character catalog', () => {
  const hero = read('../src/components/DashboardCharacterHero.tsx');

  assert.doesNotMatch(hero, /getCharacterByImageUrl|character\?\.accentColor/);
  assert.match(hero, /theme\?\.accentColor \?\?/);
});

test('dashboard menu actions expose semantic tones and colored icons', () => {
  const hero = read('../src/components/DashboardCharacterHero.tsx');
  const parent = read('../src/components/ParentDashboard.tsx');
  const child = read('../src/components/ChildDashboard.tsx');
  const neutralTheme = read('../src/styles/neutral-theme.css');
  const tokens = read('../src/styles/tokens.css');

  assert.match(hero, /export type CharacterMenuTone = 'attention' \| 'action' \| 'explore' \| 'reward' \| 'growth' \| 'neutral'/);
  assert.match(hero, /data-menu-tone=\{action\.tone\}/);
  assert.match(hero, /className="hh-character-menu-icon"/);
  for (const tone of ['attention', 'action', 'growth', 'reward', 'explore']) {
    assert.match(parent, new RegExp(`tone: '${tone}'`));
  }
  for (const tone of ['attention', 'action', 'explore', 'reward', 'growth', 'neutral']) {
    assert.match(child, new RegExp(`tone: '${tone}'`));
    assert.match(tokens, new RegExp(`--hh-menu-tone-${tone}:`));
  }
  assert.match(hero, /className="hh-character-menu-icon" style=\{action\.tone/);
  assert.match(neutralTheme, /\.hh-character-menu-icon/);
  assert.match(neutralTheme, /background: color-mix\(in srgb, var\(--hh-neutral-surface\) 68%, transparent\)/);
});

test('shared hero exposes one theme color for all dashboard controls', () => {
  const hero = read('../src/components/DashboardCharacterHero.tsx');
  const characterStyles = read('../src/styles/character.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(hero, /--hh-character-theme-color/);
  assert.match(hero, /data-theme-color=\{menuVariant\}/);
  assert.doesNotMatch(characterStyles, /var\(--hh-character-glow\)/);
  assert.match(neutralTheme, /--hh-character-glow/);
  assert.match(neutralTheme, /\.hh-character-hero-panel\s*\{[\s\S]*?--hh-character-glow:\s*var\(--hh-character-theme-color\)/);
  assert.match(neutralTheme, /@supports\s*\(color:\s*color-mix/);
  assert.match(neutralTheme, /box-shadow:[^;]*var\(--hh-character-glow\)/);
  assert.match(neutralTheme, /\.hh-character-icon-button:hover[\s\S]*?var\(--hh-character-glow\)/);
  assert.match(neutralTheme, /\.hh-character-menu-action:focus-visible[\s\S]*?var\(--hh-character-glow\)/);
  assert.match(neutralTheme, /\.hh-character-hero-panel > \.hh-character-dashboard-actions \.hh-character-icon-button,[\s\S]*?box-shadow:\s*none/);
  assert.match(neutralTheme, /\.hh-parent-content-modal-bar \.hh-character-icon-button,[\s\S]*?box-shadow:\s*none/);
  assert.match(neutralTheme, /\.hh-character-menu\.is-open \.hh-character-menu-action,[\s\S]*?box-shadow:\s*none/);
  assert.doesNotMatch(neutralTheme, /rgba\(255, 177, 205, 0\.68\)/);
});

test('child adventure cards let the character scene show through', () => {
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(neutralTheme, /\.hh-adventure-card\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) 68%, transparent\)/);
  assert.doesNotMatch(neutralTheme, /\.hh-adventure-card\s*\{[\s\S]*?backdrop-filter:/);
  assert.match(neutralTheme, /\.hh-character-icon-button,[\s\S]*?background:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) 68%, transparent\)/);
  assert.doesNotMatch(neutralTheme, /\.hh-character-icon-button,[\s\S]*?backdrop-filter:/);
});

test('completed adventure checks use the neutral black ink', () => {
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(neutralTheme, /\.hh-adventure-task-row\.is-submitted \.hh-adventure-task-state,[\s\S]*?\.hh-adventure-task-row\.is-completed \.hh-adventure-task-state\s*\{[\s\S]*?color:\s*var\(--hh-neutral-ink\)/);
});

test('shared hero allows persisted theme values to override catalog defaults', () => {
  const source = read('../src/components/DashboardCharacterHero.tsx');
  assert.match(source, /theme\?\.accentColor \?\?/);
  assert.match(source, /theme\?\.mobileBackgroundImageUrl \?\?/);
  assert.match(source, /theme\?\.desktopBackgroundImageUrl \?\?/);
});
