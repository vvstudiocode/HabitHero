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
  TaskRow,
  TaskViewModel,
  Timestamp,
  UnixMilliseconds,
} from '../types';

const toUnixMilliseconds = (timestamp: Timestamp): UnixMilliseconds => Date.parse(timestamp);

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
  name: row.name,
  points: row.points,
  status: row.status,
  icon: row.icon,
  duration: row.duration_minutes,
  timerEndTime: null,
  timerRemainingMs: null,
  timerIsRunning: false,
  isDaily: row.is_daily,
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
