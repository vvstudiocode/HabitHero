import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_WORLD_WEATHER,
  DEFAULT_WEATHER_LOCATION,
  fetchWorldWeather,
  getWorldTimeState,
  mapOpenMeteoWeatherCode,
} from '../src/features/world/world-weather';
import { normalizeCwaWeather } from '../supabase/functions/_shared/cwa-weather';

describe('world weather and game time', () => {
  it('uses Taiwan local time for the four phase boundaries', () => {
    const dawn = getWorldTimeState(Date.parse('2026-08-23T21:30:00Z'));
    const day = getWorldTimeState(Date.parse('2026-08-23T23:00:00Z'));
    const dusk = getWorldTimeState(Date.parse('2026-08-23T09:00:00Z'));
    const duskMidpoint = getWorldTimeState(Date.parse('2026-08-23T10:00:00Z'));
    const night = getWorldTimeState(Date.parse('2026-08-23T10:30:00Z'));
    const nextDawn = getWorldTimeState(Date.parse('2026-08-23T21:00:00Z'));

    assert.equal(dawn.phase, 'dawn');
    assert.equal(dawn.phaseProgress, 0.25);
    assert.equal(day.phase, 'day');
    assert.equal(dusk.phase, 'dusk');
    assert.equal(duskMidpoint.phase, 'dusk');
    assert.equal(Math.round(duskMidpoint.phaseProgress * 100), 67);
    assert.equal(night.phase, 'night');
    assert.equal(nextDawn.phase, 'dawn');
  });

  it('maps WMO codes to the supported no-snow runtime weather set', () => {
    assert.equal(mapOpenMeteoWeatherCode(0), 'clear');
    assert.equal(mapOpenMeteoWeatherCode(3), 'cloudy');
    assert.equal(mapOpenMeteoWeatherCode(51), 'rain');
    assert.equal(mapOpenMeteoWeatherCode(65), 'storm');
    assert.equal(mapOpenMeteoWeatherCode(95), 'storm');
    assert.equal(mapOpenMeteoWeatherCode(71), 'cloudy');
  });

  it('normalizes current API data and keeps the API call replaceable', async () => {
    let requestUrl = '';
    const weather = await fetchWorldWeather({
      location: DEFAULT_WEATHER_LOCATION,
      fetcher: async (input) => {
        requestUrl = String(input);
        return {
          ok: true,
          json: async () => ({
            current: {
              time: '2026-08-23T10:00',
              weather_code: 61,
              precipitation: 1.2,
              rain: 1.1,
              showers: 0,
              cloud_cover: 84,
              wind_speed_10m: 9,
            },
          }),
        } as Response;
      },
    });

    assert.match(requestUrl, /api\.open-meteo\.com\/v1\/forecast/);
    assert.match(requestUrl, /weather_code/);
    assert.match(requestUrl, /cloud_cover/);
    assert.equal(weather.condition, 'rain');
    assert.equal(weather.cloudCover, 84);
    assert.equal(weather.source, 'open-meteo');
    assert.equal(weather.intensity > 0, true);
  });

  it('provides a safe clear-weather fallback shape', () => {
    assert.deepEqual(DEFAULT_WORLD_WEATHER, {
      condition: 'clear',
      intensity: 0,
      cloudCover: 0,
      windSpeedKmh: 0,
      source: 'fallback',
      observedAt: 0,
    });
  });

  it('normalizes the Central Weather Administration forecast for the active interval', () => {
    const weather = normalizeCwaWeather({
      records: {
        location: [{
          locationName: '臺北市',
          weatherElement: [
            {
              elementName: 'Wx',
              time: [{
                startTime: '2026-08-23T06:00:00+08:00',
                endTime: '2026-08-23T18:00:00+08:00',
                parameter: { parameterName: '多雲時陰短暫雨', parameterValue: '9' },
              }],
            },
            {
              elementName: 'PoP',
              time: [{
                startTime: '2026-08-23T06:00:00+08:00',
                endTime: '2026-08-23T18:00:00+08:00',
                parameter: { parameterName: '60', parameterUnit: '百分比' },
              }],
            },
          ],
        }],
      },
    }, Date.parse('2026-08-23T10:00:00+08:00'));

    assert.equal(weather.condition, 'rain');
    assert.equal(weather.source, 'cwa');
    assert.equal(weather.cloudCover > 0, true);
    assert.equal(weather.intensity > 0, true);
    assert.equal(weather.observedAt, Date.parse('2026-08-23T06:00:00+08:00'));
  });

  it('maps thunder and clear CWA descriptions without adding snow rendering', () => {
    const storm = normalizeCwaWeather({
      records: {
        location: [{
          locationName: '臺北市',
          weatherElement: [{
            elementName: 'Wx',
            time: [{
              startTime: '2026-08-23T00:00:00+08:00',
              endTime: '2026-08-23T12:00:00+08:00',
              parameter: { parameterName: '午後短暫雷雨', parameterValue: '22' },
            }],
          }],
        }],
      },
    }).condition;
    const clear = normalizeCwaWeather({
      records: {
        location: [{
          locationName: '臺北市',
          weatherElement: [{
            elementName: 'Wx',
            time: [{
              startTime: '2026-08-23T00:00:00+08:00',
              endTime: '2026-08-23T12:00:00+08:00',
              parameter: { parameterName: '天氣晴', parameterValue: '1' },
            }],
          }],
        }],
      },
    }).condition;

    assert.equal(storm, 'storm');
    assert.equal(clear, 'clear');
  });
});
