import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('friend list uses the same solid card surface as the add-adventure sheet', () => {
  const neutralTheme = read('../src/styles/neutral-theme.css');
  const sheetRule = neutralTheme.match(/\.hh-sprite-theme \.hh-friend-list-sheet\s*\{([^}]*)\}/)?.[1] ?? '';
  const headerRule = neutralTheme.match(/\.hh-sprite-theme \.hh-friend-list-header\s*\{([^}]*)\}/)?.[1] ?? '';
  const formRule = neutralTheme.match(/\.hh-sprite-theme \.hh-friend-list-form\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.match(sheetRule, /background:\s*var\(--hh-neutral-surface\)/);
  assert.match(headerRule, /background:\s*transparent\s*!important/);
  assert.match(formRule, /background:\s*transparent\s*!important/);
  assert.match(neutralTheme, /header:not\([^)]*\):not\([^)]*\):not\(\.hh-friend-list-header\)/);
});

test('friend list form uses a semantic surface hook instead of a colored utility background', () => {
  const friendList = read('../src/features/friends/components/FriendListSheet.tsx');

  assert.match(friendList, /className="hh-friend-list-form mt-4 rounded-2xl p-4"/);
  assert.doesNotMatch(friendList, /hh-friend-list-form[^\n]*bg-emerald-/);
});
