import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateChildAccountPayload, loadAppData } from '../src/lib/data-access';
import {
  calculateJoinedDays,
  childProfileRowToViewModel,
  familyRowToViewModel,
  validateChildProfileCreation,
} from '../src/lib/data-contracts';
import type {
  ChildProfileRow,
  FamilyMemberRow,
  FamilyRow,
  ProfileRow,
  RewardRedemptionRow,
  RewardRow,
  TaskRow,
  WishlistItemRow,
} from '../src/types';

const joinedAt = '2026-07-28T16:00:00.000Z';

describe('child profile creation contract', () => {
  it('requires a supported gender and a non-empty character id', () => {
    assert.equal(validateChildProfileCreation({ gender: 'boy', characterId: 'boy-001' }), null);
    assert.match(
      validateChildProfileCreation({ gender: 'other', characterId: 'boy-001' }) ?? '',
      /gender/i,
    );
    assert.match(
      validateChildProfileCreation({ gender: 'girl', characterId: '' }) ?? '',
      /character/i,
    );
  });

  it('builds the account payload with immutable child identity fields', () => {
    assert.deepEqual(buildCreateChildAccountPayload('family-1', {
      name: '小明',
      loginName: 'xiaoming',
      password: 'secret1',
      gender: 'boy',
      characterId: 'boy-001',
    }), {
      action: 'create',
      familyId: 'family-1',
      childName: '小明',
      loginName: 'xiaoming',
      password: 'secret1',
      gender: 'boy',
      characterId: 'boy-001',
    });
    assert.deepEqual(buildCreateChildAccountPayload('family-1', {
      name: ' 小美 ',
      loginName: 'xiaomei',
      password: ' secret2 ',
      gender: 'girl',
      characterId: 'girl-002',
    }), {
      action: 'create',
      familyId: 'family-1',
      childName: ' 小美 ',
      loginName: 'xiaomei',
      password: ' secret2 ',
      gender: 'girl',
      characterId: 'girl-002',
    });
  });
});

describe('child profile view contract', () => {
  it('preserves identity and computes inclusive Taipei calendar days', () => {
    const row: ChildProfileRow = {
      id: 'child-1',
      family_id: 'family-1',
      profile_id: null,
      login_name: null,
      display_name: '小明',
      gender: 'boy',
      character_id: 'boy-001',
      joined_at: joinedAt,
      points_balance: 0,
      created_at: joinedAt,
      updated_at: joinedAt,
    };

    assert.equal(calculateJoinedDays(joinedAt, '2026-07-29T01:00:00.000Z'), 1);
    assert.equal(calculateJoinedDays(joinedAt, '2026-07-30T01:00:00.000Z'), 2);
    assert.equal(childProfileRowToViewModel(row).characterId, 'boy-001');
    assert.equal(childProfileRowToViewModel(row).joinedAt, joinedAt);
  });

  it('carries child theme overrides without requiring them before subscription features exist', () => {
    const row: ChildProfileRow = {
      id: 'child-1', family_id: 'family-1', profile_id: null, login_name: null,
      display_name: '小明', gender: 'boy', character_id: 'boy-001', joined_at: joinedAt,
      accent_color: '#4E8CFF', background_image_mobile_url: 'https://cdn.test/mobile.png',
      background_image_desktop_url: null, points_balance: 0, created_at: joinedAt, updated_at: joinedAt,
    };

    assert.deepEqual(childProfileRowToViewModel(row).theme, {
      accentColor: '#4E8CFF',
      mobileBackgroundImageUrl: 'https://cdn.test/mobile.png',
      desktopBackgroundImageUrl: null,
    });
  });
});

