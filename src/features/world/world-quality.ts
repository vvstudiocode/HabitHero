export type WorldQuality = 'low' | 'high';
export type WorldBudget = 'grass' | 'flower';

export const WORLD_QUALITY_SETTINGS = {
  low: {
    // These are relative scene-budget anchors. The runtime scales the
    // viewport-aware prototype counts against the high-quality anchors so
    // high quality remains visually identical to the standalone prototype.
    grassCount: 72,
    flowerCount: 10,
    maxPixelRatio: 1,
    swayAmplitude: 0.035,
    motionScale: 0.18,
    outerDensityMultiplier: 1,
    forestLayers: 3,
    shadows: false,
    shadowMapSize: 512,
  },
  high: {
    grassCount: 220,
    flowerCount: 28,
    maxPixelRatio: 2,
    swayAmplitude: 0.08,
    motionScale: 1,
    outerDensityMultiplier: 5,
    forestLayers: 7,
    shadows: true,
    shadowMapSize: 2048,
  },
} as const;

export function getWorldQuality(input: {
  prefersReducedMotion: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}): WorldQuality {
  if (
    input.prefersReducedMotion
    || (input.deviceMemory !== undefined && input.deviceMemory <= 2)
    || (input.hardwareConcurrency !== undefined && input.hardwareConcurrency <= 2)
  ) return 'low';
  return 'high';
}

export function scaleWorldBudget(baseCount: number, quality: WorldQuality, budget: WorldBudget): number {
  const safeBaseCount = Number.isFinite(baseCount) ? Math.max(1, Math.round(baseCount)) : 1;
  const highQualityCount = WORLD_QUALITY_SETTINGS.high[`${budget}Count`];
  const qualityCount = WORLD_QUALITY_SETTINGS[quality][`${budget}Count`];
  return Math.max(1, Math.round(safeBaseCount * (qualityCount / highQualityCount)));
}
