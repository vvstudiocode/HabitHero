import type { ChildGameData, ChildWorldEntity, GameCatalogItem } from './contracts';
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

export function getDecorationModelUrl(item: GameCatalogItem | undefined): string | undefined {
  return getLocalGameModelUrl(item?.itemType === 'decoration' ? item : undefined) ?? undefined;
}

export function getDecorationGroundOffset(item: GameCatalogItem | undefined): number {
  const groundOffset = item?.metadata.groundOffset;
  return typeof groundOffset === 'number' && Number.isFinite(groundOffset) ? groundOffset : 0;
}
