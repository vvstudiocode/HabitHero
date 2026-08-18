import type { PetBehaviorMode } from './contracts';

export type PetAction = 'idle' | 'wander' | 'follow';

export function shouldPausePetForMenu(selection: { behaviorMode: PetBehaviorMode; following: boolean }): boolean {
  return selection.behaviorMode === 'wander' && !selection.following;
}

export interface PetActionPlanInput {
  action: PetAction;
  inventoryItemId: string;
  followingIds: readonly string[];
  roamingIds: readonly string[];
}

export interface PetActionPlan {
  followingIds: string[];
  roamingIds: string[];
  shouldPlaceIdleEntity: boolean;
}

/**
 * Keeps the mutually-exclusive follow/roam queues consistent with the action
 * selected from the pet in the world.
 */
export function getPetActionPlan({
  action,
  inventoryItemId,
  followingIds,
  roamingIds,
}: PetActionPlanInput): PetActionPlan {
  const nextFollowingIds = followingIds.filter((id) => id !== inventoryItemId);
  const wasFollowing = nextFollowingIds.length !== followingIds.length;
  const nextRoamingIds = roamingIds.filter((id) => id !== inventoryItemId);
  const wasRoaming = nextRoamingIds.length !== roamingIds.length;

  if (action === 'idle') {
    return {
      followingIds: nextFollowingIds,
      roamingIds: nextRoamingIds,
      shouldPlaceIdleEntity: wasFollowing || wasRoaming,
    };
  }

  if (action === 'follow') {
    return {
      followingIds: followingIds.includes(inventoryItemId)
        ? [...followingIds]
        : [inventoryItemId, ...nextFollowingIds],
      roamingIds: nextRoamingIds,
      shouldPlaceIdleEntity: false,
    };
  }

  return {
    followingIds: nextFollowingIds,
    roamingIds: roamingIds.includes(inventoryItemId)
      ? [...roamingIds]
      : [...nextRoamingIds, inventoryItemId],
    shouldPlaceIdleEntity: false,
  };
}
