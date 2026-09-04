import type { Object3D } from 'three';

type ThreeNamespace = typeof import('three');

export const WORLD_NAME_LABEL_SCALE = 0.11;
export const WORLD_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER = 0.55;
export const WORLD_NAME_LABEL_HEAD_GAP = 0.22;
const WORLD_NAME_LABEL_FONT_SIZE = 26;

export function getWorldNameLabelLocalScale(modelScale: number, scaleMultiplier: number): number {
  const safeModelScale = Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1;
  const safeLabelScale = Number.isFinite(scaleMultiplier) && scaleMultiplier > 0
    ? scaleMultiplier
    : WORLD_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER;
  return safeLabelScale / safeModelScale;
}

export function getWorldNameLabelY(modelHeight: number, modelScale = 1): number {
  const safeModelHeight = Number.isFinite(modelHeight) ? Math.max(modelHeight, 0) : 0;
  const safeModelScale = Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1;
  return safeModelHeight + WORLD_NAME_LABEL_HEAD_GAP / safeModelScale;
}

export function createWorldNameLabel(
  THREE: ThreeNamespace,
  displayName: string | undefined,
  showName: boolean,
  scaleMultiplier = WORLD_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER,
  modelScale = 1,
): Object3D | undefined {
  const name = displayName?.trim();
  if (!showName || !name || typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  const font = `600 ${WORLD_NAME_LABEL_FONT_SIZE}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.font = font;
  const horizontalPadding = 16;
  canvas.width = Math.max(64, Math.ceil(context.measureText(name).width + horizontalPadding * 2));
  canvas.height = 42;
  context.font = font;
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(name, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const label = new THREE.Sprite(material);
  label.name = 'world-name-label';
  label.renderOrder = 20;
  const localScale = getWorldNameLabelLocalScale(modelScale, scaleMultiplier);
  label.scale.set(
    (canvas.width / canvas.height) * WORLD_NAME_LABEL_SCALE * localScale,
    WORLD_NAME_LABEL_SCALE * localScale,
    1,
  );
  return label;
}
