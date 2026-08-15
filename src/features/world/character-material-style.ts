export const WARM_HAND_PAINTED_CHARACTER_STYLE = Object.freeze({
  roughness: 0.86,
  metalness: 0,
  envMapIntensity: 0.2,
  specularIntensity: 0.35,
  colorTint: Object.freeze([1, 0.975, 0.93] as const),
});

/**
 * A flatter, brighter material pass for supplied pets. Keep the original
 * albedo map for each pet, but remove relief/reflection inputs that make the
 * models read as plastic or metal in the meadow light.
 */
export const PICTUREBOOK_PET_MATERIAL_STYLE = Object.freeze({
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0,
  specularIntensity: 0.12,
  clearcoat: 0,
  clearcoatRoughness: 1,
  transmission: 0,
  iridescence: 0,
  sheen: 0,
  flatShading: true,
  colorLift: Object.freeze([1.08, 1.04, 0.98] as const),
});

export interface WarmHandPaintedCharacterMaterial {
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  specularIntensity?: number;
  color?: {
    r?: number;
    g?: number;
    b?: number;
    setRGB?: (red: number, green: number, blue: number) => void;
  };
  map?: {
    colorSpace?: string;
    needsUpdate?: boolean;
  };
  needsUpdate?: boolean;
}

export interface PicturebookPetMaterial extends WarmHandPaintedCharacterMaterial {
  [key: string]: unknown;
  flatShading?: boolean;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  iridescence?: number;
  sheen?: number;
  reflectivity?: number;
  normalMap?: object | null;
  roughnessMap?: object | null;
  metalnessMap?: object | null;
  clearcoatMap?: object | null;
  clearcoatNormalMap?: object | null;
  clearcoatRoughnessMap?: object | null;
  specularMap?: object | null;
  specularColorMap?: object | null;
  specularIntensityMap?: object | null;
  sheenColorMap?: object | null;
  sheenRoughnessMap?: object | null;
  transmissionMap?: object | null;
  thicknessMap?: object | null;
  envMap?: object | null;
}

/**
 * Keep imported character textures intact while moving their live rendering
 * toward a warm, matte, hand-painted animation look.
 */
export function applyWarmHandPaintedCharacterMaterial(
  material: WarmHandPaintedCharacterMaterial,
): WarmHandPaintedCharacterMaterial {
  material.roughness = WARM_HAND_PAINTED_CHARACTER_STYLE.roughness;
  material.metalness = WARM_HAND_PAINTED_CHARACTER_STYLE.metalness;
  material.envMapIntensity = WARM_HAND_PAINTED_CHARACTER_STYLE.envMapIntensity;
  material.specularIntensity = WARM_HAND_PAINTED_CHARACTER_STYLE.specularIntensity;

  const [red, green, blue] = WARM_HAND_PAINTED_CHARACTER_STYLE.colorTint;
  if (material.color) {
    if (typeof material.color.r === 'number' && typeof material.color.g === 'number' && typeof material.color.b === 'number') {
      material.color.r *= red;
      material.color.g *= green;
      material.color.b *= blue;
    } else {
      material.color.setRGB?.(red, green, blue);
    }
  }

  if (material.map) {
    material.map.colorSpace = 'srgb';
    material.map.needsUpdate = true;
  }
  material.needsUpdate = true;
  return material;
}

const PICTUREBOOK_RELIEF_MAP_KEYS = [
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'specularMap',
  'specularColorMap',
  'specularIntensityMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'transmissionMap',
  'thicknessMap',
  'envMap',
] as const;

export function applyPicturebookPetMaterial(
  material: PicturebookPetMaterial,
): PicturebookPetMaterial {
  material.roughness = PICTUREBOOK_PET_MATERIAL_STYLE.roughness;
  material.metalness = PICTUREBOOK_PET_MATERIAL_STYLE.metalness;
  material.envMapIntensity = PICTUREBOOK_PET_MATERIAL_STYLE.envMapIntensity;
  material.specularIntensity = PICTUREBOOK_PET_MATERIAL_STYLE.specularIntensity;
  material.clearcoat = PICTUREBOOK_PET_MATERIAL_STYLE.clearcoat;
  material.clearcoatRoughness = PICTUREBOOK_PET_MATERIAL_STYLE.clearcoatRoughness;
  material.transmission = PICTUREBOOK_PET_MATERIAL_STYLE.transmission;
  material.iridescence = PICTUREBOOK_PET_MATERIAL_STYLE.iridescence;
  material.sheen = PICTUREBOOK_PET_MATERIAL_STYLE.sheen;
  material.reflectivity = 0.12;
  material.flatShading = PICTUREBOOK_PET_MATERIAL_STYLE.flatShading;

  PICTUREBOOK_RELIEF_MAP_KEYS.forEach((key) => {
    const detachedTexture = material[key];
    if (
      detachedTexture
      && detachedTexture !== material.map
      && typeof detachedTexture === 'object'
      && 'dispose' in detachedTexture
      && typeof detachedTexture.dispose === 'function'
    ) {
      detachedTexture.dispose();
    }
    material[key] = null;
  });

  const [red, green, blue] = PICTUREBOOK_PET_MATERIAL_STYLE.colorLift;
  if (material.color) {
    if (typeof material.color.r === 'number' && typeof material.color.g === 'number' && typeof material.color.b === 'number') {
      material.color.r *= red;
      material.color.g *= green;
      material.color.b *= blue;
    } else {
      material.color.setRGB?.(red, green, blue);
    }
  }

  if (material.map) {
    material.map.colorSpace = 'srgb';
    material.map.needsUpdate = true;
  }
  material.needsUpdate = true;
  return material;
}
