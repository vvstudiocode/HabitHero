import type { AnimationClip, Object3D } from 'three';
import { getWorldCharacterByAssetKey } from '../characters/world-character-catalog';

export interface RemoteCharacterAsset {
  model: Object3D;
  animations: readonly AnimationClip[];
}

export function createRemoteCharacterLoader(options: {
  load: (url: string) => Promise<{ scene: Object3D; animations: readonly AnimationClip[] }>;
  applyStyle: (scene: Object3D) => void;
}): (characterAssetKey: string) => Promise<RemoteCharacterAsset | undefined> {
  return async (characterAssetKey) => {
    const character = getWorldCharacterByAssetKey(characterAssetKey);
    if (!character) return undefined;
    const result = await options.load(character.modelUrl);
    options.applyStyle(result.scene);
    return { model: result.scene, animations: result.animations };
  };
}
