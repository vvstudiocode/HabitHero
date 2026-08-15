const PHONE_VIEWPORT_WIDTH = 480;
const PHONE_PIXEL_RATIO_CAP = 1.25;
export const DEFAULT_WORLD_MAX_FPS = 60;

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
