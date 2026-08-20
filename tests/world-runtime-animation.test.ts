import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { AnimationClip, NumberKeyframeTrack, VectorKeyframeTrack } from 'three';
import {
  createInPlaceAnimationClip,
  getCharacterAnimationClip,
} from '../src/features/world/world-runtime-animation';

const runtimeSource = readFileSync(
  new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url),
  'utf8',
);
const animationSource = readFileSync(
  new URL('../src/features/world/world-runtime-animation.ts', import.meta.url),
  'utf8',
);

function roundedTrackValues(values: ArrayLike<number>): number[] {
  return Array.from(values).map((value) => Number(Number(value).toFixed(3)));
}

describe('world runtime animation helpers', () => {
  it('selects idle and walk clips by the existing supplied asset name patterns', () => {
    const idle = new AnimationClip('Idle', 1, []);
    const rest = new AnimationClip('soft_rest_pose', 1, []);
    const walk = new AnimationClip('Walk_InPlace', 1, []);
    const run = new AnimationClip('RunCycle', 1, []);
    const dance = new AnimationClip('Dance', 1, []);

    assert.equal(getCharacterAnimationClip([dance, idle, walk], 'idle'), idle);
    assert.equal(getCharacterAnimationClip([dance, rest, run], 'idle'), rest);
    assert.equal(getCharacterAnimationClip([dance, walk, idle], 'walk'), walk);
    assert.equal(getCharacterAnimationClip([dance, run, idle], 'walk'), run);
    assert.equal(getCharacterAnimationClip([dance], 'idle'), undefined);
  });

  it('normalizes only horizontal root-like position tracks and preserves the source clip', () => {
    const clip = new AnimationClip('Walk_Forward', 1, [
      new VectorKeyframeTrack('Armature.position', [0, 1], [0.4, 0.9, -0.6, 1.1, 1.4, 2.5]),
      new VectorKeyframeTrack('.bones[mixamorig:Hips].position', [0, 1], [0, 0.2, 0, -1, 0.3, 3]),
      new VectorKeyframeTrack('mixamorig:Spine.position', [0, 1], [0, 0.5, 0, 0.2, 0.7, 0.4]),
      new NumberKeyframeTrack('root.scale[x]', [0, 1], [1, 1.2]),
    ]);

    const normalized = createInPlaceAnimationClip(clip);

    assert.notEqual(normalized, clip);
    assert.deepEqual(roundedTrackValues(normalized.tracks[0].values), [0.4, 0.9, -0.6, 0.4, 1.4, -0.6]);
    assert.deepEqual(roundedTrackValues(normalized.tracks[1].values), [0, 0.2, 0, 0, 0.3, 0]);
    assert.deepEqual(roundedTrackValues(normalized.tracks[2].values), roundedTrackValues(clip.tracks[2].values));
    assert.deepEqual(roundedTrackValues(normalized.tracks[3].values), [1, 1.2]);
    assert.deepEqual(roundedTrackValues(clip.tracks[0].values), [0.4, 0.9, -0.6, 1.1, 1.4, 2.5]);
  });

  it('keeps runtime callers wired through the in-place walk clip helper', () => {
    assert.match(animationSource, /function getWalkAnimationClip/);
    assert.match(runtimeSource, /clipAction\(createInPlaceAnimationClip\(getWalkAnimationClip\(animations\)!\)\)/);
    assert.match(runtimeSource, /createInPlaceAnimationClip\(getWalkAnimationClip\(roamingCharacterAnimations\)!\)/);
  });
});
