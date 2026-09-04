import type { Object3D } from 'three';
import { circlesOverlap, type CollisionCircle, type RadialWorldBoundary, type WorldPoint2D } from './world-collision';

type ThreeNamespace = typeof import('three');

const AUTHORED_COLLISION_MIN_HEIGHT = 0.22;
const AUTHORED_COLLISION_MIN_SIZE = 0.12;
const AUTHORED_COLLISION_NAVIGATION_INSET = 0.18;
const AUTHORED_GROUND_MIN_SIZE = 8;
const AUTHORED_GROUND_MAX_THICKNESS = 2.5;
const AUTHORED_SPAWN_GRID_STEP = 1.25;
const AUTHORED_BOUNDARY_BUCKETS = 72;
const AUTHORED_BOUNDARY_EDGE_MARGIN = 0.55;
const AUTHORED_SCENE_GROUND_CLEARANCE = 0.06;

export function getAuthoredSceneModule(source: Object3D, moduleKey: string): Object3D | undefined {
  return source.children.find((child) => (
    child.userData.sunriseVillageModule === moduleKey
    || child.userData.authoredWorldModule === moduleKey
  ));
}

/**
 * Read the authored surface below a world-space X/Z position. Authored
 * modules can have a thick cloud underside, so the module's bounding-box top
 * is not necessarily the surface where the character should stand.
 */
export function getAuthoredSceneSurfaceY(
  THREE: ThreeNamespace,
  source: Object3D,
  groundModuleKey: string,
  x: number,
  z: number,
  fallbackY: number,
): number {
  return sampleAuthoredSceneSurfaceY(THREE, source, groundModuleKey, x, z) ?? fallbackY;
}

export function hasAuthoredSceneSurface(
  THREE: ThreeNamespace,
  source: Object3D,
  groundModuleKey: string,
  x: number,
  z: number,
): boolean {
  return sampleAuthoredSceneSurfaceY(THREE, source, groundModuleKey, x, z) !== undefined;
}

function sampleAuthoredSceneSurfaceY(
  THREE: ThreeNamespace,
  source: Object3D,
  groundModuleKey: string,
  x: number,
  z: number,
): number | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
  const groundModule = getAuthoredSceneModule(source, groundModuleKey);
  if (!groundModule) return undefined;

  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(groundModule);
  if (bounds.isEmpty() || !Number.isFinite(bounds.max.y) || !Number.isFinite(bounds.min.y)) return undefined;

  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(x, bounds.max.y + 1, z),
    new THREE.Vector3(0, -1, 0),
    0,
    Math.max(bounds.max.y - bounds.min.y + 2, 2),
  );
  const hit = raycaster.intersectObject(groundModule, true)[0];
  return hit && Number.isFinite(hit.point.y) ? hit.point.y : undefined;
}

export interface AuthoredSceneGroundAlignmentOptions {
  preserveGroundModulePosition?: boolean;
}

export function alignAuthoredSceneToGround(
  THREE: ThreeNamespace,
  root: Object3D,
  source: Object3D,
  fallbackY: number,
  groundModuleKey?: string,
  options: AuthoredSceneGroundAlignmentOptions = {},
): void {
  root.updateMatrixWorld(true);
  const groundModule = groundModuleKey ? getAuthoredSceneModule(source, groundModuleKey) : undefined;
  const groundCandidates = (groundModule ? [groundModule] : source.children).map((child) => {
    let bounds: InstanceType<ThreeNamespace['Box3']>;
    if (options.preserveGroundModulePosition && child === groundModule) {
      const authoredY = child.position.y;
      child.position.y = 0;
      root.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(child);
      child.position.y = authoredY;
      root.updateMatrixWorld(true);
    } else {
      bounds = new THREE.Box3().setFromObject(child);
    }
    const size = new THREE.Vector3();
    bounds.getSize(size);
    return { bounds, size };
  }).filter(({ bounds, size }) => !bounds.isEmpty() && (groundModule ? true : size.y < AUTHORED_COLLISION_MIN_HEIGHT));
  const ground = groundCandidates.sort((left, right) => (
    right.size.x * right.size.z - left.size.x * left.size.z
  ))[0];
  if (ground) {
    // `bounds.max.y` is in world space and already includes the root's
    // current translation. Apply only the remaining delta; replacing the
    // local root position with a world-space value would double-count that
    // translation and drop scenes whose authored root starts above zero.
    root.position.y += AUTHORED_SCENE_GROUND_CLEARANCE - ground.bounds.max.y;
  } else {
    root.position.y = fallbackY;
  }
  root.updateMatrixWorld(true);
}

