import type { GameCatalogItem, GameItemType } from './contracts';
import { WORLD_CHARACTER_CATALOG } from '../characters/world-character-catalog';

export interface LocalGameAsset {
  modelUrl: string | null;
  thumbnailUrl: string | null;
}

const EMPTY_LOCAL_GAME_ASSET: LocalGameAsset = {
  modelUrl: null,
  thumbnailUrl: null,
};

const CHARACTER_ASSETS: Readonly<Record<string, LocalGameAsset>> = Object.fromEntries(
  WORLD_CHARACTER_CATALOG.map((character) => [character.assetKey, {
    modelUrl: character.modelUrl,
    thumbnailUrl: character.thumbnailUrl,
  }]),
);

const PET_ASSETS: Readonly<Record<string, LocalGameAsset>> = {
  'pet.arcadia': { modelUrl: '/assets/pets/arcadia.glb', thumbnailUrl: '/assets/pets/arcadia-thumbnail.webp' },
  'pet.baruku-mushroom': { modelUrl: '/assets/pets/baruku-mushroom.glb', thumbnailUrl: '/assets/pets/baruku-mushroom-thumbnail.png' },
  'pet.belilos-fox': { modelUrl: '/assets/pets/belilos-fox.glb', thumbnailUrl: '/assets/pets/belilos-fox-thumbnail.webp' },
  'pet.buleifu-tiger': { modelUrl: '/assets/pets/buleifu-tiger.glb', thumbnailUrl: '/assets/pets/buleifu-tiger-thumbnail.webp' },
  'pet.christo': { modelUrl: '/assets/pets/christo.glb', thumbnailUrl: '/assets/pets/christo-thumbnail.png' },
  'pet.chrono-rabbit': { modelUrl: '/assets/pets/chrono-rabbit.glb', thumbnailUrl: '/assets/pets/chrono-rabbit-thumbnail.png' },
  'pet.forest-guardian': { modelUrl: '/assets/starlight-sprout-pet.glb', thumbnailUrl: '/assets/forest-guardian-thumbnail.png' },
  'pet.kaldo': { modelUrl: '/assets/pets/kaldo.glb', thumbnailUrl: '/assets/pets/kaldo-thumbnail.png' },
  'pet.magellan-rabbit': { modelUrl: '/assets/pets/magellan-rabbit.glb', thumbnailUrl: '/assets/pets/magellan-rabbit-thumbnail.png' },
  'pet.moko': { modelUrl: '/assets/pets/moko.glb', thumbnailUrl: '/assets/pets/moko-thumbnail.png' },
  'pet.murphy-bear': { modelUrl: '/assets/pets/murphy-bear.glb', thumbnailUrl: '/assets/pets/murphy-bear-thumbnail.png' },
  'pet.nibus': { modelUrl: '/assets/pets/nibus.glb', thumbnailUrl: '/assets/pets/nibus-thumbnail.png' },
  'pet.orian': { modelUrl: '/assets/pets/orian.glb', thumbnailUrl: '/assets/pets/orian-thumbnail.png' },
  'pet.oum': { modelUrl: '/assets/pets/oum.glb', thumbnailUrl: '/assets/pets/oum-thumbnail.webp' },
  'pet.silf-owl': { modelUrl: '/assets/pets/silf-owl.glb', thumbnailUrl: '/assets/pets/silf-owl-thumbnail.png' },
  'pet.star-diver': { modelUrl: '/assets/pets/star-diver.glb', thumbnailUrl: '/assets/pets/star-diver-thumbnail.png' },
  // Keep the stable legacy key used by the SQL migrations and point it at the
  // packaged Forest Guardian presentation.
  'pet.starlight-sprout': { modelUrl: '/assets/starlight-sprout-pet.glb', thumbnailUrl: '/assets/forest-guardian-thumbnail.png' },
  'pet.yaoguang-deer': { modelUrl: '/assets/pets/yaoguang-deer.glb', thumbnailUrl: '/assets/pets/yaoguang-deer-thumbnail.png' },
};

const DECORATION_ASSETS: Readonly<Record<string, LocalGameAsset>> = {
  'decoration.adventure-table': { modelUrl: '/assets/decorations/adventure-table.glb', thumbnailUrl: '/assets/decorations/adventure-table-thumbnail.png' },
  'decoration.bed': { modelUrl: '/assets/decorations/bed.glb', thumbnailUrl: '/assets/decorations/bed-thumbnail.png' },
  'decoration.bookcase': { modelUrl: '/assets/decorations/bookcase.glb', thumbnailUrl: '/assets/decorations/bookcase-thumbnail.png' },
  'decoration.curtain-wall': { modelUrl: '/assets/decorations/curtain-wall.glb', thumbnailUrl: '/assets/decorations/curtain-wall-thumbnail.webp' },
  'decoration.fountain': { modelUrl: '/assets/decorations/fountain.glb', thumbnailUrl: '/assets/decorations/fountain-thumbnail.png' },
  'decoration.nightstand': { modelUrl: '/assets/decorations/nightstand.glb', thumbnailUrl: '/assets/decorations/nightstand-thumbnail.png' },
  'decoration.wall': { modelUrl: '/assets/decorations/wall.glb', thumbnailUrl: '/assets/decorations/wall-thumbnail.webp' },
  'decoration.study-chair': { modelUrl: '/assets/decorations/study-chair.glb', thumbnailUrl: '/assets/decorations/study-chair-thumbnail.png' },
  'decoration.study-desk': { modelUrl: '/assets/decorations/study-desk.glb', thumbnailUrl: '/assets/decorations/study-desk-thumbnail.png' },
};

const LOCAL_GAME_ASSETS: Readonly<Record<GameItemType, Readonly<Record<string, LocalGameAsset>>>> = {
  character: CHARACTER_ASSETS,
  pet: PET_ASSETS,
  decoration: DECORATION_ASSETS,
};

export function getLocalGameAsset(itemType: GameItemType, assetKey: string | null | undefined): LocalGameAsset {
  if (!assetKey) return EMPTY_LOCAL_GAME_ASSET;
  return LOCAL_GAME_ASSETS[itemType][assetKey] ?? EMPTY_LOCAL_GAME_ASSET;
}

export function getLocalGameThumbnailUrl(item: Pick<GameCatalogItem, 'itemType' | 'assetKey'>): string | null {
  return getLocalGameAsset(item.itemType, item.assetKey).thumbnailUrl;
}

export function getLocalGameModelUrl(item: Pick<GameCatalogItem, 'itemType' | 'assetKey'> | undefined): string | null {
  return item ? getLocalGameAsset(item.itemType, item.assetKey).modelUrl : null;
}

export function isLocalGameItem3DPreviewEnabled(item: Pick<GameCatalogItem, 'itemType' | 'assetKey'>): boolean {
  return getLocalGameModelUrl(item) !== null;
}

export function isLocalGameItemShopSupported(item: Pick<GameCatalogItem, 'itemType' | 'assetKey'>): boolean {
  return getLocalGameThumbnailUrl(item) !== null;
}
