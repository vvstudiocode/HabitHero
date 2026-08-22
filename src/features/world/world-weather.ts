export const WORLD_TIME_PHASES = ['dawn', 'day', 'dusk', 'night'] as const;
export type WorldTimePhase = (typeof WORLD_TIME_PHASES)[number];

export const WORLD_WEATHER_CONDITIONS = ['clear', 'cloudy', 'rain', 'storm'] as const;
export type WorldWeatherCondition = (typeof WORLD_WEATHER_CONDITIONS)[number];

export const WORLD_WEATHER_REFRESH_MS = 15 * 60 * 1000;
export const WORLD_TIME_PHASE_SCHEDULE = Object.freeze({
  dawn: Object.freeze({ startMinute: 5 * 60, durationMinutes: 2 * 60 }),
  day: Object.freeze({ startMinute: 7 * 60, durationMinutes: 10 * 60 }),
  dusk: Object.freeze({ startMinute: 17 * 60, durationMinutes: 90 }),
  night: Object.freeze({ startMinute: 18 * 60 + 30, durationMinutes: 10 * 60 + 30 }),
});

export const WORLD_TIME_LIGHTING = Object.freeze({
  dawn: Object.freeze({ exposure: 1.02, environmentIntensity: 0.24, hemisphereIntensity: 1.42, sunIntensity: 1.9, sunColor: 0xffbd8c }),
  day: Object.freeze({ exposure: 1.12, environmentIntensity: 0.27, hemisphereIntensity: 1.72, sunIntensity: 2.85, sunColor: 0xffd7aa }),
  dusk: Object.freeze({ exposure: 1.0, environmentIntensity: 0.23, hemisphereIntensity: 1.25, sunIntensity: 1.62, sunColor: 0xff966d86 }),
  night: Object.freeze({ exposure: 0.9, environmentIntensity: 0.15, hemisphereIntensity: 0.55, sunIntensity: 0.22, sunColor: 0x8eacdb }),
});

export const DEFAULT_WEATHER_LOCATION = Object.freeze({
  label: 'Taipei',
  latitude: 25.033,
  longitude: 121.565,
});

export interface WorldWeatherLocation {
  label?: string;
  latitude: number;
  longitude: number;
}

export interface WorldTimeState {
  phase: WorldTimePhase;
  phaseIndex: number;
  phaseProgress: number;
}

export interface WorldWeatherState {
  condition: WorldWeatherCondition;
  intensity: number;
  cloudCover: number;
  windSpeedKmh: number;
  source: 'cwa' | 'open-meteo' | 'fallback';
  observedAt: number;
}

export const DEFAULT_WORLD_WEATHER: WorldWeatherState = Object.freeze({
  condition: 'clear',
  intensity: 0,
  cloudCover: 0,
  windSpeedKmh: 0,
  source: 'fallback',
  observedAt: 0,
});

export function isWorldWeatherState(value: unknown): value is WorldWeatherState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return WORLD_WEATHER_CONDITIONS.includes(candidate.condition as WorldWeatherCondition)
    && ['cwa', 'open-meteo', 'fallback'].includes(String(candidate.source))
    && typeof candidate.intensity === 'number'
    && Number.isFinite(candidate.intensity)
    && typeof candidate.cloudCover === 'number'
    && Number.isFinite(candidate.cloudCover)
    && typeof candidate.windSpeedKmh === 'number'
    && Number.isFinite(candidate.windSpeedKmh)
    && typeof candidate.observedAt === 'number'
    && Number.isFinite(candidate.observedAt);
}

