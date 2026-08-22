import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CWA_WEATHER_CACHE_KEY,
  CWA_WEATHER_LOCATION_NAME,
  normalizeCwaWeather,
  type CwaWeatherState,
} from '../_shared/cwa-weather.ts';

const CWA_ENDPOINT = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001';
const CACHE_TTL_MS = 15 * 60 * 1000;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isCachedWeather(value: unknown): value is CwaWeatherState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['clear', 'cloudy', 'rain', 'storm'].includes(String(candidate.condition))
    && candidate.source === 'cwa'
    && typeof candidate.intensity === 'number'
    && typeof candidate.cloudCover === 'number'
    && typeof candidate.windSpeedKmh === 'number'
    && typeof candidate.observedAt === 'number';
}

async function fetchCwaWeather(apiKey: string): Promise<CwaWeatherState> {
  const url = new URL(CWA_ENDPOINT);
  url.searchParams.set('Authorization', apiKey);
  url.searchParams.set('format', 'JSON');
  url.searchParams.set('locationName', CWA_WEATHER_LOCATION_NAME);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('CWA weather request failed.');
  return normalizeCwaWeather(await response.json());
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!request.headers.get('Authorization')) return json({ error: 'Authentication is required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cwaApiKey = Deno.env.get('CWA_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !cwaApiKey) return json({ error: 'Weather service is not configured.' }, 503);

  let body: { location?: string } = {};
  try {
    const parsedBody = await request.json();
    if (parsedBody && typeof parsedBody === 'object') body = parsedBody as { location?: string };
  } catch {
    // An empty request body is valid and uses the configured Taipei location.
  }
  if (body.location && body.location !== CWA_WEATHER_CACHE_KEY) {
    return json({ error: 'Only the configured weather location is available.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: cachedRow } = await adminClient
    .from('world_weather_cache')
    .select('payload, fetched_at')
    .eq('cache_key', CWA_WEATHER_CACHE_KEY)
    .maybeSingle();
  if (cachedRow && isCachedWeather(cachedRow.payload)) {
    const fetchedAt = Date.parse(cachedRow.fetched_at);
    if (Number.isFinite(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS) return json(cachedRow.payload);
  }

  try {
    const weather = await fetchCwaWeather(cwaApiKey);
    const { error: cacheError } = await adminClient.from('world_weather_cache').upsert({
      cache_key: CWA_WEATHER_CACHE_KEY,
      payload: weather,
      fetched_at: new Date().toISOString(),
    });
    if (cacheError) console.warn('Unable to persist shared weather cache.');
    return json(weather);
  } catch {
    return json({ error: 'Unable to load weather right now.' }, 502);
  }
});
