import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadAppData } from '../src/lib/data-access';
import type {
  ChildProfileRow,
  FamilyMemberRow,
  FamilyRow,
  ProfileRow,
  TaskRow,
  TaskTimerSessionRow,
} from '../src/types';

const now = '2026-08-20T00:00:00.000Z';

describe('repository app-data hydration', () => {
  it('initializes the default app state shape for a parent family with no children', async () => {
    const client = createHydrationClient({
      profiles: [profileRow('parent-1', 'Parent One')],
      familyMembers: [familyMemberRow('member-1', 'family-1', 'parent-1', 'parent')],
      families: [familyRow('family-1')],
      children: [],
      tasks: [],
      timerSessions: [],
    });

    const { state, familyId, role } = await loadAppData(client as never, 'parent-1');

    assert.equal(familyId, 'family-1');
    assert.equal(role, 'parent');
    assert.deepEqual(state.children, []);
    assert.deepEqual(state.taskTemplates, []);
    assert.deepEqual(state.ledger, []);
    assert.deepEqual(state.adventureGroups, []);
    assert.deepEqual(state.taskSchedules, []);
    assert.deepEqual(state.timerSessions, []);
    assert.deepEqual(state.gameDataByChildId, {});
    assert.equal(state.parentActiveChildId, null);
    assert.equal(state.childLoggedInId, null);
    assert.deepEqual(state.familyTheme, {
      accentColor: 'amber',
      mobileBackgroundImageUrl: null,
      desktopBackgroundImageUrl: null,
    });
  });

  it('hydrates server timer sessions onto only the matching child task', async () => {
    const client = createHydrationClient({
      profiles: [
        profileRow('parent-1', 'Parent One'),
        profileRow('child-profile-1', 'Child One'),
      ],
      familyMembers: [
        familyMemberRow('member-1', 'family-1', 'parent-1', 'parent'),
        familyMemberRow('member-2', 'family-1', 'child-profile-1', 'child'),
      ],
      families: [familyRow('family-1')],
      children: [childRow('child-1', 'family-1', 'child-profile-1')],
      tasks: [
        taskRow('task-with-timer', 'family-1', 'child-1', { duration: 2 }),
        taskRow('task-without-timer', 'family-1', 'child-1', { duration: 2 }),
      ],
      timerSessions: [timerRow('timer-1', 'family-1', 'child-1', 'task-with-timer')],
    });

    const { state } = await loadAppData(client as never, 'parent-1');
    const child = state.children[0];
    const taskWithTimer = child.tasks.find((task) => task.id === 'task-with-timer');
    const taskWithoutTimer = child.tasks.find((task) => task.id === 'task-without-timer');

    assert.equal(taskWithTimer?.timerIsRunning, false);
    assert.equal(taskWithTimer?.timerRemainingMs, 90_000);
    assert.equal(taskWithTimer?.timerEndTime, null);
    assert.equal(taskWithoutTimer?.timerIsRunning, false);
    assert.equal(taskWithoutTimer?.timerRemainingMs, null);
    assert.equal(taskWithoutTimer?.timerEndTime, null);
  });
});

function createHydrationClient({
  profiles,
  familyMembers,
  families,
  children,
  tasks,
  timerSessions,
}: {
  profiles: ProfileRow[];
  familyMembers: FamilyMemberRow[];
  families: FamilyRow[];
  children: ChildProfileRow[];
  tasks: TaskRow[];
  timerSessions: TaskTimerSessionRow[];
}) {
  const tableRows: Record<string, unknown[]> = {
    profiles,
    family_members: familyMembers,
    families,
    parent_consents: [],
    child_profiles: children,
    task_templates: [],
    tasks,
    rewards: [],
    wishlist_items: [],
    reward_redemptions: [],
    point_ledger: [],
    adventure_groups: [],
    task_schedules: [],
    adventure_timer_sessions: timerSessions,
    game_catalog_items: [],
    family_game_item_prices: [],
    child_game_wallets: [],
    child_inventory_items: [],
    child_game_loadouts: [],
    child_world_states: [],
    child_world_entities: [],
  };
  return {
    from(table: string) {
      return new QueryStub(tableRows[table] ?? []);
    },
    rpc: async () => ({ data: null, error: null }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  };
}

function profileRow(id: string, displayName: string): ProfileRow {
  return { id, display_name: displayName, avatar_url: null, created_at: now, updated_at: now };
}

function familyMemberRow(
  id: string,
  familyId: string,
  profileId: string,
  role: FamilyMemberRow['role'],
): FamilyMemberRow {
  return { id, family_id: familyId, profile_id: profileId, role, created_at: now };
}

function familyRow(id: string): FamilyRow {
  return {
    id,
    name: 'Family',
    created_by: 'parent-1',
    created_at: now,
    updated_at: now,
    accent_color: 'amber',
    background_image_mobile_url: null,
    background_image_desktop_url: null,
  };
}

function childRow(id: string, familyId: string, profileId: string): ChildProfileRow {
  return {
    id,
    family_id: familyId,
    profile_id: profileId,
    display_name: 'Child One',
    gender: 'girl',
    character_id: 'girl-001',
    joined_at: now,
    points_balance: 0,
    login_name: null,
    accent_color: null,
    background_image_mobile_url: null,
    background_image_desktop_url: null,
  };
}

function taskRow(
  id: string,
  familyId: string,
  childId: string,
  { duration }: { duration: number },
): TaskRow {
  return {
    id,
    family_id: familyId,
    child_profile_id: childId,
    template_id: null,
    name: id,
    points: 5,
    status: 'todo',
    icon: 'Star',
    duration_minutes: duration,
    is_daily: false,
    due_on: null,
    due_time: null,
    end_time: null,
    category: 'life_habit',
    origin: 'parent_assigned',
    original_name: null,
    original_points: null,
    confirmed_at: null,
    confirmed_by: null,
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    approved_points: null,
    child_reflection_text: null,
    child_mood: null,
    child_difficulty: null,
    parent_feedback_text: null,
    parent_correction_text: null,
    feedback_tone: null,
    revision_note: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
}

function timerRow(
  id: string,
  familyId: string,
  childId: string,
  taskId: string,
): TaskTimerSessionRow {
  return {
    id,
    family_id: familyId,
    child_profile_id: childId,
    task_id: taskId,
    status: 'paused',
    accumulated_seconds: 30,
    started_at: now,
    last_resumed_at: null,
    paused_at: now,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
}

class QueryStub implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private rows: unknown[];

  constructor(rows: unknown[]) {
    this.rows = [...rows];
  }

  select() { return this; }
  order() { return this; }
  limit(count: number) {
    this.rows = this.rows.slice(0, count);
    return this;
  }
  range(from: number, to: number) {
    this.rows = this.rows.slice(from, to + 1);
    return this;
  }
  eq(column: string, value: unknown) {
    this.rows = this.rows.filter((row) => (row as Record<string, unknown>)[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.rows = this.rows.filter((row) => (row as Record<string, unknown>)[column] !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.rows = this.rows.filter((row) => values.includes((row as Record<string, unknown>)[column]));
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }
  single() {
    return Promise.resolve({ data: this.rows[0], error: null });
  }
  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected);
  }
}
