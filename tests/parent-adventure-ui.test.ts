import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { TaskSchedule } from '../src/types';
import { formatScheduleCardDetails, formatScheduleDetails, formatScheduleWeekdays, getSharedScheduleDetails, groupActiveAdventureSchedules } from '../src/features/adventures/adventure-schedule-display';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('parent adventure forms keep daily and general completion rules separate', () => {
  const daily = read('../src/features/adventures/components/ParentAdventureScheduleForm.tsx');
  const general = read('../src/features/adventures/components/ParentGeneralAdventureForm.tsx');

  assert.doesNotMatch(daily, /每日冒險不要求孩子填寫心得/);
  assert.doesNotMatch(daily, /value="quick"/);
  assert.match(daily, /最晚開始時間/);
  assert.match(general, /value="quick"/);
  assert.match(general, /value="reflection"/);
  assert.doesNotMatch(general, /value="none"/);
  assert.match(general, /最晚開始時間/);
  assert.doesNotMatch(daily, /先鎖住下一個冒險/);
});

test('new daily and general adventures allow the parent to choose a category', () => {
  const daily = read('../src/features/adventures/components/ParentAdventureScheduleForm.tsx');
  const general = read('../src/features/adventures/components/ParentGeneralAdventureForm.tsx');
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.match(daily, /固定分類/);
  assert.match(daily, /TASK_CATEGORIES\.map/);
  assert.match(general, /固定分類/);
  assert.match(general, /TASK_CATEGORIES\.map/);
  assert.match(workspace, /category: input\.category/);
  assert.doesNotMatch(workspace, /category: 'life_habit'/);
});

test('daily weekday selection uses a dedicated visible selected state', () => {
  const daily = read('../src/features/adventures/components/ParentAdventureScheduleForm.tsx');
  const modalStyles = read('../src/styles/modals.css');
  const neutralStyles = read('../src/styles/neutral-theme.css');

  assert.match(daily, /hh-adventure-weekday/);
  assert.match(daily, /selected \? ' is-selected' : ''/);
  assert.doesNotMatch(daily, /孩子首頁只會顯示今天有勾選的每日冒險/);
  assert.match(modalStyles, /\.hh-adventure-weekday\s*\{/);
  assert.match(neutralStyles, /\.hh-adventure-weekday\.is-selected\s*\{[^}]*background:\s*var\(--hh-neutral-ink\)/);
});

test('daily schedule choices and actions use the neutral app palette', () => {
  const daily = read('../src/features/adventures/components/ParentAdventureScheduleForm.tsx');
  const modalStyles = read('../src/styles/modals.css');
  const neutralStyles = read('../src/styles/neutral-theme.css');

  assert.match(daily, /hh-adventure-child-choice/);
  assert.match(daily, /hh-adventure-timer-choice/);
  assert.match(daily, /hh-adventure-control/);
  assert.match(daily, /hh-adventure-primary-action/);
  assert.match(daily, /hh-adventure-field/);
  assert.doesNotMatch(daily, /(?:bg|border|text|ring)-blue-/);
  assert.match(modalStyles, /\.hh-adventure-child-choice,/);
  assert.match(neutralStyles, /\.hh-adventure-child-choice\.is-selected,/);
  assert.match(neutralStyles, /\.hh-adventure-control\s*\{[^}]*accent-color:\s*var\(--hh-neutral-ink\)/);
  assert.match(neutralStyles, /\.hh-adventure-primary-action\s*\{[^}]*background:\s*var\(--hh-neutral-ink\)/);
});

test('daily schedule overlays are portaled above the scrollable parent feature', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');
  const overlayStyles = read('../src/styles/overlays.css');

  assert.match(workspace, /createPortal/);
  assert.match(workspace, /renderAdventureOverlay/);
  assert.match(overlayStyles, /\.hh-modal-overlay\s*\{[^}]*animation:\s*hh-modal-overlay-in/);
});

