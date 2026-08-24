import type { FriendSummary } from '../friends/contracts';
import type {
  ChildGameData,
  GameCatalogItem,
  WorldMutationPayload,
  WorldMutationResult,
  WorldTransformMutationPayload,
} from '../world/contracts';
import type {
  DecorationPlacementControl,
  DecorationPlacementDraft,
  DecorationPlacementGestureDelta,
} from '../world/world-placement';
import type { FriendWorldRepository } from '../../lib/social-data/friend-world-repository';
import type { SharedDecorationRepository } from '../../lib/social-data/shared-decoration-repository';

export type {
  DecorationPlacementControl,
  DecorationPlacementDraft,
  DecorationPlacementGestureDelta,
} from '../world/world-placement';

export interface DecorationPurchasePrompt {
  inventoryItemId: string;
  item: GameCatalogItem;
}

export interface DecorationPlacementSession {
  inventoryItemId: string;
  catalogItemId: string;
  draft: DecorationPlacementDraft;
  entityId?: string;
  placementScope?: 'owned' | 'shared';
}

export interface SharedDecorationItem {
  inventoryItemId: string;
  item: GameCatalogItem;
}

export interface SharedDecorationSocialContext {
  worldOwnerChildProfileId: string;
  friendWorldRepository?: FriendWorldRepository;
  sharedDecorationRepository?: SharedDecorationRepository;
  reloadSnapshot?: () => Promise<void>;
}

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

export interface ChildDecorationActionDependencies {
  activeChildId?: string | null;
  gameData: ChildGameData;
  worldGameData: ChildGameData;
  socialSession: SharedDecorationSocialContext | null;
  decorationPurchasePrompt: DecorationPurchasePrompt | null;
  decorationPlacement: DecorationPlacementSession | null;
  placementItem?: GameCatalogItem;
  placementValid: boolean;
  decorationPlacementPending: boolean;
  shareDecorationItem: SharedDecorationItem | null;
  closeChildFeature: (afterClose?: () => void) => void;
  showToast: (message: string) => void;
  setDecorationPurchasePrompt: (value: DecorationPurchasePrompt | null) => void;
  setDecorationPlacement: StateSetter<DecorationPlacementSession | null>;
  setDecorationPlacementPending: (value: boolean) => void;
  setShareDecorationItem: (value: SharedDecorationItem | null) => void;
  setHeroFeature: (value: null) => void;
  setHeroMenuGroup: (value: null) => void;
  setHeroMenuVisible: (value: boolean) => void;
  removeWorldEntity: (childId: string, payload: WorldMutationPayload) => Promise<WorldMutationResult>;
  updateWorldEntityTransform: (childId: string, payload: WorldTransformMutationPayload) => Promise<WorldMutationResult>;
  placeWorldEntity: (childId: string, payload: WorldMutationPayload) => Promise<WorldMutationResult>;
}

export interface ChildDecorationActions {
  startDecorationPlacement: () => void;
  startOwnedDecorationPlacement: (inventoryItemId: string, catalogItemId: string) => void;
  startExistingDecorationPlacement: (entityId: string) => void;
  collectSelectedDecoration: (entityId: string) => Promise<void>;
  leaveDecorationInInventory: () => void;
  handleDecorationPlacementPositionChange: (position: { x: number; z: number }) => void;
  handleDecorationPlacementControl: (control: DecorationPlacementControl) => void;
  handleDecorationPlacementGesture: (gesture: DecorationPlacementGestureDelta) => void;
  completeDecorationPlacement: () => Promise<void>;
  shareDecorationWithFriend: (friend: FriendSummary) => Promise<void>;
  collectAllSharedDecorations: (expectedRevision: number) => Promise<WorldMutationResult>;
  cancelDecorationPlacement: () => void;
}
