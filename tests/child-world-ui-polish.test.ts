import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('friend list closes from the blank backdrop with a visible X and fade-out lifecycle', () => {
  const sheet = read('../src/features/friends/components/FriendListSheet.tsx');
  const chatSheet = read('../src/features/world-chat/components/WorldChatSheet.tsx');
  const overlays = read('../src/styles/overlays.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(sheet, /<X\s+size=\{22\}/);
  assert.match(sheet, /hh-modal-overlay hh-friend-list-overlay/);
  assert.match(sheet, /event\.target === event\.currentTarget/);
  assert.match(sheet, /onAnimationEnd=/);
  assert.match(sheet, /hh-friend-list-header/);
  assert.match(sheet, /hh-friend-list-close/);
  assert.match(chatSheet, /<X\s+size=\{22\}/);
  assert.match(chatSheet, /aria-label="關閉聊天"/);
  assert.match(chatSheet, /onClick=\{closeFromBackdrop\}/);
  assert.match(chatSheet, /onAnimationEnd=\{finishClose\}/);
  assert.match(overlays, /\.hh-friend-list-overlay\.is-leaving/);
  assert.match(overlays, /\.hh-world-chat-sheet-layer\.is-leaving[\s\S]*?hh-modal-overlay-out/);
  assert.match(neutralTheme, /\.hh-sprite-theme \.hh-friend-list-header[\s\S]*?background:\s*transparent !important[\s\S]*?box-shadow:\s*none !important/);
  assert.match(neutralTheme, /\.hh-sprite-theme \.hh-friend-list-sheet[\s\S]*?background:\s*transparent[\s\S]*?box-shadow:\s*none/);
});

test('child world HUD surfaces share the chat translucency without border lines', () => {
  const tokens = read('../src/styles/tokens.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(tokens, /--hh-world-overlay-surface-opacity:\s*44%/);
  assert.match(neutralTheme, /--hh-world-overlay-surface:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) var\(--hh-world-overlay-surface-opacity\), transparent\)/);
  const hudSelectors = [
    '.hh-character-stats>div',
    '.hh-adventure-card',
    '.hh-world-clean-mode-control',
    '.hh-world-action-toggle',
    '.hh-world-action-item',
    '.hh-friend-dock',
  ];
  for (const selector of hudSelectors) assert.match(neutralTheme, new RegExp(`${selector.replace(/[.>]/g, '\\$&')}[\\s\\S]*?background: var\\(--hh-world-overlay-surface\\);[\\s\\S]*?border: 0;`));
  assert.match(neutralTheme, /\.hh-character-hero-panel > \.hh-character-dashboard-actions \.hh-character-icon-button[\s\S]*?background: var\(--hh-world-overlay-surface\);/);
});

test('child adventure cards live in a responsive task-board overlay', () => {
  const character = read('../src/styles/character.css');

  assert.match(character, /\.hh-child-adventure-board\s*\{[\s\S]*?position:\s*relative/);
  assert.match(character, /\.hh-child-adventure-board\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--hh-adventure-board-max-width\)\)/);
  assert.match(character, /\.hh-adventure-board-layout\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(character, /@media \(max-width:\s*760px\)[\s\S]*?\.hh-adventure-board-layout[\s\S]*?grid-template-columns:\s*1fr/);

  const controls = read('../src/styles/world-controls.css');
  assert.match(controls, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-world-joystick--fixed[\s\S]*?left:\s*calc\(var\(--hh-character-content-left,\s*12px\) \+ \(var\(--hh-adventure-board-width\) \/ 2\)\);/);
  assert.match(controls, /\.hh-dashboard-screen--child\[data-landscape-cutout-side="left"\]\s+\.hh-world-joystick--fixed/);
  assert.match(controls, /\.hh-world-joystick--dynamic\s*\{[\s\S]*?top:\s*clamp\(56px,[\s\S]*?left:\s*clamp\(max\(56px,[\s\S]*?safe-area-inset-left/);
});

test('parent hero menu actions share the settings translucency', () => {
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(neutralTheme, /\.hh-sprite-theme \.hh-character-menu\[data-menu-variant="parent"\] \.hh-character-menu-root > \.hh-character-menu-action[\s\S]*?background:\s*var\(--hh-world-overlay-surface\)/);
});
