import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  createFireflyLayout,
  getFireflyCount,
  getRainVisualLength,
  getRainVisualIntensity,
} from '../src/features/world/world-weather-effects';

describe('world weather effect budgets', () => {
  it('keeps night stars aligned with the sky direction instead of copying camera rotation', () => {
    const source = readFileSync(new URL('../src/features/world/world-weather-effects.ts', import.meta.url), 'utf8');
    assert.match(source, /stars\.position\.copy\(camera\.position\)/);
    assert.doesNotMatch(source, /stars\.quaternion\.copy\(camera\.quaternion\)/);
  });

  it('uses the same restrained rain amount across every time phase', () => {
    assert.equal(getRainVisualIntensity('dawn', 'rain'), 0.3);
    assert.equal(getRainVisualIntensity('day', 'storm'), 0.3);
    assert.equal(getRainVisualIntensity('dusk', 'rain'), 0.3);
    assert.equal(getRainVisualIntensity('night', 'storm'), 0.3);
    assert.equal(getRainVisualLength('rain'), 0.45);
    assert.equal(getRainVisualLength('storm'), 0.45);
    assert.equal(getRainVisualIntensity('day', 'clear'), 0);
    assert.equal(getRainVisualLength('clear'), 0);
  });

  it('keeps fireflies in both the full walkable area and an outer meadow ring', () => {
    const fieldSize = 26.95;
    const walkableSize = 9.9;
    const layout = createFireflyLayout({
      count: getFireflyCount('high'),
      fieldSize,
      walkableSize,
      seed: 42,
    });
    const walkableHalf = walkableSize * 0.5;
    const fieldHalf = fieldSize * 0.5;
    const inner = layout.filter(({ x, z }) => Math.max(Math.abs(x), Math.abs(z)) <= walkableHalf);
    const outer = layout.filter(({ x, z }) => Math.max(Math.abs(x), Math.abs(z)) > walkableHalf);

    assert.equal(layout.length, 48);
    assert.equal(inner.length > 0, true);
    assert.equal(outer.length > 0, true);
    assert.equal(layout.every(({ x, z }) => Math.abs(x) <= fieldHalf && Math.abs(z) <= fieldHalf), true);
  });
});
