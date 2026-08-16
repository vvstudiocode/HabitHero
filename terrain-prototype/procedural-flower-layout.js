export const FLOWER_COLORS = Object.freeze(['yellow', 'red', 'white', 'blue', 'purple']);

const FLOWER_COLOR_VALUES = Object.freeze({
  yellow: 0xffd85a,
  red: 0xe96a62,
  white: 0xfff8df,
  blue: 0x76aee8,
  purple: 0xb58be8,
});

const WALKABLE_FLOWER_DENSITY_MULTIPLIER = 3;
const WALKABLE_FLOWER_CENTER_CLEARANCE_RATIO = 0.06;

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

export function getProceduralFlowerCount({ width }) {
  const safeWidth = Number.isFinite(width) ? width : 375;
  if (safeWidth <= 480) return 84 * WALKABLE_FLOWER_DENSITY_MULTIPLIER;
  if (safeWidth <= 900) return 116 * WALKABLE_FLOWER_DENSITY_MULTIPLIER;
  return 156 * WALKABLE_FLOWER_DENSITY_MULTIPLIER;
}

export function createProceduralFlowerLayout({
  count,
  walkableSize,
  baseHeight = 0,
  seed = 20260809,
} = {}) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }
  if (!Number.isFinite(walkableSize) || walkableSize <= 0) {
    throw new Error('walkableSize must be a positive number');
  }

  const random = createRandom(seed);
  const halfSpread = walkableSize * 0.45;

  return Array.from({ length: count }, (_, index) => {
    let x;
    let z;
    do {
      x = (random() * 2 - 1) * halfSpread;
      z = (random() * 2 - 1) * halfSpread;
    } while (Math.hypot(x, z) < walkableSize * WALKABLE_FLOWER_CENTER_CLEARANCE_RATIO);

    const color = FLOWER_COLORS[(index + Math.floor(random() * FLOWER_COLORS.length)) % FLOWER_COLORS.length];
    return {
      x,
      y: baseHeight,
      z,
      height: 0.052 + random() * 0.052,
      size: 0.025 + random() * 0.018,
      rotation: random() * Math.PI * 2,
      color,
      colorValue: FLOWER_COLOR_VALUES[color],
    };
  });
}
