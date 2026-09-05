import type { Object3D } from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

type ThreeNamespace = typeof import('three');

interface SurfaceGeometryState {
  geometry: import('three').BufferGeometry;
  canUseBoundsTree: boolean;
  createdBoundsTree: boolean;
}

export function getAuthoredSceneModule(source: Object3D, moduleKey: string): Object3D | undefined {
  return source.children.find((child) => (
    child.userData.sunriseVillageModule === moduleKey
    || child.userData.authoredWorldModule === moduleKey
  ));
}

export interface AuthoredSceneSurfaceSampler {
  sample: (x: number, z: number) => number | undefined;
  dispose: () => void;
}

/**
 * Prepare the immutable authored ground for repeated NPC and player queries.
 * The render mesh remains the source of truth: BVH only changes how the same
 * triangles are searched, while the cached bounds and scratch objects remove
 * per-frame scene traversal and garbage creation.
 */
export function createAuthoredSceneSurfaceSampler(
  THREE: ThreeNamespace,
  source: Object3D,
  groundModuleKey: string,
): AuthoredSceneSurfaceSampler {
  const groundModule = getAuthoredSceneModule(source, groundModuleKey);
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  const rayDirection = new THREE.Vector3(0, -1, 0);
  const rayOrigin = new THREE.Vector3();
  const intersections: import('three').Intersection[] = [];
  const bounds = new THREE.Box3();
  const originalRaycasts = new Map<import('three').Mesh, import('three').Mesh['raycast']>();
  const surfaceGeometries = new Map<import('three').BufferGeometry, SurfaceGeometryState>();
  let disposed = false;
  let hasLastQuery = false;
  let lastX = Number.NaN;
  let lastZ = Number.NaN;
  let lastResult: number | undefined;

  if (groundModule) {
    source.updateMatrixWorld(true);
    bounds.setFromObject(groundModule);
    groundModule.traverse((object) => {
      const mesh = object as import('three').Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      let geometryState = surfaceGeometries.get(mesh.geometry);
      if (!geometryState) {
        const hadBoundsTree = Boolean(mesh.geometry.boundsTree);
        let canUseBoundsTree = hadBoundsTree;
        let createdBoundsTree = false;
        if (!canUseBoundsTree) {
          try {
            computeBoundsTree.call(mesh.geometry);
            canUseBoundsTree = Boolean(mesh.geometry.boundsTree);
            createdBoundsTree = canUseBoundsTree;
          } catch {
            canUseBoundsTree = false;
          }
        }
        geometryState = {
          geometry: mesh.geometry,
          canUseBoundsTree,
          createdBoundsTree,
        };
        surfaceGeometries.set(mesh.geometry, geometryState);
        if (!canUseBoundsTree) return;
      }
      if (!geometryState.canUseBoundsTree) return;
      originalRaycasts.set(mesh, mesh.raycast);
      mesh.raycast = acceleratedRaycast;
    });
  }

  const sample = (x: number, z: number): number | undefined => {
    if (disposed) return undefined;
    if (hasLastQuery && x === lastX && z === lastZ) return lastResult;
    hasLastQuery = true;
    lastX = x;
    lastZ = z;
    lastResult = undefined;
    if (!groundModule || !Number.isFinite(x) || !Number.isFinite(z)) return undefined;
    if (bounds.isEmpty() || !Number.isFinite(bounds.max.y) || !Number.isFinite(bounds.min.y)) return undefined;

    rayOrigin.set(x, bounds.max.y + 1, z);
    raycaster.set(rayOrigin, rayDirection);
    raycaster.near = 0;
    raycaster.far = Math.max(bounds.max.y - bounds.min.y + 2, 2);
    intersections.length = 0;
    raycaster.intersectObject(groundModule, true, intersections);
    const hit = intersections[0];
    if (!hit || !Number.isFinite(hit.point.y)) return undefined;
    lastResult = hit.point.y;
    return lastResult;
  };

  return {
    sample,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      originalRaycasts.forEach((raycast, mesh) => {
        mesh.raycast = raycast;
      });
      surfaceGeometries.forEach(({ geometry, createdBoundsTree }) => {
        if (createdBoundsTree) disposeBoundsTree.call(geometry);
      });
      intersections.length = 0;
      lastResult = undefined;
    },
  };
}
