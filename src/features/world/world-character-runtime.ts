import type { Object3D } from 'three';
import {
  CHARACTER_GROUND_CONTACT_Y,
  getCharacterGroundingReferenceY,
  getGroundedRootY,
} from './world-runtime-geometry';

type ThreeNamespace = typeof import('three');

export interface WorldCharacterAssetDefinition {
  size: { x: number; y: number; z: number };
  offset: { x: number; y: number; z: number };
}

export interface WorldCharacterMount {
  definition: WorldCharacterAssetDefinition;
  footNodes: Object3D[];
  scale: number;
}

export function defineWorldCharacterAsset(
  THREE: ThreeNamespace,
  source: Object3D,
): WorldCharacterAssetDefinition {
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  source.traverse((object) => {
    const mesh = object as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return {
    size: { x: size.x, y: size.y, z: size.z },
    offset: { x: -center.x, y: -bounds.min.y, z: -center.z },
  };
}

export function getWorldCharacterFootNodes(source: Object3D): Object3D[] {
  const footNodes: Object3D[] = [];
  source.traverse((node) => {
    if (/toe_end$/i.test(node.name)) footNodes.push(node);
  });
  return footNodes;
}

export function getWorldCharacterScale(
  definition: WorldCharacterAssetDefinition,
  targetHeight: number,
): number {
  return targetHeight / Math.max(definition.size.y, 0.001);
}

export function groundWorldCharacter(
  THREE: ThreeNamespace,
  options: {
    root: Object3D;
    model: Object3D;
    footNodes: readonly Object3D[];
    parentY?: number;
    groundY?: number;
  },
): number {
  options.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(options.model);
  if (!Number.isFinite(bounds.min.y)) return options.root.position.y;
  const footYs = options.footNodes.map((node) => node.getWorldPosition(new THREE.Vector3()).y);
  const referenceY = getCharacterGroundingReferenceY(bounds.min.y, footYs);
  options.root.position.y = getGroundedRootY(
    options.root.position.y,
    referenceY,
    options.parentY ?? 0,
    options.groundY ?? CHARACTER_GROUND_CONTACT_Y,
  );
  options.root.updateMatrixWorld(true);
  return options.root.position.y;
}

export function mountWorldCharacterModel(
  THREE: ThreeNamespace,
  options: {
    root: Object3D;
    model: Object3D;
    targetHeight: number;
    parentY?: number;
    groundY?: number;
  },
): WorldCharacterMount {
  const definition = defineWorldCharacterAsset(THREE, options.model);
  const scale = getWorldCharacterScale(definition, options.targetHeight);
  options.root.scale.setScalar(scale);
  options.model.position.set(definition.offset.x, definition.offset.y, definition.offset.z);
  options.root.add(options.model);
  const footNodes = getWorldCharacterFootNodes(options.model);
  groundWorldCharacter(THREE, {
    root: options.root,
    model: options.model,
    footNodes,
    parentY: options.parentY,
    groundY: options.groundY,
  });
  return { definition, footNodes, scale };
}
