export const NATURAL_WORLD_VISUAL_SETTINGS = Object.freeze({
  low: Object.freeze({
    backgroundColor: 0x79b9d6,
    fogColor: 0xb9b08d,
    fogNear: 11.5,
    fogFar: 24,
    sunColor: 0xffd4b2,
    sunIntensity: 2.7,
    sunPosition: [5.5, 8.5, -4.5],
    sunDirection: [0.52, 0.75, -0.43],
    grassAmbientColor: 0xc2bdad,
    hemisphereSkyColor: 0xffebdf,
    hemisphereGroundColor: 0x777265,
    hemisphereIntensity: 1.5,
    environmentIntensity: 0.24,
    exposure: 1.02,
    sunlightPatchColor: 0xffc4a0,
    sunlightPatchOpacity: 0.06,
    sunlightPatchCount: 2,
    butterflyCount: 3,
    pollenCount: 48,
    pollenOpacity: 0.12,
  }),
  high: Object.freeze({
    backgroundColor: 0x79b9d6,
    fogColor: 0xb9b08d,
    fogNear: 11,
    fogFar: 29,
    sunColor: 0xffd4b2,
    sunIntensity: 3.0,
    sunPosition: [5.5, 8.5, -4.5],
    sunDirection: [0.52, 0.75, -0.43],
    grassAmbientColor: 0xcac4b3,
    hemisphereSkyColor: 0xffebdf,
    hemisphereGroundColor: 0x777265,
    hemisphereIntensity: 1.68,
    environmentIntensity: 0.27,
    exposure: 1.04,
    sunlightPatchColor: 0xffc4a0,
    sunlightPatchOpacity: 0.09,
    sunlightPatchCount: 4,
    butterflyCount: 5,
    pollenCount: 120,
    pollenOpacity: 0.17,
  }),
});

function createRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function requirePositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}

export function getNaturalWorldVisualSettings(quality = 'high') {
  return NATURAL_WORLD_VISUAL_SETTINGS[quality] ?? NATURAL_WORLD_VISUAL_SETTINGS.high;
}

export function createAmbientPollenLayout({ count = 1, fieldSize = 1, seed = 20260811, height = 4 } = {}) {
  requirePositiveInteger(count, 'count');
  requirePositiveNumber(fieldSize, 'fieldSize');
  requirePositiveNumber(height, 'height');

  const random = createRandom(seed);
  const halfField = fieldSize * 0.5;
  const minimumHeight = Math.min(0.35, height * 0.5);

  return Array.from({ length: count }, () => ({
    x: (random() * 2 - 1) * halfField,
    y: minimumHeight + random() * Math.max(height - minimumHeight, 0.001),
    z: (random() * 2 - 1) * halfField,
    size: 0.6 + random() * 0.8,
    phase: random() * Math.PI * 2,
  }));
}
