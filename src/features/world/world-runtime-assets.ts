import type { ChildGameData, ChildWorldEntity, GameCatalogItem, WorldTransform } from './contracts';
import { getLocalGameModelUrl } from './game-content-assets';
import { getDecorationCollisionSpec } from './world-collision';
import { HABITHERO_ROAMING_CHARACTER_MODEL_URL } from './world-roaming';

export const PROTOTYPE_WORLD_ASSETS = {
  tree: new URL('../../../terrain-prototype/assets/big-tree-optimized.glb', import.meta.url).href,
  character: '/assets/characters/arthur.glb',
  roamingCharacter: HABITHERO_ROAMING_CHARACTER_MODEL_URL,
  skybox: new URL('../../../terrain-prototype/assets/sky-equirectangular-day.png', import.meta.url).href,
  skyboxes: Object.freeze({
    dawn: new URL('../../../terrain-prototype/assets/sky-equirectangular-dawn.png', import.meta.url).href,
    day: new URL('../../../terrain-prototype/assets/sky-equirectangular-day.png', import.meta.url).href,
    dusk: new URL('../../../terrain-prototype/assets/sky-equirectangular-dusk.png', import.meta.url).href,
    night: new URL('../../../terrain-prototype/assets/sky-equirectangular-night.png', import.meta.url).href,
  }),
} as const;

export interface DecorationGroundCoverMask {
  x: number;
  z: number;
  rotationY: number;
  halfWidth: number;
  halfDepth: number;
  edgeSoftness: number;
  shape: 'rectangle' | 'circle';
}

export function getDecorationCatalogItem(gameData: ChildGameData, entity: ChildWorldEntity): GameCatalogItem | undefined {
  const catalogItemId = entity.catalogItemId
    ?? gameData.inventory.find((inventory) => inventory.id === entity.inventoryItemId)?.catalogItemId;
  return catalogItemId
    ? gameData.catalog.find((item) => item.id === catalogItemId && item.itemType === 'decoration')
    : undefined;
}

export function getDecorationCollisionInput(gameData: ChildGameData, entity: ChildWorldEntity) {
  const item = getDecorationCatalogItem(gameData, entity);
  const spec = getDecorationCollisionSpec(item?.metadata, entity.collisionRadius ?? 0.3);
  return {
    positionX: entity.x,
    positionZ: entity.z,
    scale: entity.scale,
    rotationY: entity.rotationY,
    ...spec,
  };
}

function getPositiveMetadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function getDecorationGroundCoverMask(
  item: Pick<GameCatalogItem, 'itemType' | 'metadata'> | undefined,
  entity: Pick<ChildWorldEntity, 'x' | 'z' | 'rotationY' | 'scale'>,
): DecorationGroundCoverMask | undefined {
  if (item?.itemType !== 'decoration' || item.metadata.passThrough !== true) return undefined;
  const width = getPositiveMetadataNumber(item.metadata, 'groundCoverWidth');
  const depth = getPositiveMetadataNumber(item.metadata, 'groundCoverDepth');
  if (!width || !depth) return undefined;
  const scale = Number.isFinite(entity.scale) && entity.scale > 0 ? entity.scale : 1;
  const edgeSoftness = getPositiveMetadataNumber(item.metadata, 'groundCoverEdgeSoftness') ?? 0.08;
  return {
    x: entity.x,
    z: entity.z,
    rotationY: Number.isFinite(entity.rotationY) ? entity.rotationY : 0,
    halfWidth: width * scale * 0.5,
    halfDepth: depth * scale * 0.5,
    edgeSoftness: edgeSoftness * scale,
    shape: item.metadata.groundCoverShape === 'circle' ? 'circle' : 'rectangle',
  };
}

export function getDecorationGroundCoverMaskForTransform(
  item: Pick<GameCatalogItem, 'itemType' | 'metadata'> | undefined,
  transform: WorldTransform,
): DecorationGroundCoverMask | undefined {
  return getDecorationGroundCoverMask(item, transform);
}

export function getDecorationGroundCoverMasks(
  gameData: ChildGameData,
  excludedEntityId?: string,
): DecorationGroundCoverMask[] {
  return gameData.worldEntities
    .filter((entity) => entity.entityKind === 'decoration' && entity.isActive && entity.id !== excludedEntityId)
    .map((entity) => getDecorationGroundCoverMask(getDecorationCatalogItem(gameData, entity), entity))
    .filter((mask): mask is DecorationGroundCoverMask => Boolean(mask));
}

export function getDecorationModelUrl(item: GameCatalogItem | undefined): string | undefined {
  return getLocalGameModelUrl(item?.itemType === 'decoration' ? item : undefined) ?? undefined;
}

export function getDecorationGroundOffset(item: GameCatalogItem | undefined): number {
  const groundOffset = item?.metadata.groundOffset;
  return typeof groundOffset === 'number' && Number.isFinite(groundOffset) ? groundOffset : 0;
}
