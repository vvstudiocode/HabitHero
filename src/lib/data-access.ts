import type { SupabaseClient } from '@supabase/supabase-js';
import {
  childProfileRowToViewModel,
  familyMemberRowToViewModel,
  profileRowToViewModel,
  redemptionRowToViewModel,
  pointLedgerRowToViewModel,
  taskRowToViewModel,
} from './data-contracts';
import type {
  ChildProfileRow, FamilyMemberRow, FamilyRow, ProfileRow, RewardRow,
  RewardRedemptionRow, TaskRow, TaskTemplateRow, WishlistItemRow, PointLedgerRow,
} from '../types';
import type { AppState, Child, Reward, Task, TaskStatus, TaskTemplate } from '../types';

export interface LoadedAppData {
  state: AppState;
  familyId: string;
  role: 'parent' | 'child';
}

const emptyState = (): AppState => ({
  parentPin: null,
  children: [],
  parentActiveChildId: null,
  childLoggedInId: null,
  taskTemplates: [],
  ledger: [],
  lastResetDate: null,
});

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}

function childFromRows(
  child: ChildProfileRow,
  profile: ProfileRow,
  tasks: TaskRow[],
  rewards: RewardRow[],
  wishlist: WishlistItemRow[],
  tickets: RewardRedemptionRow[],
): Child {
  return {
    ...childProfileRowToViewModel(child, profileRowToViewModel(profile)),
    code: '',
    tasks: tasks.filter((row) => row.child_profile_id === child.id).map(taskRowToViewModel),
    rewards: rewards.filter((row) => row.child_profile_id === child.id).map((row) => ({ id: row.id, name: row.name, points: row.points, icon: row.icon })),
    wishlist: wishlist.filter((row) => row.child_profile_id === child.id).map((row) => ({ id: row.id, name: row.name })),
    tickets: tickets.filter((row) => row.child_profile_id === child.id).map((row) => ({ ...redemptionRowToViewModel(row), status: row.status === 'cancelled' ? 'pending' : row.status })),
  };
}

export async function loadAppData(client: SupabaseClient, userId: string): Promise<LoadedAppData> {
  const profileResult = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  let profile = check(profileResult) as ProfileRow | null;
  const profileWasCreated = !profile;
  if (!profile) {
    profile = check(await client.from('profiles').insert({ id: userId, display_name: userId.slice(0, 8) }).select().single()) as ProfileRow;
  }

  let members = asRows<FamilyMemberRow>(check(await client.from('family_members').select('*').eq('profile_id', userId)));
  // Existing profiles can be invite targets. Do not provision them as parents
  // before the child invite redemption transaction gets a chance to run.
  if (members.length === 0 && profileWasCreated) {
    const family = check(await client.from('families').insert({ name: `${profile.display_name} 的家庭`, created_by: userId }).select().single()) as FamilyRow;
    check(await client.from('family_members').insert({ family_id: family.id, profile_id: userId, role: 'parent' }));
    members = [{ id: `${family.id}:parent`, family_id: family.id, profile_id: userId, role: 'parent', created_at: new Date().toISOString() }];
  }
  if (members.length === 0) {
    throw new Error('此帳號尚未加入家庭，請使用有效邀請 token 後重試。');
  }

  const familyId = members[0].family_id;
  const role = members.find((member) => member.profile_id === userId)?.role ?? 'parent';
  const state = emptyState();
  let children: ChildProfileRow[] = [];
  let profiles: ProfileRow[] = [];
  let tasks: TaskRow[] = [];
  let rewards: RewardRow[] = [];
  let wishlist: WishlistItemRow[] = [];
  let tickets: RewardRedemptionRow[] = [];
  let ledger: PointLedgerRow[] = [];

  if (role === 'child') {
    // Child sessions intentionally never enumerate family members or child profiles.
    const ownChild = check(await client.from('child_profiles').select('*').eq('family_id', familyId).eq('profile_id', userId).single()) as ChildProfileRow;
    children = [ownChild];
    profiles = [profile];
    const childFilter = ownChild.id;
    [tasks, rewards, wishlist, tickets, ledger] = await Promise.all([
      client.from('tasks').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at').then((result) => asRows<TaskRow>(check(result))),
      client.from('rewards').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('sort_order').then((result) => asRows<RewardRow>(check(result))),
      client.from('wishlist_items').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at').then((result) => asRows<WishlistItemRow>(check(result))),
      client.from('reward_redemptions').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at', { ascending: false }).then((result) => asRows<RewardRedemptionRow>(check(result))),
      client.from('point_ledger').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at', { ascending: false }).then((result) => asRows<PointLedgerRow>(check(result))),
    ]);
  } else {
    const allMembers = asRows<FamilyMemberRow>(check(await client.from('family_members').select('*').eq('family_id', familyId)));
    const profileIds = [...new Set(allMembers.map((member) => member.profile_id))];
    profiles = asRows<ProfileRow>(check(await client.from('profiles').select('*').in('id', profileIds)));
    children = asRows<ChildProfileRow>(check(await client.from('child_profiles').select('*').eq('family_id', familyId)));
    [state.taskTemplates, tasks, rewards, wishlist, tickets, ledger] = await Promise.all([
      client.from('task_templates').select('*').eq('family_id', familyId).order('sort_order').then((result) => asRows<TaskTemplateRow>(check(result)).map((row): TaskTemplate => ({ id: row.id, name: row.name, points: row.points, icon: row.icon, ...(row.duration_minutes == null ? {} : { duration: row.duration_minutes }) }))),
      client.from('tasks').select('*').eq('family_id', familyId).order('created_at').then((result) => asRows<TaskRow>(check(result))),
      client.from('rewards').select('*').eq('family_id', familyId).order('sort_order').then((result) => asRows<RewardRow>(check(result))),
      client.from('wishlist_items').select('*').eq('family_id', familyId).order('created_at').then((result) => asRows<WishlistItemRow>(check(result))),
      client.from('reward_redemptions').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).then((result) => asRows<RewardRedemptionRow>(check(result))),
      client.from('point_ledger').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).then((result) => asRows<PointLedgerRow>(check(result))),
    ]);
  }
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  state.children = children.flatMap((child) => {
    const childProfile = profileById.get(child.profile_id);
    return childProfile ? [childFromRows(child, childProfile, tasks, rewards, wishlist, tickets)] : [];
  });
  state.ledger = ledger.map(pointLedgerRowToViewModel);
  const ownChild = children.find((child) => child.profile_id === userId);
  state.childLoggedInId = ownChild?.id ?? null;
  state.parentActiveChildId = state.children[0]?.id ?? null;
  return { state, familyId, role };
}

