import type { ChildWorldEntity, GameCatalogItem } from './contracts';

type PetCatalogLookup = Pick<GameCatalogItem, 'assetKey' | 'metadata'>;

const CANONICAL_PET_MODEL_PATHS: Record<string, string> = {
  'pet.star-diver': '/assets/pets/star-diver.glb',
  'pet.teddy-sou': '/assets/pets/teddy-sou.glb',
};

export function getPetModelUrl(item: PetCatalogLookup | undefined, fallbackUrl: string): string {
  const canonicalModel = item?.assetKey ? CANONICAL_PET_MODEL_PATHS[item.assetKey] : undefined;
  if (canonicalModel) return canonicalModel;
  const metadataModel = item?.metadata.model;
  return typeof metadataModel === 'string'
    && metadataModel.startsWith('/assets/')
    && metadataModel.toLowerCase().endsWith('.glb')
    ? metadataModel
    : fallbackUrl;
}

export function resolvePetCatalogItem(
  entity: Pick<ChildWorldEntity, 'catalogItemId' | 'assetKey'>,
  catalogById: ReadonlyMap<string, GameCatalogItem>,
  catalogByAssetKey: ReadonlyMap<string, GameCatalogItem>,
): GameCatalogItem | undefined {
  return (entity.catalogItemId ? catalogById.get(entity.catalogItemId) : undefined)
    ?? (entity.assetKey ? catalogByAssetKey.get(entity.assetKey) : undefined);
}
