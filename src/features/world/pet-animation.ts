export type PetAnimationState = 'idle' | 'walk';

export interface PetPauseDurationRange {
  min: number;
  max: number;
}

export const PET_ANIMATION_CROSSFADE_SECONDS = 0.2;

export interface PetIdleTransitionState {
  cycleElapsed: number;
  movePending: boolean;
}

export const PET_IDLE_PAUSE_DURATION_RANGE = {
  min: 3,
  max: 5,
} as const satisfies PetPauseDurationRange;

export const PET_WALK_ONLY_PAUSE_DURATION_RANGE = {
  min: 3,
  max: 5,
} as const satisfies PetPauseDurationRange;

export function queuePetMoveAfterIdleCycle(
  state: PetIdleTransitionState,
  hasIdleAnimation: boolean,
): PetIdleTransitionState {
  return hasIdleAnimation ? { ...state, movePending: true } : state;
}

export function advancePetIdleCycle(
  state: PetIdleTransitionState,
  delta: number,
  duration: number,
): { state: PetIdleTransitionState; shouldSwitchToWalk: boolean } {
  const safeDelta = Number.isFinite(delta) ? Math.max(0, delta) : 0;
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      state: { cycleElapsed: 0, movePending: false },
      shouldSwitchToWalk: true,
    };
  }
  const elapsed = Math.max(0, state.cycleElapsed) + safeDelta;
  const shouldSwitchToWalk = state.movePending && elapsed >= duration;
  return {
    state: {
      cycleElapsed: elapsed % duration,
      movePending: shouldSwitchToWalk ? false : state.movePending,
    },
    shouldSwitchToWalk,
  };
}

export function getPetAnimationClipName(
  clipNames: readonly string[],
  state: PetAnimationState,
): string | undefined {
  const statePattern = state === 'walk' ? /walk|run/i : /idle|iddle|stand|rest/i;
  return clipNames.find((name) => statePattern.test(name));
}
