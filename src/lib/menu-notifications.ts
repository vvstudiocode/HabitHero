export interface MenuNotificationCounts {
  review?: number;
  rewards?: number;
  wishlist?: number;
  goals?: number;
}

const hasItems = (count: number | undefined) => (count ?? 0) > 0;

export function getParentMenuNotifications(counts: MenuNotificationCounts) {
  return {
    review: hasItems(counts.review),
    rewards: hasItems(counts.rewards),
    wishlist: hasItems(counts.wishlist),
  };
}

export function getChildMenuNotifications(counts: MenuNotificationCounts) {
  return {
    goals: hasItems(counts.goals),
    rewards: hasItems(counts.rewards),
    wishlist: hasItems(counts.wishlist),
  };
}
