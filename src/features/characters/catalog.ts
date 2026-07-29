export type ChildGender = 'boy' | 'girl';
export type CharacterCategory = 'adventure' | 'nature' | 'fantasy';

export interface CharacterOption {
  id: string;
  name: string;
  category: CharacterCategory;
  imageUrl: string;
  desktopImageUrl?: string;
  accentColor: string;
  description: string;
}

export const CHARACTER_CATALOG: readonly CharacterOption[] = [
  { id: 'pink-catgirl-room', name: '粉貓女', category: 'fantasy', imageUrl: '/images/habithero-catgirl-room.png', desktopImageUrl: '/images/habithero-catgirl-room-desktop.png', accentColor: '#f472b6', description: '在溫暖房間裡展開每天的小冒險' },
  { id: 'black-catboy-room', name: '黑貓男', category: 'fantasy', imageUrl: '/images/habithero-black-catboy-room.png', desktopImageUrl: '/images/habithero-black-catboy-room-desktop.png', accentColor: '#d9d9df', description: '在充滿收藏與靈感的房間裡展開每天的小冒險' },
];

export const CHARACTER_CATEGORIES: { id: 'all' | CharacterCategory; label: string }[] = [
  { id: 'all', label: '全部' },
];

export function getCharacterById(characterId: string | null | undefined): CharacterOption | undefined {
  return CHARACTER_CATALOG.find(character => character.id === characterId);
}

export function getCharacterByImageUrl(imageUrl: string): CharacterOption | undefined {
  return CHARACTER_CATALOG.find(character => character.imageUrl === imageUrl || character.desktopImageUrl === imageUrl);
}

export function getCharactersForCategory(category: 'all' | CharacterCategory): CharacterOption[] {
  return category === 'all' ? [...CHARACTER_CATALOG] : CHARACTER_CATALOG.filter(character => character.category === category);
}
