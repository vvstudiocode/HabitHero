import type { SupabaseClient } from '@supabase/supabase-js';
import {
  adventureGroupRowToViewModel,
  familyRowToViewModel,
  familyMemberRowToViewModel,
  pointLedgerRowToViewModel,
  taskTemplateRowToViewModel,
  taskScheduleRowToViewModel,
  taskTimerSessionRowToViewModel,
  applyServerTimerSession,
} from './data-contracts';
import type {
  AdventureGroupRow,
  ChildProfileRow, FamilyMemberRow, ProfileRow, RewardRow,
  RewardRedemptionRow, TaskRow, TaskTemplateRow, WishlistItemRow, PointLedgerRow, FamilyRow,
  TaskScheduleRow, TaskTimerSessionRow,
} from '../types';
import type { ChildProfileCreationInput } from './data-contracts';
import type {
  AdventureGroup,
  AppState,
  PointLedgerAdjustmentResult,
  PointLedgerPage,
  Reward,
  Task,
  TaskSchedule,
  TaskStatus,
  TaskTemplate,
  TaskTimerSession,
} from '../types';
import {
  createPointLedgerPage,
  DEFAULT_POINT_LEDGER_PAGE_SIZE,
  normalizePointLedgerPagination,
  validatePointLedgerAdjustment,
} from './point-ledger';
import { validateRewardPoints } from './reward-validation';
import {
  buildCreateChildAccountPayload,
  type CreateChildAccountInput,
} from './child-account-data-access';
import { childFromRows } from './child-data-access';
import {
  buildAdventureCompletionPayload,
  buildAdventureSchedulePayload,
  buildAdventureScheduleUpdatePayload,
  type AdventureCompletionInput,
  type AdventureScheduleInput,
  type AdventureScheduleUpdateInput,
  type BatchAdventureReviewResult,
  type GeneralAdventureInput,
} from './adventure-data-access';
import {
  buildConfirmChildGoalPayload,
  buildProposeChildGoalPayload,
  buildReviewTaskCompletionPayload,
  buildSubmitTaskReflectionPayload,
  type ConfirmChildGoalInput,
  type ProposeChildGoalInput,
  type ReviewTaskCompletionInput,
  type SubmitTaskReflectionInput,
} from './growth-data-access';
import { functionErrorMessage } from './edge-function-errors';
import {
  buildAdjustChildPointsPayload,
  pointLedgerAdjustmentResultFromRpc,
} from './point-ledger-data-access';
import {
  buildCreateTaskPayload,
  buildCreateTaskTemplatePayload,
  buildUpdateTaskPayload,
  buildUpdateTaskTemplatePayload,
} from './task-data-access';
import { loadChildGameData } from '../features/world/game-data';
import {
  toWorldMutationResult,
  toWorldPlacementRpcArgs,
  toWorldTransformRpcArgs,
} from '../features/world/world-data-access';
import type {
  GamePurchaseResult,
  WorldMutationResult,
  WorldMutationPayload,
  WorldTransformMutationPayload,
} from '../features/world/contracts';

export {
  toWorldMutationResult,
  toWorldPlacementRpcArgs,
  toWorldTransformRpcArgs,
} from '../features/world/world-data-access';

export {
  buildAdventureCompletionPayload,
  buildAdventureSchedulePayload,
  buildAdventureScheduleUpdatePayload,
} from './adventure-data-access';
export {
  buildCreateChildAccountPayload,
} from './child-account-data-access';
export type {
  CreateChildAccountInput,
} from './child-account-data-access';
export type {
  AdventureCompletionInput,
  AdventureScheduleInput,
  AdventureScheduleUpdateInput,
  BatchAdventureReviewResult,
  GeneralAdventureInput,
} from './adventure-data-access';
export {
  buildConfirmChildGoalPayload,
  buildProposeChildGoalPayload,
  buildReviewTaskCompletionPayload,
  buildSubmitTaskReflectionPayload,
} from './growth-data-access';
export type {
  ConfirmChildGoalInput,
  ProposeChildGoalInput,
  ReviewTaskCompletionInput,
  SubmitTaskReflectionInput,
} from './growth-data-access';
export {
  buildAdjustChildPointsPayload,
} from './point-ledger-data-access';