test('daily schedule management copy uses Chinese task states', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.match(workspace, /等待審核、已完成的任務與點數都會保留/);
  assert.match(workspace, /formatScheduleDetails/);
  assert.doesNotMatch(workspace, /pending or completed/);
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

  assert.match(board, /requestedTask\?: \{ id: string; requestId: number \}/);
  assert.match(board, /setOpenCard\(requestedType\)/);
  assert.match(board, /task\.id === requestedTask\.id/);
  assert.match(board, /setSelectedTaskId\(requestedTask\.id\)/);
  assert.match(board, /handledRequestId\.current === requestedTask\.requestId/);
  assert.match(dashboard, /requestedTask=\{adventureOpenRequest\}/);
  assert.match(dashboard, /setAdventureOpenRequest\(\{ id: taskId, requestId: Date\.now\(\) \}\)/);
  assert.match(dashboard, /dismissWithAnimation\([\s\S]*?\.hh-goal-proposal-overlay/);
  assert.match(proposalForm, /建立並開始/);
  assert.match(proposalForm, /完成後再由爸媽確認點數/);
  assert.match(overlayStyles, /\.hh-goal-proposal-overlay\.hh-modal-exit[\s\S]*?hh-goal-overlay-exit/);
});

test('adventure detail header is excluded from global header shadows and metadata uses white surfaces', () => {
  const neutralStyles = read('../src/styles/neutral-theme.css');

  assert.match(
    neutralStyles,
    /\.hh-sprite-theme header:not\(\.hh-adventure-detail-header\)/,
  );
  assert.match(
    neutralStyles,
    /\.hh-sprite-theme \.hh-dashboard-screen header:not\(\.hh-adventure-detail-header\)/,
  );
  assert.match(
    neutralStyles,
    /\.hh-adventure-detail-meta\s*>\s*div\s*\{[^}]*background:\s*var\(--hh-neutral-surface\)/,
  );
});

