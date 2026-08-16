import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('initial loading view gives the HabitHero title a dedicated larger style', () => {
  const appSource = read('../src/App.tsx');
  const loginStyles = read('../src/styles/login.css');

  assert.match(appSource, /className="hh-loading-title text-lg/);
  assert.match(loginStyles, /\.hh-loading-title\s*\{[\s\S]*?font-size:\s*clamp\(/);
});

test('background notification uses the same green switch colors as background music', () => {
  const modalStyles = read('../src/styles/modals.css');

  assert.match(modalStyles, /\.hh-notification-toggle-track\s*\{[\s\S]*?background:\s*#d7e4d6;/);
  assert.match(modalStyles, /\.hh-notification-toggle\.is-on\s+\.hh-notification-toggle-track\s*\{[\s\S]*?background:\s*#5b9c69;/);
});
