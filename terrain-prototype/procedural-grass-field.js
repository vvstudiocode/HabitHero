export const GRASS_WIND_STRENGTH = 1.4;
export const MAX_GRASS_INTERACTORS = 2;

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

function requirePositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function getProceduralGrassCount({ width, pixelRatio }) {
  const safeWidth = finiteOr(width, 375);
  const safePixelRatio = finiteOr(pixelRatio, 1);

  if (safeWidth <= 480) return 43200;
  if (safeWidth <= 900 || safePixelRatio >= 2.5) return 75600;
  return 129600;
}

export function createProceduralGrassLayout({
  count,
  fieldSize,
  walkableSize = fieldSize * 0.4,
  baseHeight = 0,
  clumpCount = 64,
  seed = 20260809,
  outerDensityMultiplier = 1,
} = {}) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }
  requirePositiveNumber(fieldSize, 'fieldSize');
  requirePositiveNumber(walkableSize, 'walkableSize');
  if (!Number.isInteger(clumpCount) || clumpCount <= 0) {
    throw new Error('clumpCount must be a positive integer');
  }
  if (!Number.isInteger(outerDensityMultiplier) || outerDensityMultiplier <= 0) {
    throw new Error('outerDensityMultiplier must be a positive integer');
  }

  const random = createRandom(seed);
  const halfField = fieldSize / 2;
  const centers = Array.from({ length: clumpCount }, (_, index) => ({
    x: (random() - 0.5) * fieldSize * 0.94,
    z: (random() - 0.5) * fieldSize * 0.94,
    radius: 0.45 + random() * 1.25,
    lushness: 0.9 + random() * 0.2,
    index,
  }));

  const layout = Array.from({ length: count }, (_, index) => {
    const clump = centers[index % centers.length];
    // Rebalance the existing blade budget toward the tree line instead of
    // increasing total geometry; distant blades are softened by scene fog.
    const useWalkableArea = random() < (5 / 6);
    const useScatter = random() < 0.74;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * clump.radius;
    const clumpedX = clump.x + Math.cos(angle) * radius;
    const clumpedZ = clump.z + Math.sin(angle) * radius;
    const sampleSize = useWalkableArea ? Math.min(walkableSize, fieldSize) : fieldSize;
    const x = Math.min(Math.max(
      useWalkableArea || useScatter ? (random() - 0.5) * sampleSize : clumpedX,
      -halfField,
    ), halfField);
    const z = Math.min(Math.max(
      useWalkableArea || useScatter ? (random() - 0.5) * sampleSize : clumpedZ,
      -halfField,
    ), halfField);

    return {
      x,
      y: baseHeight,
      z,
      height: Math.min(0.173, 0.067 + random() * 0.1 * clump.lushness),
      width: 0.01 + random() * 0.018,
      rotation: random() * Math.PI * 2,
      phase: random() * Math.PI * 2,
      color: random(),
      clump: useScatter ? -1 : clump.index,
    };
  });

  if (outerDensityMultiplier === 1) return layout;

  const walkableHalf = Math.min(walkableSize, fieldSize) * 0.5;
  const outerBlades = layout.filter(blade => (
    Math.abs(blade.x) > walkableHalf || Math.abs(blade.z) > walkableHalf
  ));
  const extraOuterBlades = [];
  for (let copyIndex = 1; copyIndex < outerDensityMultiplier; copyIndex += 1) {
    const outwardOffset = copyIndex * 0.018;
    outerBlades.forEach((blade, bladeIndex) => {
      const distance = Math.max(Math.hypot(blade.x, blade.z), 0.001);
      const heightVariation = bladeIndex % 2 === 0 ? 0.96 : 1.04;
      extraOuterBlades.push({
        ...blade,
        x: Math.min(Math.max(blade.x + (blade.x / distance) * outwardOffset, -halfField), halfField),
        z: Math.min(Math.max(blade.z + (blade.z / distance) * outwardOffset, -halfField), halfField),
        height: Math.min(0.173, blade.height * heightVariation),
        width: blade.width * (copyIndex % 2 === 0 ? 0.94 : 1.06),
        rotation: (blade.rotation + copyIndex * 0.83) % (Math.PI * 2),
        phase: (blade.phase + copyIndex * 1.17) % (Math.PI * 2),
      });
    });
  }

  return [...layout, ...extraOuterBlades];
}

export function updateGrassInteractionState({
  previousPosition,
  currentPosition,
  previousStrength = 0,
  previousDirection = { x: 0, z: 1 },
  delta,
}) {
  const safeDelta = Math.max(finiteOr(delta, 0), 0.001);
  const dx = finiteOr(currentPosition?.x, 0) - finiteOr(previousPosition?.x, 0);
  const dz = finiteOr(currentPosition?.z, 0) - finiteOr(previousPosition?.z, 0);
  const distance = Math.hypot(dx, dz);
  const speed = distance / safeDelta;
  const targetStrength = Math.min(speed / 0.82, 1);
  const response = targetStrength > previousStrength ? 0.045 : 0.32;
  const blend = 1 - Math.exp(-safeDelta / response);
  const strength = Math.min(Math.max(previousStrength + (targetStrength - previousStrength) * blend, 0), 1);

  if (distance <= 0.00001) {
    return {
      direction: {
        x: finiteOr(previousDirection?.x, 0),
        z: finiteOr(previousDirection?.z, 1),
      },
      strength,
    };
  }

  return {
    direction: { x: dx / distance, z: dz / distance },
    strength,
  };
}
