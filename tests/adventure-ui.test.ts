import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canToggleAdventureTimer,
  getAdventureProgress,
  getAdventureTaskCountdown,
  getAdventureTimerState,
  getAdventureTaskState,
  formatAdventureTaskWindow,
  hasStartedAdventureTimer,
  isLegacyGrowthTask,
  sortAdventureTasksByStartTime,
  splitAdventureTasks,
} from '../src/features/adventures/adventure-progress';
import { getTodayAdventureSummary } from '../src/features/adventures/today-adventure-summary';
import {
  createAdventureIdempotencyKey,
  getCompletionValidationError,
  normalizeCompletionReportMode,
} from '../src/features/adventures/adventure-completion';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const task = (
  id: string,
  status: 'proposed' | 'proposal_revision_requested' | 'todo' | 'pending' | 'revision_requested' | 'completed',
  overrides: Record<string, unknown> = {},
) => ({
  id,
  name: id,
  points: 5,
  icon: 'Star',
  status,
  isDaily: false,
  adventureType: 'general' as const,
  duration: null,
  requiresTimer: false,
  timerIsRunning: false,
  timerRemainingMs: null,
  ...overrides,
});

test('adventure progress counts submitted and approved tasks but removes returned work', () => {
  const progress = getAdventureProgress([
    task('todo', 'todo'),
    task('submitted', 'pending'),
    task('returned', 'revision_requested'),
    task('approved', 'completed'),
  ]);

  assert.deepEqual(progress, { completed: 2, total: 4 });
  assert.equal(getAdventureTaskState(task('submitted', 'pending')), 'submitted');
  assert.equal(getAdventureTaskState(task('returned', 'revision_requested')), 'revision');
});

test('formats adventure task time windows for compact task summaries', () => {
  assert.equal(formatAdventureTaskWindow({ dueTime: '21:00:00', endTime: '22:00:00' }), '21:00–22:00');
  assert.equal(formatAdventureTaskWindow({ dueTime: '21:00:00', endTime: null }), '21:00 起');
  assert.equal(formatAdventureTaskWindow({ dueTime: null, endTime: null }), '隨時');
});

test('a timed adventure cannot be completed before its timer is started', () => {
  const freshTimedTask = task('fresh-timed', 'todo', {
    duration: 30,
    requiresTimer: false,
    timerIsRunning: false,
    timerRemainingMs: null,
  });
  const pausedTimedTask = { ...freshTimedTask, timerRemainingMs: 900_000 };
  const completedTimedTask = { ...freshTimedTask, timerRemainingMs: 0 };
  const untimedTask = task('untimed', 'todo', {
    duration: null,
    requiresTimer: false,
    timerIsRunning: false,
    timerRemainingMs: null,
  });

  assert.deepEqual(getAdventureTimerState(freshTimedTask, 1_800), {
    hasTimer: true,
    started: false,
    complete: false,
  });
  assert.deepEqual(getAdventureTimerState(pausedTimedTask, 900), {
    hasTimer: true,
    started: true,
    complete: false,
  });
  assert.deepEqual(getAdventureTimerState(completedTimedTask, 0), {
    hasTimer: true,
    started: true,
    complete: true,
  });
  assert.deepEqual(getAdventureTimerState(untimedTask, 0), {
    hasTimer: false,
    started: false,
    complete: true,
  });
});

test('a started timed adventure stays actionable after its start window closes', () => {
  const runningTask = task('running-after-window', 'todo', {
    duration: 30,
    requiresTimer: true,
    timerIsRunning: true,
    timerEndTime: 1_000,
    timerRemainingMs: null,
  });
  const pausedTask = { ...runningTask, timerIsRunning: false, timerEndTime: null, timerRemainingMs: 30_000 };
  const freshTask = { ...runningTask, timerIsRunning: false, timerEndTime: null, timerRemainingMs: null };

  assert.equal(hasStartedAdventureTimer(runningTask), true);
  assert.equal(hasStartedAdventureTimer(pausedTask), true);
  assert.equal(hasStartedAdventureTimer(freshTask), false);
  assert.equal(canToggleAdventureTimer(runningTask, 0, false), true, 'a running timer can still be stopped after endTime');
  assert.equal(canToggleAdventureTimer(pausedTask, 10, false), true, 'a paused timer can resume after endTime because it was already started');
  assert.equal(canToggleAdventureTimer(freshTask, 1_800, false), false);
});

test('shows a compact countdown only while an adventure timer is running', () => {
  const runningTask = task('running', 'todo', {
    timerIsRunning: true,
    timerEndTime: 493_000,
    timerRemainingMs: null,
  });

  assert.equal(getAdventureTaskCountdown(runningTask, 0), '剩餘 8:13');
  assert.equal(getAdventureTaskCountdown({ ...runningTask, timerEndTime: 0 }, 0), '剩餘 0:00');
  assert.equal(getAdventureTaskCountdown({ ...runningTask, timerIsRunning: false, timerRemainingMs: 493_000, timerEndTime: null }, 0), null);
  assert.equal(getAdventureTaskCountdown({ ...runningTask, timerIsRunning: false, timerRemainingMs: null, timerEndTime: null }, 0), null);
});

