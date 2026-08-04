export interface ParentMenuNotificationCounts {
  review?: number;
  rewards?: number;
  wishlist?: number;
}

export interface ChildMenuNotificationCounts {
  goals?: number;
  rewardTickets?: number;
  wishlist?: number;
}

const hasItems = (count: number | undefined) => (count ?? 0) > 0;

export function getParentMenuNotifications(counts: ParentMenuNotificationCounts) {
  return {
    review: hasItems(counts.review),
    rewards: hasItems(counts.rewards),
    wishlist: hasItems(counts.wishlist),
  };
}

export function getChildMenuNotifications(counts: ChildMenuNotificationCounts) {
  return {
    goals: hasItems(counts.goals),
    rewards: hasItems(counts.rewardTickets),
    wishlist: hasItems(counts.wishlist),
  };
}
