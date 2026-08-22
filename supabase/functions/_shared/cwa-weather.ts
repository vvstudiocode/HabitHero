export const CWA_WEATHER_CACHE_KEY = 'taipei';
export const CWA_WEATHER_LOCATION_NAME = '臺北市';

const WEATHER_CONDITIONS = ['clear', 'cloudy', 'rain', 'storm'] as const;
type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export interface CwaWeatherState {
  condition: WeatherCondition;
  intensity: number;
  cloudCover: number;
  windSpeedKmh: number;
  source: 'cwa';
  observedAt: number;
}

interface CwaWeatherInterval {
  startTime: string;
  endTime?: string;
  parameter?: {
    parameterName?: string;
    parameterValue?: string;
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function getIntervals(payload: unknown, elementName: string): CwaWeatherInterval[] {
  const root = asRecord(payload);
  const records = asRecord(root?.records);
  const locations = Array.isArray(records?.location) ? records.location : [];
  const location = asRecord(locations[0]);
  const weatherElements = Array.isArray(location?.weatherElement) ? location.weatherElement : [];
  const element = weatherElements
    .map(asRecord)
    .find((candidate) => candidate?.elementName === elementName);
  const intervals = Array.isArray(element?.time) ? element.time : [];
  return intervals.filter((interval): interval is CwaWeatherInterval => {
    const candidate = asRecord(interval);
    return typeof candidate?.startTime === 'string';
  }).map((interval) => {
    const candidate = interval as unknown as Record<string, unknown>;
    return {
      startTime: String(candidate.startTime),
      endTime: typeof candidate.endTime === 'string' ? candidate.endTime : undefined,
      parameter: asRecord(candidate.parameter) as CwaWeatherInterval['parameter'],
    };
  });
}

function selectInterval(intervals: CwaWeatherInterval[], nowMs: number): CwaWeatherInterval | undefined {
  return intervals.find((interval) => {
    const startMs = Date.parse(interval.startTime);
    const endMs = interval.endTime ? Date.parse(interval.endTime) : Number.POSITIVE_INFINITY;
    return Number.isFinite(startMs) && nowMs >= startMs && nowMs < endMs;
  }) ?? intervals[0];
}

function getCondition(description: string): WeatherCondition {
  if (description.includes('雷')) return 'storm';
  if (description.includes('雨')) return 'rain';
  if (description.includes('陰') || description.includes('多雲') || description.includes('霧')) return 'cloudy';
  return 'clear';
}

function getProbability(interval: CwaWeatherInterval | undefined): number {
  const value = interval?.parameter?.parameterName ?? interval?.parameter?.parameterValue;
  const parsed = value === undefined ? 0 : Number.parseFloat(value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : 0;
}

export function normalizeCwaWeather(payload: unknown, nowMs = Date.now()): CwaWeatherState {
  const weatherInterval = selectInterval(getIntervals(payload, 'Wx'), nowMs);
  if (!weatherInterval?.parameter?.parameterName) {
    throw new Error('CWA response does not contain a weather forecast.');
  }

  const condition = getCondition(weatherInterval.parameter.parameterName);
  const probability = getProbability(selectInterval(getIntervals(payload, 'PoP'), nowMs));
  const observedAt = Date.parse(weatherInterval.startTime);
  const cloudCover = condition === 'clear' ? 0 : condition === 'cloudy' ? 65 : condition === 'storm' ? 70 : 55;
  const intensity = condition === 'clear'
    ? 0
    : condition === 'cloudy'
      ? 0.35
      : condition === 'storm'
        ? Math.max(0.8, probability / 100)
        : clamp(Math.max(0.35, probability / 100), 0.35, 1);

  return {
    condition,
    intensity,
    cloudCover,
    windSpeedKmh: 0,
    source: 'cwa',
    observedAt: Number.isFinite(observedAt) ? observedAt : 0,
  };
}
