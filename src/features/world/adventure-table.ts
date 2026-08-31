import type { ChildGameData, GameCatalogItem } from './contracts';
import type { CollisionCircleInput, WorldTransform } from './world-collision';
import { getDecorationCollisionSpec } from './world-collision';

export const ADVENTURE_TABLE_ASSET_KEY = 'decoration.adventure-table';
export const ADVENTURE_TABLE_LANDMARK_ID = 'landmark.adventure-table';
export const ADVENTURE_TABLE_POSITION = Object.freeze({ x: -3.2, z: 3.2 });
export const ADVENTURE_TABLE_SCALE = 0.38;
export const ADVENTURE_TABLE_INTERACTION_ENTER_RADIUS = 1.55;
export const ADVENTURE_TABLE_INTERACTION_EXIT_RADIUS = 2;
export const ADVENTURE_TABLE_PROMPT_LOWERING_RATIO = 0.5;
export const ADVENTURE_TABLE_PROMPT_SCALE_MIN = 0.72;

export interface AdventureTableScreenPosition {
  x: number;
  y: number;
  scale: number;
}

export function getAdventureTablePromptHeight(topY: number, baseY: number): number {
  return topY + (baseY - topY) * ADVENTURE_TABLE_PROMPT_LOWERING_RATIO;
}

export function getAdventureTablePromptScale(
  cameraDistance: number,
  defaultCameraDistance: number,
  maxCameraDistance: number,
): number {
  if (!Number.isFinite(cameraDistance) || !Number.isFinite(defaultCameraDistance) || !Number.isFinite(maxCameraDistance)) return 1;
  if (maxCameraDistance <= defaultCameraDistance || cameraDistance <= defaultCameraDistance) return 1;
  const progress = Math.min(1, (cameraDistance - defaultCameraDistance) / (maxCameraDistance - defaultCameraDistance));
  return 1 - progress * (1 - ADVENTURE_TABLE_PROMPT_SCALE_MIN);
}

const ADVENTURE_TABLE_FALLBACK_ITEM: GameCatalogItem = {
  id: ADVENTURE_TABLE_LANDMARK_ID,
  itemType: 'decoration',
  name: '冒險桌',
  description: '和冒險桌聊聊，挑選今天想完成的任務。',
  scrollPrice: 0,
  assetKey: ADVENTURE_TABLE_ASSET_KEY,
  thumbnailUrl: '/assets/decorations/adventure-table-thumbnail.png',
  isActive: true,
  isStarter: false,
  isStackable: false,
  collisionRadius: 0.78,
  minScale: ADVENTURE_TABLE_SCALE,
  maxScale: ADVENTURE_TABLE_SCALE,
  sortOrder: -1,
  metadata: {
    model: '/assets/decorations/adventure-table.glb',
    thumbnail: '/assets/decorations/adventure-table-thumbnail.png',
    renderMode: 'static',
    groundOffset: 0.5455,
    navigationRadius: 0.48,
    navigationInset: 0.25,
  },
};

export function isAdventureTableItem(item: Pick<GameCatalogItem, 'assetKey'> | undefined): boolean {
  return item?.assetKey === ADVENTURE_TABLE_ASSET_KEY;
}

export function getAdventureTableCatalogItem(gameData: ChildGameData): GameCatalogItem {
  return gameData.catalog.find((item) => item.itemType === 'decoration' && isAdventureTableItem(item))
    ?? ADVENTURE_TABLE_FALLBACK_ITEM;
}

/**
 * Keep the landmark in a stable screen-independent world location, while
 * rotating it toward the runtime-computed big tree anchor.
 */
export function getAdventureTableWorldTransform(tree: Pick<WorldTransform, 'x' | 'z'>): WorldTransform {
  return {
    x: ADVENTURE_TABLE_POSITION.x,
    y: 0,
    z: ADVENTURE_TABLE_POSITION.z,
    rotationX: 0,
    rotationY: Math.atan2(tree.x - ADVENTURE_TABLE_POSITION.x, tree.z - ADVENTURE_TABLE_POSITION.z),
    rotationZ: 0,
    scale: ADVENTURE_TABLE_SCALE,
  };
}

export function getAdventureTableCollisionInput(
  transform: WorldTransform,
  item: Pick<GameCatalogItem, 'metadata' | 'collisionRadius'>,
): CollisionCircleInput {
  const spec = getDecorationCollisionSpec(item.metadata, item.collisionRadius);
  return {
    positionX: transform.x,
    positionZ: transform.z,
    scale: transform.scale,
    rotationY: transform.rotationY,
    ...spec,
  };
}

export function isAdventureTableNearby(distance: number, wasNearby: boolean): boolean {
  if (!Number.isFinite(distance) || distance < 0) return false;
  return distance <= (wasNearby ? ADVENTURE_TABLE_INTERACTION_EXIT_RADIUS : ADVENTURE_TABLE_INTERACTION_ENTER_RADIUS);
}
