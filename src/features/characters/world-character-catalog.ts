export interface WorldCharacterOption {
  id: string;
  name: string;
  assetKey: string;
  modelUrl: string;
  thumbnailUrl: string;
  description: string;
}

export const CURRENT_WORLD_CHARACTER_ID = 'character.arthur';

/**
 * These are the mobile-optimized supplied characters. Each model ships an
 * in-place walk clip; models may also provide an authored idle clip.
 */
export const WORLD_CHARACTER_CATALOG: readonly WorldCharacterOption[] = [
  {
    id: 'character.arthur',
    name: '亞瑟',
    assetKey: 'character.arthur',
    modelUrl: '/assets/characters/arthur.glb',
    thumbnailUrl: '/assets/characters/arthur-thumbnail.webp',
    description: '帶著溫暖笑容、勇敢踏上冒險的旅人。',
  },
  {
    id: 'character.elina',
    name: '艾利娜',
    assetKey: 'character.elina',
    modelUrl: '/assets/characters/elina.glb',
    thumbnailUrl: '/assets/characters/elina-thumbnail.webp',
    description: '帶著輕盈步伐探索日常的小小冒險家。',
  },
  {
    id: 'character.sia',
    name: '希雅',
    assetKey: 'character.sia',
    modelUrl: '/assets/characters/sia.glb',
    thumbnailUrl: '/assets/characters/sia-thumbnail.webp',
    description: '細心觀察世界、總能發現新線索的夥伴。',
  },
  {
    id: 'character.elio',
    name: '艾利歐',
    assetKey: 'character.elio',
    modelUrl: '/assets/characters/elio.glb',
    thumbnailUrl: '/assets/characters/elio-thumbnail.webp',
    description: '背著小行囊，準備好迎接每一個新發現。',
  },
  {
    id: 'character.moss',
    name: '莫斯',
    assetKey: 'character.moss',
    modelUrl: '/assets/characters/moss.glb',
    thumbnailUrl: '/assets/characters/moss-thumbnail.webp',
    description: '帶著鹿角與森林氣息，安靜地踏上冒險旅程。',
  },
  {
    id: 'character.noah',
    name: '諾亞',
    assetKey: 'character.noah',
    modelUrl: '/assets/characters/noah.glb',
    thumbnailUrl: '/assets/characters/noah-thumbnail.webp',
    description: '穿著黃色雨衣，帶著探索精神踏上海邊旅程。',
  },
  {
    id: 'character.collette',
    name: '柯蕾特',
    assetKey: 'character.collette',
    modelUrl: '/assets/characters/collette.glb',
    thumbnailUrl: '/assets/characters/collette-thumbnail.webp',
    description: '戴著藍色貝雷帽，穿著紅裙踏上溫暖的小旅程。',
  },
  {
    id: 'character.violette',
    name: '薇歐莉特',
    assetKey: 'character.violette',
    modelUrl: '/assets/characters/violette.glb',
    thumbnailUrl: '/assets/characters/violette-thumbnail.webp',
    description: '帶著薰衣草色長髮，在溫柔晨光中展開每日冒險。',
  },
  {
    id: 'character.gilt',
    name: '吉爾特',
    assetKey: 'character.gilt',
    modelUrl: '/assets/characters/gilt.glb',
    thumbnailUrl: '/assets/characters/gilt-thumbnail.webp',
    description: '穿著閃電雨衣，在每一場雨裡收集勇氣與新發現。',
  },
  {
    id: 'character.lunalia',
    name: '露娜莉亞',
    assetKey: 'character.lunalia',
    modelUrl: '/assets/characters/lunalia.glb',
    thumbnailUrl: '/assets/characters/lunalia-thumbnail.webp',
    description: '伴著月光與樹影，溫柔地守護每一次夜間冒險。',
  },
];

const worldCharacterById = new Map(WORLD_CHARACTER_CATALOG.map((character) => [character.id, character]));

export function getWorldCharacterById(characterId: string | null | undefined): WorldCharacterOption | undefined {
  return characterId ? worldCharacterById.get(characterId) : undefined;
}

export function getWorldCharacterByAssetKey(assetKey: string | null | undefined): WorldCharacterOption | undefined {
  return assetKey ? WORLD_CHARACTER_CATALOG.find((character) => character.assetKey === assetKey) : undefined;
}