export interface LoadedAppData {
  state: AppState;
  familyId: string;
  role: 'parent' | 'child';
}

const emptyState = (): AppState => ({
  parentPin: null,
  parentConsentVersion: null,
  children: [],
  parentActiveChildId: null,
  childLoggedInId: null,
  taskTemplates: [],
  ledger: [],
  lastResetDate: null,
  familyTheme: { accentColor: 'amber', mobileBackgroundImageUrl: null, desktopBackgroundImageUrl: null },
  adventureGroups: [],
  taskSchedules: [],
  timerSessions: [],
  gameDataByChildId: {},
});

// Keep enough history in the app state for the UI's 30-item pages.
// This can later become a server-side cursor when history grows substantially.
const CHILD_COMPLETED_TASK_HISTORY_LIMIT = 300;
const FAMILY_COMPLETED_TASK_HISTORY_LIMIT = 300;
const INITIAL_POINT_LEDGER_LIMIT = DEFAULT_POINT_LEDGER_PAGE_SIZE;

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

export async function loadAppData(client: SupabaseClient, userId: string): Promise<LoadedAppData> {
  const profileResult = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  let profile = check(profileResult) as ProfileRow | null;
  if (!profile) {
    // Multiple auth/data-loading effects can bootstrap the same profile at
    // once (especially after a persisted session is restored). Upsert makes
    // this recovery path safe when another request creates the row first.
    profile = check(await client
      .from('profiles')
      .upsert({ id: userId, display_name: userId.slice(0, 8) }, { onConflict: 'id' })
      .select()
      .single()) as ProfileRow;
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
  // Family rows intentionally remain parent-only under the existing RLS hardening.
  // Child sessions use the persisted amber family default until family theme
  // reads are explicitly exposed to that role.
  const family = role === 'parent'
    ? check(await client.from('families').select('*').eq('id', familyId).single()) as FamilyRow
    : null;
  const state = emptyState();
  if (family) state.familyTheme = familyRowToViewModel(family).theme;
  if (role === 'parent') {
    const consent = check(await client.from('parent_consents').select('consent_version').eq('family_id', familyId).eq('parent_profile_id', userId).eq('consent_type', 'parental').maybeSingle()) as { consent_version: string } | null;
    state.parentConsentVersion = consent?.consent_version ?? null;
  }
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
    check(await client.rpc('ensure_daily_adventure_occurrences', {
      target_child_profile_id: childFilter,
    }));
    const [activeTasks, completedHistory, loadedRewards, loadedWishlist, loadedTickets, loadedLedger] = await Promise.all([
      client.from('tasks').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).neq('status', 'completed').order('created_at').then((result) => asRows<TaskRow>(check(result))),
      client.from('tasks').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).eq('status', 'completed').order('completed_at', { ascending: false }).limit(CHILD_COMPLETED_TASK_HISTORY_LIMIT).then((result) => asRows<TaskRow>(check(result))),
      client.from('rewards').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('sort_order').then((result) => asRows<RewardRow>(check(result))),
      client.from('wishlist_items').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at').then((result) => asRows<WishlistItemRow>(check(result))),
      client.from('reward_redemptions').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at', { ascending: false }).then((result) => asRows<RewardRedemptionRow>(check(result))),
      client.from('point_ledger').select('*').eq('family_id', familyId).eq('child_profile_id', childFilter).order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, INITIAL_POINT_LEDGER_LIMIT - 1).then((result) => asRows<PointLedgerRow>(check(result))),
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
    await Promise.all(children.map((child) => client.rpc('ensure_daily_adventure_occurrences', {
      target_child_profile_id: child.id,
    }).then(check)));
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
      client.from('point_ledger').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, INITIAL_POINT_LEDGER_LIMIT - 1).then((result) => asRows<PointLedgerRow>(check(result))),
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
  const [groups, schedules, timerSessions] = await Promise.all([
    client.from('adventure_groups').select('*').eq('family_id', familyId).then((result) => asRows<AdventureGroupRow>(check(result))),
    client.from('task_schedules').select('*').eq('family_id', familyId).then((result) => asRows<TaskScheduleRow>(check(result))),
    client.from('adventure_timer_sessions').select('*').eq('family_id', familyId).then((result) => asRows<TaskTimerSessionRow>(check(result))),
  ]);
  state.adventureGroups = groups.map(adventureGroupRowToViewModel);
  state.taskSchedules = schedules.map(taskScheduleRowToViewModel);
  state.timerSessions = timerSessions.map(taskTimerSessionRowToViewModel);
  state.gameDataByChildId = await loadChildGameData(
    client,
    familyId,
    children.map((child) => child.id),
    role === 'parent',
  );
  const timerByTaskId = new Map(state.timerSessions.map((session) => [session.taskId, session]));
  state.children = state.children.map((child) => ({
    ...child,
    tasks: child.tasks.map((task) => {
      const timer = timerByTaskId.get(task.id);
      return timer ? applyServerTimerSession(task, timer) : task;
    }),
  }));
  const ownChild = children.find((child) => child.profile_id === userId);
  state.childLoggedInId = ownChild?.id ?? null;
  state.parentActiveChildId = state.children[0]?.id ?? null;
  return { state, familyId, role };
}

