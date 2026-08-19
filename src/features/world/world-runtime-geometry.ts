/** Ground contact for a visible foot reference, just above the meadow plane. */
export const PLAYER_CHARACTER_GROUND_OFFSET = -0.12;
export const CHARACTER_GROUND_CONTACT_Y = 0.055;

export function getCharacterGroundingReferenceY(
  boundsMinY: number,
  footYs: readonly number[],
): number {
  const finiteFootYs = footYs.filter(Number.isFinite);
  return finiteFootYs.length > 0 ? Math.min(...finiteFootYs) : boundsMinY;
}

export function getCharacterGroundingCorrection(
  modelMinYRelativeToPlayerRoot: number,
  groundY = CHARACTER_GROUND_CONTACT_Y,
): number {
  if (!Number.isFinite(modelMinYRelativeToPlayerRoot) || !Number.isFinite(groundY)) return 0;
  return groundY - modelMinYRelativeToPlayerRoot;
}

/** Move a character root so an animated model's world-space lowest point meets the grass. */
export function getGroundedRootY(
  currentRootY: number,
  modelMinYWorld: number,
  parentY = 0,
  groundY = CHARACTER_GROUND_CONTACT_Y,
): number {
  if (!Number.isFinite(currentRootY) || !Number.isFinite(modelMinYWorld) || !Number.isFinite(parentY)) return currentRootY;
  return currentRootY + getCharacterGroundingCorrection(modelMinYWorld - parentY, groundY);
}

/**
 * The supplied walk-only rigs have no idle clip. Keep them on the first
 * authored walk pose while stopped instead of exposing the bind/T-pose frame.
 */
export const WALK_IDLE_POSE_RATIO = 0.04;

export function getWalkIdlePoseTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const lastSafeTime = Math.max(0, duration - 0.0001);
  return Math.min(Math.max(duration * WALK_IDLE_POSE_RATIO, 0.033), lastSafeTime);
}

export const PROTOTYPE_WORLD_CONFIG = {
  gridSize: 9,
  terrainStep: 1.1,
  scenePadding: 8,
  treeFitToTile: 7.2,
  treeHeightScale: 1,
  treeRootSink: 0.03,
  treeAnchorX: 1.1,
  characterTargetHeight: 0.76 * (2 / 3),
  characterMoveSpeed: 1.1,
  cameraDistanceDefault: 4.1,
  cameraDistanceMin: 1.45,
  cameraDistanceMax: 6.5,
  cameraPitchMin: 0.12,
  // Stop one degree before vertical so a downward drag can reach the grass
  // without moving the camera to the opposite side of the character.
  cameraPitchMax: Math.PI * (89 / 180),
  initialCameraYaw: Math.PI / 2,
  initialCameraPitch: 0.18,
} as const;

export const TREE_OUTER_EDGE_PADDING = 0.08;

export function getOuterTreePlacement({
  treeSize,
  terrainLimit,
  terrainStep,
  treeFitToTile,
  x,
  edgePadding = TREE_OUTER_EDGE_PADDING,
}: {
  treeSize: { x: number; y: number; z: number };
  terrainLimit: number;
  terrainStep: number;
  treeFitToTile: number;
  x: number;
  edgePadding?: number;
}) {
  const footprint = Math.max(treeSize.x, treeSize.z);
  const scale = (terrainStep * treeFitToTile) / footprint;
  const halfDepth = (treeSize.z * scale) / 2;
  return {
    x,
    z: -(terrainLimit + halfDepth + edgePadding),
    scale,
    halfDepth,
    footprintRadius: (footprint * scale) / 2,
  };
}
