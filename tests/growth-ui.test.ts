import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('growth cards expose period shortcuts, collapsed child cards, clickable dates, and category progress', () => {
  const panel = read('../src/features/growth/components/GrowthSummaryPanel.tsx');

  assert.match(panel, /label: '今日'/);
  assert.match(panel, /label: '本週'/);
  assert.match(panel, /label: '本月'/);
  assert.match(panel, /is-selected/);
  assert.match(panel, /aria-expanded=\{expanded\}/);
  assert.match(panel, /onSelectDay=\{/);
  assert.match(panel, /點擊日期查看當天任務/);
  assert.match(panel, /分類統計/);
  assert.match(panel, /已完成 \/ 已安排/);
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /event\.key === 'Escape'/);
  assert.doesNotMatch(panel, /filterAndPaginateCompletedTasks/);
});

test('growth controls stay lightweight and day details escape the child card layer', () => {
  const panel = read('../src/features/growth/components/GrowthSummaryPanel.tsx');

  assert.match(panel, /className="grid grid-cols-3 gap-2"/);
  assert.doesNotMatch(panel, /rounded-2xl border border-gray-200 bg-gray-50 p-1/);
  assert.doesNotMatch(panel, /aria-label="顯示孩子"/);
  assert.doesNotMatch(panel, /childFilter/);
  assert.doesNotMatch(panel, /showChildFilter/);
  assert.doesNotMatch(panel, /依已安排、已到期的冒險計算/);
  assert.match(panel, /className="relative overflow-hidden rounded-3xl/);
  assert.match(panel, /createPortal/);
  assert.match(panel, /createPortal\([\s\S]*document\.body/);
  assert.match(panel, /className="hh-growth-day-dialog-layer"/);
  assert.match(panel, /\{selectedDay && <GrowthDayDialog/);
  assert.doesNotMatch(panel, /pointer-events-none absolute inset-0 z-20/);
  assert.doesNotMatch(panel, /bg-black\/30/);
  assert.doesNotMatch(panel, /absolute inset-0 cursor-default/);
});
