import type { WorldTimePhase } from '../world-weather';

export type ProceduralSkyRgb = readonly [number, number, number];

export interface ProceduralSkyConfig {
  cycleSeconds: number;
  startHour: number;
}

export interface ProceduralSkyPalette {
  zenith: ProceduralSkyRgb;
  horizon: ProceduralSkyRgb;
  below: ProceduralSkyRgb;
  cloudLight: ProceduralSkyRgb;
  cloudShadow: ProceduralSkyRgb;
  sun: ProceduralSkyRgb;
  moon: ProceduralSkyRgb;
  exposure: number;
}

export interface ProceduralSkyFrame extends ProceduralSkyPalette {
  hour: number;
  phase: WorldTimePhase;
  sunDirection: ProceduralSkyRgb;
  moonDirection: ProceduralSkyRgb;
  sunVisibility: number;
  moonVisibility: number;
  night: number;
  twilight: number;
}

export const DEFAULT_PROCEDURAL_SKY_CONFIG: Readonly<ProceduralSkyConfig> = Object.freeze({
  // A one-hour full turn keeps the day/night change noticeable while feeling
  // natural during a normal My World session.
  cycleSeconds: 60 * 60,
  startHour: 5,
});

const MIN_CYCLE_SECONDS = 30;
const MAX_CYCLE_SECONDS = 60 * 60;
const FULL_DAY_HOURS = 24;
// Aim the default sunrise side toward the preview camera so the procedural
// sun can be found in the scene without requiring an upward camera drag.
const SOLAR_AZIMUTH = -2.35;
const MOON_AZIMUTH = -2.35;

interface SkyKeyframe extends ProceduralSkyPalette {
  hour: number;
}

