export const WARM_HAND_PAINTED_CHARACTER_STYLE = Object.freeze({
  roughness: 0.86,
  metalness: 0,
  envMapIntensity: 0.2,
  specularIntensity: 0.35,
  colorTint: Object.freeze([1, 0.975, 0.93] as const),
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
