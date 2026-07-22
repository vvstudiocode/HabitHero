import {
  ChildProfileRow,
  ChildViewModel,
  FamilyMemberRow,
  FamilyMemberViewModel,
  FamilyRow,
  FamilyViewModel,
  ProfileRow,
  ProfileViewModel,
  RewardRedemptionRow,
  RewardRedemptionViewModel,
  PointLedgerRow,
  PointLedgerViewModel,
  TaskTemplateRow,
  TaskTemplateViewModel,
  TaskRow,
  TaskCategory,
  TaskOrigin,
  TaskViewModel,
  Timestamp,
  UnixMilliseconds,
} from '../types';

const toUnixMilliseconds = (timestamp: Timestamp): UnixMilliseconds => Date.parse(timestamp);
const defaultCategory: TaskCategory = 'life_habit';
const defaultOrigin: TaskOrigin = 'parent_assigned';

export const profileRowToViewModel = (row: ProfileRow): ProfileViewModel => ({
  id: row.id,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
});

export const familyRowToViewModel = (
  row: FamilyRow,
  members: FamilyMemberViewModel[] = [],
): FamilyViewModel => ({ id: row.id, name: row.name, members });

export const familyMemberRowToViewModel = (
  row: FamilyMemberRow,
  profile: ProfileViewModel,
): FamilyMemberViewModel => ({
  id: row.id,
  profileId: row.profile_id,
  displayName: profile.displayName,
  role: row.role,
});

export const childProfileRowToViewModel = (
  row: ChildProfileRow,
  profile?: ProfileViewModel,
): ChildViewModel => ({
  id: row.id,
  familyId: row.family_id,
  profileId: row.profile_id,
  loginName: row.login_name,
  name: profile?.displayName ?? row.display_name,
  points: row.points_balance,
});

export const taskRowToViewModel = (row: TaskRow): TaskViewModel => ({
  id: row.id,
  familyId: row.family_id,
  childProfileId: row.child_profile_id,
  templateId: row.template_id,
  name: row.name,
  points: row.points,
  status: row.status,
  icon: row.icon,
  duration: row.duration_minutes,
  timerEndTime: null,
  timerRemainingMs: null,
  timerIsRunning: false,
  isDaily: row.is_daily,
  dueOn: row.due_on,
  dueTime: row.due_time,
  category: row.category ?? defaultCategory,
  origin: row.origin ?? defaultOrigin,
  originalName: row.original_name ?? null,
  originalPoints: row.original_points ?? null,
  confirmedAt: row.confirmed_at ?? null,
  confirmedBy: row.confirmed_by ?? null,
  submittedAt: row.submitted_at ?? null,
  reviewedAt: row.reviewed_at ?? null,
  reviewedBy: row.reviewed_by ?? null,
  approvedPoints: row.approved_points ?? null,
  reflection: row.child_reflection_text ?? null,
  mood: row.child_mood ?? null,
  difficulty: row.child_difficulty ?? null,
  parentFeedback: row.parent_feedback_text ?? null,
  parentCorrection: row.parent_correction_text ?? null,
  feedbackTone: row.feedback_tone ?? null,
  revisionNote: row.revision_note ?? null,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const taskTemplateRowToViewModel = (
  row: TaskTemplateRow,
): TaskTemplateViewModel => ({
  id: row.id,
  name: row.name,
  points: row.points,
  duration: row.duration_minutes,
  icon: row.icon,
  category: row.category ?? defaultCategory,
  suggestedEvidence: row.suggested_evidence ?? 'reflection',
});

export const redemptionRowToViewModel = (
  row: RewardRedemptionRow,
): RewardRedemptionViewModel => ({
  id: row.id,
  rewardId: row.reward_id,
  rewardName: row.reward_name,
  rewardIcon: row.reward_icon,
  pointsCost: row.points_cost,
  status: row.status,
  createdAt: toUnixMilliseconds(row.created_at),
});

export const pointLedgerRowToViewModel = (
  row: PointLedgerRow,
): PointLedgerViewModel => ({
  id: row.id,
  childProfileId: row.child_profile_id,
  pointsDelta: row.points_delta,
  entryType: row.entry_type,
  note: row.note,
  createdAt: toUnixMilliseconds(row.created_at),
});
