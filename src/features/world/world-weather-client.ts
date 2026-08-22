import { getSupabaseClient } from '../../lib/supabase';
import { isWorldWeatherState, type WorldWeatherState } from './world-weather';

export async function fetchCwaWorldWeather(): Promise<WorldWeatherState> {
  const { data, error } = await getSupabaseClient().functions.invoke<WorldWeatherState>('get-weather', {
    body: { location: 'taipei' },
  });
  if (error) throw new Error('CWA weather function failed.');
  if (!isWorldWeatherState(data)) throw new Error('CWA weather response was invalid.');
  return data;
}