test('mobile adventure completion keeps the submit action below the reflection field', () => {
  const completion = read('../src/features/adventures/components/AdventureCompletionForm.tsx');
  const overlayStyles = read('../src/styles/overlays.css');
  const neutralStyles = read('../src/styles/neutral-theme.css');

  assert.match(completion, /hh-adventure-completion-actions/);
  assert.match(overlayStyles, /--hh-adventure-completion-action-clearance:\s*calc\(24px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(overlayStyles, /@media \(max-width: 760px\)[\s\S]*?\.hh-adventure-completion-actions\s*\{[\s\S]*?position:\s*static/);
  assert.match(overlayStyles, /@media \(max-width: 760px\)[\s\S]*?\.hh-adventure-completion-actions\s*\{[\s\S]*?width:\s*100%/);
  assert.match(overlayStyles, /\.hh-adventure-completion-actions\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(overlayStyles, /\.hh-adventure-complete-button\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(overlayStyles, /\.hh-adventure-completion\s*\{[\s\S]*?padding-bottom:\s*var\(--hh-adventure-completion-action-clearance\)/);
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

test('daily adventure details are grouped by child and collapsed by default', () => {
  const calendar = read('../src/features/adventures/components/ParentAdventureCalendar.tsx');

  assert.match(calendar, /const \[expandedChildIds, setExpandedChildIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(calendar, /aria-expanded=\{isExpanded\}/);
  assert.match(calendar, /aria-controls=\{childTasksId\}/);
  assert.match(calendar, /expandedChildIds\.includes\(childId\) &&/);
  assert.match(calendar, /setExpandedChildIds\(current => current\.includes\(childId\)/);
});

test('calendar task rows expose edit and delete actions only for unfinished tasks', () => {
  const calendar = read('../src/features/adventures/components/ParentAdventureCalendar.tsx');

  assert.match(calendar, /onEditTask\?:/);
  assert.match(calendar, /onDeleteTask\?:/);
  assert.match(calendar, /const canManage = task\.status === 'todo' \|\| task\.status === 'revision_requested'/);
  assert.match(calendar, />編輯<\/button>/);
  assert.match(calendar, />刪除<\/button>/);
});

test('daily schedule management exposes a history-safe stop action', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.match(workspace, /過去紀錄、等待審核、已完成的任務與點數都會保留/);
  assert.match(workspace, />停止<\/button>/);
  assert.match(workspace, /停止後不會再產生新的冒險/);
});

test('daily adventure cards show shared settings before child-specific details expand', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');
  const neutralStyles = read('../src/styles/neutral-theme.css');

  assert.match(workspace, /const \[expandedScheduleNames, setExpandedScheduleNames\] = useState<string\[\]>\(\[\]\)/);
  assert.match(workspace, /每日冒險卡片/);
  assert.match(workspace, /id="daily-schedules-content"/);
  assert.match(workspace, /getSharedScheduleDetails\(scheduleEntries\.map\(entry => entry\.schedule\)\)/);
  assert.match(workspace, /sharedScheduleDetails\.join\(' · '\)/);
  assert.match(workspace, /formatScheduleWeekdays\(schedule\.weekdays\)/);
  assert.match(workspace, /aria-expanded=\{isScheduleExpanded\}/);
  assert.match(workspace, /formatScheduleDetails\(schedule\)/);
  assert.match(workspace, /hh-adventure-schedule-trigger/);
  assert.doesNotMatch(workspace, /rounded-full bg-gray-100/);
  assert.match(neutralStyles, /\.hh-adventure-schedule-trigger\s*\{[^}]*border: 0/);
});

test('daily schedules are grouped by adventure and retain child-specific weekdays', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.match(workspace, /每日冒險卡片/);
  assert.doesNotMatch(workspace, /這裡列出目前會自動產生的每日冒險/);
  assert.match(workspace, /groupActiveAdventureSchedules\(activeSchedules, children\)/);
  assert.match(workspace, /formatScheduleDetails\(schedule\)\.join\(' · '\)/);
  assert.match(workspace, /給 \{childName\}/);
  assert.match(workspace, /scheduleEntries\.map/);
  assert.doesNotMatch(workspace, /expandedScheduleChildIds/);
  assert.doesNotMatch(workspace, /childSchedules/);
});

const makeSchedule = (overrides: Partial<TaskSchedule>): TaskSchedule => ({
  id: 'schedule-default',
  familyId: 'family-1',
  childProfileId: 'child-default',
  name: '預設冒險',
  description: null,
  points: 10,
  icon: 'Star',
  category: 'life_habit',
  durationMinutes: null,
  startTime: null,
  endTime: null,
  weekdays: [1],
  timezone: 'Asia/Taipei',
  requiresTimer: false,
  requiresReviewBeforeNextTask: false,
  activeFrom: '2026-08-01',
  activeUntil: null,
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

test('daily adventure display keeps each child weekdays under the adventure', () => {
  const groups = groupActiveAdventureSchedules(
    [
      makeSchedule({ id: 'brush-lulu', childProfileId: 'lulu', name: '睡前刷牙', weekdays: [1, 4] }),
      makeSchedule({ id: 'brush-en', childProfileId: 'en', name: '睡前刷牙', weekdays: [1, 3, 4] }),
      makeSchedule({ id: 'read-xuan', childProfileId: 'xuan', name: '閱讀 20 分鐘', weekdays: [2, 5] }),
      makeSchedule({ id: 'inactive', childProfileId: 'lulu', name: '不應顯示', isActive: false }),
    ],
    [
      { id: 'lulu', name: 'lulu' },
      { id: 'en', name: '小恩' },
      { id: 'xuan', name: '小宣' },
    ],
  );

  assert.deepEqual(groups.map(group => ({
    name: group.name,
    entries: group.entries.map(entry => ({ childName: entry.childName, weekdays: entry.schedule.weekdays })),
  })), [
    {
      name: '睡前刷牙',
      entries: [
        { childName: 'lulu', weekdays: [1, 4] },
        { childName: '小恩', weekdays: [1, 3, 4] },
      ],
    },
    {
      name: '閱讀 20 分鐘',
      entries: [{ childName: '小宣', weekdays: [2, 5] }],
    },
  ]);
  assert.equal(formatScheduleWeekdays([1, 3, 4]), '每週一、三、四');
  assert.equal(formatScheduleWeekdays([1, 2, 3, 4, 5, 6, 7]), '每天');
  const detailedSchedule = makeSchedule({
    points: 15,
    startTime: '19:00',
    endTime: '20:30',
    requiresTimer: true,
    durationMinutes: 20,
    activeUntil: '2026-08-31',
  });
  assert.deepEqual(formatScheduleCardDetails(detailedSchedule), [
    '時間 19:00–20:30',
    '點數 15 點',
    '計時 20 分鐘',
    '有效期 8/1–8/31',
  ]);
  assert.deepEqual(formatScheduleDetails(detailedSchedule), [
    '每週一',
    '時間 19:00–20:30',
    '點數 15 點',
    '計時 20 分鐘',
    '有效期 8/1–8/31',
  ]);
  assert.deepEqual(getSharedScheduleDetails([detailedSchedule, { ...detailedSchedule, id: 'same-settings' }]), formatScheduleCardDetails(detailedSchedule));
  assert.equal(getSharedScheduleDetails([detailedSchedule, { ...detailedSchedule, id: 'different-points', points: 20 }]), null);
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

test('adventure workspace toolbar uses consistent plain buttons', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.match(workspace, /const toolbarButtonClass =/);
  assert.match(workspace, /aria-pressed=\{view === 'calendar'\} className=\{toolbarButtonClass\(view === 'calendar'\)\}/);
  assert.match(workspace, /aria-pressed=\{view === 'list'\} className=\{toolbarButtonClass\(view === 'list'\)\}/);
  assert.match(workspace, /className=\{toolbarButtonClass\(false\)\} onClick=\{\(\) => openForm\('daily'\)\}/);
  assert.match(workspace, /className=\{toolbarButtonClass\(false\)\} onClick=\{\(\) => openForm\('general'\)\}/);
  assert.match(workspace, /border border-gray-200/);
  assert.match(workspace, /aria-pressed:border-gray-900/);
  assert.match(workspace, /focus-visible:ring-2/);
  assert.doesNotMatch(workspace, /hh-adventure-view-switch flex rounded-xl bg-gray-100 p-1/);
  assert.doesNotMatch(workspace, /bg-white text-gray-900 shadow-sm/);
  assert.doesNotMatch(workspace, /bg-blue-500 px-3 text-sm font-bold text-white/);
});

test('parent workspace manages schedules without manual group archiving', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.match(workspace, /每日冒險卡片/);
  assert.match(workspace, /停止每日冒險/);
  assert.match(workspace, /停止後不會再產生新的冒險/);
  assert.match(workspace, /onUpdateSchedule/);
  assert.doesNotMatch(workspace, /尚有未完成冒險/);
  assert.doesNotMatch(workspace, /onArchiveGroup/);
});

test('completed general adventure groups are archived automatically', () => {
  const workspace = read('../src/features/adventures/components/ParentAdventureWorkspace.tsx');

  assert.doesNotMatch(workspace, /一般冒險集合/);
  assert.doesNotMatch(workspace, /封存集合/);
  assert.doesNotMatch(workspace, /archivedGroups/);
  assert.doesNotMatch(workspace, /onArchiveGroup/);
});

test('schedule editing requires an explicit safe update scope', () => {
  const form = read('../src/features/adventures/components/ParentAdventureScheduleForm.tsx');

  assert.match(form, /today_unfinished/);
  assert.match(form, /from_tomorrow/);
  assert.match(form, /today_and_future/);
  assert.match(form, /不會修改過去紀錄、等待審核、已完成或要求補充/);
  assert.match(form, /正在計時或暫停中/);
  assert.doesNotMatch(form, /等待這次家長確認前，先鎖住下一個冒險/);
});
