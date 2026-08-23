export interface FriendWorldPetPresentation {
  displayName: string;
  metadata: Record<string, unknown>;
}

const FRIEND_WORLD_PET_NAMES: Readonly<Record<string, string>> = {
  'pet.ailite': '艾莉特',
  'pet.arcadia': '阿卡迪亞',
  'pet.baruku-mushroom': '巴魯菇',
  'pet.belilos-fox': '貝里洛斯',
  'pet.buleifu-tiger': '布雷夫虎',
  'pet.christo': '克里斯多',
  'pet.cloud-bird': '雲朵小鳥',
  'pet.chrono-rabbit': '克羅諾',
  'pet.farm-bull': '大公牛',
  'pet.farm-calf': '小牛',
  'pet.farm-chick': '小雞',
  'pet.farm-lamb': '小羊',
  'pet.farm-piglet': '小豬',
  'pet.farm-rooster': '公雞',
  'pet.farm-sheep': '綿羊',
  'pet.farm-turkey': '火雞',
  'pet.forest-fox': '森林小狐',
  'pet.forest-guardian': '森林守護者',
  'pet.jasmine': '茉莉',
  'pet.kaldo': '卡爾多',
  'pet.magellan-rabbit': '麥哲倫',
  'pet.moko': '莫可',
  'pet.murphy-bear': '墨菲熊',
  'pet.nibus': '尼布斯',
  'pet.orian': '奧利安',
  'pet.oum': '歐姆',
  'pet.plush-bear': '棕熊玩偶',
  'pet.plush-bunny': '兔兔玩偶',
  'pet.plush-cat': '黑貓玩偶',
  'pet.plush-dog': '小狗玩偶',
  'pet.qifu-er': '齊福爾',
  'pet.silf-owl': '希爾芙',
  'pet.star-diver': '星辰潛者',
  'pet.starlight-sprout': '森林守護者',
  'pet.teddy-sou': '泰迪酥',
  'pet.yaoguang-deer': '瑤光',
};

const FRIEND_WORLD_DEFAULT_PET_METADATA: Readonly<Record<string, unknown>> = {
  hideGroundMarker: true,
  groundShadowScaleMultiplier: 0.22,
  nameLabelScaleMultiplier: 0.55,
};

const FRIEND_WORLD_NO_SHADOW_PETS = new Set(['pet.jasmine', 'pet.star-diver', 'pet.teddy-sou']);

export function getFriendWorldPetPresentation(assetKey: string): FriendWorldPetPresentation {
  return {
    displayName: FRIEND_WORLD_PET_NAMES[assetKey] ?? '寵物夥伴',
    metadata: {
      ...FRIEND_WORLD_DEFAULT_PET_METADATA,
      ...(FRIEND_WORLD_NO_SHADOW_PETS.has(assetKey) ? { hideGroundShadow: true } : {}),
    },
  };
}
