import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const edgeFunctionSource = read('../supabase/functions/get-weather/index.ts');
const migrationSource = read('../supabase/migrations/20260823000000_world_weather_cache.sql');
const clientSource = read('../src/features/world/world-weather-client.ts');

describe('Central Weather Administration integration contracts', () => {
  it('keeps the CWA key server-only and protects the edge function', () => {
    assert.match(edgeFunctionSource, /Deno\.env\.get\('CWA_API_KEY'\)/);
    assert.match(edgeFunctionSource, /opendata\.cwa\.gov\.tw\/api\/v1\/rest\/datastore\/F-C0032-001/);
    assert.match(edgeFunctionSource, /world_weather_cache/);
    assert.doesNotMatch(edgeFunctionSource, /CWA-[A-Z0-9-]{12,}/);
    assert.match(clientSource, /functions\.invoke(?:<[^>]+>)?\('get-weather'/);
    assert.doesNotMatch(clientSource, /CWA_API_KEY/);
  });

  it('keeps the cache inaccessible to browser roles', () => {
    assert.match(migrationSource, /enable row level security/i);
    assert.match(migrationSource, /revoke all on table public\.world_weather_cache from anon, authenticated/i);
    assert.doesNotMatch(migrationSource, /service_role|SUPABASE_SERVICE_ROLE/i);
  });
});
