export const CLEAN_MODE_DOUBLE_TAP_MAX_INTERVAL_MS = 420;
export const CLEAN_MODE_DOUBLE_TAP_MAX_TAP_DURATION_MS = 450;
export const CLEAN_MODE_DOUBLE_TAP_MAX_MOVEMENT_PX = 18;

export interface SingleFingerDoubleTapGestureMetrics {
  tapCount: number;
  intervalMs: number;
  maxMovementPx: number;
  maxTapDurationMs?: number;
  cancelled?: boolean;
}

export function isSingleFingerDoubleTapGesture({
  tapCount,
  intervalMs,
  maxMovementPx,
  maxTapDurationMs,
  cancelled = false,
}: SingleFingerDoubleTapGestureMetrics): boolean {
  return !cancelled
    && tapCount === 2
    && intervalMs >= 0
    && intervalMs <= CLEAN_MODE_DOUBLE_TAP_MAX_INTERVAL_MS
    && maxMovementPx <= CLEAN_MODE_DOUBLE_TAP_MAX_MOVEMENT_PX
    && (maxTapDurationMs === undefined
      || (maxTapDurationMs >= 0 && maxTapDurationMs <= CLEAN_MODE_DOUBLE_TAP_MAX_TAP_DURATION_MS));
}
