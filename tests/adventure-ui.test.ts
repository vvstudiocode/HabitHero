import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getAdventureProgress,
  getAdventureTaskState,
  isLegacyGrowthTask,
  splitAdventureTasks,
} from '../src/features/adventures/adventure-progress';
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

test('adventures use only the adventure board completion entry, not the legacy goal list', () => {
  assert.equal(isLegacyGrowthTask(task('general', 'todo')), false);
  assert.equal(isLegacyGrowthTask(task('daily', 'todo', { adventureType: 'daily', isDaily: true })), false);
  assert.equal(isLegacyGrowthTask(task('legacy', 'todo', { adventureType: undefined })), true);

  const dashboard = read('../src/components/ChildDashboard.tsx');
  assert.match(dashboard, /const legacyGrowthTasks = tasks\.filter\(isLegacyGrowthTask\)/);
  assert.match(dashboard, /const todoTasks = legacyGrowthTasks/);
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
  assert.match(card, /aria-expanded=\{expanded\}/);
  assert.match(card, /aria-controls=/);
  assert.match(card, /onTransitionEnd/);
  assert.match(row, /aria-label=/);
  assert.match(detail, /role="dialog"/);
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
