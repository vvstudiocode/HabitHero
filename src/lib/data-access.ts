import type { SupabaseClient } from '@supabase/supabase-js';
import {
  childProfileRowToViewModel,
  familyMemberRowToViewModel,
  profileRowToViewModel,
  redemptionRowToViewModel,
  pointLedgerRowToViewModel,
  taskRowToViewModel,
  taskTemplateRowToViewModel,
} from './data-contracts';
import type {
  ChildProfileRow, FamilyMemberRow, ProfileRow, RewardRow,
  RewardRedemptionRow, TaskRow, TaskTemplateRow, WishlistItemRow, PointLedgerRow,
} from '../types';
import type { AppState, Child, FeedbackTone, Reward, Task, TaskCategory, TaskStatus, TaskTemplate } from '../types';

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

const CHILD_COMPLETED_TASK_HISTORY_LIMIT = 30;
const FAMILY_COMPLETED_TASK_HISTORY_LIMIT = 60;

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}

function removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export interface ProposeChildGoalInput {
  name: string;
  points: number;
  icon: string;
  category: TaskCategory;
  duration?: number | null;
  dueOn?: string | null;
  dueTime?: string | null;
}

export interface ConfirmChildGoalInput {
  name: string;
  points: number;
  category: TaskCategory;
}

export interface SubmitTaskReflectionInput {
  reflection: string;
  mood?: string | null;
  difficulty?: number | null;
}

export interface ReviewTaskCompletionInput {
  approved: boolean;
  approvedPoints: number;
  feedback?: string | null;
  correction?: string | null;
  tone?: FeedbackTone | null;
  revisionNote?: string | null;
}

function normalizeFeedbackTone(tone?: FeedbackTone | null): FeedbackTone | null {
  if (tone === 'celebration' || tone === 'celebrating') return 'celebratory';
  if (tone === 'correction') return 'corrective';
  return tone ?? null;
}

export const buildProposeChildGoalPayload = (
  familyId: string,
  childId: string,
  goal: ProposeChildGoalInput,
) => ({
  target_family_id: familyId,
  target_child_profile_id: childId,
  goal_name: goal.name,
  goal_points: goal.points,
  goal_icon: goal.icon,
  goal_category: goal.category,
  goal_duration_minutes: goal.duration ?? null,
  goal_due_on: goal.dueOn ?? null,
  goal_due_time: goal.dueTime ?? null,
});

export const buildConfirmChildGoalPayload = (
  taskId: string,
  confirmation: ConfirmChildGoalInput,
) => ({
  target_task_id: taskId,
  confirmed_name: confirmation.name,
  confirmed_points: confirmation.points,
  confirmed_category: confirmation.category,
});

export const buildSubmitTaskReflectionPayload = (
  taskId: string,
  submission: SubmitTaskReflectionInput,
) => ({
  target_task_id: taskId,
  reflection: submission.reflection,
  mood: submission.mood ?? null,
  difficulty: submission.difficulty ?? null,
});

export const buildReviewTaskCompletionPayload = (
  taskId: string,
  review: ReviewTaskCompletionInput,
) => ({
  target_task_id: taskId,
  approved: review.approved,
  approved_points: review.approvedPoints,
  feedback: review.feedback ?? null,
  correction: review.correction ?? null,
  tone: normalizeFeedbackTone(review.tone),
  revision_note: review.revisionNote ?? null,
});

