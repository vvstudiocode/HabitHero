import type { ChildGameData } from './contracts';
import type { WorldQuality } from './world-quality';
import type { WorldLocation } from './world-location';

function getWorldEntitiesSceneSignature(gameData: ChildGameData) {
  return [...gameData.worldEntities]
    // Both pets and decorations are synchronized by the mounted runtime. Keep
    // transforms and entity add/remove operations out of the remount key so a
    // placement mutation never flashes the whole terrain scene.
    .filter((entity) => entity.entityKind !== 'pet' && entity.entityKind !== 'decoration')
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entity) => [
      entity.id,
      entity.inventoryItemId,
      entity.entityKind,
      entity.worldLayoutVersion,
      entity.behaviorMode,
      entity.roamingSlot,
      entity.isActive,
      entity.collisionRadius,
      entity.assetKey,
      entity.displayName,
    ].join(':'))
    .join('|');
}

export function getTerrainWorldSceneKey(
  gameData: ChildGameData,
  quality: WorldQuality,
  showPetNames = true,
  worldLocation: WorldLocation = 'my-world',
): string {
  return [
    getWorldEntitiesSceneSignature(gameData),
    quality,
    showPetNames ? 'pet-names-on' : 'pet-names-off',
    worldLocation,
  ].join('||');
}
