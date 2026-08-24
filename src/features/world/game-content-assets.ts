import type { GameCatalogItem, GameItemType } from './contracts';
import { WORLD_CHARACTER_CATALOG } from '../characters/world-character-catalog';

export interface LocalGameAsset {
  modelUrl: string | null;
  thumbnailUrl: string | null;
}

export interface LocalDecorationRuntimeDefaults {
  collisionRadius: number;
  metadata: Record<string, unknown>;
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
  'pet.ailite': { modelUrl: '/assets/pets/ailite.glb', thumbnailUrl: '/assets/pets/ailite-thumbnail.png' },
  'pet.arcadia': { modelUrl: '/assets/pets/arcadia.glb', thumbnailUrl: '/assets/pets/arcadia-thumbnail.webp' },
  'pet.baruku-mushroom': { modelUrl: '/assets/pets/baruku-mushroom.glb', thumbnailUrl: '/assets/pets/baruku-mushroom-thumbnail.png' },
  'pet.belilos-fox': { modelUrl: '/assets/pets/belilos-fox.glb', thumbnailUrl: '/assets/pets/belilos-fox-thumbnail.webp' },
  'pet.buleifu-tiger': { modelUrl: '/assets/pets/buleifu-tiger.glb', thumbnailUrl: '/assets/pets/buleifu-tiger-thumbnail.webp' },
  'pet.christo': { modelUrl: '/assets/pets/christo.glb', thumbnailUrl: '/assets/pets/christo-thumbnail.png' },
  'pet.chrono-rabbit': { modelUrl: '/assets/pets/chrono-rabbit.glb', thumbnailUrl: '/assets/pets/chrono-rabbit-thumbnail.png' },
  'pet.forest-guardian': { modelUrl: '/assets/starlight-sprout-pet.glb', thumbnailUrl: '/assets/forest-guardian-thumbnail.png' },
  'pet.jasmine': { modelUrl: '/assets/pets/jasmine.glb', thumbnailUrl: '/assets/pets/jasmine-thumbnail.png' },
  'pet.kaldo': { modelUrl: '/assets/pets/kaldo.glb', thumbnailUrl: '/assets/pets/kaldo-thumbnail.png' },
  'pet.magellan-rabbit': { modelUrl: '/assets/pets/magellan-rabbit.glb', thumbnailUrl: '/assets/pets/magellan-rabbit-thumbnail.png' },
  'pet.moko': { modelUrl: '/assets/pets/moko.glb', thumbnailUrl: '/assets/pets/moko-thumbnail.png' },
  'pet.murphy-bear': { modelUrl: '/assets/pets/murphy-bear.glb', thumbnailUrl: '/assets/pets/murphy-bear-thumbnail.png' },
  'pet.nibus': { modelUrl: '/assets/pets/nibus.glb', thumbnailUrl: '/assets/pets/nibus-thumbnail.png' },
  'pet.orian': { modelUrl: '/assets/pets/orian.glb', thumbnailUrl: '/assets/pets/orian-thumbnail.png' },
  'pet.oum': { modelUrl: '/assets/pets/oum.glb', thumbnailUrl: '/assets/pets/oum-thumbnail.webp' },
  'pet.qifu-er': { modelUrl: '/assets/pets/qifu-er.glb', thumbnailUrl: '/assets/pets/qifu-er-thumbnail.png' },
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
  'decoration.blue-rug': { modelUrl: '/assets/decorations/blue-rug.glb', thumbnailUrl: '/assets/decorations/blue-rug-thumbnail.png' },
  'decoration.bookcase': { modelUrl: '/assets/decorations/bookcase.glb', thumbnailUrl: '/assets/decorations/bookcase-thumbnail.png' },
  'decoration.computer-desk': { modelUrl: '/assets/decorations/computer-desk.glb', thumbnailUrl: '/assets/decorations/computer-desk-thumbnail.png' },
  'decoration.curtain-wall': { modelUrl: '/assets/decorations/curtain-wall.glb', thumbnailUrl: '/assets/decorations/curtain-wall-thumbnail.webp' },
  'decoration.floor-lamp': { modelUrl: '/assets/decorations/floor-lamp.glb', thumbnailUrl: '/assets/decorations/floor-lamp-thumbnail.png' },
  'decoration.fountain': { modelUrl: '/assets/decorations/fountain.glb', thumbnailUrl: '/assets/decorations/fountain-thumbnail.png' },
  'decoration.gaming-chair': { modelUrl: '/assets/decorations/gaming-chair.glb', thumbnailUrl: '/assets/decorations/gaming-chair-thumbnail.png' },
  'decoration.lavender-pattern-rug': { modelUrl: '/assets/decorations/lavender-pattern-rug.glb', thumbnailUrl: '/assets/decorations/lavender-pattern-rug-thumbnail.png' },
  'decoration.nightstand': { modelUrl: '/assets/decorations/nightstand.glb', thumbnailUrl: '/assets/decorations/nightstand-thumbnail.png' },
  'decoration.patchwork-rug': { modelUrl: '/assets/decorations/patchwork-rug.glb', thumbnailUrl: '/assets/decorations/patchwork-rug-thumbnail.png' },
  'decoration.pawprint-rug': { modelUrl: '/assets/decorations/pawprint-rug.glb', thumbnailUrl: '/assets/decorations/pawprint-rug-thumbnail.png' },
  'decoration.royal-crest-rug': { modelUrl: '/assets/decorations/royal-crest-rug.glb', thumbnailUrl: '/assets/decorations/royal-crest-rug-thumbnail.png' },
  'decoration.sofa': { modelUrl: '/assets/decorations/sofa.glb', thumbnailUrl: '/assets/decorations/sofa-thumbnail.png' },
  'decoration.stone-fire-pit': { modelUrl: '/assets/decorations/stone-fire-pit.glb', thumbnailUrl: '/assets/decorations/stone-fire-pit-thumbnail.png' },
  'decoration.wall': { modelUrl: '/assets/decorations/wall.glb', thumbnailUrl: '/assets/decorations/wall-thumbnail.webp' },
  'decoration.study-chair': { modelUrl: '/assets/decorations/study-chair.glb', thumbnailUrl: '/assets/decorations/study-chair-thumbnail.png' },
  'decoration.study-desk': { modelUrl: '/assets/decorations/study-desk.glb', thumbnailUrl: '/assets/decorations/study-desk-thumbnail.png' },
};

