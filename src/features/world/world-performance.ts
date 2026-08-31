const PHONE_VIEWPORT_WIDTH = 480;
const PHONE_PIXEL_RATIO_CAP = 1.25;
export const ACTIVE_WORLD_MAX_FPS = 60;
export const IDLE_WORLD_MAX_FPS = 30;
export const WORLD_IDLE_GRACE_MS = 750;
export const DEFAULT_WORLD_MAX_FPS = ACTIVE_WORLD_MAX_FPS;

export interface WorldFrameActivity {
  playerMoving: boolean;
  petMoving: boolean;
  cameraMoving: boolean;
  roamingCharacterMoving: boolean;
  interactionActive: boolean;
}

export interface WorldFrameRateState {
  lastActiveAt: number;
  maxFps: typeof ACTIVE_WORLD_MAX_FPS | typeof IDLE_WORLD_MAX_FPS;
}

export function createWorldFrameRateState(now: number): WorldFrameRateState {
  return {
    lastActiveAt: Number.isFinite(now) ? now : 0,
    maxFps: ACTIVE_WORLD_MAX_FPS,
  };
}

export function updateWorldFrameRateState({
  now,
  state,
  activity,
  idleGraceMs = WORLD_IDLE_GRACE_MS,
}: {
  now: number;
  state: WorldFrameRateState;
  activity: WorldFrameActivity;
  idleGraceMs?: number;
}): WorldFrameRateState {
  const safeNow = Number.isFinite(now) ? now : state.lastActiveAt;
  const isActive = activity.playerMoving
    || activity.petMoving
    || activity.cameraMoving
    || activity.roamingCharacterMoving
    || activity.interactionActive;
  if (isActive) {
    return {
      lastActiveAt: safeNow,
      maxFps: ACTIVE_WORLD_MAX_FPS,
    };
  }

  const lastActiveAt = Number.isFinite(state.lastActiveAt) ? state.lastActiveAt : safeNow;
  const safeGraceMs = Number.isFinite(idleGraceMs) ? Math.max(0, idleGraceMs) : WORLD_IDLE_GRACE_MS;
  return {
    lastActiveAt,
    maxFps: safeNow - lastActiveAt >= safeGraceMs ? IDLE_WORLD_MAX_FPS : ACTIVE_WORLD_MAX_FPS,
  };
}

export function getWorldPixelRatio({
  devicePixelRatio,
  viewportWidth,
  maxPixelRatio,
}: {
  devicePixelRatio?: number;
  viewportWidth?: number;
  maxPixelRatio?: number;
}): number {
  const safeDevicePixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio! > 0 ? devicePixelRatio! : 1;
  const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth! > 0 ? viewportWidth! : PHONE_VIEWPORT_WIDTH;
  const safeMaxPixelRatio = Number.isFinite(maxPixelRatio) && maxPixelRatio! > 0 ? maxPixelRatio! : 1;
  const viewportCap = safeViewportWidth <= PHONE_VIEWPORT_WIDTH ? PHONE_PIXEL_RATIO_CAP : safeMaxPixelRatio;
  return Math.min(safeDevicePixelRatio, safeMaxPixelRatio, viewportCap);
}

export function shouldRenderWorldFrame({
  now,
  lastRenderedAt,
  maxFps = DEFAULT_WORLD_MAX_FPS,
}: {
  now: number;
  lastRenderedAt: number;
  maxFps?: number;
}): boolean {
  if (!Number.isFinite(now)) return false;
  if (!Number.isFinite(lastRenderedAt)) return true;
  const safeMaxFps = Number.isFinite(maxFps) && maxFps > 0 ? maxFps : DEFAULT_WORLD_MAX_FPS;
  return now - lastRenderedAt >= 1000 / safeMaxFps;
}
