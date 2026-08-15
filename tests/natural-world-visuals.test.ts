import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NATURAL_WORLD_VISUAL_SETTINGS,
  createAmbientPollenLayout,
  getNaturalWorldVisualSettings,
} from '../terrain-prototype/natural-world-visuals.js';

describe('natural world visuals', () => {
  it('keeps low and high quality settings visually related but performance-aware', () => {
    const low = getNaturalWorldVisualSettings('low');
    const high = getNaturalWorldVisualSettings('high');

    assert.equal(low.fogFar < high.fogFar, true);
    assert.equal(low.pollenCount < high.pollenCount, true);
    assert.equal(low.environmentIntensity <= high.environmentIntensity, true);
    assert.equal(NATURAL_WORLD_VISUAL_SETTINGS.low.sunDirection.length, 3);
  });

  it('creates deterministic, bounded pollen positions', () => {
    const options = { count: 80, fieldSize: 20, seed: 42, height: 4 };
    const first = createAmbientPollenLayout(options);
    const second = createAmbientPollenLayout(options);

    assert.deepEqual(first, second);
    assert.equal(first.length, 80);
    assert.equal(first.every((particle) => Math.abs(particle.x) <= 10), true);
    assert.equal(first.every((particle) => Math.abs(particle.z) <= 10), true);
    assert.equal(first.every((particle) => particle.y >= 0.35 && particle.y <= 4), true);
    assert.equal(first.every((particle) => particle.size >= 0.6 && particle.size <= 1.4), true);
    assert.equal(first.every((particle) => particle.phase >= 0 && particle.phase <= Math.PI * 2), true);
  });

  it('rejects invalid pollen layouts instead of silently creating malformed buffers', () => {
    assert.throws(() => createAmbientPollenLayout({ count: 0, fieldSize: 20 }), /count/);
    assert.throws(() => createAmbientPollenLayout({ count: 4, fieldSize: 0 }), /fieldSize/);
  });
});
