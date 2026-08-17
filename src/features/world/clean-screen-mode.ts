export const CLEAN_MODE_TWO_FINGER_MAX_DURATION_MS = 450;
export const CLEAN_MODE_TWO_FINGER_MAX_MOVEMENT_PX = 18;

export interface TwoFingerTapGestureMetrics {
  maxConcurrentPointers: number;
  durationMs: number;
  maxMovementPx: number;
  cancelled?: boolean;
}

export function isTwoFingerTapGesture({
  maxConcurrentPointers,
  durationMs,
  maxMovementPx,
  cancelled = false,
}: TwoFingerTapGestureMetrics): boolean {
  return !cancelled
    && maxConcurrentPointers === 2
    && durationMs >= 0
    && durationMs <= CLEAN_MODE_TWO_FINGER_MAX_DURATION_MS
    && maxMovementPx <= CLEAN_MODE_TWO_FINGER_MAX_MOVEMENT_PX;
}
