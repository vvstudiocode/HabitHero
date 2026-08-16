import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('document pages share the warm page surface without a white header treatment', () => {
  const modalStyles = read('../src/styles/modals.css');
  const neutralThemeStyles = read('../src/styles/neutral-theme.css');
  const documentHeader = modalStyles.match(/\.hh-document-header\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(documentHeader, /background:\s*transparent;/);
  assert.match(documentHeader, /border-bottom:\s*0;/);
  assert.match(documentHeader, /box-shadow:\s*none;/);
  assert.match(documentHeader, /backdrop-filter:\s*none;/);
  assert.match(neutralThemeStyles, /header:not\(\.hh-adventure-detail-header\):not\(\.hh-document-header\)/);
});