export interface DataRepository {
  load(userId: string): Promise<LoadedAppData>;
  insertChild(familyId: string, name: string): Promise<void>;
  updateChild(familyId: string, childId: string, name: string): Promise<void>;
  deleteChild(familyId: string, childId: string): Promise<void>;
  insertTemplate(familyId: string, template: Omit<TaskTemplate, 'id'>): Promise<void>;
  updateTemplate(id: string, updates: Partial<TaskTemplate>): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  insertTask(familyId: string, childId: string, task: Omit<Task, 'id' | 'status'>): Promise<void>;
  updateTask(id: string, updates: Partial<Task>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  updateTaskStatus(id: string, status: TaskStatus): Promise<void>;
  insertReward(familyId: string, childId: string, reward: Omit<Reward, 'id'>): Promise<void>;
  updateReward(id: string, updates: Partial<Reward>): Promise<void>;
  deleteReward(id: string): Promise<void>;
  insertWishlist(familyId: string, childId: string, name: string): Promise<void>;
  approveWishlist(familyId: string, childId: string, wishlistId: string, points: number): Promise<void>;
  redeemReward(rewardId: string): Promise<void>;
  fulfillTicket(ticketId: string): Promise<void>;
}

export function createDataRepository(client: SupabaseClient): DataRepository {
  return {
    load: (userId) => loadAppData(client, userId),
    async insertChild() { throw new Error('目前資料庫尚未提供 child invite/join token，無法安全建立可登入的孩子帳號。'); },
    async updateChild(familyId, childId, name) {
      const child = check(await client.from('child_profiles').select('profile_id').eq('family_id', familyId).eq('id', childId).single()) as { profile_id: string };
      check(await client.from('profiles').update({ display_name: name }).eq('id', child.profile_id));
    },
    async deleteChild(familyId, childId) { check(await client.from('child_profiles').delete().eq('family_id', familyId).eq('id', childId)); },
    async insertTemplate(familyId, template) { check(await client.from('task_templates').insert({ family_id: familyId, name: template.name, points: template.points, icon: template.icon, duration_minutes: template.duration ?? null })); },
    async updateTemplate(id, updates) { check(await client.from('task_templates').update({ ...updates, duration_minutes: updates.duration ?? null }).eq('id', id)); },
    async deleteTemplate(id) { check(await client.from('task_templates').delete().eq('id', id)); },
    async insertTask(familyId, childId, task) { check(await client.from('tasks').insert({ family_id: familyId, child_profile_id: childId, name: task.name, points: task.points, icon: task.icon, duration_minutes: task.duration ?? null, is_daily: task.isDaily ?? false })); },
    async updateTask(id, updates) { check(await client.from('tasks').update({ name: updates.name, points: updates.points, icon: updates.icon, duration_minutes: updates.duration ?? null, is_daily: updates.isDaily }).eq('id', id)); },
    async deleteTask(id) { check(await client.from('tasks').delete().eq('id', id)); },
    async updateTaskStatus(id, status) {
      if (status === 'completed') check(await client.rpc('approve_task_completion', { target_task_id: id }));
      else check(await client.from('tasks').update({ status, completed_at: status === 'pending' ? new Date().toISOString() : null }).eq('id', id));
    },
    async insertReward(familyId, childId, reward) { check(await client.from('rewards').insert({ family_id: familyId, child_profile_id: childId, name: reward.name, points: reward.points, icon: reward.icon })); },
    async updateReward(id, updates) { check(await client.from('rewards').update({ name: updates.name, points: updates.points, icon: updates.icon }).eq('id', id)); },
    async deleteReward(id) { check(await client.from('rewards').delete().eq('id', id)); },
    async insertWishlist(familyId, childId, name) { check(await client.from('wishlist_items').insert({ family_id: familyId, child_profile_id: childId, name })); },
    async approveWishlist(familyId, childId, wishlistId, points) {
      check(await client.rpc('approve_wishlist_item', {
        target_family_id: familyId,
        target_child_profile_id: childId,
        target_wishlist_id: wishlistId,
        target_points: points,
      }));
    },
    async redeemReward(rewardId) { check(await client.rpc('redeem_reward', { target_reward_id: rewardId })); },
    async fulfillTicket(ticketId) { check(await client.from('reward_redemptions').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() }).eq('id', ticketId)); },
  };
}