export function getAuthoredSceneCollisionProxies(THREE: ThreeNamespace, source: Object3D): CollisionCircle[] {
  source.updateMatrixWorld(true);
  return source.children.map((child) => {
    if (child.userData.sunriseVillageCollision === false) return undefined;
    const bounds = new THREE.Box3().setFromObject(child);
    if (bounds.isEmpty()) return undefined;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    const isBroadLowGroundSlab = size.x >= AUTHORED_GROUND_MIN_SIZE
      && size.z >= AUTHORED_GROUND_MIN_SIZE
      && size.y <= AUTHORED_GROUND_MAX_THICKNESS;
    if (isBroadLowGroundSlab) return undefined;
    if (size.y < AUTHORED_COLLISION_MIN_HEIGHT || size.x < AUTHORED_COLLISION_MIN_SIZE || size.z < AUTHORED_COLLISION_MIN_SIZE) return undefined;
    const footprintScale = typeof child.userData.sunriseVillageCollisionFootprintScale === 'number'
      && Number.isFinite(child.userData.sunriseVillageCollisionFootprintScale)
      && child.userData.sunriseVillageCollisionFootprintScale > 0
      ? child.userData.sunriseVillageCollisionFootprintScale
      : 1;
    return {
      x: center.x,
      z: center.z,
      radius: Math.max(size.x, size.z) * 0.5 * footprintScale,
      shape: 'rectangle' as const,
      halfWidth: size.x * 0.5 * footprintScale,
      halfDepth: size.z * 0.5 * footprintScale,
      navigationInset: AUTHORED_COLLISION_NAVIGATION_INSET,
    };
  }).filter((proxy): proxy is CollisionCircle => Boolean(proxy));
}

