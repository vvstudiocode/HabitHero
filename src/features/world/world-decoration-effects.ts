import type { Object3D } from 'three';
import type { GameCatalogItem } from './contracts';

type ThreeNamespace = typeof import('three');

export interface DecorationPointLightConfig {
  color: number;
  intensity: number;
  distance: number;
  height: number;
}

interface DecorationPointLightState {
  light: import('three').PointLight;
  baseDistance: number;
}

const POINT_LIGHT_STATE_KEY = 'decorationPointLightState';

function getPositiveMetadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function getDecorationPointLightConfig(
  item: Pick<GameCatalogItem, 'itemType' | 'metadata'> | undefined,
): DecorationPointLightConfig | undefined {
  if (item?.itemType !== 'decoration' || item.metadata.pointLight !== true) return undefined;
  return {
    color: typeof item.metadata.pointLightColor === 'number' ? item.metadata.pointLightColor : 0xffa34a,
    intensity: getPositiveMetadataNumber(item.metadata, 'pointLightIntensity') ?? 2,
    distance: getPositiveMetadataNumber(item.metadata, 'pointLightDistance') ?? 3,
    height: getPositiveMetadataNumber(item.metadata, 'pointLightHeight') ?? 0.3,
  };
}

export function getDecorationPointLightDistance(baseDistance: number, scale: number): number {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return baseDistance * safeScale;
}

export function syncDecorationPointLight(root: Object3D, scale = root.scale.x): void {
  const state = root.userData[POINT_LIGHT_STATE_KEY] as DecorationPointLightState | undefined;
  if (!state) return;
  state.light.distance = getDecorationPointLightDistance(state.baseDistance, scale);
}

export function setDecorationObjectScale(root: Object3D, scale: number): void {
  root.scale.setScalar(scale);
  syncDecorationPointLight(root, scale);
}

export function addDecorationPointLight(
  THREE: ThreeNamespace,
  root: Object3D,
  item: GameCatalogItem | undefined,
  opacity: number,
): Object3D {
  if (opacity < 1 || root.userData[POINT_LIGHT_STATE_KEY]) return root;
  const config = getDecorationPointLightConfig(item);
  if (!config) return root;

  const light = new THREE.PointLight(config.color, config.intensity, config.distance, 2);
  light.position.y = config.height;
  light.castShadow = false;
  root.add(light);
  root.userData[POINT_LIGHT_STATE_KEY] = { light, baseDistance: config.distance } satisfies DecorationPointLightState;
  syncDecorationPointLight(root);
  return root;
}