export type WorldWeatherFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const taipeiClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Taipei',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function getTaipeiMinutes(nowMs: number): number {
  const parts = taipeiClockFormatter.formatToParts(nowMs);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function getWorldTimeState(nowMs = Date.now()): WorldTimeState {
  const taipeiMinutes = getTaipeiMinutes(nowMs);
  const phase = taipeiMinutes >= WORLD_TIME_PHASE_SCHEDULE.dawn.startMinute
    && taipeiMinutes < WORLD_TIME_PHASE_SCHEDULE.day.startMinute
    ? 'dawn'
    : taipeiMinutes >= WORLD_TIME_PHASE_SCHEDULE.day.startMinute
      && taipeiMinutes < WORLD_TIME_PHASE_SCHEDULE.dusk.startMinute
      ? 'day'
      : taipeiMinutes >= WORLD_TIME_PHASE_SCHEDULE.dusk.startMinute
        && taipeiMinutes < WORLD_TIME_PHASE_SCHEDULE.night.startMinute
        ? 'dusk'
        : 'night';
  const schedule = WORLD_TIME_PHASE_SCHEDULE[phase];
  const elapsedMinutes = phase === 'night' && taipeiMinutes < schedule.startMinute
    ? taipeiMinutes + 24 * 60 - schedule.startMinute
    : taipeiMinutes - schedule.startMinute;
  const phaseIndex = WORLD_TIME_PHASES.indexOf(phase);
  return {
    phase,
    phaseIndex,
    phaseProgress: elapsedMinutes / schedule.durationMinutes,
  };
}

export function mapOpenMeteoWeatherCode(
  weatherCode: number,
  precipitation = 0,
): WorldWeatherCondition {
  if ([95, 96, 99].includes(weatherCode)) return 'storm';
  if ([65, 67, 82].includes(weatherCode)) return 'storm';
  if ([51, 53, 55, 56, 57, 61, 63, 66, 80, 81].includes(weatherCode)) return 'rain';
  if ([1, 2, 3, 45, 48].includes(weatherCode)) return 'cloudy';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'cloudy';
  return precipitation > 0 ? 'rain' : 'clear';
}

function getWeatherIntensity(
  condition: WorldWeatherCondition,
  precipitation: number,
  showers: number,
  cloudCover: number,
): number {
  if (condition === 'clear') return 0;
  if (condition === 'cloudy') return clamp(cloudCover / 100, 0.18, 0.72);
  const precipitationIntensity = clamp(Math.max(precipitation, showers) / 4, 0.25, 1);
  return condition === 'storm'
    ? Math.max(0.72, precipitationIntensity)
    : precipitationIntensity;
}

export function normalizeOpenMeteoWeather(payload: unknown): WorldWeatherState {
  const current = payload && typeof payload === 'object' && 'current' in payload
    ? (payload as { current?: Record<string, unknown> }).current
    : undefined;
  if (!current) throw new Error('Open-Meteo response does not contain current weather data.');

  const weatherCode = Math.round(finiteNumber(current.weather_code));
  const precipitation = Math.max(0, finiteNumber(current.precipitation));
  const rain = Math.max(0, finiteNumber(current.rain));
  const showers = Math.max(0, finiteNumber(current.showers));
  const cloudCover = clamp(finiteNumber(current.cloud_cover), 0, 100);
  const condition = mapOpenMeteoWeatherCode(weatherCode, precipitation + rain + showers);
  const observedAt = typeof current.time === 'string' ? Date.parse(current.time) : Number.NaN;
  return {
    condition,
    intensity: getWeatherIntensity(condition, precipitation + rain, showers, cloudCover),
    cloudCover,
    windSpeedKmh: Math.max(0, finiteNumber(current.wind_speed_10m)),
    source: 'open-meteo',
    observedAt: Number.isFinite(observedAt) ? observedAt : 0,
  };
}

export function buildOpenMeteoUrl(location: WorldWeatherLocation): string {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'weather_code,precipitation,rain,showers,cloud_cover,wind_speed_10m',
    timezone: 'auto',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export async function fetchWorldWeather({
  location = DEFAULT_WEATHER_LOCATION,
  fetcher = fetch,
  signal,
}: {
  location?: WorldWeatherLocation;
  fetcher?: WorldWeatherFetcher;
  signal?: AbortSignal;
} = {}): Promise<WorldWeatherState> {
  const response = await fetcher(buildOpenMeteoUrl(location), { signal });
  if (!response.ok) throw new Error(`Open-Meteo request failed with HTTP ${response.status}.`);
  return normalizeOpenMeteoWeather(await response.json());
}