export function getAuthoredSceneRadialBoundary(
  THREE: ThreeNamespace,
  source: Object3D,
  groundModuleKey = 'island',
  horizontalScaleFactor = 1,
): RadialWorldBoundary | undefined {
  source.updateMatrixWorld(true);
  const island = getAuthoredSceneModule(source, groundModuleKey);
  if (!island) return undefined;
  const bounds = new THREE.Box3().setFromObject(island);
  if (bounds.isEmpty()) return undefined;
  const center = bounds.getCenter(new THREE.Vector3());
  const safeHorizontalScaleFactor = Number.isFinite(horizontalScaleFactor) && horizontalScaleFactor > 0
    ? horizontalScaleFactor
    : 1;
  const islandOrigin = island.getWorldPosition(new THREE.Vector3());
  const restoredCenter = {
    x: islandOrigin.x + (center.x - islandOrigin.x) / safeHorizontalScaleFactor,
    z: islandOrigin.z + (center.z - islandOrigin.z) / safeHorizontalScaleFactor,
  };
  const radii = Array.from({ length: AUTHORED_BOUNDARY_BUCKETS }, () => 0);
  const worldVertex = new THREE.Vector3();
  island.traverse((object) => {
    const mesh = object as Object3D & {
      isMesh?: boolean;
      geometry?: {
        attributes?: {
          position?: {
            count: number;
            getX: (index: number) => number;
            getY: (index: number) => number;
            getZ: (index: number) => number;
          };
        };
      };
    };
    const position = mesh.geometry?.attributes?.position;
    if (!mesh.isMesh || !position) return;
    for (let index = 0; index < position.count; index += 1) {
      worldVertex.set(position.getX(index), position.getY(index), position.getZ(index));
      mesh.localToWorld(worldVertex);
      const restoredX = islandOrigin.x + (worldVertex.x - islandOrigin.x) / safeHorizontalScaleFactor;
      const restoredZ = islandOrigin.z + (worldVertex.z - islandOrigin.z) / safeHorizontalScaleFactor;
      const deltaX = restoredX - restoredCenter.x;
      const deltaZ = restoredZ - restoredCenter.z;
      const radius = Math.hypot(deltaX, deltaZ);
      if (!Number.isFinite(radius)) continue;
      const angle = (Math.atan2(deltaZ, deltaX) + Math.PI * 2) % (Math.PI * 2);
      const bucket = Math.min(AUTHORED_BOUNDARY_BUCKETS - 1, Math.floor(angle / (Math.PI * 2) * AUTHORED_BOUNDARY_BUCKETS));
      radii[bucket] = Math.max(radii[bucket], radius);
    }
  });
  const fallbackRadius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 0.5;
  const completedRadii = radii.map((radius, index) => {
    if (radius > 0) return Math.max(0.5, radius - AUTHORED_BOUNDARY_EDGE_MARGIN);
    for (let distance = 1; distance < AUTHORED_BOUNDARY_BUCKETS; distance += 1) {
      const candidate = radii[(index + distance) % AUTHORED_BOUNDARY_BUCKETS]
        || radii[(index - distance + AUTHORED_BOUNDARY_BUCKETS) % AUTHORED_BOUNDARY_BUCKETS];
      if (candidate > 0) return Math.max(0.5, candidate - AUTHORED_BOUNDARY_EDGE_MARGIN);
    }
    return Math.max(0.5, fallbackRadius - AUTHORED_BOUNDARY_EDGE_MARGIN);
  });
  return {
    center: restoredCenter,
    radii: completedRadii,
  };
}

/**
 * Pick a clear square in the authored village instead of relying on the
 * procedural world's historical spawn point, which may be inside a building
 * after the GLB is re-exported.
 */
export function getAuthoredSceneSpawnPosition(
  obstacles: readonly CollisionCircle[],
  boundary: number,
  radius = 0.35,
  preferredPosition?: WorldPoint2D,
): WorldPoint2D | undefined {
  if (!Number.isFinite(boundary) || boundary <= radius || !Number.isFinite(radius) || radius <= 0) return undefined;
  const origins = preferredPosition ? [preferredPosition, { x: 0, z: 0 }] : [{ x: 0, z: 0 }];
  const visited = new Set<string>();
  for (const origin of origins) {
    const maxRing = Math.ceil(boundary / AUTHORED_SPAWN_GRID_STEP);
    for (let ring = 0; ring <= maxRing; ring += 1) {
      for (let xIndex = -ring; xIndex <= ring; xIndex += 1) {
        for (let zIndex = -ring; zIndex <= ring; zIndex += 1) {
          if (Math.max(Math.abs(xIndex), Math.abs(zIndex)) !== ring) continue;
          const candidate = {
            x: origin.x + xIndex * AUTHORED_SPAWN_GRID_STEP,
            z: origin.z + zIndex * AUTHORED_SPAWN_GRID_STEP,
          };
          const key = `${candidate.x}:${candidate.z}`;
          if (visited.has(key)) continue;
          visited.add(key);
          if (Math.abs(candidate.x) + radius > boundary || Math.abs(candidate.z) + radius > boundary) continue;
          if (!obstacles.some((obstacle) => circlesOverlap({ ...candidate, radius }, obstacle))) return candidate;
        }
      }
    }
  }
  return undefined;
}