describe('child data loading assembly', () => {
  it('keeps child row filtering, profile fallback, tickets, task fields, and theme stable', async () => {
    const familyRow: FamilyRow = {
      id: 'family-1',
      name: '我的家庭',
      created_by: 'parent-1',
      accent_color: 'amber',
      background_image_mobile_url: null,
      background_image_desktop_url: null,
      created_at: joinedAt,
      updated_at: joinedAt,
    };
    const profileRows: ProfileRow[] = [
      {
        id: 'parent-1',
        display_name: 'Parent',
        avatar_url: null,
        created_at: joinedAt,
        updated_at: joinedAt,
      },
      {
        id: 'profile-child-1',
        display_name: 'Profile Name',
        avatar_url: null,
        created_at: joinedAt,
        updated_at: joinedAt,
      },
    ];
    const familyMembers: FamilyMemberRow[] = [
      { id: 'member-parent', family_id: 'family-1', profile_id: 'parent-1', role: 'parent', created_at: joinedAt },
      { id: 'member-child-1', family_id: 'family-1', profile_id: 'profile-child-1', role: 'child', created_at: joinedAt },
    ];
    const childRows: ChildProfileRow[] = [
      {
        id: 'child-1',
        family_id: 'family-1',
        profile_id: 'profile-child-1',
        login_name: 'profile-name',
        display_name: 'Row Name',
        gender: 'boy',
        character_id: 'boy-001',
        joined_at: joinedAt,
        points_balance: 12,
        accent_color: '#4E8CFF',
        background_image_mobile_url: 'https://cdn.test/mobile.png',
        background_image_desktop_url: null,
        created_at: joinedAt,
        updated_at: joinedAt,
      },
      {
        id: 'child-2',
        family_id: 'family-1',
        profile_id: null,
        login_name: null,
        display_name: 'Fallback Name',
        gender: 'girl',
        character_id: 'girl-002',
        joined_at: joinedAt,
        points_balance: 7,
        created_at: joinedAt,
        updated_at: joinedAt,
      },
    ];
    const taskRows: TaskRow[] = [
      {
        id: 'task-child-1',
        family_id: 'family-1',
        child_profile_id: 'child-1',
        template_id: null,
        name: 'Adventure task',
        points: 5,
        status: 'pending',
        icon: 'Compass',
        duration_minutes: 20,
        is_daily: false,
        due_on: '2026-07-30',
        due_time: '18:00',
        end_time: '19:00',
        requires_review_before_next_task: true,
        category: 'learning',
        origin: 'child_proposed',
        original_name: 'Adventure',
        original_points: 4,
        confirmed_at: joinedAt,
        confirmed_by: 'parent-1',
        submitted_at: joinedAt,
        reviewed_at: null,
        reviewed_by: null,
        approved_points: null,
        child_reflection_text: 'I tried.',
        child_mood: 'curious',
        child_difficulty: 2,
        parent_feedback_text: null,
        parent_correction_text: null,
        feedback_tone: null,
        revision_note: null,
        completed_at: null,
        created_at: joinedAt,
        updated_at: joinedAt,
        description: 'Find three things.',
        adventure_type: 'general',
        adventure_group_id: 'group-1',
        schedule_id: null,
        occurrence_date: '2026-07-30',
        completion_report_mode: 'reflection',
        quick_report: 'smooth',
        requires_timer: true,
      },
      {
        id: 'task-child-2',
        family_id: 'family-1',
        child_profile_id: 'child-2',
        template_id: null,
        name: 'Other child task',
        points: 3,
        status: 'pending',
        icon: 'Star',
        duration_minutes: null,
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
        created_at: joinedAt,
        updated_at: joinedAt,
      },
    ];
    const rewards: RewardRow[] = [
      { id: 'reward-1', family_id: 'family-1', child_profile_id: 'child-1', name: 'Sticker', points: 2, icon: 'Star', sort_order: 1, created_at: joinedAt, updated_at: joinedAt },
      { id: 'reward-2', family_id: 'family-1', child_profile_id: 'child-2', name: 'Snack', points: 3, icon: 'Apple', sort_order: 2, created_at: joinedAt, updated_at: joinedAt },
    ];
    const wishlist: WishlistItemRow[] = [
      { id: 'wishlist-1', family_id: 'family-1', child_profile_id: 'child-1', name: 'New book', created_at: joinedAt, updated_at: joinedAt },
      { id: 'wishlist-2', family_id: 'family-1', child_profile_id: 'child-2', name: 'Toy', created_at: joinedAt, updated_at: joinedAt },
    ];
    const tickets: RewardRedemptionRow[] = [
      { id: 'ticket-1', family_id: 'family-1', child_profile_id: 'child-1', reward_id: 'reward-1', reward_name: 'Sticker', reward_icon: 'Star', points_cost: 2, status: 'cancelled', created_at: joinedAt, fulfilled_at: null },
      { id: 'ticket-2', family_id: 'family-1', child_profile_id: 'child-2', reward_id: 'reward-2', reward_name: 'Snack', reward_icon: 'Apple', points_cost: 3, status: 'pending', created_at: joinedAt, fulfilled_at: null },
    ];
    const client = createLoadAppDataClient({
      profileRows,
      familyMembers,
      familyRow,
      childRows,
      taskRows,
      rewards,
      wishlist,
      tickets,
    });

    const { state, familyId, role } = await loadAppData(client as never, 'parent-1');

    assert.equal(familyId, 'family-1');
    assert.equal(role, 'parent');
    assert.deepEqual(state.children.map((child) => child.id), ['child-1', 'child-2']);

    const childWithProfile = state.children[0];
    assert.equal(childWithProfile.name, 'Profile Name');
    assert.equal(childWithProfile.code, '');
    assert.equal(childWithProfile.tasks.length, 1);
    assert.equal(childWithProfile.tasks[0].id, 'task-child-1');
    assert.equal(childWithProfile.tasks[0].adventureType, 'general');
    assert.equal(childWithProfile.tasks[0].adventureGroupId, 'group-1');
    assert.equal(childWithProfile.tasks[0].description, 'Find three things.');
    assert.equal(childWithProfile.tasks[0].completionReportMode, 'reflection');
    assert.equal(childWithProfile.tasks[0].quickReport, 'smooth');
    assert.equal(childWithProfile.tasks[0].requiresTimer, true);
    assert.deepEqual(childWithProfile.rewards.map((reward) => reward.id), ['reward-1']);
    assert.deepEqual(childWithProfile.wishlist.map((item) => item.id), ['wishlist-1']);
    assert.deepEqual(childWithProfile.tickets.map((ticket) => ticket.id), ['ticket-1']);
    assert.equal(childWithProfile.tickets[0].status, 'pending');
    assert.deepEqual(childWithProfile.theme, {
      accentColor: '#4E8CFF',
      mobileBackgroundImageUrl: 'https://cdn.test/mobile.png',
      desktopBackgroundImageUrl: null,
    });

    const childWithoutProfile = state.children[1];
    assert.equal(childWithoutProfile.name, 'Fallback Name');
    assert.deepEqual(childWithoutProfile.tasks.map((task) => task.id), ['task-child-2']);
    assert.deepEqual(childWithoutProfile.rewards.map((reward) => reward.id), ['reward-2']);
    assert.deepEqual(childWithoutProfile.wishlist.map((item) => item.id), ['wishlist-2']);
    assert.deepEqual(childWithoutProfile.tickets.map((ticket) => ticket.id), ['ticket-2']);
  });
});