export interface DataRepository {
  load(userId: string): Promise<LoadedAppData>;
  insertChild(familyId: string, name: string, loginName: string, password: string, childProfileId?: string, identity?: ChildProfileCreationInput): Promise<void>;
  updateChildPassword(familyId: string, childId: string, password: string): Promise<void>;
  updateChild(familyId: string, childId: string, name: string): Promise<void>;
  deleteChild(familyId: string, childId: string): Promise<void>;
  insertTemplate(familyId: string, template: Omit<TaskTemplate, 'id'>): Promise<void>;
  updateTemplate(id: string, updates: Partial<TaskTemplate>): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  insertTask(familyId: string, childId: string, task: Omit<Task, 'id' | 'status'>): Promise<string>;
  updateTask(id: string, updates: Partial<Task>): Promise<void>;
  deleteTask(id: string): Promise<void>;
  updateTaskStatus(id: string, status: TaskStatus): Promise<void>;
  proposeChildGoal(familyId: string, childId: string, goal: ProposeChildGoalInput): Promise<string>;
  confirmChildGoal(taskId: string, confirmation: ConfirmChildGoalInput): Promise<void>;
  returnChildGoal(taskId: string, revisionNote: string): Promise<void>;
  submitTaskReflection(taskId: string, submission: SubmitTaskReflectionInput): Promise<void>;
  reviewTaskCompletion(taskId: string, review: ReviewTaskCompletionInput): Promise<void>;
  ensureDailyAdventureOccurrences(childProfileId: string, date?: string): Promise<void>;
  submitAdventureCompletion(taskId: string, submission: AdventureCompletionInput): Promise<void>;
  abandonChildAdventure(taskId: string): Promise<void>;
  reviewAdventureCompletion(taskId: string, review: ReviewTaskCompletionInput): Promise<void>;
  createAdventureSchedule(familyId: string, schedule: AdventureScheduleInput): Promise<string[]>;
  updateAdventureSchedule(scheduleId: string, updates: AdventureScheduleUpdateInput): Promise<TaskSchedule>;
  disableAdventureSchedule(scheduleId: string): Promise<void>;
  createGeneralAdventure(familyId: string, input: GeneralAdventureInput): Promise<string[]>;
  updateGeneralAdventureTitle(familyId: string, childProfileId: string, title: string): Promise<AdventureGroup | null>;
  startAdventureTimer(taskId: string): Promise<TaskTimerSession | null>;
  pauseAdventureTimer(taskId: string): Promise<TaskTimerSession | null>;
  resumeAdventureTimer(taskId: string): Promise<TaskTimerSession | null>;
  batchReviewDailyAdventures(taskIds: string[]): Promise<BatchAdventureReviewResult>;
  insertReward(familyId: string, childId: string, reward: Omit<Reward, 'id'>): Promise<void>;
  updateReward(id: string, updates: Partial<Reward>): Promise<void>;
  deleteReward(id: string): Promise<void>;
  insertWishlist(familyId: string, childId: string, name: string): Promise<void>;
  deleteWishlist(wishlistId: string): Promise<void>;
  approveWishlist(familyId: string, childId: string, wishlistId: string, points: number): Promise<void>;
  listPointLedger(familyId: string, childProfileId: string, page?: number, pageSize?: number): Promise<PointLedgerPage>;
  adjustChildPoints(familyId: string, childProfileId: string, pointsDelta: number, note: string): Promise<PointLedgerAdjustmentResult>;
  redeemReward(rewardId: string): Promise<void>;
  fulfillTicket(ticketId: string): Promise<void>;
  recordParentConsent(familyId: string, consentVersion: string): Promise<void>;
  purchaseGameItem(childId: string, catalogItemId: string, quantity: number, idempotencyKey: string): Promise<GamePurchaseResult>;
  equipGameCharacter(childId: string, inventoryItemId: string): Promise<void>;
  setPetDisplayName(childId: string, inventoryItemId: string, displayName: string | null): Promise<void>;
  setFollowingPets(childId: string, inventoryItemIds: string[]): Promise<WorldMutationResult>;
  setFollowingPet(childId: string, inventoryItemId: string | null): Promise<WorldMutationResult>;
  setRoamingPets(childId: string, inventoryItemIds: string[]): Promise<WorldMutationResult>;
  placeWorldEntity(childId: string, payload: WorldMutationPayload): Promise<WorldMutationResult>;
  updateWorldEntityTransform(childId: string, payload: WorldTransformMutationPayload): Promise<WorldMutationResult>;
  removeWorldEntity(childId: string, payload: Pick<WorldMutationPayload, 'inventoryItemId' | 'entityId' | 'expectedRevision'>): Promise<WorldMutationResult>;
  collectAllWorldDecorations(childId: string, expectedRevision: number): Promise<WorldMutationResult>;
  setFamilyGameItemPrice(catalogItemId: string, scrollPrice: number): Promise<void>;
  resetFamilyGameItemPrice(catalogItemId: string): Promise<void>;
  revokeTaskApproval(taskId: string): Promise<void>;
}