function childFromRows(
  child: ChildProfileRow,
  profile: ProfileRow | undefined,
  tasks: TaskRow[],
  rewards: RewardRow[],
  wishlist: WishlistItemRow[],
  tickets: RewardRedemptionRow[],
): Child {
  return {
    ...childProfileRowToViewModel(child, profile ? profileRowToViewModel(profile) : undefined),
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
  if (!profile) {
    profile = check(await client.from('profiles').insert({ id: userId, display_name: userId.slice(0, 8) }).select().single()) as ProfileRow;
  }

  let members = asRows<FamilyMemberRow>(check(await client.from('family_members').select('*').eq('profile_id', userId)));
  // Every non-anonymous account is a parent account in the current flow. This
  // also repairs accounts created by an earlier build that have a profile but
  // no family membership, instead of sending a valid parent back to landing.
  if (members.length === 0) {
    const familyId = check(await client.rpc('ensure_parent_family')) as string;
    members = [{ id: `${familyId}:parent`, family_id: familyId, profile_id: userId, role: 'parent', created_at: new Date().toISOString() }];
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
    const [activeTasks, completedHistory, loadedRewards, loadedWishlist, loadedTickets, loadedLedger] = await Promise.all([
      client.from('tasks').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).neq('status', 'completed').order('created_at').then((result) => asRows<TaskRow>(check(result))),
      client.from('tasks').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).eq('status', 'completed').order('completed_at', { ascending: false }).limit(CHILD_COMPLETED_TASK_HISTORY_LIMIT).then((result) => asRows<TaskRow>(check(result))),
      client.from('rewards').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('sort_order').then((result) => asRows<RewardRow>(check(result))),
      client.from('wishlist_items').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at').then((result) => asRows<WishlistItemRow>(check(result))),
      client.from('reward_redemptions').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at', { ascending: false }).then((result) => asRows<RewardRedemptionRow>(check(result))),
      client.from('point_ledger').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at', { ascending: false }).then((result) => asRows<PointLedgerRow>(check(result))),
    ]);
    tasks = [...activeTasks, ...completedHistory];
    rewards = loadedRewards;
    wishlist = loadedWishlist;
    tickets = loadedTickets;
    ledger = loadedLedger;
  } else {
    const allMembers = asRows<FamilyMemberRow>(check(await client.from('family_members').select('*').eq('family_id', familyId)));
    const profileIds = [...new Set(allMembers.map((member) => member.profile_id))];
    profiles = asRows<ProfileRow>(check(await client.from('profiles').select('*').in('id', profileIds)));
    children = asRows<ChildProfileRow>(check(await client.from('child_profiles').select('*').eq('family_id', familyId)));
    const [loadedTemplates, activeTasks, completedHistory, loadedRewards, loadedWishlist, loadedTickets, loadedLedger] = await Promise.all([
      client.from('task_templates').select('*').eq('family_id', familyId).order('sort_order').then((result) => asRows<TaskTemplateRow>(check(result)).map((row): TaskTemplate => {
        const template = taskTemplateRowToViewModel(row);
        return { ...template, ...(template.duration == null ? { duration: undefined } : { duration: template.duration }) };
      })),
      client.from('tasks').select('*').eq('family_id', familyId).neq('status', 'completed').order('created_at').then((result) => asRows<TaskRow>(check(result))),
      client.from('tasks').select('*').eq('family_id', familyId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(FAMILY_COMPLETED_TASK_HISTORY_LIMIT).then((result) => asRows<TaskRow>(check(result))),
      client.from('rewards').select('*').eq('family_id', familyId).order('sort_order').then((result) => asRows<RewardRow>(check(result))),
      client.from('wishlist_items').select('*').eq('family_id', familyId).order('created_at').then((result) => asRows<WishlistItemRow>(check(result))),
      client.from('reward_redemptions').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).then((result) => asRows<RewardRedemptionRow>(check(result))),
      client.from('point_ledger').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).then((result) => asRows<PointLedgerRow>(check(result))),
    ]);
    state.taskTemplates = loadedTemplates;
    tasks = [...activeTasks, ...completedHistory];
    rewards = loadedRewards;
    wishlist = loadedWishlist;
    tickets = loadedTickets;
    ledger = loadedLedger;
  }
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  state.children = children.flatMap((child) => {
    const childProfile = child.profile_id ? profileById.get(child.profile_id) : undefined;
    return [childFromRows(child, childProfile, tasks, rewards, wishlist, tickets)];
  });
  state.ledger = ledger.map(pointLedgerRowToViewModel);
  const ownChild = children.find((child) => child.profile_id === userId);
  state.childLoggedInId = ownChild?.id ?? null;
  state.parentActiveChildId = state.children[0]?.id ?? null;
  return { state, familyId, role };
}