test('sorts adventure tasks from the earliest start time and keeps ties stable', () => {
  const tasks = [
    task('late', 'todo', { dueTime: '18:00', adventureType: 'daily', occurrenceDate: '2026-08-03' }),
    task('untimed', 'todo', { dueTime: null, adventureType: 'daily', occurrenceDate: '2026-08-03' }),
    task('early', 'todo', { dueTime: '08:00', adventureType: 'daily', occurrenceDate: '2026-08-03' }),
    task('tie-a', 'todo', { dueTime: '08:00', adventureType: 'daily', occurrenceDate: '2026-08-03' }),
    task('tie-b', 'todo', { dueTime: '08:00', adventureType: 'daily', occurrenceDate: '2026-08-03' }),
  ];

  assert.deepEqual(sortAdventureTasksByStartTime(tasks).map(({ id }) => id), ['early', 'tie-a', 'tie-b', 'late', 'untimed']);
  assert.deepEqual(splitAdventureTasks(tasks, '2026-08-03').daily.map(({ id }) => id), ['early', 'tie-a', 'tie-b', 'late', 'untimed']);
});

test('an offline completion stays checked but clearly reports that points are not awarded yet', () => {
  const offlineTask = task('offline', 'todo', { pendingSync: true });

  assert.deepEqual(getAdventureProgress([offlineTask]), { completed: 1, total: 1 });
  assert.equal(getAdventureTaskState(offlineTask), 'syncing');

  const board = read('../src/features/adventures/components/ChildAdventureBoard.tsx');
  const progress = read('../src/features/adventures/adventure-progress.ts');
  assert.match(board, /完成紀錄等待同步，點數尚未發放/);
  assert.match(progress, /等待同步，點數尚未發放/);
});

test('daily and general adventures are split without carrying a dated daily occurrence forward', () => {
  const groups = splitAdventureTasks(
    [
      task('legacy-daily', 'todo', { isDaily: true, adventureType: undefined }),
      task('today', 'todo', { adventureType: 'daily', occurrenceDate: '2026-07-31' }),
      task('yesterday', 'todo', { adventureType: 'daily', occurrenceDate: '2026-07-30' }),
      task('general', 'todo'),
    ],
    '2026-07-31',
  );

  assert.deepEqual(groups.daily.map(({ id }) => id), ['legacy-daily', 'today']);
  assert.deepEqual(groups.general.map(({ id }) => id), ['general']);
});

test('submitted and approved adventures leave the child dashboard task list', () => {
  const groups = splitAdventureTasks([
    task('available', 'todo'),
    task('submitted', 'pending'),
    task('approved', 'completed'),
  ], '2026-07-31');

  assert.deepEqual(groups.general.map(({ id }) => id), ['available']);
});

test('today adventure summary keeps daily progress and groups completed general adventures by Taipei date', () => {
  const summary = getTodayAdventureSummary([
    task('daily-done', 'completed', {
      adventureType: 'daily',
      occurrenceDate: '2026-08-03',
      completedAt: '2026-08-03T12:00:00.000Z',
    }),
    task('general-active', 'todo', { adventureType: 'general' }),
    task('general-done-today', 'completed', {
      adventureType: 'general',
      completedAt: '2026-08-03T12:00:00.000Z',
    }),
    task('general-done-yesterday', 'completed', {
      adventureType: 'general',
      completedAt: '2026-08-02T12:00:00.000Z',
    }),
  ], '2026-08-03');

  assert.deepEqual(summary.daily.map(({ id }) => id), ['daily-done']);
  assert.deepEqual(getAdventureProgress(summary.daily), { completed: 1, total: 1 });
  assert.deepEqual(summary.generalActive.map(({ id }) => id), ['general-active']);
  assert.deepEqual(summary.generalCompletedByDate.map(({ dateKey, tasks: grouped }) => ({
    dateKey,
    ids: grouped.map(({ id }) => id),
  })), [
    { dateKey: '2026-08-03', ids: ['general-done-today'] },
    { dateKey: '2026-08-02', ids: ['general-done-yesterday'] },
  ]);
  assert.deepEqual(getTodayAdventureSummary([
    task('daily-done', 'completed', { adventureType: 'daily', occurrenceDate: '2026-08-03' }),
  ], '2026-08-04').daily, []);
});

test('today adventure summary sorts daily and active general tasks by start time', () => {
  const summary = getTodayAdventureSummary([
    task('daily-late', 'todo', { adventureType: 'daily', occurrenceDate: '2026-08-03', dueTime: '18:00' }),
    task('daily-early', 'todo', { adventureType: 'daily', occurrenceDate: '2026-08-03', dueTime: '08:00' }),
    task('general-late', 'todo', { adventureType: 'general', dueTime: '20:00' }),
    task('general-early', 'todo', { adventureType: 'general', dueTime: '10:00' }),
  ], '2026-08-03');

  assert.deepEqual(summary.daily.map(({ id }) => id), ['daily-early', 'daily-late']);
  assert.deepEqual(summary.generalActive.map(({ id }) => id), ['general-early', 'general-late']);
});

