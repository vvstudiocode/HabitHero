import {
  childProfileRowToViewModel,
  profileRowToViewModel,
  redemptionRowToViewModel,
  taskRowToViewModel,
} from './data-contracts';
import type {
  Child,
  ChildProfileRow,
  ProfileRow,
  RewardRedemptionRow,
  RewardRow,
  TaskRow,
  WishlistItemRow,
} from '../types';

export function childFromRows(
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