export interface DataRepository {
  load(userId: string): Promise<LoadedAppData>;
  insertChild(familyId: string, name: string, loginName: string, password: string, childProfileId?: string): Promise<void>;
  updateChildPassword(familyId: string, childId: string, password: string): Promise<void>;
  updateChild(familyId: string, childId: string, name: string): Promise<void>;
  deleteChild(familyId: string, childId: string): Promise<void>;
  insertTemplate(familyId: string, template: Omit<TaskTemplate, 'id'>): Promise<void>;
  updateTemplate(id: string, updates: Partial<TaskTemplate>): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  insertTask(familyId: string, childId: string, task: Omit<Task, 'id' | 'status'>): Promise<void>;
  updateTask(id: string, updates: Partial<Task>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  updateTaskStatus(id: string, status: TaskStatus): Promise<void>;
  proposeChildGoal(familyId: string, childId: string, goal: ProposeChildGoalInput): Promise<void>;
  confirmChildGoal(taskId: string, confirmation: ConfirmChildGoalInput): Promise<void>;
  returnChildGoal(taskId: string, revisionNote: string): Promise<void>;
  submitTaskReflection(taskId: string, submission: SubmitTaskReflectionInput): Promise<void>;
  reviewTaskCompletion(taskId: string, review: ReviewTaskCompletionInput): Promise<void>;
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
    async insertChild(familyId, name, loginName, password, childProfileId) {
      const { data, error } = await client.functions.invoke('manage-child-account', {
        body: { action: 'create', familyId, childProfileId, childName: name, loginName, password },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    async updateChildPassword(familyId, childId, password) {
      const { data, error } = await client.functions.invoke('manage-child-account', {
        body: { action: 'reset-password', familyId, childProfileId: childId, password },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    async updateChild(familyId, childId, name) {
      const child = check(await client.from('child_profiles').select('profile_id').eq('family_id', familyId).eq('id', childId).single()) as { profile_id: string | null };
      check(await client.from('child_profiles').update({ display_name: name }).eq('family_id', familyId).eq('id', childId));
      if (child.profile_id) check(await client.from('profiles').update({ display_name: name }).eq('id', child.profile_id));
    },
    async deleteChild(familyId, childId) {
      const { data, error } = await client.functions.invoke('manage-child-account', {
        body: { action: 'delete', familyId, childProfileId: childId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    async insertTemplate(familyId, template) {
      check(await client.from('task_templates').insert({
        family_id: familyId,
        name: template.name,
        points: template.points,
        icon: template.icon,
        duration_minutes: template.duration ?? null,
        category: template.category ?? 'life_habit',
        suggested_evidence: template.suggestedEvidence ?? 'reflection',
      }));
    },
    async updateTemplate(id, updates) {
      check(await client.from('task_templates').update(removeUndefined({
        name: updates.name,
        points: updates.points,
        icon: updates.icon,
        duration_minutes: updates.duration,
        category: updates.category,
        suggested_evidence: updates.suggestedEvidence,
      })).eq('id', id));
    },
    async deleteTemplate(id) { check(await client.from('task_templates').delete().eq('id', id)); },
    async insertTask(familyId, childId, task) {
      check(await client.from('tasks').insert({
        family_id: familyId,
        child_profile_id: childId,
        template_id: task.templateId ?? null,
        name: task.name,
        points: task.points,
        icon: task.icon,
        duration_minutes: task.duration ?? null,
        is_daily: task.isDaily ?? false,
        due_on: task.dueOn ?? null,
        due_time: task.dueTime ?? null,
        category: task.category ?? 'life_habit',
        origin: task.origin ?? 'parent_assigned',
      }));
    },
    async updateTask(id, updates) {
      check(await client.from('tasks').update(removeUndefined({
        name: updates.name,
        points: updates.points,
        status: updates.status,
        icon: updates.icon,
        duration_minutes: updates.duration,
        is_daily: updates.isDaily,
        due_on: updates.dueOn,
        due_time: updates.dueTime,
        category: updates.category,
        origin: updates.origin,
        approved_points: updates.approvedPoints,
        child_reflection_text: updates.reflection,
        child_mood: updates.mood,
        child_difficulty: updates.difficulty,
        parent_feedback_text: updates.parentFeedback,
        parent_correction_text: updates.parentCorrection,
        feedback_tone: updates.feedbackTone,
        revision_note: updates.revisionNote,
      })).eq('id', id));
    },
    async deleteTask(id) { check(await client.from('tasks').delete().eq('id', id)); },
    async updateTaskStatus(id, status) {
      if (status === 'completed') check(await client.rpc('approve_task_completion', { target_task_id: id }));
      else if (status === 'pending') throw new Error('請使用 submitTaskReflection 提交完成心得。');
      else check(await client.from('tasks').update({ status, completed_at: null }).eq('id', id));
    },
    async proposeChildGoal(familyId, childId, goal) {
      check(await client.rpc('propose_child_goal', buildProposeChildGoalPayload(familyId, childId, goal)));
    },
    async confirmChildGoal(taskId, confirmation) {
      check(await client.rpc('confirm_child_goal', buildConfirmChildGoalPayload(taskId, confirmation)));
    },
    async returnChildGoal(taskId, revisionNote) {
      check(await client.rpc('return_child_goal', {
        target_task_id: taskId,
        target_revision_note: revisionNote,
      }));
    },
    async submitTaskReflection(taskId, submission) {
      check(await client.rpc('submit_task_reflection', buildSubmitTaskReflectionPayload(taskId, submission)));
    },
    async reviewTaskCompletion(taskId, review) {
      check(await client.rpc('review_task_completion', buildReviewTaskCompletionPayload(taskId, review)));
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
