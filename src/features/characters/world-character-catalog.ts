export interface WorldCharacterOption {
  id: string;
  name: string;
  assetKey: string;
  modelUrl: string;
  thumbnailUrl: string;
  description: string;
}

/**
 * The ChibiCharacters package ships idle, walk and run clips in every model.
 * Keep this small catalog local so the parent can select a starting character
 * before the child has an authenticated game-data session.
 */
export const WORLD_CHARACTER_CATALOG: readonly WorldCharacterOption[] = [
  {
    id: 'character.chibi-archer',
    name: '弓箭手',
    assetKey: 'character.chibi-archer',
    modelUrl: '/assets/chibi-characters/archer.glb',
    thumbnailUrl: '/assets/chibi-characters/archer-thumbnail.png',
    description: '帶著弓箭探索森林的敏捷旅人。',
  },
  {
    id: 'character.chibi-knight',
    name: '騎士',
    assetKey: 'character.chibi-knight',
    modelUrl: '/assets/chibi-characters/knight.glb',
    thumbnailUrl: '/assets/chibi-characters/knight-thumbnail.png',
    description: '穿上盔甲守護冒險夥伴。',
  },
  {
    id: 'character.chibi-merchant',
    name: '商人',
    assetKey: 'character.chibi-merchant',
    modelUrl: '/assets/chibi-characters/merchant.glb',
    thumbnailUrl: '/assets/chibi-characters/merchant-thumbnail.png',
    description: '背著行囊尋找新奇寶物。',
  },
  {
    id: 'character.chibi-ninja',
    name: '忍者',
    assetKey: 'character.chibi-ninja',
    modelUrl: '/assets/chibi-characters/ninja.glb',
    thumbnailUrl: '/assets/chibi-characters/ninja-thumbnail.png',
    description: '安靜又俐落地穿梭世界。',
  },
  {
    id: 'character.chibi-student',
    name: '學生',
    assetKey: 'character.chibi-student',
    modelUrl: '/assets/chibi-characters/student.glb',
    thumbnailUrl: '/assets/chibi-characters/student-thumbnail.png',
    description: '把每天的學習變成一場冒險。',
  },
];

const worldCharacterById = new Map(WORLD_CHARACTER_CATALOG.map((character) => [character.id, character]));

export function getWorldCharacterById(characterId: string | null | undefined): WorldCharacterOption | undefined {
  return characterId ? worldCharacterById.get(characterId) : undefined;
}

export function getWorldCharacterByAssetKey(assetKey: string | null | undefined): WorldCharacterOption | undefined {
  return assetKey ? WORLD_CHARACTER_CATALOG.find((character) => character.assetKey === assetKey) : undefined;
}
