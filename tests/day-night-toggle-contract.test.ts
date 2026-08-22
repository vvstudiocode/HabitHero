import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const panelSource = read('../src/features/world/components/ChildGamePanel.tsx');
const displaySettingsSource = read('../src/features/world/components/WorldDisplaySettings.tsx');
const dashboardSource = read('../src/components/ChildDashboard.tsx');
const terrainSource = read('../src/features/world/TerrainWorldLayer.tsx');
const runtimeSource = read('../src/features/world/world-weather-runtime.ts');
const prototypeSource = read('../src/features/world/prototype-world-runtime.ts');

describe('child day and night toggle', () => {
  it('exposes the toggle without disabling weather', () => {
    assert.match(displaySettingsSource, /日夜效果/);
    assert.doesNotMatch(displaySettingsSource, /關閉後固定白天/);
    assert.match(panelSource, /dayNightEnabled/);
    assert.match(dashboardSource, /useDayNightPreference/);
    assert.match(dashboardSource, /onDayNightChange/);
  });

  it('passes the preference to the world runtime and keeps weather updates active', () => {
    assert.match(terrainSource, /dayNightEnabled/);
    assert.match(prototypeSource, /dayNightEnabled/);
    assert.match(prototypeSource, /weatherRuntime\.setDayNightEnabled\(next\.dayNightEnabled\)/);
    assert.match(runtimeSource, /setDayNightEnabled/);
    assert.match(runtimeSource, /fetchCwaWorldWeather/);
  });
});