describe('family theme data contract', () => {
  it('preserves the amber default and future background slots', () => {
    const row: FamilyRow = {
      id: 'family-1', name: '我的家庭', created_by: 'parent-1',
      accent_color: 'amber', background_image_mobile_url: null,
      background_image_desktop_url: 'https://cdn.test/family-desktop.png',
      created_at: joinedAt, updated_at: joinedAt,
    };

    assert.deepEqual(familyRowToViewModel(row).theme, {
      accentColor: 'amber',
      mobileBackgroundImageUrl: null,
      desktopBackgroundImageUrl: 'https://cdn.test/family-desktop.png',
    });
  });
});

function createLoadAppDataClient({
  profileRows,
  familyMembers,
  familyRow,
  childRows,
  taskRows,
  rewards,
  wishlist,
  tickets,
}: {
  profileRows: ProfileRow[];
  familyMembers: FamilyMemberRow[];
  familyRow: FamilyRow;
  childRows: ChildProfileRow[];
  taskRows: TaskRow[];
  rewards: RewardRow[];
  wishlist: WishlistItemRow[];
  tickets: RewardRedemptionRow[];
}) {
  const tableRows: Record<string, unknown[]> = {
    profiles: profileRows,
    family_members: familyMembers,
    families: [familyRow],
    parent_consents: [],
    child_profiles: childRows,
    task_templates: [],
    tasks: taskRows,
    rewards,
    wishlist_items: wishlist,
    reward_redemptions: tickets,
    point_ledger: [],
    adventure_groups: [],
    task_schedules: [],
    adventure_timer_sessions: [],
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