export function createDataRepository(client: SupabaseClient): DataRepository {
  return {
    load: (userId) => loadAppData(client, userId),
    async insertChild(familyId, name, loginName, password, childProfileId, identity) {
      const { data, error } = await client.functions.invoke('manage-child-account', {
        body: {
          action: 'create',
          familyId,
          childProfileId,
          childName: name,
          loginName,
          password,
          gender: identity?.gender,
          characterId: identity?.characterId,
        },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
    },
    async updateChildPassword(familyId, childId, password) {
      const { data, error } = await client.functions.invoke('manage-child-account', {
        body: { action: 'reset-password', familyId, childProfileId: childId, password },
      });
      if (error) throw new Error(await functionErrorMessage(error));
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
      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
    },
    async insertTemplate(familyId, template) {
      check(await client.from('task_templates').insert(buildCreateTaskTemplatePayload(familyId, template)));
    },
    async updateTemplate(id, updates) {
      check(await client.from('task_templates').update(buildUpdateTaskTemplatePayload(updates)).eq('id', id));
    },
    async deleteTemplate(id) { check(await client.from('task_templates').delete().eq('id', id)); },
    async insertTask(familyId, childId, task) {
      const row = check(await client.from('tasks').insert(buildCreateTaskPayload(familyId, childId, task)).select('id').single()) as { id: string };
      return row.id;
    },
    async updateTask(id, updates) {
      check(await client.from('tasks').update(buildUpdateTaskPayload(updates)).eq('id', id));
    },
    async deleteTask(id) { check(await client.from('tasks').delete().eq('id', id)); },
    async updateTaskStatus(id, status) {
      if (status === 'completed') check(await client.rpc('approve_task_completion', { target_task_id: id }));
      else if (status === 'pending') throw new Error('請使用 submitTaskReflection 提交完成心得。');
      else check(await client.from('tasks').update({ status, completed_at: null }).eq('id', id));
    },
    async proposeChildGoal(familyId, childId, goal) {
      const row = check(await client.rpc('propose_child_goal', buildProposeChildGoalPayload(familyId, childId, goal))) as { id: string } | null;
      return row?.id ?? '';
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
    async ensureDailyAdventureOccurrences(childProfileId, date) {
      check(await client.rpc('ensure_daily_adventure_occurrences', removeUndefined({
        target_child_profile_id: childProfileId,
        target_date: date,
      })));
    },
    async submitAdventureCompletion(taskId, submission) {
      check(await client.rpc('submit_adventure_completion', buildAdventureCompletionPayload(taskId, submission)));
    },
    async abandonChildAdventure(taskId) {
      check(await client.rpc('abandon_child_adventure', { target_task_id: taskId }));
    },
    async reviewAdventureCompletion(taskId, review) {
      check(await client.rpc('review_adventure_completion', buildReviewTaskCompletionPayload(taskId, review)));
    },
    async createAdventureSchedule(familyId, schedule) {
      const ids: string[] = [];
      for (const childProfileId of schedule.childProfileIds) {
        const result = check(await client.rpc(
          'create_adventure_schedule',
          buildAdventureSchedulePayload(familyId, schedule, childProfileId),
        )) as { id?: string } | string | null;
        const id = typeof result === 'string' ? result : result?.id ?? '';
        if (id) ids.push(id);
        check(await client.rpc('ensure_daily_adventure_occurrences', {
          target_child_profile_id: childProfileId,
        }));
      }
      return ids;
    },
    async updateAdventureSchedule(scheduleId, updates) {
      const currentRow = check(await client.from('task_schedules').select('*').eq('id', scheduleId).single()) as TaskScheduleRow;
      const current = taskScheduleRowToViewModel(currentRow);
      const result = check(await client.rpc(
        'update_adventure_schedule',
        buildAdventureScheduleUpdatePayload(scheduleId, current, updates),
      )) as TaskScheduleRow;
      return taskScheduleRowToViewModel(result);
    },
    async disableAdventureSchedule(scheduleId) {
      check(await client.rpc('disable_adventure_schedule', { target_schedule_id: scheduleId }));
    },
    async createGeneralAdventure(familyId, input) {
      const ids: string[] = [];
      for (const childProfileId of input.childProfileIds) {
        const result = check(await client.rpc('create_general_adventure', {
          target_family_id: familyId,
          target_child_profile_id: childProfileId,
          adventure_name: input.name,
          adventure_description: input.description ?? null,
          adventure_points: input.points,
          adventure_icon: input.icon,
          adventure_category: input.category,
          adventure_duration_minutes: input.durationMinutes ?? null,
          adventure_due_on: input.dueOn ?? null,
          adventure_start_time: input.startTime ?? null,
          adventure_end_time: input.endTime ?? null,
          adventure_completion_report_mode: input.reportMode,
          adventure_requires_timer: input.requiresTimer ?? false,
          adventure_requires_review_before_next_task: input.requiresReviewBeforeNextTask ?? false,
        })) as TaskRow | { id?: string } | string | null;
        const id = typeof result === 'string' ? result : result?.id ?? '';
        if (id) ids.push(id);
      }
      return ids;
    },
    async updateGeneralAdventureTitle(_familyId, childProfileId, title) {
      const result = check(await client.rpc('update_general_adventure_title', {
        target_child_profile_id: childProfileId,
        new_title: title,
      })) as AdventureGroupRow | null;
      return result ? adventureGroupRowToViewModel(result) : null;
    },
    async startAdventureTimer(taskId) {
      const result = check(await client.rpc('start_adventure_timer', { target_task_id: taskId })) as TaskTimerSessionRow | null;
      return result ? taskTimerSessionRowToViewModel(result) : null;
    },
    async pauseAdventureTimer(taskId) {
      const result = check(await client.rpc('pause_adventure_timer', { target_task_id: taskId })) as TaskTimerSessionRow | null;
      return result ? taskTimerSessionRowToViewModel(result) : null;
    },
    async resumeAdventureTimer(taskId) {
      const result = check(await client.rpc('resume_adventure_timer', { target_task_id: taskId })) as TaskTimerSessionRow | null;
      return result ? taskTimerSessionRowToViewModel(result) : null;
    },
    async batchReviewDailyAdventures(taskIds) {
      const result = check(await client.rpc('batch_review_daily_adventures', { target_task_ids: taskIds })) as
        | { failed_task_ids?: string[]; failedTaskIds?: string[] }
        | null;
      return { failedTaskIds: result?.failedTaskIds ?? result?.failed_task_ids ?? [] };
    },
    async insertReward(familyId, childId, reward) {
      const validation = validateRewardPoints(reward.points);
      if (validation.ok === false) throw new Error(validation.message);
      check(await client.from('rewards').insert({ family_id: familyId, child_profile_id: childId, name: reward.name, points: reward.points, icon: reward.icon }));
    },
    async updateReward(id, updates) {
      if (updates.points !== undefined) {
        const validation = validateRewardPoints(updates.points);
        if (validation.ok === false) throw new Error(validation.message);
      }
      check(await client.from('rewards').update({ name: updates.name, points: updates.points, icon: updates.icon }).eq('id', id));
    },
    async deleteReward(id) { check(await client.from('rewards').delete().eq('id', id)); },
    async insertWishlist(familyId, childId, name) { check(await client.from('wishlist_items').insert({ family_id: familyId, child_profile_id: childId, name })); },
    async deleteWishlist(wishlistId) { check(await client.from('wishlist_items').delete().eq('id', wishlistId)); },
    async approveWishlist(familyId, childId, wishlistId, points) {
      check(await client.rpc('approve_wishlist_item', {
        target_family_id: familyId,
        target_child_profile_id: childId,
        target_wishlist_id: wishlistId,
        target_points: points,
      }));
    },
    async listPointLedger(familyId, childProfileId, page = 1, pageSize = DEFAULT_POINT_LEDGER_PAGE_SIZE) {
      const pagination = normalizePointLedgerPagination(page, pageSize);
      const query = client
        .from('point_ledger')
        .select('*', { count: 'exact' })
        .eq('family_id', familyId)
        .eq('child_profile_id', childProfileId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(pagination.from, pagination.to);
      const result = await query;
      if (result.error) throw new Error(result.error.message);
      const entries = asRows<PointLedgerRow>(result.data).map(pointLedgerRowToViewModel);
      return createPointLedgerPage(entries, result.count ?? 0, pagination);
    },
    async adjustChildPoints(familyId, childProfileId, pointsDelta, note) {
      const validation = validatePointLedgerAdjustment(pointsDelta, note);
      if (validation.ok === false) throw new Error(validation.message);
      const result = check(await client.rpc('adjust_child_points', buildAdjustChildPointsPayload(
        childProfileId,
        pointsDelta,
        validation.note,
      )));
      return pointLedgerAdjustmentResultFromRpc(result);
    },
    async redeemReward(rewardId) { check(await client.rpc('redeem_reward', { target_reward_id: rewardId })); },
    async fulfillTicket(ticketId) { check(await client.from('reward_redemptions').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() }).eq('id', ticketId)); },
    async recordParentConsent(familyId, consentVersion) {
      check(await client.rpc('record_parent_consent', { target_family_id: familyId, consent_version: consentVersion }));
    },
    async purchaseGameItem(childId, catalogItemId, quantity, idempotencyKey) {
      const result = check(await client.rpc('purchase_game_item', {
        target_child_profile_id: childId,
        target_catalog_item_id: catalogItemId,
        target_quantity: quantity,
        purchase_idempotency_key: idempotencyKey,
      })) as {
        purchase_id: string;
        inventory_item_id: string;
        wallet_balance: number;
        quantity: number;
      };
      return {
        purchaseId: result.purchase_id,
        inventoryItemId: result.inventory_item_id,
        walletBalance: Number(result.wallet_balance),
        quantity: Number(result.quantity),
      };
    },
    async equipGameCharacter(childId, inventoryItemId) {
      check(await client.rpc('equip_game_character', {
        target_child_profile_id: childId,
        target_inventory_item_id: inventoryItemId,
      }));
    },
    async setPetDisplayName(childId, inventoryItemId, displayName) {
      check(await client.rpc('set_pet_display_name', {
        target_child_profile_id: childId,
        target_inventory_item_id: inventoryItemId,
        target_display_name: displayName,
      }));
    },
    async setFollowingPets(childId, inventoryItemIds) {
      const result = check(await client.rpc('set_following_pets', {
        target_child_profile_id: childId,
        target_inventory_item_ids: inventoryItemIds,
      })) as WorldMutationResult;
      return { revision: Number(result.revision) };
    },
    async setFollowingPet(childId, inventoryItemId) {
      return this.setFollowingPets(childId, inventoryItemId ? [inventoryItemId] : []);
    },
    async setRoamingPets(childId, inventoryItemIds) {
      const result = check(await client.rpc('set_roaming_pets', {
        target_child_profile_id: childId,
        target_inventory_item_ids: inventoryItemIds,
      })) as WorldMutationResult;
      return { revision: Number(result.revision) };
    },
    async placeWorldEntity(childId, payload) {
      return toWorldMutationResult(check(await client.rpc('place_world_entity', {
        ...toWorldPlacementRpcArgs(payload),
        target_child_profile_id: childId,
      })));
    },
    async updateWorldEntityTransform(childId, payload) {
      return toWorldMutationResult(check(await client.rpc('update_world_entity_transform', {
        ...toWorldTransformRpcArgs(payload),
        target_child_profile_id: childId,
      })));
    },
    async removeWorldEntity(childId, payload) {
      return check(await client.rpc('remove_world_entity', {
        target_child_profile_id: childId,
        target_inventory_item_id: payload.inventoryItemId,
        ...(payload.entityId ? { target_entity_id: payload.entityId } : {}),
        expected_revision: payload.expectedRevision,
      })) as WorldMutationResult;
    },
    async collectAllWorldDecorations(childId, expectedRevision) {
      return check(await client.rpc('collect_all_world_decorations', {
        target_child_profile_id: childId,
        expected_revision: expectedRevision,
      })) as WorldMutationResult;
    },
    async setFamilyGameItemPrice(catalogItemId, scrollPrice) {
      check(await client.rpc('set_family_game_item_price', {
        target_catalog_item_id: catalogItemId,
        target_scroll_price: scrollPrice,
      }));
    },
    async resetFamilyGameItemPrice(catalogItemId) {
      check(await client.rpc('reset_family_game_item_price', { target_catalog_item_id: catalogItemId }));
    },
    async revokeTaskApproval(taskId) {
      check(await client.rpc('revoke_task_approval', { target_task_id: taskId }));
    },
  };
}