// Friend snapshots intentionally expose only safe asset keys. Keep the
// client-side presentation contract local so shared decorations still use the
// same grounding, collision, grass-mask, and light behavior as owned items
// without adding catalog metadata to a friend-world payload.
const DECORATION_RUNTIME_DEFAULTS: Readonly<Record<string, LocalDecorationRuntimeDefaults>> = {
  'decoration.study-desk': { collisionRadius: 0.95, metadata: { groundOffset: 0.713, navigationRadius: 0.58, navigationInset: 0.25, collisionShape: 'rectangle', collisionWidth: 2, collisionDepth: 1.08 } },
  'decoration.bookcase': { collisionRadius: 0.85, metadata: { groundOffset: 1, navigationRadius: 0.48, navigationInset: 0.25, collisionShape: 'rectangle', collisionWidth: 1.57, collisionDepth: 0.72 } },
  'decoration.study-chair': { collisionRadius: 0.65, metadata: { groundOffset: 1, navigationRadius: 0.36, navigationInset: 0.25, collisionShape: 'circle' } },
  'decoration.bed': { collisionRadius: 1.05, metadata: { groundOffset: 0.426, navigationRadius: 0.56, navigationInset: 0.25, collisionShape: 'rectangle', collisionWidth: 1.74, collisionDepth: 1.99 } },
  'decoration.nightstand': { collisionRadius: 0.52, metadata: { groundOffset: 1, navigationRadius: 0.32, navigationInset: 0.25, collisionShape: 'circle' } },
  'decoration.adventure-table': { collisionRadius: 0.78, metadata: { groundOffset: 0.5455, navigationRadius: 0.48, navigationInset: 0.25 } },
  'decoration.fountain': { collisionRadius: 0.68, metadata: { groundOffset: 1, navigationRadius: 0.4, navigationInset: 0.25, collisionShape: 'circle' } },
  'decoration.curtain-wall': { collisionRadius: 0.28, metadata: { groundOffset: 0.6309, navigationRadius: 0.28, navigationInset: 0.25, collisionShape: 'rectangle', collisionWidth: 2, collisionDepth: 0.3 } },
  'decoration.wall': { collisionRadius: 0.28, metadata: { groundOffset: 0.6309, navigationRadius: 0.28, navigationInset: 0.25, collisionShape: 'rectangle', collisionWidth: 2, collisionDepth: 0.3 } },
  'decoration.computer-desk': { collisionRadius: 0.95, metadata: { groundOffset: 0.8533437848, navigationRadius: 0.58, navigationInset: 0.25, collisionShape: 'rectangle', collisionWidth: 2, collisionDepth: 1.17 } },
  'decoration.sofa': { collisionRadius: 0.95, metadata: { groundOffset: 0.5177779794, navigationRadius: 0.58, navigationInset: 0.25, collisionShape: 'rectangle', collisionWidth: 1.9, collisionDepth: 1.11 } },
  'decoration.floor-lamp': { collisionRadius: 0.5, metadata: { groundOffset: 0.9516010284, navigationRadius: 0.32, navigationInset: 0.25, collisionShape: 'circle' } },
  'decoration.gaming-chair': { collisionRadius: 0.6, metadata: { groundOffset: 0.9510509968, navigationRadius: 0.44, navigationInset: 0.22, collisionShape: 'rectangle', collisionWidth: 0.95, collisionDepth: 0.82 } },
  'decoration.blue-rug': { collisionRadius: 0.05, metadata: { groundOffset: 0.0219800007, passThrough: true, groundCoverWidth: 1.96, groundCoverDepth: 1.96, groundCoverEdgeSoftness: 0.12 } },
  'decoration.patchwork-rug': { collisionRadius: 0.05, metadata: { groundOffset: 0.01094, passThrough: true, groundCoverWidth: 1.96, groundCoverDepth: 1.96, groundCoverEdgeSoftness: 0.12 } },
  'decoration.pawprint-rug': { collisionRadius: 0.05, metadata: { groundOffset: 0.02972, passThrough: true, groundCoverWidth: 1.96, groundCoverDepth: 1.96, groundCoverEdgeSoftness: 0.12 } },
  'decoration.lavender-pattern-rug': { collisionRadius: 0.05, metadata: { groundOffset: 0.00819, passThrough: true, groundCoverWidth: 1.96, groundCoverDepth: 1.96, groundCoverEdgeSoftness: 0.12 } },
  'decoration.royal-crest-rug': { collisionRadius: 0.05, metadata: { groundOffset: 0.01101, passThrough: true, groundCoverWidth: 1.96, groundCoverDepth: 1.96, groundCoverEdgeSoftness: 0.12 } },
  'decoration.stone-fire-pit': { collisionRadius: 0.65, metadata: { groundOffset: 0, passThrough: true, groundCoverWidth: 1.2, groundCoverDepth: 1.2, groundCoverShape: 'circle', groundCoverEdgeSoftness: 0.1, pointLight: true, pointLightColor: 16751181, pointLightIntensity: 2.2, pointLightDistance: 3.2, pointLightHeight: 0.34 } },
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

/**
 * Starter characters may use the built-in procedural renderer, while every
 * other owned item must be present in the current app's packaged asset map.
 * This is the same compatibility gate used by the shop, extended for the
 * free starter item that does not have a shop thumbnail.
 */
export function isLocalGameItemInventorySupported(
  item: Pick<GameCatalogItem, 'itemType' | 'assetKey' | 'isStarter'>,
): boolean {
  return item.isStarter || isLocalGameItemShopSupported(item);
}

export function getLocalDecorationRuntimeDefaults(assetKey: string): LocalDecorationRuntimeDefaults {
  return DECORATION_RUNTIME_DEFAULTS[assetKey] ?? { collisionRadius: 0.35, metadata: {} };
}
