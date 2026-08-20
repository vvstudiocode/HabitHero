import type { Child } from '../types';

export type GroupedReward = {
  id: string;
  name: string;
  points: number;
  children: { childId: string; childName: string; rewardId: string }[];
};

export function groupParentRewards(children: readonly Child[]): GroupedReward[] {
  const allRewards = children.flatMap(c => c.rewards.map(r => ({ ...r, childId: c.id, childName: c.name })));
  return Object.values(allRewards.reduce((acc, reward) => {
    const key = `${reward.name}-${reward.points}`;
    if (!acc[key]) {
      acc[key] = { id: key, name: reward.name, points: reward.points, children: [{ childId: reward.childId, childName: reward.childName, rewardId: reward.id }] };
    } else {
      acc[key].children.push({ childId: reward.childId, childName: reward.childName, rewardId: reward.id });
    }
    return acc;
  }, {} as Record<string, GroupedReward>)) as GroupedReward[];
}
