import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('parent point cards omit redundant helper and balance labels', () => {
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const pointsSectionStart = dashboard.indexOf('parent-child-points-title');
  const pointsSectionEnd = dashboard.indexOf('</section>', pointsSectionStart);
  const pointsSection = dashboard.slice(pointsSectionStart, pointsSectionEnd);

  assert.doesNotMatch(pointsSection, /從這裡贈點或扣點，所有變動都會留下紀錄/);
  assert.doesNotMatch(pointsSection, /目前餘額/);
});

test('adventure abandonment has no extra card wrapper', () => {
  const detail = read('../src/features/adventures/components/AdventureTaskDetail.tsx');
  assert.doesNotMatch(detail, /mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3/);
  assert.match(detail, /放棄這個冒險/);
});

test('child feature header places points and scrolls before the close control', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const headerStart = dashboard.indexOf('hh-parent-content-modal-bar hh-parent-content-modal-bar--child');
  const headerEnd = dashboard.indexOf('        {isOffline', headerStart);
  const header = dashboard.slice(headerStart, headerEnd);
  const wishlistActionIndex = dashboard.indexOf('aria-label="告訴爸媽我想要什麼"', headerStart);
  const closeControlIndex = dashboard.indexOf('aria-label="關閉功能頁面"', headerStart);

  assert.ok(header.indexOf('displayedScrolls') < header.indexOf('關閉功能頁面'));
  assert.ok(header.indexOf('childPoints') < header.indexOf('關閉功能頁面'));
  assert.ok(dashboard.indexOf('childPoints', headerStart) < wishlistActionIndex);
  assert.ok(wishlistActionIndex < closeControlIndex);
  assert.match(header, /onClick=\{\(\) => closeChildFeature\(\)\}/);
  assert.doesNotMatch(header, /onClick=\{\s*closeChildFeature\s*\}/);
});

test('child feature header keeps navigation touch-sized and horizontally scrollable', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const overlays = read('../src/styles/overlays.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(dashboard, /<nav className="hh-child-feature-nav" aria-label="小孩功能導覽">/);
  assert.match(overlays, /\.hh-child-feature-nav[\s\S]*?overflow-x:\s*auto/);
  assert.match(overlays, /\.hh-child-feature-nav-button[\s\S]*?min-width:\s*44px/);
  assert.match(overlays, /\.hh-child-feature-nav-button[\s\S]*?min-height:\s*44px/);
  assert.match(overlays, /\.hh-child-feature-nav-button[\s\S]*?font-size:\s*13px/);
  assert.match(neutralTheme, /\.hh-child-feature-nav-button[\s\S]*?box-shadow:\s*none/);
  assert.match(dashboard, /PointValue value=\{childPoints\} iconSize=\{15\} className="hh-child-feature-points"/);
  assert.match(overlays, /\.hh-child-feature-points > span[\s\S]*?font-size:\s*20px/);
  assert.match(dashboard, /item\.id === 'settings'[\s\S]*?hh-child-feature-nav-label/);
  assert.match(dashboard, /openChildFeature\('settings'\)[\s\S]*?hh-child-feature-settings-button/);
  assert.match(overlays, /@media \(max-width: 760px\)[\s\S]*?\.hh-child-feature-nav-button\.is-settings[\s\S]*?display:\s*none/);
  assert.match(overlays, /@media \(max-width: 760px\)[\s\S]*?\.hh-child-feature-settings-button[\s\S]*?display:\s*grid/);
});