const SKY_KEYFRAMES: readonly SkyKeyframe[] = [
  {
    hour: 0,
    zenith: [0.035, 0.07, 0.2],
    horizon: [0.1, 0.18, 0.36],
    below: [0.018, 0.04, 0.1],
    cloudLight: [0.36, 0.48, 0.72],
    cloudShadow: [0.045, 0.075, 0.18],
    sun: [1, 0.48, 0.23],
    moon: [0.56, 0.72, 1],
    exposure: 1.12,
  },
  {
    hour: 5,
    zenith: [0.08, 0.12, 0.28],
    horizon: [0.74, 0.36, 0.3],
    below: [0.08, 0.055, 0.12],
    cloudLight: [1, 0.48, 0.25],
    cloudShadow: [0.17, 0.09, 0.2],
    sun: [1, 0.54, 0.27],
    moon: [0.56, 0.72, 1],
    exposure: 0.96,
  },
  {
    hour: 7,
    zenith: [0.2, 0.54, 0.94],
    horizon: [0.62, 0.83, 0.95],
    below: [0.42, 0.54, 0.64],
    cloudLight: [1, 1, 0.97],
    cloudShadow: [0.42, 0.56, 0.72],
    sun: [1, 0.76, 0.38],
    moon: [0.56, 0.72, 1],
    exposure: 1.08,
  },
  {
    hour: 12,
    zenith: [0.18, 0.56, 0.98],
    horizon: [0.66, 0.86, 0.97],
    below: [0.5, 0.64, 0.74],
    cloudLight: [1, 1, 0.98],
    cloudShadow: [0.46, 0.6, 0.76],
    sun: [1, 0.88, 0.52],
    moon: [0.56, 0.72, 1],
    exposure: 1.1,
  },
  {
    hour: 17,
    zenith: [0.18, 0.36, 0.65],
    horizon: [0.76, 0.48, 0.42],
    below: [0.24, 0.17, 0.24],
    cloudLight: [1, 0.54, 0.3],
    cloudShadow: [0.25, 0.16, 0.28],
    sun: [1, 0.52, 0.26],
    moon: [0.56, 0.72, 1],
    exposure: 1.0,
  },
  {
    hour: 18.5,
    zenith: [0.085, 0.12, 0.29],
    horizon: [0.82, 0.3, 0.25],
    below: [0.12, 0.05, 0.14],
    cloudLight: [1, 0.4, 0.2],
    cloudShadow: [0.15, 0.06, 0.17],
    sun: [1, 0.42, 0.2],
    moon: [0.56, 0.72, 1],
    exposure: 1.02,
  },
  {
    hour: 20,
    zenith: [0.04, 0.08, 0.22],
    horizon: [0.13, 0.2, 0.4],
    below: [0.02, 0.045, 0.11],
    cloudLight: [0.42, 0.55, 0.8],
    cloudShadow: [0.055, 0.1, 0.24],
    sun: [1, 0.48, 0.23],
    moon: [0.56, 0.72, 1],
    exposure: 1.12,
  },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function wrapHour(hour: number): number {
  const wrapped = hour % FULL_DAY_HOURS;
  return wrapped < 0 ? wrapped + FULL_DAY_HOURS : wrapped;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mixNumber(left: number, right: number, amount: number): number {
  return left + (right - left) * amount;
}

function mixRgb(left: ProceduralSkyRgb, right: ProceduralSkyRgb, amount: number): ProceduralSkyRgb {
  return [
    mixNumber(left[0], right[0], amount),
    mixNumber(left[1], right[1], amount),
    mixNumber(left[2], right[2], amount),
  ];
}

function normalizeVector(x: number, y: number, z: number): ProceduralSkyRgb {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function getPhase(hour: number): WorldTimePhase {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 18.5) return 'dusk';
  return 'night';
}

function getPaletteAtHour(hour: number): ProceduralSkyPalette {
  const normalizedHour = wrapHour(hour);
  const extendedHour = normalizedHour;
  const keyframes: readonly SkyKeyframe[] = [
    ...SKY_KEYFRAMES,
    { ...SKY_KEYFRAMES[0], hour: FULL_DAY_HOURS },
  ];
  let left = keyframes[0];
  let right = keyframes[keyframes.length - 1];
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    if (extendedHour >= keyframes[index].hour && extendedHour <= keyframes[index + 1].hour) {
      left = keyframes[index];
      right = keyframes[index + 1];
      break;
    }
  }
  const amount = smoothstep(0, 1, (extendedHour - left.hour) / Math.max(right.hour - left.hour, 0.001));
  return {
    zenith: mixRgb(left.zenith, right.zenith, amount),
    horizon: mixRgb(left.horizon, right.horizon, amount),
    below: mixRgb(left.below, right.below, amount),
    cloudLight: mixRgb(left.cloudLight, right.cloudLight, amount),
    cloudShadow: mixRgb(left.cloudShadow, right.cloudShadow, amount),
    sun: mixRgb(left.sun, right.sun, amount),
    moon: mixRgb(left.moon, right.moon, amount),
    exposure: mixNumber(left.exposure, right.exposure, amount),
  };
}

export function normalizeProceduralSkyConfig(input: Partial<ProceduralSkyConfig> = {}): ProceduralSkyConfig {
  const cycleSeconds = typeof input.cycleSeconds === 'number' && Number.isFinite(input.cycleSeconds)
    ? clamp(input.cycleSeconds, MIN_CYCLE_SECONDS, MAX_CYCLE_SECONDS)
    : DEFAULT_PROCEDURAL_SKY_CONFIG.cycleSeconds;
  const startHour = typeof input.startHour === 'number' && Number.isFinite(input.startHour)
    ? wrapHour(input.startHour)
    : DEFAULT_PROCEDURAL_SKY_CONFIG.startHour;
  return { cycleSeconds, startHour };
}

export function getProceduralSkyPreviewConfig(search = ''): ProceduralSkyConfig {
  const params = new URLSearchParams(search);
  const cycleSeconds = Number(params.get('sky-cycle'));
  const startHour = Number(params.get('sky-hour'));
  return normalizeProceduralSkyConfig({
    cycleSeconds: Number.isFinite(cycleSeconds) ? cycleSeconds : undefined,
    startHour: Number.isFinite(startHour) ? startHour : undefined,
  });
}

export function getProceduralSkyFrameAtHour(hour: number): ProceduralSkyFrame {
  const normalizedHour = wrapHour(Number.isFinite(hour) ? hour : DEFAULT_PROCEDURAL_SKY_CONFIG.startHour);
  const solarAngle = ((normalizedHour - 6) / 12) * Math.PI;
  const horizontal = Math.cos(solarAngle);
  const sunDirection = normalizeVector(
    Math.sin(SOLAR_AZIMUTH) * horizontal,
    Math.sin(solarAngle) * 0.88,
    Math.cos(SOLAR_AZIMUTH) * horizontal,
  );
  // Keep the moon a little lower than the zenith and on a readable azimuth so
  // it remains visible in the default My World camera without needing an
  // extra moon mesh or light.
  const moonAzimuth = MOON_AZIMUTH
    + Math.sin((normalizedHour / FULL_DAY_HOURS) * Math.PI * 2) * 0.34;
  const moonHorizontal = 0.72;
  const moonHeight = Math.max(0.02, -sunDirection[1] * 0.04);
  const moonDirection = normalizeVector(
    Math.sin(moonAzimuth) * moonHorizontal,
    moonHeight,
    Math.cos(moonAzimuth) * moonHorizontal,
  );
  const sunVisibility = smoothstep(-0.08, 0.1, sunDirection[1]);
  const moonVisibility = smoothstep(-0.04, 0.15, moonDirection[1]);
  const night = smoothstep(0.02, 0.18, -sunDirection[1]);
  const twilight = 1 - smoothstep(0.06, 0.3, Math.abs(sunDirection[1]));
  return {
    hour: normalizedHour,
    phase: getPhase(normalizedHour),
    ...getPaletteAtHour(normalizedHour),
    sunDirection,
    moonDirection,
    sunVisibility,
    moonVisibility: moonVisibility * night,
    night,
    twilight,
  };
}

export function getProceduralSkyFrame(elapsedSeconds: number, config: Partial<ProceduralSkyConfig> = {}): ProceduralSkyFrame {
  const resolved = normalizeProceduralSkyConfig(config);
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  return getProceduralSkyFrameAtHour(resolved.startHour + (elapsed / resolved.cycleSeconds) * FULL_DAY_HOURS);
}
