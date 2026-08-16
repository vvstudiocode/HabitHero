import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canAbandonChildAdventure,
  splitAdventureTasks,
} from '../src/features/adventures/adventure-progress';
import { createDataRepository } from '../src/lib/data-access';
import type { AdventureTask } from '../src/features/adventures/types';

const migrationUrl = new URL('../supabase/migrations/20260816044557_allow_parent_child_mode_abandonment.sql', import.meta.url);
const schemaMigrationUrl = new URL('../supabase/migrations/20260816043106_child_abandon_general_adventures.sql', import.meta.url);

const task = (overrides: Partial<AdventureTask> = {}): AdventureTask => ({
  id: 'task-1',
  name: '整理書包',
  points: 10,
  status: 'proposed',
  icon: 'Star',
  isDaily: false,
  adventureType: 'general',
  origin: 'child_proposed',
  timerIsRunning: false,
  timerRemainingMs: null,
  timerEndTime: null,
  submittedAt: null,
  ...overrides,
});

test('only an unsubmitted child-proposed general adventure can be abandoned', () => {
  assert.equal(canAbandonChildAdventure(task()), true);
  assert.equal(canAbandonChildAdventure(task({ status: 'proposal_revision_requested' })), true);
  assert.equal(canAbandonChildAdventure(task({ status: 'todo', confirmedAt: '2026-08-16T01:00:00.000Z' })), true);
  assert.equal(canAbandonChildAdventure(task({ origin: 'parent_assigned' })), false);
  assert.equal(canAbandonChildAdventure(task({ adventureType: 'daily' })), false);
  assert.equal(canAbandonChildAdventure(task({ status: 'revision_requested', submittedAt: '2026-08-16T02:00:00.000Z' })), false);
  assert.equal(canAbandonChildAdventure(task({ status: 'pending', submittedAt: '2026-08-16T02:00:00.000Z' })), false);
  assert.equal(canAbandonChildAdventure(task({ status: 'completed' })), false);
  assert.equal(canAbandonChildAdventure(task({ status: 'todo', timerIsRunning: true })), false);
  assert.equal(canAbandonChildAdventure(task({ status: 'todo', timerRemainingMs: 30_000 })), false);
});

test('cancelled adventures no longer appear in the child active board', () => {
  const result = splitAdventureTasks([
    task({ id: 'active' }),
    task({ id: 'cancelled', status: 'cancelled' }),
  ], '2026-08-16');

  assert.deepEqual(result.general.map((item) => item.id), ['active']);
});

test('repository uses the child-only abandonment RPC', async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  };
  const repository = createDataRepository(client as never);

  await repository.abandonChildAdventure('task-1');

  assert.deepEqual(calls, [{
    name: 'abandon_child_adventure',
    args: { target_task_id: 'task-1' },
  }]);
});

test('abandonment migration preserves history and supports parent child-mode authorization', () => {
  const sql = readFileSync(migrationUrl, 'utf8');
  const schemaSql = readFileSync(schemaMigrationUrl, 'utf8');

  assert.match(schemaSql, /status in \('proposed', 'proposal_revision_requested', 'todo', 'pending', 'revision_requested', 'completed', 'cancelled'\)/i);
  assert.match(sql, /create or replace function public\.abandon_child_adventure\(target_task_id uuid\)/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = pg_catalog, public/i);
  assert.match(sql, /private\.is_child_owner\(task_row\.family_id, task_row\.child_profile_id\)[\s\S]*?or private\.is_family_parent\(task_row\.family_id\)/i);
  assert.match(sql, /task_row\.origin = 'child_proposed'/i);
  assert.match(sql, /task_row\.adventure_type = 'general'/i);
  assert.match(sql, /task_row\.status in \('proposed', 'proposal_revision_requested', 'todo'\)/i);
  assert.match(sql, /task_row\.submitted_at is null/i);
  assert.match(sql, /set status = 'cancelled'/i);
  assert.match(sql, /cancelled_by = 'child'/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.tasks/i);
  assert.match(sql, /grant execute on function public\.abandon_child_adventure\(uuid\) to authenticated/i);
});

test('child detail exposes a confirmation action without making it available to submitted work', () => {
  const source = readFileSync(new URL('../src/features/adventures/components/AdventureTaskDetail.tsx', import.meta.url), 'utf8');
  assert.match(source, /放棄這個冒險/);
  assert.match(source, /放棄後不會得到點數，家長仍看得到紀錄/);
  assert.match(source, /onAbandon/);
  assert.match(source, /canAbandonChildAdventure/);

  const confirmStart = source.indexOf('const confirmAbandon');
  const confirmEnd = source.indexOf('\n\n  useEffect', confirmStart);
  const confirmHandler = source.slice(confirmStart, confirmEnd);
  assert.ok(confirmHandler.indexOf('await onAbandon(task)') < confirmHandler.indexOf('requestClose()'));
});

test('parent calendar keeps abandoned adventures visible with the child-abandoned label', () => {
  const source = readFileSync(new URL('../src/features/adventures/components/ParentAdventureCalendar.tsx', import.meta.url), 'utf8');
  assert.match(source, /cancelled: \{ label: '孩子放棄'/);
});
