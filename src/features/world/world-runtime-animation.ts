import type { AnimationClip } from 'three';

export function getCharacterAnimationClip(clips: readonly AnimationClip[], state: 'idle' | 'walk'): AnimationClip | undefined {
  const pattern = state === 'walk' ? /walk|run/i : /idle|iddle|stand|rest/i;
  return clips.find((clip) => pattern.test(clip.name));
}

export function getWalkAnimationClip(clips: readonly AnimationClip[]): AnimationClip | undefined {
  return getCharacterAnimationClip(clips, 'walk') ?? clips[0];
}

/**
 * Patrol movement is driven by the world steering layer, so imported walk
 * clips must animate in place. Some supplied GLBs also key the armature root
 * forward; playing that root motion on top of the actor movement makes the
 * model snap backwards when the clip loops.
 */
export function createInPlaceAnimationClip(clip: AnimationClip): AnimationClip {
  const inPlaceClip = clip.clone();
  inPlaceClip.tracks.forEach((track) => {
    if (!/\.position$/i.test(track.name) || !/(?:^|[/.[\]])(?:armature|root|hips|pelvis|mixamorig:?root|mixamorig:?hips|mixamorig:?pelvis)(?:[/.[\]]|$)/i.test(track.name)) return;
    if (track.values.length < 3 || track.values.length % 3 !== 0) return;
    const initialX = track.values[0];
    const initialZ = track.values[2];
    for (let index = 0; index < track.values.length; index += 3) {
      track.values[index] = initialX;
      track.values[index + 2] = initialZ;
    }
  });
  return inPlaceClip;
}
