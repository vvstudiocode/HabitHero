import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);

function readAdventureMigration(): string {
  const migration = readdirSync(migrationDirectory)
    .filter((name) => name.endsWith('_child_adventure_board.sql'))
    .sort()
    .at(-1);

  assert.ok(migration, 'child adventure board migration must exist');
  return readFileSync(new URL(migration, migrationDirectory), 'utf8');
}

function extractFunction(sql: string, functionName: string): string {
  const match = sql.match(new RegExp(
    `create (?:or replace )?function public\\.${functionName}\\b[^]*?\\$\\$;`,
    'i',
  ));
  assert.ok(match, `${functionName} must exist`);
  return match[0];
}

test('adventure migration models groups, schedules, occurrences, reports, and server timers', () => {
  const sql = readAdventureMigration();

  assert.match(sql, /create table public\.adventure_groups/i);
  assert.match(sql, /create table public\.task_schedules/i);
  assert.match(sql, /create table public\.adventure_timer_sessions/i);
  assert.match(sql, /add column adventure_type text/i);
  assert.match(sql, /add column completion_report_mode text/i);
  assert.match(sql, /add column occurrence_date date/i);
  assert.match(
    sql,
    /unique index tasks_daily_occurrence_unique[^]*?\(schedule_id, child_profile_id, occurrence_date\)[^]*?where schedule_id is not null/i,
  );
  assert.match(sql, /where status = 'running'/i);
});

test('adventure RPCs enforce occurrences, completion, review, scheduling, groups, and timers', () => {
  const sql = readAdventureMigration();

  for (const functionName of [
    'create_adventure_schedule',
    'update_adventure_schedule',
    'disable_adventure_schedule',
    'ensure_daily_adventure_occurrences',
    'create_general_adventure',
    'update_general_adventure_title',
    'archive_adventure_group',
    'start_adventure_timer',
    'pause_adventure_timer',
    'resume_adventure_timer',
    'submit_adventure_completion',
    'review_adventure_completion',
    'batch_review_daily_adventures',
  ]) {
    assert.match(sql, new RegExp(`create (?:or replace )?function public\\.${functionName}\\b`, 'i'));
  }

  assert.match(
    sql,
    /on conflict \(schedule_id, child_profile_id, occurrence_date\)\s+where schedule_id is not null\s+do nothing/i,
  );
  assert.match(sql, /completion_report_mode = 'quick'/i);
  assert.match(sql, /completion_report_mode = 'reflection'/i);
  assert.match(sql, /requires_timer/i);
  assert.match(sql, /another task is waiting for parent review/i);
  assert.match(sql, /entry_type,\s*points_delta/i);
  assert.match(sql, /'proposed', normalized_icon[^]*?'child_proposed'/i);
  assert.match(sql, /if points_to_award > 0 then\s+insert into public\.point_ledger/i);
  assert.match(sql, /if task_row\.status = 'completed' and approved then\s+return task_row/i);
});

test('schedule updates scope changes without rewriting history or submitted work', () => {
  const sql = readAdventureMigration();
  const updateSchedule = extractFunction(sql, 'update_adventure_schedule');
  const disableSchedule = extractFunction(sql, 'disable_adventure_schedule');

  assert.equal(
    [...sql.matchAll(/create (?:or replace )?function public\.update_adventure_schedule\b/gi)].length,
    1,
    'update_adventure_schedule must not be overloaded',
  );
  assert.match(updateSchedule, /update_scope text default 'from_tomorrow'/i);
  assert.match(updateSchedule, /update_scope not in \('today_unfinished', 'from_tomorrow', 'today_and_future'\)/i);
  assert.match(updateSchedule, /task\.occurrence_date >= scoped_from_date/i);
  assert.match(updateSchedule, /task\.status = 'todo'/i);
  assert.match(updateSchedule, /timer\.status in \('running', 'paused'\)/i);
  assert.match(updateSchedule, /delete from public\.tasks task[\s\S]*task\.status = 'todo'[\s\S]*task\.occurrence_date >= scoped_from_date/i);
  assert.match(updateSchedule, /if update_scope = 'from_tomorrow' then[\s\S]*insert into public\.task_schedules/i);
  assert.match(updateSchedule, /set is_active = false/i);
  assert.match(updateSchedule, /elsif update_scope = 'today_and_future' then[\s\S]*update public\.task_schedules/i);
  assert.match(updateSchedule, /update_scope <> 'today_unfinished'[\s\S]*task\.occurrence_date = taipei_today/i);
  assert.match(disableSchedule, /set is_active = false/i);
  assert.doesNotMatch(disableSchedule, /delete from public\.tasks/i);
  assert.match(
    sql,
    /grant execute on function public\.update_adventure_schedule\(\s*uuid, text, text, integer, text, text, integer, time, time,\s*smallint\[\], text, boolean, boolean, date, date, text\s*\) to authenticated/i,
  );
});

test('group archiving rejects unfinished adventures instead of silently losing them', () => {
  const sql = readAdventureMigration();

  assert.match(sql, /task\.status <> 'completed'/i);
  assert.match(sql, /unfinished adventures must be moved or cancelled before archiving/i);
});

test('adventure tables and definer RPCs have explicit authorization boundaries', () => {
  const sql = readAdventureMigration();

  for (const tableName of ['adventure_groups', 'task_schedules', 'adventure_timer_sessions']) {
    assert.match(sql, new RegExp(`alter table public\\.${tableName} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on table public\\.${tableName} from public, anon`, 'i'));
  }
  for (const policyName of ['adventure_groups_select', 'task_schedules_select']) {
    const policy = sql.match(new RegExp(
      `create policy ${policyName}\\b[^;]+;`,
      'i',
    ))?.[0] ?? '';
    assert.match(policy, /private\.is_family_parent\(family_id\)/i);
    assert.match(policy, /private\.is_child_owner\(family_id, child_profile_id\)/i);
    assert.doesNotMatch(policy, /private\.is_family_member\(family_id\)/i);
  }

  const definerFunctions = [...sql.matchAll(
    /create (?:or replace )?function public\.([a-z_]+)\([^]*?\$\$;/gi,
  )];
  assert.ok(definerFunctions.length >= 10);

  for (const [, functionName] of definerFunctions) {
    const definition = definerFunctions.find((match) => match[1] === functionName)?.[0] ?? '';
    assert.match(definition, /security definer/i, `${functionName} must be SECURITY DEFINER`);
    assert.match(definition, /set search_path = pg_catalog, public/i, `${functionName} needs a fixed search_path`);
    assert.match(definition, /auth\.uid\(\)/i, `${functionName} must bind authorization to auth.uid()`);
    assert.match(sql, new RegExp(`revoke all on function public\\.${functionName}\\([^;]+\\) from public, anon`, 'i'));
    assert.match(sql, new RegExp(`grant execute on function public\\.${functionName}\\([^;]+\\) to authenticated`, 'i'));
  }
});

test('review gates are retired for tasks, templates, and schedules', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260731153000_remove_review_gates.sql', import.meta.url),
    'utf8',
  );

  assert.match(sql, /drop trigger if exists tasks_review_gate_guard/i);
  assert.match(sql, /update public\.tasks[\s\S]*requires_review_before_next_task = false/i);
  assert.match(sql, /update public\.task_templates[\s\S]*requires_review_before_next_task = false/i);
  assert.match(sql, /update public\.task_schedules[\s\S]*requires_review_before_next_task = false/i);
  assert.match(sql, /check \(requires_review_before_next_task = false\)/i);
});
