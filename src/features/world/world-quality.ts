export type WorldQuality = 'low' | 'high';
export type WorldBudget = 'grass' | 'flower';

export const WORLD_QUALITY_SETTINGS = {
  low: {
    // These are relative scene-budget anchors. The runtime scales the
    // viewport-aware prototype counts against the high-quality anchors so
    // high quality remains visually identical to the standalone prototype.
    grassCount: 132,
    flowerCount: 10,
    maxPixelRatio: 1,
    // Keep a visible meadow edge while avoiding a large duplicate-blade burst
    // on phones that already entered the low-quality path.
    outerDensityMultiplier: 12,
    boundaryDensityMultiplier: 4,
    forestLayers: 0,
    shadows: false,
    shadowMapSize: 512,
  },
  high: {
    grassCount: 220,
    flowerCount: 28,
    // The outer field is decorative, so spend the GPU budget on the playable
    // meadow instead of multiplying distant decorative blades.
    maxPixelRatio: 1.5,
    outerDensityMultiplier: 18,
    boundaryDensityMultiplier: 6,
    forestLayers: 0,
    shadows: true,
    shadowMapSize: 1024,
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
