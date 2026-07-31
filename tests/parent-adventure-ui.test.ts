import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('parent adventure forms keep daily and general completion rules separate', () => {
  const daily = read('../src/features/adventures/components/ParentAdventureScheduleForm.tsx');
  const general = read('../src/features/adventures/components/ParentGeneralAdventureForm.tsx');

  assert.match(daily, /每日冒險不要求孩子填寫心得/);
  assert.doesNotMatch(daily, /value="quick"/);
  assert.match(general, /value="quick"/);
  assert.match(general, /value="reflection"/);
  assert.doesNotMatch(general, /value="none"/);
});

test('child adventure board collapses an expanded section when the blank background is pressed', () => {
  const board = read('../src/features/adventures/components/ChildAdventureBoard.tsx');

  assert.match(board, /const boardRef = useRef<HTMLElement>\(null\)/);
  assert.match(board, /document\.addEventListener\('pointerdown', handleOutsidePointerDown\)/);
  assert.match(board, /boardRef\.current\?\.contains\(target\)/);
  assert.match(board, /target\.closest\([^)]*\[role="dialog"\][^)]*\)/);
  assert.match(board, /setOpenCard\(null\)/);
  assert.match(board, /<aside ref=\{boardRef\}/);
});

test('child adventure board keeps the controls without the redundant board heading', () => {
  const board = read('../src/features/adventures/components/ChildAdventureBoard.tsx');
  const characterStyles = read('../src/styles/character.css');
  const neutralStyles = read('../src/styles/neutral-theme.css');

  assert.doesNotMatch(board, /<h2>我的冒險<\/h2>/);
  assert.match(board, /aria-label="我的冒險"/);
  assert.doesNotMatch(characterStyles, /\.hh-child-adventure-board\s*>\s*h2/);
  assert.doesNotMatch(neutralStyles, /\.hh-child-adventure-board\s*>\s*h2/);
});

