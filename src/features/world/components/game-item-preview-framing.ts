export const PREVIEW_MODEL_DIMENSION = 2.7625 * 0.325;
export const PREVIEW_CAMERA_PADDING = 1.18;
export const DEFAULT_PREVIEW_ZOOM = 1;
export const MIN_PREVIEW_ZOOM = 0.72;
export const MAX_PREVIEW_ZOOM = 1.8;
const CHARACTER_PREVIEW_Y_OFFSET = -0.36;
const MIXAMO_PREVIEW_Y_OFFSET = -0.36;

const MIXAMO_PET_PREVIEW_ASSET_KEYS = new Set([
  'pet.ailite',
  'pet.qifu-er',
  'pet.star-diver',
  'pet.nibus',
  'pet.christo',
  'pet.moko',
  'pet.kaldo',
  'pet.jasmine',
  'pet.orian',
  'pet.oum',
  'pet.arcadia',
]);

export interface PreviewModelSize {
  x: number;
  y: number;
  z: number;
}

export interface PreviewModelOffset {
  x: number;
  y: number;
  z: number;
}

export function getPreviewModelOffset(item: { itemType: 'character' | 'pet' | 'decoration'; assetKey: string }): PreviewModelOffset {
  if (item.itemType === 'character') {
    return { x: 0, y: CHARACTER_PREVIEW_Y_OFFSET, z: 0 };
  }
  if (item.itemType === 'pet' && MIXAMO_PET_PREVIEW_ASSET_KEYS.has(item.assetKey)) {
    return { x: 0, y: MIXAMO_PREVIEW_Y_OFFSET, z: 0 };
  }
  return { x: 0, y: 0, z: 0 };
}

export function getPreviewModelScale(size: PreviewModelSize): number {
  const largestDimension = Math.max(size.x, size.y, size.z, 0.01);
  return PREVIEW_MODEL_DIMENSION / largestDimension;
}

export function getPreviewFitDistance(
  radius: number,
  verticalFovDegrees: number,
  aspect: number,
  padding = PREVIEW_CAMERA_PADDING,
): number {
  const safeRadius = Math.max(radius, 0.01);
  const safeAspect = Math.max(aspect, 0.01);
  const verticalHalfFov = (verticalFovDegrees * Math.PI) / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * safeAspect);
  const limitingHalfFov = Math.max(Math.min(verticalHalfFov, horizontalHalfFov), 0.01);
  return (safeRadius * Math.max(padding, 1)) / Math.sin(limitingHalfFov);
}

export function getPreviewMaxZoom(padding = PREVIEW_CAMERA_PADDING): number {
  return Math.min(MAX_PREVIEW_ZOOM, Math.max(DEFAULT_PREVIEW_ZOOM, padding));
}

export function clampPreviewZoom(zoom: number, maxZoom = getPreviewMaxZoom()): number {
  return Math.min(maxZoom, Math.max(MIN_PREVIEW_ZOOM, zoom));
}
