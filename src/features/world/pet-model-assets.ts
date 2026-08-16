import type { ChildWorldEntity, GameCatalogItem } from './contracts';
import { getLocalGameModelUrl } from './game-content-assets';

type PetCatalogLookup = Pick<GameCatalogItem, 'assetKey' | 'metadata'>;

export function getPetModelUrl(item: PetCatalogLookup | undefined): string | undefined {
  return getLocalGameModelUrl(item ? { itemType: 'pet', assetKey: item.assetKey } : undefined) ?? undefined;
}

export function resolvePetCatalogItem(
  entity: Pick<ChildWorldEntity, 'catalogItemId' | 'assetKey'>,
  catalogById: ReadonlyMap<string, GameCatalogItem>,
  catalogByAssetKey: ReadonlyMap<string, GameCatalogItem>,
): GameCatalogItem | undefined {
  return (entity.catalogItemId ? catalogById.get(entity.catalogItemId) : undefined)
    ?? (entity.assetKey ? catalogByAssetKey.get(entity.assetKey) : undefined);
}