test('general adventure form uses an icon-only sheet header and hides scrollbar chrome', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const overlayStyles = read('../src/styles/overlays.css');
  const neutralStyles = read('../src/styles/neutral-theme.css');

  assert.doesNotMatch(dashboard, /<strong>新增一般冒險<\/strong>/);
  assert.match(dashboard, /aria-label="關閉新增一般冒險"/);
  assert.match(overlayStyles, /\.hh-goal-proposal-sheet\s*\{[\s\S]*?scrollbar-width:\s*none/);
  assert.match(overlayStyles, /\.hh-goal-proposal-sheet::\-webkit-scrollbar\s*\{[\s\S]*?display:\s*none/);
  assert.match(overlayStyles, /\.hh-goal-proposal-sheet-bar\s*\{[\s\S]*?position:\s*absolute[\s\S]*?left:\s*16px/);
  assert.match(
    neutralStyles,
    /button:not\(\.hh-character-menu-action\):not\(\.hh-character-icon-button\):not\(\.hh-adventure-button\):not\(\.hh-goal-proposal-backdrop\):hover/,
  );
  assert.match(neutralStyles, /\.hh-goal-proposal-backdrop:hover,[\s\S]*?background:\s*rgba\(32, 33, 36, 0\.28\)\s*!important/);
});

test('a newly created general adventure opens immediately after the creation layer exits', () => {
  const board = read('../src/features/adventures/components/ChildAdventureBoard.tsx');
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const proposalForm = read('../src/features/growth/components/GoalProposalForm.tsx');
  const overlayStyles = read('../src/styles/overlays.css');

  assert.match(board, /requestedTask\?: \{ name: string; requestId: number \}/);
  assert.match(board, /setOpenCard\('general'\)/);
  assert.match(board, /setSelectedTaskId\(requestedAdventure\.id\)/);
  assert.match(dashboard, /requestedTask=\{adventureOpenRequest\}/);
  assert.match(dashboard, /setAdventureOpenRequest\(\{ name: input\.name\.trim\(\), requestId: Date\.now\(\) \}\)/);
  assert.match(dashboard, /dismissWithAnimation\([\s\S]*?\.hh-goal-proposal-overlay/);
  assert.match(proposalForm, /建立並開始/);
  assert.match(proposalForm, /完成後再由爸媽確認點數/);
  assert.match(overlayStyles, /\.hh-goal-proposal-overlay\.hh-modal-exit[\s\S]*?hh-goal-overlay-exit/);
});

test('mobile adventure completion keeps the submit action visible above the safe area', () => {
  const completion = read('../src/features/adventures/components/AdventureCompletionForm.tsx');
  const overlayStyles = read('../src/styles/overlays.css');
  const neutralStyles = read('../src/styles/neutral-theme.css');

  assert.match(completion, /hh-adventure-completion-actions/);
  assert.match(overlayStyles, /@media \(max-width: 760px\)[\s\S]*?\.hh-adventure-completion-actions\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(overlayStyles, /@media \(max-width: 760px\)[\s\S]*?\.hh-adventure-completion-actions\s*\{[\s\S]*?width:\s*auto/);
  assert.match(overlayStyles, /\.hh-adventure-completion-actions\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(overlayStyles, /\.hh-adventure-complete-button\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(overlayStyles, /\.hh-adventure-completion\s*\{[\s\S]*?padding-bottom:/);
  assert.match(neutralStyles, /\.hh-adventure-complete-button\s*\{[\s\S]*?color:\s*#ffffff;[\s\S]*?background:\s*var\(--hh-neutral-ink\)/);
  assert.doesNotMatch(neutralStyles, /\.hh-adventure-complete-button\s*\{[\s\S]*?background:\s*var\(--hh-character-theme-color\)/);
});

test('calendar exposes month navigation, date details and daily batch review', () => {
  const calendar = read('../src/features/adventures/components/ParentAdventureCalendar.tsx');
  const dashboardStyles = read('../src/styles/dashboard.css');
  const themeStyleOwners = [
    read('../src/styles/character.css'),
    read('../src/styles/modals.css'),
    read('../src/styles/neutral-theme.css'),
    read('../src/styles/overlays.css'),
  ];

  assert.match(calendar, /aria-label="上一個月"/);
  assert.match(calendar, /aria-label="下一個月"/);
  assert.match(calendar, /hh-adventure-calendar-header/);
  assert.match(calendar, /hh-adventure-calendar-grid/);
  assert.match(calendar, /day\.isToday[\s\S]*?>今</);
  assert.match(calendar, /hasPending \? `待\$\{dayTasks\.length\}` : `\$\{dayTasks\.length\}項`/);
  assert.match(dashboardStyles, /\.hh-adventure-month-navigation\s*\{[\s\S]*?grid-template-columns:\s*44px minmax\(0,\s*1fr\) 44px/);
  themeStyleOwners.forEach(styles => {
    assert.match(styles, /span:not\(\.hh-adventure-calendar-today\):not\(\.hh-adventure-calendar-count\)/);
  });
  assert.match(calendar, /當日冒險/);
  assert.match(calendar, /批次核准每日冒險/);
  assert.match(calendar, /getBatchReviewableIds/);
  assert.doesNotMatch(calendar, /查看每日與一般冒險的安排、完成及待審核狀態/);
});

test('parent dashboard routes adventure creation through dedicated components', () => {
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.match(dashboard, /ParentAdventureWorkspace/);
  assert.match(workspace, /ParentAdventureCalendar/);
  assert.match(workspace, /ParentAdventureScheduleForm/);
  assert.match(workspace, /ParentGeneralAdventureForm/);
  assert.match(workspace, /每日冒險/);
  assert.match(workspace, /一般冒險/);
  assert.match(workspace, /variant="center"/);
  assert.match(workspace, /hh-adventure-form-dialog/);
  assert.match(workspace, /dismissWithAnimation/);
});

test('parent workspace manages schedules and prevents unsafe group archiving', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.match(workspace, /每日冒險排程/);
  assert.match(workspace, /停用排程/);
  assert.match(workspace, /停用只影響尚未產生的未來冒險/);
  assert.match(workspace, /onUpdateSchedule/);
  assert.match(workspace, /尚有未完成冒險/);
  assert.match(workspace, /onArchiveGroup/);
});

test('schedule editing requires an explicit safe update scope', () => {
  const form = read('../src/features/adventures/components/ParentAdventureScheduleForm.tsx');

  assert.match(form, /today_unfinished/);
  assert.match(form, /from_tomorrow/);
  assert.match(form, /today_and_future/);
  assert.match(form, /不會修改過去紀錄、等待審核、已完成或要求補充/);
  assert.match(form, /正在計時或暫停中/);
  assert.match(form, /等待這次家長確認前，先鎖住下一個冒險/);
});
