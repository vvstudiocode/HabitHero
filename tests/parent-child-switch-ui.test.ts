import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('parent dashboard exposes a labeled, mobile-visible child switch entry', () => {
  const source = read('../src/components/ParentDashboard.tsx');
  const entryStart = source.lastIndexOf('<button', source.indexOf('切換小孩視角'));
  const entryEnd = source.indexOf('</button>', entryStart) + '</button>'.length;
  const entry = source.slice(entryStart, entryEnd);

  assert.match(entry, /className="hh-parent-child-switch-action[^"\n]*\bflex\b/);
  assert.match(entry, /min-h-12/);
  assert.match(entry, /aria-label="切換小孩視角"/);
  assert.match(entry, /title="切換小孩視角"/);
  assert.match(entry, /<Users size=\{20\} aria-hidden="true" className="hh-parent-child-switch-icon shrink-0 text-gray-900" \/>/);
  assert.doesNotMatch(entry, /className="[^"]*(?:\bhidden\b|sm:hidden|md:hidden|lg:hidden)/);
});

test('family child picker gives every switch route a visible, accessible icon and 44px target', () => {
  const source = read('../src/components/FamilyChildPicker.tsx');

  assert.match(source, /<button key=\{child\.id\}[\s\S]*?aria-label=\{`切換到\$\{child\.name\}視角`\}/);
  assert.match(source, /title=\{`切換到\$\{child\.name\}視角`\}/);
  assert.match(source, /<User size=\{20\} aria-hidden="true" className="hh-family-picker-option-icon shrink-0 text-\[var\(--hh-neutral-ink\)\]" \/>/);
  assert.match(source, /aria-label="回到家長管理端"/);
  assert.match(source, /title="回到家長管理端"/);
  assert.match(source, /<LockKeyhole size=\{20\} aria-hidden="true" className="hh-family-picker-option-icon shrink-0 text-\[var\(--hh-neutral-ink\)\]" \/>/);
  assert.match(source, /hh-family-picker-child-option[^\n]*min-h-12/);
  assert.match(source, /hh-family-picker-parent-option[^\n]*min-h-12/);
  assert.doesNotMatch(source, /[\u{1F300}-\u{1FAFF}]/u);
});

test('parent child preview keeps social controls visible without impersonating a child session', () => {
  const dashboardSource = read('../src/components/ChildDashboard.tsx');
  const socialSource = read('../src/features/world-social/WorldSocialLayer.tsx');

  assert.match(dashboardSource, /enabled=\{role === 'child'\}/);
  assert.match(socialSource, /const previewMode = role === 'parent' && !enabled;/);
  assert.match(socialSource, /if \(!enabled && !previewMode\) return null;/);
  assert.match(socialSource, /請用小孩帳號登入後，才能使用好友世界與聊天/);
});
