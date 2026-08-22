import type { WorldTimePhase, WorldWeatherState } from './world-weather';

export type WeatherQuality = 'low' | 'high';

const WORLD_RAIN_VISUAL_AMOUNT = 0.3;
const WORLD_RAIN_LINE_LENGTH = 0.45;
const FIREFLY_COUNTS = Object.freeze({ low: 24, high: 48 });

export interface FireflyLayoutPosition {
  x: number;
  y: number;
  z: number;
  seed: number;
}

export function getFireflyCount(quality: WeatherQuality): number {
  return FIREFLY_COUNTS[quality];
}

export function getRainVisualIntensity(
  phase: WorldTimePhase,
  condition: WorldWeatherState['condition'],
): number {
  void phase;
  return condition === 'rain' || condition === 'storm' ? WORLD_RAIN_VISUAL_AMOUNT : 0;
}

export function getRainVisualLength(condition: WorldWeatherState['condition']): number {
  return condition === 'rain' || condition === 'storm' ? WORLD_RAIN_LINE_LENGTH : 0;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFireflyLayout({
  count,
  fieldSize,
  walkableSize,
  seed = 20260823,
}: {
  count: number;
  fieldSize: number;
  walkableSize: number;
  seed?: number;
}): FireflyLayoutPosition[] {
  const safeCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  const safeFieldHalf = Math.max(Number.isFinite(fieldSize) ? fieldSize * 0.5 : 0.5, 0.5);
  const safeWalkableHalf = Math.min(
    Math.max(Number.isFinite(walkableSize) ? walkableSize * 0.5 : safeFieldHalf * 0.4, 0.25),
    safeFieldHalf * 0.72,
  );
  const random = createSeededRandom(seed);
  const innerCount = Math.ceil(safeCount * 0.6);
  const outerCount = safeCount - innerCount;
  const layout: FireflyLayoutPosition[] = [];
  const innerGridWidth = Math.max(1, Math.ceil(Math.sqrt(innerCount)));
  const outerGridWidth = Math.max(1, Math.ceil(outerCount / 4));
  const outerInner = Math.min(safeWalkableHalf + 0.45, safeFieldHalf * 0.78);
  const outerOuter = safeFieldHalf * 0.92;

  for (let index = 0; index < innerCount; index += 1) {
    const row = Math.floor(index / innerGridWidth);
    const column = index % innerGridWidth;
    const xRatio = (column + 0.28 + random() * 0.44) / innerGridWidth;
    const zRatio = (row + 0.28 + random() * 0.44) / innerGridWidth;
    layout.push({
      x: (xRatio * 2 - 1) * safeWalkableHalf,
      y: 0.24 + random() * 1.65,
      z: (zRatio * 2 - 1) * safeWalkableHalf,
      seed: random() * Math.PI * 2,
    });
  }

  for (let index = 0; index < outerCount; index += 1) {
    const side = index % 4;
    const sideIndex = Math.floor(index / 4);
    const tangentRatio = (sideIndex + 0.32 + random() * 0.36) / outerGridWidth;
    const tangent = (tangentRatio * 2 - 1) * outerOuter;
    const radial = outerInner + random() * Math.max(outerOuter - outerInner, 0.1);
    const x = side === 0 ? radial : side === 1 ? -radial : tangent;
    const z = side === 2 ? radial : side === 3 ? -radial : tangent;
    layout.push({
      x,
      y: 0.28 + random() * 1.55,
      z,
      seed: random() * Math.PI * 2,
    });
  }

  return layout;
}
