import type { GameCatalogItem, WorldTransform } from './contracts';
import { isTransformWithinWorld, VISIBLE_GRASS_BOUNDARY, type CollisionCircle } from './world-collision';

export interface DecorationPlacementDraft {
  x: number;
  z: number;
  rotationY: number;
  scale: number;
}

export type DecorationPlacementControl = 'rotate-left' | 'rotate-right' | 'scale-down' | 'scale-up';

export interface DecorationPlacementGestureDelta {
  scaleFactor: number;
  rotationDelta: number;
}

export function shouldMovePlacementDecoration(pointerCount: number, startedOnDecoration: boolean): boolean {
  return pointerCount === 1 && startedOnDecoration;
}

export interface PlacementGridCell {
  x: number;
  z: number;
  isValid: boolean;
}

const ROTATION_STEP = Math.PI / 8;
const SCALE_STEP = 0.1;
const ROTATION_DRAG_RADIANS_PER_PIXEL = Math.PI / 240;
const PLACEMENT_START_DISTANCE = 1.8;

export function getPlacementStartPosition(
  characterPosition: { x: number; z: number },
  cameraYaw: number,
  distance = PLACEMENT_START_DISTANCE,
): { x: number; z: number } {
  const safeYaw = Number.isFinite(cameraYaw) ? cameraYaw : 0;
  const safeDistance = Number.isFinite(distance) ? Math.max(0.5, distance) : PLACEMENT_START_DISTANCE;
  return {
    x: characterPosition.x - Math.sin(safeYaw) * safeDistance,
    z: characterPosition.z - Math.cos(safeYaw) * safeDistance,
  };
}

export function getPlacementRotationDelta(previousX: number, currentX: number): number {
  if (!Number.isFinite(previousX) || !Number.isFinite(currentX)) return 0;
  return (currentX - previousX) * ROTATION_DRAG_RADIANS_PER_PIXEL;
}

/**
 * Three.js treats rotations that differ by a full turn as the same visual
 * orientation. Keep the persisted value canonical so repeated gestures never
 * grow past the database constraint.
 */
export function normalizeWorldRotationY(rotationY: number): number {
  if (!Number.isFinite(rotationY)) return 0;
  if (rotationY >= -Math.PI && rotationY <= Math.PI) return rotationY;
  const fullTurn = Math.PI * 2;
  const wrapped = ((rotationY + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  return wrapped;
}

export function createDecorationPlacementDraft(item?: Pick<GameCatalogItem, 'minScale' | 'maxScale' | 'metadata'>): DecorationPlacementDraft {
  const configuredDefault = item?.metadata.defaultScale;
  const defaultScale = typeof configuredDefault === 'number' && Number.isFinite(configuredDefault)
    ? Math.min(item.maxScale, Math.max(item.minScale, configuredDefault))
    : 1;
  return { x: 1.8, z: -1.5, rotationY: 0, scale: defaultScale };
}

export function applyDecorationPlacementControl(
  draft: DecorationPlacementDraft,
  control: DecorationPlacementControl,
  bounds?: Pick<GameCatalogItem, 'minScale' | 'maxScale'>,
): DecorationPlacementDraft {
  if (control === 'rotate-left' || control === 'rotate-right') {
    const direction = control === 'rotate-left' ? -1 : 1;
    return { ...draft, rotationY: normalizeWorldRotationY(draft.rotationY + direction * ROTATION_STEP) };
  }

  const minimum = Math.max(0.1, bounds?.minScale ?? 0.1);
  const maximum = Math.min(3, bounds?.maxScale ?? 3);
  const direction = control === 'scale-down' ? -1 : 1;
  return {
    ...draft,
    scale: Math.min(maximum, Math.max(minimum, Number((draft.scale + direction * SCALE_STEP).toFixed(2)))),
  };
}

export function applyDecorationPlacementGesture(
  draft: DecorationPlacementDraft,
  gesture: DecorationPlacementGestureDelta,
  bounds?: Pick<GameCatalogItem, 'minScale' | 'maxScale'>,
): DecorationPlacementDraft {
  const minimum = Math.max(0.1, bounds?.minScale ?? 0.1);
  const maximum = Math.min(3, bounds?.maxScale ?? 3);
  const scaleFactor = Number.isFinite(gesture.scaleFactor) && gesture.scaleFactor > 0 ? gesture.scaleFactor : 1;
  const rotationDelta = Number.isFinite(gesture.rotationDelta) ? gesture.rotationDelta : 0;
  return {
    ...draft,
    scale: Math.min(maximum, Math.max(minimum, Number((draft.scale * scaleFactor).toFixed(2)))),
    rotationY: normalizeWorldRotationY(draft.rotationY + rotationDelta),
  };
}

export function getPlacementGridCells({
  item,
  scale,
  existing = [],
  cellSize = 0.4,
  boundary = VISIBLE_GRASS_BOUNDARY,
}: {
  item: Pick<GameCatalogItem, 'collisionRadius' | 'minScale' | 'maxScale'>;
  scale: number;
  existing?: CollisionCircle[];
  cellSize?: number;
  boundary?: number;
}): PlacementGridCell[] {
  const safeCellSize = Math.max(0.1, cellSize);
  const safeBoundary = Math.max(safeCellSize / 2, boundary);
  const count = Math.ceil((safeBoundary * 2) / safeCellSize);
  const start = -safeBoundary + safeCellSize / 2;
  const cells: PlacementGridCell[] = [];
  for (let xIndex = 0; xIndex < count; xIndex += 1) {
    for (let zIndex = 0; zIndex < count; zIndex += 1) {
      const x = Number((start + xIndex * safeCellSize).toFixed(3));
      const z = Number((start + zIndex * safeCellSize).toFixed(3));
      cells.push({
        x,
        z,
        isValid: isDecorationPlacementValid({ x, z, rotationY: 0, scale }, item, existing),
      });
    }
  }
  return cells;
}

export function toDecorationPlacementTransform(draft: DecorationPlacementDraft): WorldTransform {
  return {
    x: draft.x,
    y: 0,
    z: draft.z,
    rotationX: 0,
    rotationY: normalizeWorldRotationY(draft.rotationY),
    rotationZ: 0,
    scale: draft.scale,
  };
}

export function isDecorationPlacementValid(
  draft: DecorationPlacementDraft,
  item: Pick<GameCatalogItem, 'collisionRadius' | 'minScale' | 'maxScale'>,
  existing: CollisionCircle[] = [],
): boolean {
  const transform = toDecorationPlacementTransform(draft);
  return isTransformWithinWorld(transform, item.collisionRadius, existing, VISIBLE_GRASS_BOUNDARY)
    && draft.scale >= item.minScale
    && draft.scale <= item.maxScale;
}