test('today adventure and wishlist sections omit redundant explanatory copy', () => {
  const summary = read('../src/features/adventures/components/TodayAdventureSummary.tsx');
  const dashboard = read('../src/components/ChildDashboard.tsx');

  assert.doesNotMatch(summary, /今天完成後會保留到隔天，再更新新的每日冒險/);
  assert.doesNotMatch(summary, /進行中的冒險與已完成的日期紀錄/);
  assert.doesNotMatch(dashboard, /送出後等爸媽核准，就會變成可以兌換的獎勵/);
});

test('adventures use only the adventure board completion entry, not the legacy goal list', () => {
  assert.equal(isLegacyGrowthTask(task('general', 'todo')), false);
  assert.equal(isLegacyGrowthTask(task('daily', 'todo', { adventureType: 'daily', isDaily: true })), false);
  assert.equal(isLegacyGrowthTask(task('legacy', 'todo', { adventureType: undefined })), true);

  const dashboard = read('../src/components/ChildDashboard.tsx');
  assert.match(dashboard, /const adventureTasks = tasks\.filter\(\(task\) => !isLegacyGrowthTask\(task\)\)/);
  assert.match(dashboard, /getTodayAdventureSummary/);
  assert.match(dashboard, /<TodayAdventureSummary/);
  assert.doesNotMatch(dashboard, /<GoalCard/);
});

test('daily adventures need no report while general adventures can never skip reporting', () => {
  assert.equal(normalizeCompletionReportMode('daily', 'reflection'), 'none');
  assert.equal(normalizeCompletionReportMode('general', 'none'), 'quick');
  assert.equal(getCompletionValidationError('daily', 'none', {}), null);
  assert.equal(getCompletionValidationError('general', 'quick', {}), '請選擇這次冒險的感受。');
  assert.equal(getCompletionValidationError('general', 'quick', { quickReport: 'smooth' }), null);
  assert.equal(
    getCompletionValidationError('general', 'reflection', { reflection: '   ', mood: 'happy', difficulty: 2 }),
    '請寫下想告訴爸媽的心得。',
  );
});

test('completion idempotency keys are database-safe UUIDs without a task prefix', () => {
  const key = createAdventureIdempotencyKey('task-with-non-uuid-id');

  assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.doesNotMatch(key, /task-with-non-uuid-id/);
});

test('child adventure UI is composed from reusable accessible components', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const board = read('../src/features/adventures/components/ChildAdventureBoard.tsx');
  const summary = read('../src/features/adventures/components/TodayAdventureSummary.tsx');
  const card = read('../src/features/adventures/components/AdventureCard.tsx');
  const row = read('../src/features/adventures/components/AdventureTaskRow.tsx');
  const detail = read('../src/features/adventures/components/AdventureTaskDetail.tsx');
  const completion = read('../src/features/adventures/components/AdventureCompletionForm.tsx');
  const proposal = read('../src/features/growth/components/GoalProposalForm.tsx');
  const characterStyles = read('../src/styles/character.css');
  const overlayStyles = read('../src/styles/overlays.css');
  const tokens = read('../src/styles/tokens.css');

  assert.match(dashboard, /<ChildAdventureBoard/);
  assert.match(board, /openCard/);
  assert.match(card, /now: number/);
  assert.match(card, /now=\{now\}/);
  assert.match(summary, /formatAdventureTaskWindow\(task\)/);
  assert.match(summary, /state === 'available'/);
  assert.match(summary, /text-sm font-bold text-gray-500/);
  assert.match(card, /aria-expanded=\{expanded\}/);
  assert.match(card, /aria-controls=/);
  assert.match(card, /onTransitionEnd/);
  assert.match(row, /aria-label=/);
  assert.match(row, /getAdventureTaskCountdown/);
  assert.match(row, /hh-adventure-task-countdown/);
  assert.match(detail, /role="dialog"/);
  assert.match(detail, /BellOff/);
  assert.match(detail, /停止提醒/);
  assert.match(detail, /可開始時間/);
  assert.match(completion, /completionReportMode/);
  assert.match(tokens, /--hh-adventure-enter-duration:\s*220ms/);
  assert.match(tokens, /--hh-adventure-exit-duration:\s*180ms/);
  assert.match(characterStyles, /min-height:\s*44px/);
  assert.match(characterStyles, /prefers-reduced-motion:\s*reduce/);
  assert.match(overlayStyles, /\.hh-adventure-detail-overlay/);
  assert.match(overlayStyles, /hh-adventure-detail-fade-in[^;]*backwards/);
  assert.match(overlayStyles, /\.hh-adventure-detail-overlay\.is-leaving\s*\{[^}]*animation:\s*none/s);
  assert.match(proposal, /建立並開始/);
  assert.match(proposal, /完成後再由爸媽確認點數/);
  assert.doesNotMatch(proposal, /送給爸媽確認/);
  assert.doesNotMatch(dashboard + board, /再完成一個冒險，房間就會有變化/);
});
