import type { AnimationClip, Object3D } from 'three';
import type { ChildGameData, ChildWorldEntity, GameCatalogItem, PetBehaviorMode, WorldTransform } from './contracts';
import {
  buildCollisionCircles,
  CENTRAL_TREE_KEEP_OUT,
  CHARACTER_COLLISION_RADIUS,
  CHARACTER_SPAWN,
  circlesOverlap,
  getDecorationCollisionSpec,
  WORLD_BOUNDARY,
  moveWorldCharacter,
  type CollisionCircle,
  type WorldPoint2D,
} from './world-collision';
import {
  getKeyboardCameraInput,
  getKeyboardMovement,
  isWorldCameraKey,
  isWorldMovementKey,
} from './input/keyboard-input';
import { PointerInputController } from './input/pointer-input-controller';
import { getWorldInputZone } from './input/world-input-types';
import {
  applySinglePointerCameraDrag,
  getGroundedCameraTargetHeight,
} from '../../../terrain-prototype/terrain-controls.js';
import { getProceduralGrassCount } from '../../../terrain-prototype/procedural-grass-field.js';
import { getProceduralFlowerCount } from '../../../terrain-prototype/procedural-flower-layout.js';
import { createProceduralGrassField } from '../../../terrain-prototype/procedural-grass-scene.js';
import { createProceduralFlowerField } from '../../../terrain-prototype/procedural-flowers.js';
import { createProceduralForest } from '../../../terrain-prototype/procedural-trees.js';
import { createAmbientPollenField, createSunlightPatchField } from '../../../terrain-prototype/natural-world-atmosphere.js';
import {
  createButterflyField,
  getButterflyFlightBounds,
} from '../../../terrain-prototype/natural-world-creatures.js';
import { createEastFairytaleScenery } from '../../../terrain-prototype/east-fairytale-scenery.js';
import { getNaturalWorldVisualSettings } from '../../../terrain-prototype/natural-world-visuals.js';
import {
  getWorldQuality,
  scaleWorldBudget,
  WORLD_QUALITY_SETTINGS,
} from './world-quality';
import { getWorldPixelRatio, shouldRenderWorldFrame } from './world-performance';
import {
  createWanderState,
  HABITHERO_ROAMING_CHARACTER_ASSET_KEY,
  HABITHERO_ROAMING_CHARACTER_MODEL_URL,
  HABITHERO_ROAMING_CHARACTER_RADIUS,
  HABITHERO_ROAMING_CHARACTER_SPEED,
  HABITHERO_ROAMING_CHARACTER_VISUAL_SCALE,
  getWanderStep,
  hashWanderSeed,
  type WanderState,
} from './world-roaming';
import { getDistributedPetSpawnPosition, getPetNavigationRadius } from './pet-spawning';
import {
  appendFollowingTrailSample,
  getFollowingStep,
  getFollowingDistance,
  getFollowingTrailTarget,
  getSafeFollowingDistance,
  snapshotFollowingTrail,
  PET_FOLLOW_CLEARANCE,
  PET_FOLLOW_SPEED,
} from './pet-following';
import { getPetModelUrl as getCatalogPetModelUrl, resolvePetCatalogItem } from './pet-model-assets';
import { getLocalGameModelUrl } from './game-content-assets';
import { getRequiredWorldDecorationCatalogItems, getRequiredWorldPetCatalogItems } from './world-scene-data';
import {
  advancePetIdleCycle,
  getAvailablePetAnimationActions,
  getPetAnimationActionPlayback,
  getPetAnimationActionClipName,
  getPetAnimationClipName,
  PET_ANIMATION_CROSSFADE_SECONDS,
  PET_IDLE_PAUSE_DURATION_RANGE,
  PET_WALK_ONLY_PAUSE_DURATION_RANGE,
  queuePetMoveAfterIdleCycle,
  type PetAnimationAction,
} from './pet-animation';
import { getFollowingPetInventoryIds } from './following-pet-state';
import { getPlacementStartPosition, shouldMovePlacementDecoration } from './world-placement';
import {
  applyPicturebookPetMaterial,
  applyWarmHandPaintedCharacterMaterial,
  type PicturebookPetMaterial,
  type WarmHandPaintedCharacterMaterial,
} from './character-material-style';
import {
  findFacingPetTarget,
  getSharedInteractionActions,
  type WorldInteractionTarget,
} from './world-interaction';
import {
  CHARACTER_GROUND_CONTACT_Y,
  PLAYER_CHARACTER_GROUND_OFFSET,
  PROTOTYPE_WORLD_CONFIG,
  getCharacterGroundingReferenceY,
  getGroundedRootY,
  getOuterTreePlacement,
  getWalkIdlePoseTime,
} from './world-runtime-geometry';
import {
  createDisposalTracker,
  disposeObject3D,
  disposeScene,
  disposeTexture,
  loadGltfSafely,
  type DisposableScene,
} from './world-runtime-resources';

export {
  CHARACTER_GROUND_CONTACT_Y,
  PLAYER_CHARACTER_GROUND_OFFSET,
  PROTOTYPE_WORLD_CONFIG,
  TREE_OUTER_EDGE_PADDING,
  WALK_IDLE_POSE_RATIO,
  getCharacterGroundingCorrection,
  getCharacterGroundingReferenceY,
  getGroundedRootY,
  getOuterTreePlacement,
  getWalkIdlePoseTime,
} from './world-runtime-geometry';

export {
  createDisposalTracker,
  disposeObject3D,
  disposeScene,
  loadGltfSafely,
} from './world-runtime-resources';

export const PROTOTYPE_WORLD_ASSETS = {
  tree: new URL('../../../terrain-prototype/assets/big-tree-optimized.glb', import.meta.url).href,
  character: '/assets/characters/arthur.glb',
  roamingCharacter: HABITHERO_ROAMING_CHARACTER_MODEL_URL,
  skybox: new URL('../../../terrain-prototype/assets/sky-equirectangular-day.png', import.meta.url).href,
} as const;

function getDecorationCatalogItem(gameData: ChildGameData, entity: ChildWorldEntity): GameCatalogItem | undefined {
  const catalogItemId = entity.catalogItemId
    ?? gameData.inventory.find((inventory) => inventory.id === entity.inventoryItemId)?.catalogItemId;
  return catalogItemId
    ? gameData.catalog.find((item) => item.id === catalogItemId && item.itemType === 'decoration')
    : undefined;
}

function getDecorationCollisionInput(gameData: ChildGameData, entity: ChildWorldEntity) {
  const item = getDecorationCatalogItem(gameData, entity);
  const spec = getDecorationCollisionSpec(item?.metadata, entity.collisionRadius ?? 0.3);
  return {
    positionX: entity.x,
    positionZ: entity.z,
    scale: entity.scale,
    rotationY: entity.rotationY,
    ...spec,
  };
}

export const PET_MAX_HEIGHT_RATIO = 0.5;
export const PET_MAX_DIMENSION_RATIO = 0.42;

export function getPetWorldScale({
  requestedScale,
  petHeight,
  petSize,
  characterHeight,
}: {
  requestedScale: number;
  petHeight: number;
  petSize?: { x: number; y: number; z: number };
  characterHeight: number;
}): number {
  const safeRequestedScale = Number.isFinite(requestedScale) ? Math.max(requestedScale, 0.01) : 0.01;
  const safePetHeight = Number.isFinite(petHeight) ? Math.max(petHeight, 0.001) : 0.001;
  const safeCharacterHeight = Number.isFinite(characterHeight) ? Math.max(characterHeight, 0.001) : 0.001;
  const heightScale = (safeCharacterHeight * PET_MAX_HEIGHT_RATIO) / safePetHeight;
  const maxPetDimension = petSize
    ? Math.max(
      Number.isFinite(petSize.x) ? Math.abs(petSize.x) : 0,
      Number.isFinite(petSize.y) ? Math.abs(petSize.y) : 0,
      Number.isFinite(petSize.z) ? Math.abs(petSize.z) : 0,
    )
    : 0;
  const dimensionScale = maxPetDimension > 0
    ? (safeCharacterHeight * PET_MAX_DIMENSION_RATIO) / maxPetDimension
    : Number.POSITIVE_INFINITY;
  return Math.min(safeRequestedScale, heightScale, dimensionScale);
}

export const PET_WORLD_SCALE_MULTIPLIER = 1.3;
export const PET_NAME_LABEL_WORLD_SCALE = 0.11;
export const PET_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER = 0.55;
export const PET_NAME_LABEL_HEAD_GAP = 0.22;
const PET_NAME_LABEL_FONT_SIZE = 26;
const PET_DEER_VISUAL_SCALE_MULTIPLIER = 8 / 3;
const PET_DEER_MOVEMENT_SPEED_MULTIPLIER = 0.6;
const PET_OUM_VISUAL_SCALE_MULTIPLIER = 4;

export function getPetVisualScaleMultiplier(assetKey?: string, metadata?: Record<string, unknown>): number {
  const configuredMultiplier = metadata?.visualScaleMultiplier;
  if (typeof configuredMultiplier === 'number' && Number.isFinite(configuredMultiplier) && configuredMultiplier > 0) {
    return PET_WORLD_SCALE_MULTIPLIER * configuredMultiplier;
  }
  if (assetKey === 'pet.yaoguang-deer') return PET_WORLD_SCALE_MULTIPLIER * PET_DEER_VISUAL_SCALE_MULTIPLIER;
  if (assetKey === 'pet.murphy-bear') return PET_WORLD_SCALE_MULTIPLIER * 2;
  if (assetKey === 'pet.oum') return PET_WORLD_SCALE_MULTIPLIER * PET_OUM_VISUAL_SCALE_MULTIPLIER;
  return PET_WORLD_SCALE_MULTIPLIER;
}

export function getPetMovementSpeedMultiplier(assetKey?: string, metadata?: Record<string, unknown>): number {
  const configuredMultiplier = metadata?.movementSpeedMultiplier;
  if (typeof configuredMultiplier === 'number' && Number.isFinite(configuredMultiplier) && configuredMultiplier > 0) {
    return configuredMultiplier;
  }
  if (assetKey === 'pet.yaoguang-deer') return PET_DEER_MOVEMENT_SPEED_MULTIPLIER;
  return 1;
}

export function getPetGroundOffset(_assetKey?: string, metadata?: Record<string, unknown>): number {
  const configuredOffset = metadata?.groundOffset;
  return typeof configuredOffset === 'number' && Number.isFinite(configuredOffset)
    ? configuredOffset
    : 0;
}

/** Optional extra grounding used only while a supplied walk clip is active. */
export function getPetWalkingGroundOffset(_assetKey?: string, metadata?: Record<string, unknown>): number {
  const configuredOffset = metadata?.walkingGroundOffset;
  return typeof configuredOffset === 'number' && Number.isFinite(configuredOffset)
    ? configuredOffset
    : 0;
}

export function shouldHidePetGroundShadow(metadata?: Record<string, unknown>): boolean {
  return metadata?.hideGroundShadow === true;
}

/** Hide only the handcrafted oval marker while preserving real sun-cast shadows. */
export function shouldHidePetGroundMarker(metadata?: Record<string, unknown>): boolean {
  return metadata?.hideGroundMarker === true;
}

function getPetDecorationScaleMultiplier(metadata: Record<string, unknown> | undefined, key: string): number {
  const configuredMultiplier = metadata?.[key];
  return typeof configuredMultiplier === 'number'
    && Number.isFinite(configuredMultiplier)
    && configuredMultiplier > 0
    ? configuredMultiplier
    : 1;
}

export function getPetGroundShadowScale(metadata?: Record<string, unknown>): number {
  return getPetDecorationScaleMultiplier(metadata, 'groundShadowScaleMultiplier');
}

export function getPetNameLabelScale(metadata?: Record<string, unknown>): number {
  const configuredMultiplier = metadata?.nameLabelScaleMultiplier;
  return typeof configuredMultiplier === 'number'
    && Number.isFinite(configuredMultiplier)
    && configuredMultiplier > 0
    ? configuredMultiplier
    : PET_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER;
}

export function getPetNameLabelLocalScale(modelScale: number, labelScaleMultiplier: number): number {
  const safeModelScale = Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1;
  const safeLabelScale = Number.isFinite(labelScaleMultiplier) && labelScaleMultiplier > 0
    ? labelScaleMultiplier
    : PET_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER;
  return safeLabelScale / safeModelScale;
}

export function getPetNameLabelY(modelHeight: number, modelScale = 1): number {
  const safeModelHeight = Number.isFinite(modelHeight) ? Math.max(modelHeight, 0) : 0;
  const safeModelScale = Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1;
  // The label is a child of the normalized model root. Keep the gap in world
  // units so tiny external-rig source units do not push the label far above
  // the pet after the root is scaled up.
  return safeModelHeight + PET_NAME_LABEL_HEAD_GAP / safeModelScale;
}

export const PET_WANDER_SPEED = 0.5;

export function getPetModelScale({
  requestedScale,
  petHeight,
  petSize,
  characterHeight,
}: {
  requestedScale: number;
  petHeight: number;
  petSize?: { x: number; y: number; z: number };
  characterHeight: number;
}): number {
  const normalizationScale = getPetWorldScale({
    requestedScale: Number.MAX_SAFE_INTEGER,
    petHeight,
    petSize,
    characterHeight,
  });
  const safeRequestedScale = Number.isFinite(requestedScale) ? Math.max(requestedScale, 0.01) : 0.01;
  return normalizationScale * safeRequestedScale;
}

type ThreeNamespace = typeof import('three');
type RuntimeStatus = 'loading' | 'ready' | 'failed';
type CharacterAnimationAction = 'idle' | 'walk' | PetAnimationAction;

export interface DecorationSelection {
  entityId: string;
  x: number;
  y: number;
}

export interface PetSelection {
  inventoryItemId: string;
  x: number;
  y: number;
  worldPosition: { x: number; z: number };
  rotationY: number;
  scale: number;
  following: boolean;
  behaviorMode: PetBehaviorMode;
  availableActions: readonly PetAnimationAction[];
}

export interface PrototypeWorldRuntimeOptions {
  canvas: HTMLCanvasElement;
  gameData: ChildGameData;
  equippedCatalogItem?: GameCatalogItem;
  characterRenderMode: 'anime-maiden' | 'world-glb' | 'procedural';
  characterModelUrl?: string;
  createProceduralCharacter: (THREE: ThreeNamespace, item?: GameCatalogItem) => Object3D;
  showPetNames: boolean;
  placement?: PrototypeWorldRuntimePlacement;
  onPlacementPositionChange?: (position: { x: number; z: number }) => void;
  onPlacementGestureChange?: (gesture: { scaleFactor: number; rotationDelta: number }) => void;
  onDecorationSelect?: (selection: DecorationSelection | null) => void;
  onPetSelect?: (selection: PetSelection | null) => void;
  controller: PointerInputController | null;
  pausedRef: { current: boolean };
  onStatus: (status: RuntimeStatus) => void;
  onProgress: (value: number, detail: string) => void;
  onReady: () => void;
  onError: (error: unknown) => void;
}

export interface PrototypeWorldRuntimeUpdate {
  gameData: ChildGameData;
  equippedCatalogItem?: GameCatalogItem;
  characterRenderMode: 'anime-maiden' | 'world-glb' | 'procedural';
  characterModelUrl?: string;
  showPetNames: boolean;
  placement?: PrototypeWorldRuntimePlacement;
}

export interface PrototypeWorldRuntimePlacement {
  item: GameCatalogItem;
  entityId?: string;
  transform: WorldTransform;
  isValid: boolean;
}

export interface PrototypeWorldRuntime {
  dispose: () => void;
  update: (next: PrototypeWorldRuntimeUpdate) => void;
  optimisticallySetPetIdle: (selection: PetSelection) => void;
  clearOptimisticPetIdle: (inventoryItemId: string) => void;
  playPetAnimation: (inventoryItemId: string, action: PetAnimationAction) => boolean;
  stopPetAnimation: (inventoryItemId: string) => void;
  playInteractionAction: (action: PetAnimationAction) => boolean;
}

function defineAsset(THREE: ThreeNamespace, source: Object3D) {
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const offset = new THREE.Vector3(-center.x, -bounds.min.y, -center.z);
  source.traverse((object) => {
    const mesh = object as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return { source, size, offset };
}

function applyCentralTreeMaterialFallback(THREE: ThreeNamespace, source: Object3D) {
  source.traverse((object) => {
    const mesh = object as {
      isMesh?: boolean;
      material?: { map?: { image?: { width?: number; height?: number }; colorSpace?: string; needsUpdate?: boolean }; color?: { set: (value: number) => void }; roughness?: number; metalness?: number; envMapIntensity?: number; flatShading?: boolean; needsUpdate?: boolean } | Array<{ map?: { image?: { width?: number; height?: number }; colorSpace?: string; needsUpdate?: boolean }; color?: { set: (value: number) => void }; roughness?: number; metalness?: number; envMapIntensity?: number; flatShading?: boolean; needsUpdate?: boolean }>;
    };
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const image = material.map?.image;
      if (!image?.width || !image.height) {
        material.color?.set(0x9bd58d);
        material.roughness = 0.88;
        material.metalness = 0;
      }
      material.roughness = 0.88;
      material.metalness = 0;
      material.envMapIntensity = 0.26;
      material.flatShading = true;
      if (material.map) {
        material.map.colorSpace = 'srgb';
        material.map.needsUpdate = true;
      }
      material.needsUpdate = true;
    });
  });
}

function applyWarmHandPaintedCharacterStyle(source: Object3D) {
  source.traverse((object) => {
    const mesh = object as {
      isMesh?: boolean;
      material?: WarmHandPaintedCharacterMaterial | WarmHandPaintedCharacterMaterial[];
    };
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => applyWarmHandPaintedCharacterMaterial(material));
  });
}

function applyPicturebookPetModelStyle(source: Object3D) {
  source.traverse((object) => {
    const mesh = object as {
      isMesh?: boolean;
      material?: PicturebookPetMaterial | PicturebookPetMaterial[];
    };
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => applyPicturebookPetMaterial(material));
  });
}

function createPlayerGroundShadowMaterial(THREE: ThreeNamespace) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec2 vShadowUv;
      void main() {
        vShadowUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vShadowUv;
      void main() {
        float distanceFromCenter = length(vShadowUv - vec2(0.5)) * 2.0;
        float alpha = smoothstep(1.0, 0.12, distanceFromCenter) * 0.28;
        gl_FragColor = vec4(0.02, 0.09, 0.06, alpha);
      }
    `,
  });
}

function placeAsset(THREE: ThreeNamespace, definition: ReturnType<typeof defineAsset>, position: { x: number; y: number; z: number }, scale: number) {
  const wrapper = new THREE.Group();
  const model = definition.source.clone(true);
  model.position.copy(definition.offset);
  wrapper.position.set(position.x, position.y, position.z);
  wrapper.scale.setScalar(scale);
  wrapper.add(model);
  return wrapper;
}

function getDecorationModelUrl(item: GameCatalogItem | undefined): string | undefined {
  return getLocalGameModelUrl(item?.itemType === 'decoration' ? item : undefined) ?? undefined;
}

function getDecorationGroundOffset(item: GameCatalogItem | undefined): number {
  const groundOffset = item?.metadata.groundOffset;
  return typeof groundOffset === 'number' && Number.isFinite(groundOffset) ? groundOffset : 0;
}

interface DecorationMaterialLike {
  clone?: () => DecorationMaterialLike;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
}

function prepareDecorationMaterials(root: Object3D, opacity: number) {
  root.traverse((object) => {
    const mesh = object as {
      isMesh?: boolean;
      material?: DecorationMaterialLike | DecorationMaterialLike[];
      castShadow?: boolean;
      receiveShadow?: boolean;
    };
    if (!mesh.isMesh || !mesh.material) return;
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = opacity < 1
      ? sourceMaterials.map((material) => {
        const previewMaterial = material.clone?.() ?? material;
        previewMaterial.transparent = true;
        previewMaterial.opacity = opacity;
        previewMaterial.depthWrite = false;
        return previewMaterial;
      })
      : sourceMaterials;
    mesh.material = materials.length === 1 ? materials[0] : materials;
    mesh.castShadow = opacity >= 1;
    mesh.receiveShadow = opacity >= 1;
  });
}

function createDecorationObject(
  THREE: ThreeNamespace,
  item: GameCatalogItem | undefined,
  opacity = 1,
  modelSource?: Object3D,
): Object3D {
  if (modelSource) {
    const group = new THREE.Group();
    const model = modelSource.clone(true);
    model.position.y = getDecorationGroundOffset(item);
    group.add(model);
    prepareDecorationMaterials(group, opacity);
    return group;
  }

  const transparent = opacity < 1;
  const material = new THREE.MeshStandardMaterial({
    color: 0x9a7560,
    roughness: 0.78,
    transparent,
    opacity,
    depthWrite: !transparent,
  });
  const group = new THREE.Group();
  const fallback = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8), material);
  fallback.position.y = 0.275;
  group.add(fallback);
  prepareDecorationMaterials(group, opacity);
  return group;
}

function getCharacterFootNodes(source: Object3D): Object3D[] {
  const footNodes: Object3D[] = [];
  source.traverse((node) => {
    if (/toe_end$/i.test(node.name)) footNodes.push(node);
  });
  return footNodes;
}

function getPetModelUrl(item: GameCatalogItem | undefined): string | undefined {
  return getCatalogPetModelUrl(item);
}

interface PetModelInstance {
  root: Object3D;
  model: Object3D;
  mixer?: import('three').AnimationMixer;
  walkAction?: import('three').AnimationAction;
  idleAction?: import('three').AnimationAction;
  activeAction?: import('three').AnimationAction;
  petActionActions: Partial<Record<PetAnimationAction, import('three').AnimationAction>>;
}

function createPetNameLabel(
  THREE: ThreeNamespace,
  displayName: string | undefined,
  showName: boolean,
  scaleMultiplier = PET_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER,
  modelScale = 1,
): Object3D | undefined {
  const name = displayName?.trim();
  if (!showName || !name || typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  const font = `600 ${PET_NAME_LABEL_FONT_SIZE}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
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
  label.name = 'pet-name-label';
  label.renderOrder = 20;
  const localScale = getPetNameLabelLocalScale(modelScale, scaleMultiplier);
  label.scale.set(
    (canvas.width / canvas.height) * PET_NAME_LABEL_WORLD_SCALE * localScale,
    PET_NAME_LABEL_WORLD_SCALE * localScale,
    1,
  );
  return label;
}

function createPetModel(
  THREE: ThreeNamespace,
  cloneSkinnedObject: (source: Object3D) => Object3D,
  source: Object3D,
  animations: readonly AnimationClip[],
  characterWorldHeight: number,
  requestedScale: number,
  displayName?: string,
  showPetName = true,
  hideGroundShadow = false,
  hideGroundMarker = false,
  groundShadowScaleMultiplier = 1,
  nameLabelScaleMultiplier = PET_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER,
): PetModelInstance {
  const definition = defineAsset(THREE, source);
  const model = cloneSkinnedObject(source);
  const modelScale = getPetModelScale({
    requestedScale,
    petHeight: definition.size.y,
    petSize: definition.size,
    characterHeight: characterWorldHeight,
  });
  const root = new THREE.Group();
  root.name = 'animated-pet';
  root.scale.setScalar(modelScale);
  model.position.copy(definition.offset);

  if (hideGroundShadow) {
    model.traverse((object) => {
      const mesh = object as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
  }

  if (!hideGroundShadow && !hideGroundMarker) {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({ color: 0x173226, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.name = 'animated-pet-shadow';
    shadow.rotation.x = -Math.PI / 2;
    const footprint = Math.max(definition.size.x, definition.size.z, 0.08);
    shadow.scale.set(
      footprint * 0.62 * groundShadowScaleMultiplier,
      footprint * 0.32 * groundShadowScaleMultiplier,
      1,
    );
    shadow.position.y = 0.006;
    root.add(shadow);
  }
  root.add(model);
  const nameLabel = createPetNameLabel(THREE, displayName, showPetName, nameLabelScaleMultiplier, modelScale);
  if (nameLabel) {
    nameLabel.position.y = getPetNameLabelY(definition.size.y, modelScale);
    root.add(nameLabel);
  }

  let mixer: import('three').AnimationMixer | undefined;
  let walkAction: import('three').AnimationAction | undefined;
  let idleAction: import('three').AnimationAction | undefined;
  let activeAction: import('three').AnimationAction | undefined;
  const petActionActions: Partial<Record<PetAnimationAction, import('three').AnimationAction>> = {};
  if (animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    const walkClip = getWalkAnimationClip(animations);
    const idleClipName = getPetAnimationClipName(animations.map((clip) => clip.name), 'idle');
    const idleClip = idleClipName ? animations.find((clip) => clip.name === idleClipName) : undefined;
    if (walkClip) {
      walkAction = mixer.clipAction(createInPlaceAnimationClip(getWalkAnimationClip(animations)!));
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
      walkAction.play();
    }
    if (idleClip) {
      idleAction = mixer.clipAction(createInPlaceAnimationClip(idleClip));
      idleAction.setLoop(THREE.LoopRepeat, Infinity);
      idleAction.reset().play();
    }
    activeAction = idleAction ?? walkAction;
    if (walkAction) pauseAnimationAtIdlePose(walkAction, mixer);
    for (const actionName of getAvailablePetAnimationActions(animations.map((clip) => clip.name))) {
      const clipName = getPetAnimationActionClipName(animations.map((clip) => clip.name), actionName);
      const clip = clipName ? animations.find((candidate) => candidate.name === clipName) : undefined;
      if (!clip) continue;
      const action = mixer.clipAction(createInPlaceAnimationClip(clip));
      if (getPetAnimationActionPlayback(actionName) === 'repeat') {
        action.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      petActionActions[actionName] = action;
    }
  }
  return { root, model, mixer, walkAction, idleAction, activeAction, petActionActions };
}

function pauseAnimationAtIdlePose(action: import('three').AnimationAction, mixer: import('three').AnimationMixer) {
  action.reset().play();
  action.time = getWalkIdlePoseTime(action.getClip().duration);
  action.paused = false;
  mixer.update(0);
  action.paused = true;
}

function transitionPetAnimation(
  actor: { activeAction?: import('three').AnimationAction },
  nextAction?: import('three').AnimationAction,
) {
  if (!nextAction) return false;
  const didTransition = actor.activeAction !== nextAction;
  if (didTransition) {
    const previousAction = actor.activeAction;
    nextAction.reset().setEffectiveWeight(1).play();
    if (previousAction) {
      nextAction.crossFadeFrom(previousAction, PET_ANIMATION_CROSSFADE_SECONDS, true);
    }
    actor.activeAction = nextAction;
  }
  nextAction.paused = false;
  return didTransition;
}

function updatePetAnimation(
  actor: {
    object: Object3D;
    model: Object3D;
    mixer?: import('three').AnimationMixer;
    walkAction?: import('three').AnimationAction;
    idleAction?: import('three').AnimationAction;
    activeAction?: import('three').AnimationAction;
    animationTime: number;
    idleCycleElapsed: number;
    movePending: boolean;
    movementSpeedMultiplier: number;
    baseY: number;
    walkingGroundOffset: number;
    petActionActions?: Partial<Record<PetAnimationAction, import('three').AnimationAction>>;
    petAction?: PetAnimationAction;
  },
  isWalking: boolean,
  delta: number,
  prefersReducedMotion: boolean,
) {
  const mixerDelta = delta * (prefersReducedMotion ? 0.75 : 1);
  if (actor.petAction && actor.mixer) {
    const petAction = actor.petActionActions?.[actor.petAction];
    if (petAction) {
      actor.mixer.update(mixerDelta);
      actor.object.position.y = actor.baseY;
      actor.model.rotation.z = 0;
      return;
    } else {
      actor.petAction = undefined;
    }
  }
  actor.animationTime += delta * (isWalking ? 8 * actor.movementSpeedMultiplier : 2.4);
  let nextAction = isWalking ? actor.walkAction : actor.idleAction;
  if (isWalking && actor.idleAction && actor.activeAction === actor.idleAction) {
    actor.movePending = true;
  } else if (!isWalking) {
    actor.movePending = false;
  }

  if (actor.idleAction && actor.activeAction === actor.idleAction) {
    const queuedState = queuePetMoveAfterIdleCycle(
      { cycleElapsed: actor.idleCycleElapsed, movePending: actor.movePending },
      isWalking && Boolean(actor.walkAction),
    );
    const idleCycle = advancePetIdleCycle(
      queuedState,
      mixerDelta,
      actor.idleAction.getClip().duration,
    );
    actor.idleCycleElapsed = idleCycle.state.cycleElapsed;
    actor.movePending = idleCycle.state.movePending;
    if (idleCycle.shouldSwitchToWalk && actor.walkAction) nextAction = actor.walkAction;
  }

  if (nextAction) {
    if (transitionPetAnimation(actor, nextAction) && nextAction === actor.idleAction) actor.idleCycleElapsed = 0;
  } else if (!isWalking && actor.walkAction) {
    actor.walkAction.paused = true;
    actor.activeAction = actor.walkAction;
  }
  if (actor.mixer) actor.mixer.update(mixerDelta);
  if (actor.activeAction === actor.walkAction && isWalking) {
    actor.object.position.y = actor.baseY + actor.walkingGroundOffset;
  } else {
    actor.object.position.y = actor.baseY;
  }
  actor.model.rotation.z = prefersReducedMotion
    ? 0
    : Math.sin(actor.animationTime) * (isWalking ? 0.035 : 0.012);
}

export function getCharacterAnimationClip(clips: readonly AnimationClip[], state: 'idle' | 'walk'): AnimationClip | undefined {
  const pattern = state === 'walk' ? /walk|run/i : /idle|iddle|stand|rest/i;
  return clips.find((clip) => pattern.test(clip.name));
}

function getWalkAnimationClip(clips: readonly AnimationClip[]): AnimationClip | undefined {
  return getCharacterAnimationClip(clips, 'walk') ?? clips[0];
}

/**
 * Patrol movement is driven by the world steering layer, so imported walk
 * clips must animate in place. Some supplied GLBs also key the armature root
 * forward; playing that root motion on top of the actor movement makes the
 * model snap backwards when the clip loops.
 */
export function createInPlaceAnimationClip(clip: AnimationClip): AnimationClip {
  const inPlaceClip = clip.clone();
  inPlaceClip.tracks.forEach((track) => {
    if (!/\.position$/i.test(track.name) || !/(?:^|[/.[\]])(?:armature|root|hips|pelvis|mixamorig:?root|mixamorig:?hips|mixamorig:?pelvis)(?:[/.[\]]|$)/i.test(track.name)) return;
    if (track.values.length < 3 || track.values.length % 3 !== 0) return;
    const initialX = track.values[0];
    const initialZ = track.values[2];
    for (let index = 0; index < track.values.length; index += 3) {
      track.values[index] = initialX;
      track.values[index + 2] = initialZ;
    }
  });
  return inPlaceClip;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('button, input, textarea, select, [role="dialog"], a'));
}

function getPetActorState(behaviorMode: PetBehaviorMode, following: boolean) {
  if (following) return 'following' as const;
  return behaviorMode === 'wander' ? 'wandering' as const : 'idle' as const;
}

function getCharacterUpdateKey(input: PrototypeWorldRuntimeUpdate): string {
  const item = input.equippedCatalogItem;
  return [
    input.characterRenderMode,
    input.characterModelUrl ?? '',
    item?.id ?? '',
    item?.assetKey ?? '',
    typeof item?.metadata.preview === 'string' ? item.metadata.preview : '',
    typeof item?.metadata.color === 'string' ? item.metadata.color : '',
  ].join('|');
}

export function mountPrototypeWorld(options: PrototypeWorldRuntimeOptions): PrototypeWorldRuntime {
  let disposed = false;
  let animationFrame = 0;
  let pausedTimer: number | undefined;
  let renderer: { dispose: () => void } | undefined;
  let scene: DisposableScene | undefined;
  let skyboxTexture: { dispose: () => void } | undefined;
  let loadingAbortController: AbortController | undefined;
  let removeListeners: (() => void) | undefined;
  let removeContextLostListener: (() => void) | undefined;
  let dracoDecoderLoader: { setDecoderPath: (path: string) => unknown; dispose: () => void } | undefined;
  let characterSwapAbortController: AbortController | undefined;
  let characterSwapSequence = 0;
  let updateScene: (next: PrototypeWorldRuntimeUpdate) => void = () => undefined;
  let playPetAnimation: (inventoryItemId: string, action: PetAnimationAction) => boolean = () => false;
  let stopPetAnimation: (inventoryItemId: string) => void = () => undefined;
  let playInteractionAction: (action: PetAnimationAction) => boolean = () => false;
  let optimisticPetActorsDirty = false;
  const optimisticPetIdles = new Map<string, PetSelection>();
  let latestRuntimeUpdate: PrototypeWorldRuntimeUpdate = {
    gameData: options.gameData,
    equippedCatalogItem: options.equippedCatalogItem,
    characterRenderMode: options.characterRenderMode,
    characterModelUrl: options.characterModelUrl,
    showPetNames: options.showPetNames,
    placement: options.placement,
  };
  const disposalTracker = createDisposalTracker();
  const resourceRoots: DisposableScene[] = [];

  const trackResourceRoot = (root: DisposableScene) => {
    if (disposed) {
      disposeObject3D(root, disposalTracker);
      return false;
    }
    resourceRoots.push(root);
    return true;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loadingAbortController?.abort();
    characterSwapAbortController?.abort();
    characterSwapSequence += 1;
    window.cancelAnimationFrame(animationFrame);
    if (pausedTimer !== undefined) window.clearTimeout(pausedTimer);
    removeListeners?.();
    removeContextLostListener?.();
    resourceRoots.forEach((root) => disposeObject3D(root, disposalTracker));
    if (scene && renderer) disposeScene(scene, renderer, disposalTracker);
    else if (scene) disposeObject3D(scene, disposalTracker);
    dracoDecoderLoader?.dispose();
    dracoDecoderLoader = undefined;
    disposeTexture(skyboxTexture, disposalTracker);
    renderer = undefined;
    scene = undefined;
  };

  const setup = async () => {
    let mixer: import('three').AnimationMixer | undefined;
    let roamingMixer: import('three').AnimationMixer | undefined;
    let roamingWalkAction: import('three').AnimationAction | undefined;
    try {
      options.onStatus('loading');
      options.onProgress(10, '讀取草地與大樹模型…');
      const THREE = await import('three');
      if (disposed) return;

      // The world is mounted inside the dashboard hero. Wait for that layer's
      // first layout pass so the browser can allocate the canvas context after
      // its final size is known, rather than racing React's initial paint.
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      if (disposed) return;

      const deviceNavigator = navigator as Navigator & { deviceMemory?: number };
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const quality = getWorldQuality({
        prefersReducedMotion,
        deviceMemory: deviceNavigator.deviceMemory,
        hardwareConcurrency: deviceNavigator.hardwareConcurrency,
      });
      const qualitySettings = WORLD_QUALITY_SETTINGS[quality];
      const visualSettings = getNaturalWorldVisualSettings(quality);
      const viewportWidth = Math.max(options.canvas.getBoundingClientRect().width, window.innerWidth, 1);
      const pixelRatio = getWorldPixelRatio({
        devicePixelRatio: window.devicePixelRatio,
        viewportWidth,
        maxPixelRatio: qualitySettings.maxPixelRatio,
      });
      const contextAttributes = { antialias: true, alpha: false };
      const webglContext = options.canvas.getContext('webgl2', contextAttributes)
        ?? options.canvas.getContext('webgl', contextAttributes);
      if (!webglContext) throw new Error('WebGL context is unavailable for the terrain canvas.');
      const rendererInstance = new THREE.WebGLRenderer({ canvas: options.canvas, context: webglContext as WebGL2RenderingContext, antialias: true, alpha: false });
      renderer = rendererInstance;
      rendererInstance.setPixelRatio(pixelRatio);
      rendererInstance.outputColorSpace = THREE.SRGBColorSpace;
      rendererInstance.toneMapping = THREE.ACESFilmicToneMapping;
      rendererInstance.toneMappingExposure = visualSettings.exposure;
      rendererInstance.shadowMap.enabled = qualitySettings.shadows;
      rendererInstance.shadowMap.type = THREE.PCFSoftShadowMap;

      const onContextLost = (event: Event) => {
        event.preventDefault();
        if (disposed) return;
        const error = new Error('WebGL context was lost while rendering the terrain world.');
        dispose();
        options.onStatus('failed');
        options.onError(error);
      };
      options.canvas.addEventListener('webglcontextlost', onContextLost, { passive: false });
      removeContextLostListener = () => options.canvas.removeEventListener('webglcontextlost', onContextLost);

      const worldScene = new THREE.Scene();
      scene = worldScene;
      worldScene.background = new THREE.Color(visualSettings.backgroundColor);
      worldScene.fog = new THREE.Fog(
        new THREE.Color(visualSettings.fogColor),
        visualSettings.fogNear,
        visualSettings.fogFar,
      );
      const texture = new THREE.TextureLoader().load(
        PROTOTYPE_WORLD_ASSETS.skybox,
        (loadedTexture) => {
          if (disposed) {
            loadedTexture.dispose();
            return;
          }
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.mapping = THREE.EquirectangularReflectionMapping;
          loadedTexture.needsUpdate = true;
          worldScene.background = loadedTexture;
          worldScene.environment = loadedTexture;
          worldScene.environmentIntensity = visualSettings.environmentIntensity;
        },
      );
      skyboxTexture = texture;

      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      worldScene.add(new THREE.HemisphereLight(
        visualSettings.hemisphereSkyColor,
        visualSettings.hemisphereGroundColor,
        visualSettings.hemisphereIntensity,
      ));
      const sun = new THREE.DirectionalLight(visualSettings.sunColor, visualSettings.sunIntensity);
      sun.position.set(...visualSettings.sunPosition);
      sun.target.position.set(0, 0, 0);
      worldScene.add(sun.target);
      sun.castShadow = qualitySettings.shadows;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.018;
      sun.shadow.mapSize.set(qualitySettings.shadowMapSize, qualitySettings.shadowMapSize);
      sun.shadow.camera.left = -10;
      sun.shadow.camera.right = 10;
      sun.shadow.camera.top = 10;
      sun.shadow.camera.bottom = -10;
      sun.shadow.camera.near = 0.1;
      sun.shadow.camera.far = 40;
      worldScene.add(sun);

      loadingAbortController = new AbortController();
      const signal = loadingAbortController.signal;
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
      const { clone: cloneSkinnedObject } = await import('three/examples/jsm/utils/SkeletonUtils.js');
      const loader = new GLTFLoader();
      dracoDecoderLoader = new DRACOLoader();
      dracoDecoderLoader.setDecoderPath('/draco/');
      loader.setDRACOLoader(dracoDecoderLoader);
      const treeResult = await loadGltfSafely<{ scene: Object3D }>(loader, PROTOTYPE_WORLD_ASSETS.tree, signal);
      const treeSource = treeResult.scene;
      if (!trackResourceRoot(treeSource)) return;
      if (disposed) return;
      options.onProgress(54, '生成森林邊界…');
      let characterSource: Object3D;
      let characterAnimations: AnimationClip[] = [];
      let roamingCharacterAnimations: AnimationClip[] = [];
      if (options.characterRenderMode === 'anime-maiden' || options.characterRenderMode === 'world-glb') {
        const characterUrl = options.characterModelUrl ?? PROTOTYPE_WORLD_ASSETS.character;
        const characterResult = await loadGltfSafely<{ scene: Object3D; animations: AnimationClip[] }>(loader, characterUrl, signal);
        characterSource = characterResult.scene;
        if (!trackResourceRoot(characterSource)) return;
        characterAnimations = characterResult.animations;
      } else if (options.characterRenderMode === 'procedural') {
        characterSource = options.createProceduralCharacter(THREE, options.equippedCatalogItem);
        if (!trackResourceRoot(characterSource)) return;
      } else {
        throw new Error(`Unsupported character render mode: ${options.characterRenderMode}`);
      }
      applyWarmHandPaintedCharacterStyle(characterSource);
      let roamingCharacterSource: Object3D | undefined;
      options.onProgress(58, '邀請芽芽旅行者進入世界…');
      try {
        const roamingResult = await loadGltfSafely<{ scene: Object3D; animations: AnimationClip[] }>(loader, PROTOTYPE_WORLD_ASSETS.roamingCharacter, signal);
        if (trackResourceRoot(roamingResult.scene)) roamingCharacterSource = roamingResult.scene;
        roamingCharacterAnimations = roamingResult.animations;
      } catch (error) {
        if (!disposed && !signal.aborted) console.warn(`Unable to load roaming character ${HABITHERO_ROAMING_CHARACTER_ASSET_KEY}; keeping the world playable.`, error);
      }
      if (disposed) return;
      if (roamingCharacterSource) applyWarmHandPaintedCharacterStyle(roamingCharacterSource);

      const followingPetInventoryIds = getFollowingPetInventoryIds(options.gameData);
      const catalogById = new Map(options.gameData.catalog.map((item) => [item.id, item]));
      const petCatalogById = new Map(options.gameData.catalog.filter((item) => item.itemType === 'pet').map((item) => [item.id, item]));
      const petCatalogByAssetKey = new Map(options.gameData.catalog.filter((item) => item.itemType === 'pet').map((item) => [item.assetKey, item]));
      const petModelEntries = new Map<string, string>();
      const registerPetModel = (item: GameCatalogItem | undefined, assetKey?: string) => {
        const resolvedItem = item ?? (assetKey ? petCatalogByAssetKey.get(assetKey) : undefined);
        const resolvedAssetKey = resolvedItem?.assetKey ?? assetKey;
        const modelUrl = getPetModelUrl(resolvedItem);
        if (resolvedAssetKey && modelUrl) petModelEntries.set(resolvedAssetKey, modelUrl);
      };
      getRequiredWorldPetCatalogItems(options.gameData).forEach((item) => registerPetModel(item));
      const petModelSources = new Map<string, { scene: Object3D; animations: AnimationClip[] }>();
      const petModelLoads = new Map<string, Promise<{ scene: Object3D; animations: AnimationClip[] } | undefined>>();
      const loadPetModelSource = (modelUrl: string, loadSignal: AbortSignal) => {
        const cached = petModelSources.get(modelUrl);
        if (cached) return Promise.resolve(cached);
        const pending = petModelLoads.get(modelUrl);
        if (pending) return pending;
        const load = loadGltfSafely<{ scene: Object3D; animations: AnimationClip[] }>(loader, modelUrl, loadSignal)
          .then((petResult) => {
            applyPicturebookPetModelStyle(petResult.scene);
            if (!trackResourceRoot(petResult.scene)) return undefined;
            petModelSources.set(modelUrl, petResult);
            return petResult;
          })
          .catch((error: unknown) => {
            if (!disposed && !loadSignal.aborted) console.warn(`Unable to load pet model ${modelUrl}; skipping that pet.`, error);
            return undefined;
          })
          .finally(() => petModelLoads.delete(modelUrl));
        petModelLoads.set(modelUrl, load);
        return load;
      };
      const petModelUrls = [...new Set(petModelEntries.values())];
      if (petModelUrls.length > 0) {
        options.onProgress(64, '讀取星芽獸木偶模型…');
        await Promise.all(petModelUrls.map((modelUrl) => loadPetModelSource(modelUrl, signal)));
      }
      if (disposed) return;

      const decorationModelSources = new Map<string, Object3D>();
      const decorationModelLoads = new Map<string, Promise<Object3D | undefined>>();
      const loadDecorationModelSource = (item: GameCatalogItem, loadSignal: AbortSignal) => {
        const modelUrl = getDecorationModelUrl(item);
        if (!modelUrl) return Promise.resolve(undefined);
        const cached = decorationModelSources.get(item.id);
        if (cached) return Promise.resolve(cached);
        const pending = decorationModelLoads.get(item.id);
        if (pending) return pending;
        const load = loadGltfSafely<{ scene: Object3D }>(loader, modelUrl, loadSignal)
          .then((decorationResult) => {
            if (!trackResourceRoot(decorationResult.scene)) return undefined;
            decorationModelSources.set(item.id, decorationResult.scene);
            return decorationResult.scene;
          })
          .catch((error: unknown) => {
            if (!disposed && !loadSignal.aborted) console.warn(`Unable to load decoration model ${modelUrl}; using a compact fallback.`, error);
            return undefined;
          })
          .finally(() => decorationModelLoads.delete(item.id));
        decorationModelLoads.set(item.id, load);
        return load;
      };
      const decorationModelItems = getRequiredWorldDecorationCatalogItems(options.gameData, options.placement?.item)
        .filter((item) => Boolean(getDecorationModelUrl(item)));
      if (decorationModelItems.length > 0) {
        options.onProgress(68, '讀取世界家具模型…');
        await Promise.all(decorationModelItems.map((item) => loadDecorationModelSource(item, signal)));
      }
      if (disposed) return;

      const treeDefinition = defineAsset(THREE, treeSource);
      applyCentralTreeMaterialFallback(THREE, treeDefinition.source);
      const terrainStep = PROTOTYPE_WORLD_CONFIG.terrainStep;
      const terrainLimit = terrainStep * ((PROTOTYPE_WORLD_CONFIG.gridSize - 1) / 2 + 0.42);
      const walkableWidth = terrainStep * PROTOTYPE_WORLD_CONFIG.gridSize;
      const terrainWidth = terrainStep * (PROTOTYPE_WORLD_CONFIG.gridSize + PROTOTYPE_WORLD_CONFIG.scenePadding * 2);
      const terrain = new THREE.Group();
      terrain.name = `${PROTOTYPE_WORLD_CONFIG.gridSize}x${PROTOTYPE_WORLD_CONFIG.gridSize}-terrain`;
      const proceduralGrass = createProceduralGrassField(THREE, {
        fieldSize: terrainWidth * 0.98,
        walkableSize: walkableWidth,
        baseHeight: 0.004,
        viewportWidth,
        pixelRatio,
        count: scaleWorldBudget(
          getProceduralGrassCount({ width: viewportWidth, pixelRatio }),
          quality,
          'grass',
        ),
        outerDensityMultiplier: qualitySettings.outerDensityMultiplier,
        boundaryDensityMultiplier: qualitySettings.boundaryDensityMultiplier,
        sunDirection: visualSettings.sunDirection,
        sunColor: visualSettings.sunColor,
        ambientColor: visualSettings.grassAmbientColor,
      });
      terrain.add(proceduralGrass.ground, proceduralGrass.mesh);
      terrain.add(createProceduralFlowerField(THREE, {
        walkableSize: walkableWidth,
        baseHeight: 0.006,
        viewportWidth: window.innerWidth,
        count: scaleWorldBudget(
          getProceduralFlowerCount({ width: window.innerWidth }),
          quality,
          'flower',
        ),
      }));
      const ambientPollen = createAmbientPollenField(THREE, {
        fieldSize: terrainWidth * 0.9,
        count: visualSettings.pollenCount,
        opacity: visualSettings.pollenOpacity,
      });
      terrain.add(ambientPollen.points);
      const sunlightPatches = createSunlightPatchField(THREE, {
        color: visualSettings.sunlightPatchColor,
        opacity: visualSettings.sunlightPatchOpacity,
        count: visualSettings.sunlightPatchCount,
      });
      terrain.add(sunlightPatches.group);
      const treePlacement = getOuterTreePlacement({
        treeSize: treeDefinition.size,
        terrainLimit,
        terrainStep,
        treeFitToTile: PROTOTYPE_WORLD_CONFIG.treeFitToTile,
        x: PROTOTYPE_WORLD_CONFIG.treeAnchorX,
      });
      const tree = placeAsset(THREE, treeDefinition, {
        x: treePlacement.x,
        y: -PROTOTYPE_WORLD_CONFIG.treeRootSink,
        z: treePlacement.z,
      }, treePlacement.scale);
      tree.scale.y *= PROTOTYPE_WORLD_CONFIG.treeHeightScale;
      terrain.add(tree);
      const centralTreeHeight = treeDefinition.size.y * treePlacement.scale * PROTOTYPE_WORLD_CONFIG.treeHeightScale;
      terrain.add(createProceduralForest(THREE, {
        terrainLimit,
        groundHeight: 0,
        heightLimit: centralTreeHeight * 0.5,
        layers: qualitySettings.forestLayers,
      }));
      const eastFairytaleScenery = createEastFairytaleScenery(THREE, { quality });
      terrain.add(eastFairytaleScenery.group);
      const butterflyFlightBounds = getButterflyFlightBounds({
        treeFootprintRadius: treePlacement.footprintRadius,
        maxRadius: 3,
      });
      const butterflies = createButterflyField(THREE, {
        count: visualSettings.butterflyCount,
        center: {
          x: treePlacement.x,
          z: treePlacement.z,
        },
        minRadius: butterflyFlightBounds.minRadius,
        radius: butterflyFlightBounds.maxRadius,
        minHeight: 0.78,
        maxHeight: 1.35,
      });
      terrain.add(butterflies.group);
      worldScene.add(terrain);

      const playerRoot = new THREE.Group();
      playerRoot.name = 'player-root';
      playerRoot.position.set(0, 0, terrainStep * 2.08);
      const playerFollowHistory: WorldPoint2D[] = [];
      let characterDefinition = defineAsset(THREE, characterSource);
      let characterScale = PROTOTYPE_WORLD_CONFIG.characterTargetHeight / Math.max(characterDefinition.size.y, 0.001);
      const characterRoot = new THREE.Group();
      characterRoot.name = 'player-character';
      characterRoot.scale.setScalar(characterScale);
      characterRoot.position.y = PLAYER_CHARACTER_GROUND_OFFSET;
      characterSource.position.copy(characterDefinition.offset);
      characterRoot.add(characterSource);
      playerRoot.add(characterRoot);
      worldScene.add(playerRoot);

      const playerMarker = new THREE.Mesh(
        new THREE.CircleGeometry(0.2, 32),
        createPlayerGroundShadowMaterial(THREE),
      );
      playerMarker.name = 'player-ground-shadow';
      playerMarker.rotation.x = -Math.PI / 2;
      playerMarker.scale.set(1.2, 0.74, 1);
      playerMarker.position.y = 0.006;
      playerRoot.add(playerMarker);

      let roamingActor: {
        object: import('three').Group;
        model: Object3D;
        footNodes: Object3D[];
        baseModelY: number;
        animationTime: number;
        facing: { x: number; z: number };
        wanderState: WanderState;
      } | undefined;
      if (roamingCharacterSource) {
        const roamingDefinition = defineAsset(THREE, roamingCharacterSource);
        // Object3D.clone(true) leaves SkinnedMesh.skeleton pointing at the
        // source rig, so the mixer can advance while the visible mesh stays in
        // its bind pose. SkeletonUtils.clone remaps every bone to this actor.
        const roamingModel = cloneSkinnedObject(roamingCharacterSource);
        const roamingRoot = new THREE.Group();
        roamingRoot.name = 'habithero-roaming-character';
        roamingRoot.position.set(-2.4, 0, 0.1);
        roamingRoot.scale.setScalar(
          (PROTOTYPE_WORLD_CONFIG.characterTargetHeight / Math.max(roamingDefinition.size.y, 0.001))
          * HABITHERO_ROAMING_CHARACTER_VISUAL_SCALE,
        );
        roamingModel.position.copy(roamingDefinition.offset);
        roamingRoot.add(roamingModel);
        if (roamingCharacterAnimations.length > 0) {
          roamingMixer = new THREE.AnimationMixer(roamingModel);
          const walkClip = createInPlaceAnimationClip(getWalkAnimationClip(roamingCharacterAnimations)!);
          if (walkClip) {
            roamingWalkAction = roamingMixer.clipAction(walkClip);
            roamingWalkAction.setLoop(THREE.LoopRepeat, Infinity);
            roamingWalkAction.play();
            roamingWalkAction.paused = false;
          }
        }
        const roamingMarker = new THREE.Mesh(
          new THREE.CircleGeometry(0.2, 32),
          createPlayerGroundShadowMaterial(THREE),
        );
        roamingMarker.name = 'habithero-roaming-character-shadow';
        roamingMarker.rotation.x = -Math.PI / 2;
        roamingMarker.scale.set(1.08, 0.7, 1);
        roamingMarker.position.y = 0.006;
        roamingRoot.add(roamingMarker);
        worldScene.add(roamingRoot);
        roamingActor = {
          object: roamingRoot,
          model: roamingModel,
          footNodes: getCharacterFootNodes(roamingModel),
          baseModelY: roamingModel.position.y,
          animationTime: 0,
          facing: { x: 0, z: 1 },
          wanderState: createWanderState(hashWanderSeed('habithero-roaming-character'), { x: 0, z: 1 }),
        };
      }

      const groundRoamingCharacterOnGrass = () => {
        if (!roamingActor) return;
        roamingActor.model.updateMatrixWorld(true);
        const roamingBounds = new THREE.Box3().setFromObject(roamingActor.model);
        const footYs = roamingActor.footNodes.map((node) => node.getWorldPosition(new THREE.Vector3()).y);
        const referenceY = getCharacterGroundingReferenceY(roamingBounds.min.y, footYs);
        roamingActor.object.position.y = getGroundedRootY(roamingActor.object.position.y, referenceY);
        roamingActor.object.updateMatrixWorld(true);
      };
      groundRoamingCharacterOnGrass();

      let characterActions = new Map<CharacterAnimationAction, import('three').AnimationAction>();
      let activeCharacterAction: import('three').AnimationAction | undefined;
      const playCharacterAction = (name: CharacterAnimationAction) => {
        const fallbackClip = name === 'walk' ? getWalkAnimationClip(characterAnimations) : undefined;
        const nextAction = characterActions.get(name) ?? (fallbackClip && mixer ? mixer.clipAction(fallbackClip) : undefined);
        if (!nextAction) {
          if (name === 'idle') {
            const walkAction = characterActions.get('walk');
            if (walkAction) {
              pauseAnimationAtIdlePose(walkAction, mixer!);
            }
            activeCharacterAction = undefined;
          }
          return;
        }
        if (nextAction === activeCharacterAction) {
          nextAction.paused = false;
          return;
        }
        nextAction.reset();
        if (name === 'walk') nextAction.time = getWalkIdlePoseTime(nextAction.getClip().duration);
        const shouldFadeIn = name !== 'walk' || characterActions.has('idle');
        if (shouldFadeIn) nextAction.fadeIn(0.16).play();
        else nextAction.setEffectiveWeight(1).play();
        nextAction.paused = false;
        activeCharacterAction?.fadeOut(0.16);
        activeCharacterAction = nextAction;
      };
      const configureCharacterAnimation = () => {
        mixer?.stopAllAction();
        mixer = characterAnimations.length > 0 ? new THREE.AnimationMixer(characterSource) : undefined;
        characterActions = new Map<CharacterAnimationAction, import('three').AnimationAction>();
        characterAnimations.forEach((clip) => {
          const name = clip.name.toLowerCase();
          if (name.includes('walk') || name.includes('run')) characterActions.set('walk', mixer!.clipAction(createInPlaceAnimationClip(clip)));
          if (name.includes('idle') || name.includes('iddle') || name.includes('stand') || name.includes('rest')) characterActions.set('idle', mixer!.clipAction(clip));
        });
        for (const actionName of getAvailablePetAnimationActions(characterAnimations.map((clip) => clip.name))) {
          const clipName = getPetAnimationActionClipName(characterAnimations.map((clip) => clip.name), actionName);
          const clip = clipName ? characterAnimations.find((candidate) => candidate.name === clipName) : undefined;
          if (!clip) continue;
          const action = mixer!.clipAction(createInPlaceAnimationClip(clip));
          if (getPetAnimationActionPlayback(actionName) === 'repeat') {
            action.setLoop(THREE.LoopRepeat, Infinity);
          } else {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          characterActions.set(actionName, action);
        }
        characterActions.forEach((action, actionName) => {
          if (actionName === 'sit' || actionName === 'wave' || actionName === 'dance') return;
          action.setLoop(THREE.LoopRepeat, Infinity);
        });
        activeCharacterAction = undefined;
        playCharacterAction('idle');
      };
      configureCharacterAnimation();
      let characterFootNodes = getCharacterFootNodes(characterSource);
      const groundCharacterOnGrass = () => {
        characterSource.updateMatrixWorld(true);
        const characterBounds = new THREE.Box3().setFromObject(characterSource);
        const footYs = characterFootNodes.map((node) => node.getWorldPosition(new THREE.Vector3()).y);
        const referenceY = getCharacterGroundingReferenceY(characterBounds.min.y, footYs);
        characterRoot.position.y = getGroundedRootY(
          characterRoot.position.y,
          referenceY,
          playerRoot.position.y,
        );
        characterRoot.updateMatrixWorld(true);
      };
      groundCharacterOnGrass();

      const decorationCollisions = buildCollisionCircles(options.gameData.worldEntities
        .filter((entity) => entity.entityKind === 'decoration')
        .map((entity) => getDecorationCollisionInput(options.gameData, entity)));
      const wanderObstacles = [CENTRAL_TREE_KEEP_OUT, ...decorationCollisions];
      const petSpawnObstacles = [CHARACTER_SPAWN, ...wanderObstacles];
      let petSpawnIndex = 0;
      const characterWorldHeight = characterDefinition.size.y * characterScale;
      const decorationObjects: Array<{ entityId: string; object: Object3D }> = [];
      const petActors: Array<{
        entityId: string;
        inventoryItemId: string;
        object: import('three').Object3D;
        model: Object3D;
        mixer?: import('three').AnimationMixer;
        walkAction?: import('three').AnimationAction;
        idleAction?: import('three').AnimationAction;
        activeAction?: import('three').AnimationAction;
        behaviorMode: PetBehaviorMode;
        follow: boolean;
        radius: number;
        baseY: number;
        animationTime: number;
        idleCycleElapsed: number;
        movePending: boolean;
        facing: { x: number; z: number };
        state: 'following' | 'wandering' | 'idle';
        followIndex: number;
        movementSpeedMultiplier: number;
        walkingGroundOffset: number;
        petActionActions: Partial<Record<PetAnimationAction, import('three').AnimationAction>>;
        petAction?: PetAnimationAction;
        target: { x: number; z: number } | null;
        followHistory: WorldPoint2D[];
        wanderState: WanderState;
        active: boolean;
      }> = [];
      playPetAnimation = (inventoryItemId, actionName) => {
        const actor = petActors.find((candidate) => candidate.inventoryItemId === inventoryItemId && candidate.active);
        const action = actor?.petActionActions[actionName];
        if (!actor || !action || !actor.mixer) return false;
        const previousAction = actor.activeAction;
        action.reset().setEffectiveWeight(1).play();
        if (getPetAnimationActionPlayback(actionName) === 'repeat') {
          action.setLoop(THREE.LoopRepeat, Infinity);
        } else {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        if (previousAction && previousAction !== action) {
          action.crossFadeFrom(previousAction, PET_ANIMATION_CROSSFADE_SECONDS, true);
        }
        actor.activeAction = action;
        actor.petAction = actionName;
        return true;
      };
      stopPetAnimation = (inventoryItemId) => {
        const actor = petActors.find((candidate) => candidate.inventoryItemId === inventoryItemId && candidate.active);
        if (!actor || !actor.petAction) return;
        transitionPetAnimation(actor, actor.idleAction ?? actor.walkAction);
        actor.petAction = undefined;
        actor.object.position.y = actor.baseY;
        actor.model.rotation.z = 0;
      };
      options.gameData.worldEntities.filter((entity) => entity.isActive).forEach((entity) => {
        const isPet = entity.entityKind === 'pet';
        const catalogItem = isPet
          ? resolvePetCatalogItem(entity, petCatalogById, petCatalogByAssetKey)
          : entity.catalogItemId
            ? catalogById.get(entity.catalogItemId)
            : options.gameData.inventory
              .find((inventory) => inventory.id === entity.inventoryItemId)
              ?.catalogItemId
              ? catalogById.get(options.gameData.inventory.find((inventory) => inventory.id === entity.inventoryItemId)!.catalogItemId)
              : undefined;
        const petModelUrl = isPet ? getPetModelUrl(catalogItem) : undefined;
        const petModelSource = petModelUrl ? petModelSources.get(petModelUrl) : undefined;
        const petWorldScale = Math.max(entity.scale, 0.01) * getPetVisualScaleMultiplier(catalogItem?.assetKey ?? entity.assetKey, catalogItem?.metadata);
        const petGroundOffset = isPet
          ? getPetGroundOffset(catalogItem?.assetKey ?? entity.assetKey, catalogItem?.metadata)
          : 0;
        const petWalkingGroundOffset = isPet
          ? getPetWalkingGroundOffset(catalogItem?.assetKey ?? entity.assetKey, catalogItem?.metadata)
          : 0;
        const petMovementSpeedMultiplier = isPet
          ? getPetMovementSpeedMultiplier(catalogItem?.assetKey ?? entity.assetKey, catalogItem?.metadata)
          : 1;
        const petRadius = getPetNavigationRadius(entity.collisionRadius ?? 0.28, entity.scale);
        const petModel = isPet && petModelSource
          ? createPetModel(
            THREE,
            cloneSkinnedObject,
            petModelSource.scene,
            petModelSource.animations,
            characterWorldHeight,
            petWorldScale,
            entity.displayName ?? catalogItem?.name,
            options.showPetNames,
            shouldHidePetGroundShadow(catalogItem?.metadata),
            shouldHidePetGroundMarker(catalogItem?.metadata),
            getPetGroundShadowScale(catalogItem?.metadata),
            getPetNameLabelScale(catalogItem?.metadata),
          )
          : undefined;
        if (isPet && !petModel) return;
        const decorationModelSource = !isPet && catalogItem
          ? decorationModelSources.get(catalogItem.id)
          : undefined;
        const object = isPet
          ? petModel!.root
          : createDecorationObject(THREE, catalogItem, 1, decorationModelSource);
        if (!isPet) {
          object.position.set(entity.x, entity.y, entity.z);
          object.rotation.set(entity.rotationX, entity.rotationY, entity.rotationZ);
          object.scale.setScalar(entity.scale);
        } else {
          const spawn = getDistributedPetSpawnPosition(petSpawnIndex, petRadius, petSpawnObstacles);
          petSpawnIndex += 1;
          petSpawnObstacles.push({ ...spawn, radius: petRadius });
          object.position.set(spawn.x, entity.y + petGroundOffset, spawn.z);
          object.rotation.set(entity.rotationX, entity.rotationY, entity.rotationZ);
        }
        if (!isPet) (object as Object3D & { castShadow?: boolean }).castShadow = true;
        worldScene.add(object);
        if (!isPet) decorationObjects.push({ entityId: entity.id, object });
        if (isPet) {
          const followIndex = followingPetInventoryIds.indexOf(entity.inventoryItemId);
          const follow = followIndex >= 0;
          const initialFacing = { x: Math.sin(PROTOTYPE_WORLD_CONFIG.initialCameraYaw), z: Math.cos(PROTOTYPE_WORLD_CONFIG.initialCameraYaw) };
          petActors.push({ entityId: entity.id, inventoryItemId: entity.inventoryItemId, object, model: petModel!.model, mixer: petModel!.mixer, walkAction: petModel!.walkAction, idleAction: petModel!.idleAction, activeAction: petModel!.activeAction, petActionActions: petModel!.petActionActions, behaviorMode: entity.behaviorMode, follow, followIndex, movementSpeedMultiplier: petMovementSpeedMultiplier, walkingGroundOffset: petWalkingGroundOffset, radius: petRadius, baseY: entity.y + petGroundOffset, animationTime: 0, idleCycleElapsed: 0, movePending: false, facing: initialFacing, state: getPetActorState(entity.behaviorMode, follow), target: null, followHistory: [], wanderState: createWanderState(hashWanderSeed(`pet:${entity.id}:${entity.inventoryItemId}`), initialFacing), active: true });
        }
      });
      followingPetInventoryIds.forEach((inventoryId, followIndex) => {
        if (petActors.some((actor) => actor.followIndex === followIndex)) return;
        const followingInventory = options.gameData.inventory.find((inventory) => inventory.id === inventoryId);
        const followingPet = followingInventory
          ? petCatalogById.get(followingInventory.catalogItemId)
          : undefined;
        const petModelUrl = getPetModelUrl(followingPet);
        const petModelSource = petModelUrl ? petModelSources.get(petModelUrl) : undefined;
        if (petModelSource) {
          const petVisualMultiplier = getPetVisualScaleMultiplier(followingPet?.assetKey, followingPet?.metadata);
          const petMovementSpeedMultiplier = getPetMovementSpeedMultiplier(followingPet?.assetKey, followingPet?.metadata);
          const petGroundOffset = getPetGroundOffset(followingPet?.assetKey, followingPet?.metadata);
          const petWalkingGroundOffset = getPetWalkingGroundOffset(followingPet?.assetKey, followingPet?.metadata);
          const petModel = createPetModel(
            THREE,
            cloneSkinnedObject,
            petModelSource.scene,
            petModelSource.animations,
            characterWorldHeight,
            (followingPet?.maxScale ?? 1) * petVisualMultiplier,
            followingInventory?.displayName ?? followingPet?.name,
            options.showPetNames,
            shouldHidePetGroundShadow(followingPet?.metadata),
            shouldHidePetGroundMarker(followingPet?.metadata),
            getPetGroundShadowScale(followingPet?.metadata),
            getPetNameLabelScale(followingPet?.metadata),
          );
          const object = petModel.root;
          const initialFacing = { x: Math.sin(characterRoot.rotation.y), z: Math.cos(characterRoot.rotation.y) };
          const petRadius = getPetNavigationRadius(followingPet?.collisionRadius ?? 0.28, followingPet?.maxScale ?? 1);
          const previousLeader = followIndex > 0
            ? petActors.find((candidate) => candidate.active && candidate.followIndex === followIndex - 1)
            : undefined;
          const leaderPosition = previousLeader
            ? { x: previousLeader.object.position.x, z: previousLeader.object.position.z }
            : { x: playerRoot.position.x, z: playerRoot.position.z };
          const leaderRadius = previousLeader?.radius ?? CHARACTER_COLLISION_RADIUS;
          const initialFollowDistance = Math.max(
            getFollowingDistance(followIndex),
            leaderRadius + petRadius + PET_FOLLOW_CLEARANCE,
          );
          object.position.set(
            leaderPosition.x - initialFacing.x * initialFollowDistance,
            petGroundOffset,
            leaderPosition.z - initialFacing.z * initialFollowDistance,
          );
          worldScene.add(object);
          petActors.push({ entityId: `following:${inventoryId}`, inventoryItemId: inventoryId, object, model: petModel.model, mixer: petModel.mixer, walkAction: petModel.walkAction, idleAction: petModel.idleAction, activeAction: petModel.activeAction, petActionActions: petModel.petActionActions, behaviorMode: 'idle', follow: true, followIndex, movementSpeedMultiplier: petMovementSpeedMultiplier, walkingGroundOffset: petWalkingGroundOffset, radius: petRadius, baseY: petGroundOffset, animationTime: 0, idleCycleElapsed: 0, movePending: false, facing: initialFacing, state: 'following', target: null, followHistory: [], wanderState: createWanderState(hashWanderSeed(`following:${inventoryId}`), initialFacing), active: true });
        }
      });

      let interactionActionState: {
        inventoryItemId?: string;
        action: PetAnimationAction;
      } | undefined;
      const getInteractionTarget = (): WorldInteractionTarget | null => {
        if (options.pausedRef.current || placementActive) return null;
        const characterActionsAvailable = (['sit', 'wave', 'dance'] as const)
          .filter((action) => characterActions.has(action));
        const petTarget = findFacingPetTarget({
          playerPosition: { x: playerRoot.position.x, z: playerRoot.position.z },
          playerFacing: { x: Math.sin(characterRoot.rotation.y), z: Math.cos(characterRoot.rotation.y) },
          pets: petActors
            .filter((actor) => actor.active)
            .map((actor) => ({
              inventoryItemId: actor.inventoryItemId,
              position: { x: actor.object.position.x, z: actor.object.position.z },
              availableActions: Object.keys(actor.petActionActions) as PetAnimationAction[],
            })),
        });
        if (!petTarget) return null;
        return {
          ...petTarget,
          availableActions: getSharedInteractionActions(characterActionsAvailable, petTarget.availableActions),
        };
      };
      const finishInteractionAction = (nextCharacterAction: 'idle' | 'walk' = 'idle') => {
        const state = interactionActionState;
        if (!state) return;
        const actor = state.inventoryItemId
          ? petActors.find((candidate) => candidate.inventoryItemId === state.inventoryItemId && candidate.active)
          : undefined;
        if (actor?.petAction === state.action) {
          transitionPetAnimation(actor, actor.idleAction ?? actor.walkAction);
          actor.petAction = undefined;
          actor.object.position.y = actor.baseY;
          actor.model.rotation.z = 0;
        }
        interactionActionState = undefined;
        playCharacterAction(nextCharacterAction);
      };
      playInteractionAction = (actionName) => {
        const target = getInteractionTarget();
        const characterAction = characterActions.get(actionName);
        if (!characterAction) return false;

        finishInteractionAction();
        playCharacterAction(actionName);
        const actor = target?.availableActions.includes(actionName)
          ? petActors.find((candidate) => candidate.inventoryItemId === target.inventoryItemId && candidate.active)
          : undefined;
        const petAction = actor?.petActionActions[actionName];
        if (!actor || !petAction || !actor.mixer) {
          interactionActionState = {
            action: actionName,
          };
          return true;
        }

        const offsetX = actor.object.position.x - playerRoot.position.x;
        const offsetZ = actor.object.position.z - playerRoot.position.z;
        characterRoot.rotation.y = Math.atan2(offsetX, offsetZ);
        actor.object.rotation.y = Math.atan2(-offsetX, -offsetZ);
        actor.target = null;
        actor.state = 'idle';

        const previousPetAction = actor.activeAction;
        petAction.reset().setEffectiveWeight(1).play();
        if (getPetAnimationActionPlayback(actionName) === 'repeat') {
          petAction.setLoop(THREE.LoopRepeat, Infinity);
        } else {
          petAction.setLoop(THREE.LoopOnce, 1);
          petAction.clampWhenFinished = true;
        }
        if (previousPetAction && previousPetAction !== petAction) {
          petAction.crossFadeFrom(previousPetAction, PET_ANIMATION_CROSSFADE_SECONDS, true);
        }
        actor.activeAction = petAction;
        actor.petAction = actionName;
        interactionActionState = {
          inventoryItemId: actor.inventoryItemId,
          action: actionName,
        };
        return true;
      };

      type RuntimePetActor = (typeof petActors)[number];
      let latestPetData = options.gameData;
      const pendingPetActors = new Set<string>();
      const refreshPetCatalogMaps = (gameData: ChildGameData) => {
        petCatalogById.clear();
        petCatalogByAssetKey.clear();
        gameData.catalog.filter((item) => item.itemType === 'pet').forEach((item) => {
          petCatalogById.set(item.id, item);
          petCatalogByAssetKey.set(item.assetKey, item);
        });
      };

      const updatePetActorState = (
        actor: RuntimePetActor,
        entity: ChildWorldEntity,
        catalogItem: GameCatalogItem,
        followIndex: number,
        placeAtStart: boolean,
      ) => {
        const following = followIndex >= 0;
        const visualMultiplier = getPetVisualScaleMultiplier(catalogItem.assetKey, catalogItem.metadata);
        const groundOffset = getPetGroundOffset(catalogItem.assetKey, catalogItem.metadata);
        const walkingGroundOffset = getPetWalkingGroundOffset(catalogItem.assetKey, catalogItem.metadata);
        actor.entityId = entity.id;
        actor.behaviorMode = following ? 'idle' : entity.behaviorMode;
        actor.follow = following;
        actor.followIndex = followIndex;
        actor.movementSpeedMultiplier = getPetMovementSpeedMultiplier(catalogItem.assetKey, catalogItem.metadata);
        actor.walkingGroundOffset = walkingGroundOffset;
        actor.radius = getPetNavigationRadius(entity.collisionRadius ?? catalogItem.collisionRadius, following ? (catalogItem.maxScale ?? 1) : entity.scale);
        actor.baseY = entity.y + groundOffset;
        actor.state = getPetActorState(actor.behaviorMode, following);
        actor.target = null;
        actor.followHistory.length = 0;
        if (!placeAtStart) return;
        const facing = { x: Math.sin(characterRoot.rotation.y), z: Math.cos(characterRoot.rotation.y) };
        if (following) {
          const previousLeader = followIndex > 0
            ? petActors.find((candidate) => candidate.active && candidate !== actor && candidate.followIndex === followIndex - 1)
            : undefined;
          const leaderPosition = previousLeader
            ? { x: previousLeader.object.position.x, z: previousLeader.object.position.z }
            : { x: playerRoot.position.x, z: playerRoot.position.z };
          const followDistance = Math.max(
            getFollowingDistance(followIndex),
            (previousLeader?.radius ?? CHARACTER_COLLISION_RADIUS) + actor.radius + PET_FOLLOW_CLEARANCE,
          );
          actor.object.position.set(
            leaderPosition.x - facing.x * followDistance,
            actor.baseY,
            leaderPosition.z - facing.z * followDistance,
          );
        } else {
          actor.object.position.set(entity.x, entity.y + groundOffset, entity.z);
          actor.object.rotation.set(entity.rotationX, entity.rotationY, entity.rotationZ);
        }
      };

      const createRuntimePetActor = (
        entity: ChildWorldEntity,
        catalogItem: GameCatalogItem,
        followIndex: number,
        petModelSource: { scene: Object3D; animations: AnimationClip[] },
      ): RuntimePetActor => {
        const following = followIndex >= 0;
        const visualMultiplier = getPetVisualScaleMultiplier(catalogItem.assetKey, catalogItem.metadata);
        const petModel = createPetModel(
          THREE,
          cloneSkinnedObject,
          petModelSource.scene,
          petModelSource.animations,
          characterWorldHeight,
          following ? (catalogItem.maxScale ?? 1) * visualMultiplier : Math.max(entity.scale, 0.01) * visualMultiplier,
          entity.displayName ?? catalogItem.name,
          options.showPetNames,
          shouldHidePetGroundShadow(catalogItem.metadata),
          shouldHidePetGroundMarker(catalogItem.metadata),
          getPetGroundShadowScale(catalogItem.metadata),
          getPetNameLabelScale(catalogItem.metadata),
        );
        const actor: RuntimePetActor = {
          entityId: entity.id,
          inventoryItemId: entity.inventoryItemId,
          object: petModel.root,
          model: petModel.model,
          mixer: petModel.mixer,
          walkAction: petModel.walkAction,
          idleAction: petModel.idleAction,
          activeAction: petModel.activeAction,
          petActionActions: petModel.petActionActions,
          behaviorMode: entity.behaviorMode,
          follow: following,
          radius: getPetNavigationRadius(entity.collisionRadius ?? catalogItem.collisionRadius, following ? (catalogItem.maxScale ?? 1) : entity.scale),
          baseY: entity.y + getPetGroundOffset(catalogItem.assetKey, catalogItem.metadata),
          animationTime: 0,
          idleCycleElapsed: 0,
          movePending: false,
          facing: { x: Math.sin(characterRoot.rotation.y), z: Math.cos(characterRoot.rotation.y) },
          state: getPetActorState(entity.behaviorMode, following),
          followIndex,
          movementSpeedMultiplier: getPetMovementSpeedMultiplier(catalogItem.assetKey, catalogItem.metadata),
          walkingGroundOffset: getPetWalkingGroundOffset(catalogItem.assetKey, catalogItem.metadata),
          target: null,
          followHistory: [],
          wanderState: createWanderState(hashWanderSeed(`live:${entity.id}:${entity.inventoryItemId}`), { x: 0, z: 1 }),
          active: true,
        };
        worldScene.add(actor.object);
        updatePetActorState(actor, entity, catalogItem, followIndex, true);
        return actor;
      };

      const updatePetActors = (nextGameData: ChildGameData) => {
        latestPetData = nextGameData;
        refreshPetCatalogMaps(nextGameData);
        const followingIds = getFollowingPetInventoryIds(nextGameData)
          .filter((inventoryItemId) => !optimisticPetIdles.has(inventoryItemId));
        const desired = new Map<string, { entity: ChildWorldEntity; catalogItem: GameCatalogItem; followIndex: number }>();
        followingIds.forEach((inventoryItemId, followIndex) => {
          const inventory = nextGameData.inventory.find((item) => item.id === inventoryItemId);
          const catalogItem = inventory ? petCatalogById.get(inventory.catalogItemId) : undefined;
          if (!inventory || !catalogItem) return;
          const existingEntity = nextGameData.worldEntities.find((entity) => entity.entityKind === 'pet' && entity.inventoryItemId === inventoryItemId && entity.isActive);
          desired.set(inventoryItemId, {
            entity: existingEntity ?? {
              id: `local-following-${inventoryItemId}`,
              inventoryItemId,
              entityKind: 'pet',
              worldLayoutVersion: 1,
              x: playerRoot.position.x,
              y: 0,
              z: playerRoot.position.z,
              rotationX: 0,
              rotationY: 0,
              rotationZ: 0,
              scale: 1,
              behaviorMode: 'idle',
              roamingSlot: null,
              isActive: true,
              catalogItemId: catalogItem.id,
              collisionRadius: catalogItem.collisionRadius,
              assetKey: catalogItem.assetKey,
              name: catalogItem.name,
              displayName: inventory.displayName ?? undefined,
            },
            catalogItem,
            followIndex,
          });
        });
        nextGameData.worldEntities.filter((entity) => entity.entityKind === 'pet' && entity.isActive).forEach((entity) => {
          if (desired.has(entity.inventoryItemId)) return;
          const catalogItem = resolvePetCatalogItem(entity, petCatalogById, petCatalogByAssetKey);
          if (catalogItem) desired.set(entity.inventoryItemId, { entity, catalogItem, followIndex: -1 });
        });
        optimisticPetIdles.forEach((selection, inventoryItemId) => {
          const inventory = nextGameData.inventory.find((item) => item.id === inventoryItemId);
          const catalogItem = inventory ? petCatalogById.get(inventory.catalogItemId) : undefined;
          if (!inventory || !catalogItem) {
            optimisticPetIdles.delete(inventoryItemId);
            return;
          }
          desired.set(inventoryItemId, {
            entity: {
              id: `local-optimistic-idle-${inventoryItemId}`,
              inventoryItemId,
              entityKind: 'pet',
              worldLayoutVersion: 1,
              x: selection.worldPosition.x,
              y: 0,
              z: selection.worldPosition.z,
              rotationX: 0,
              rotationY: selection.rotationY,
              rotationZ: 0,
              scale: selection.scale,
              behaviorMode: 'idle',
              roamingSlot: null,
              isActive: true,
              catalogItemId: catalogItem.id,
              collisionRadius: catalogItem.collisionRadius,
              assetKey: catalogItem.assetKey,
              name: catalogItem.name,
              displayName: inventory.displayName ?? undefined,
            },
            catalogItem,
            followIndex: -1,
          });
        });

        petActors.forEach((actor) => {
          if (!desired.has(actor.inventoryItemId)) {
            actor.active = false;
            actor.object.visible = false;
          }
        });
        desired.forEach(({ entity, catalogItem, followIndex }, inventoryItemId) => {
          const existing = petActors.find((actor) => actor.inventoryItemId === inventoryItemId);
          if (existing) {
            const wasInactive = !existing.active;
            existing.active = true;
            existing.object.visible = true;
            if (wasInactive && existing.object.parent !== worldScene) worldScene.add(existing.object);
            updatePetActorState(existing, entity, catalogItem, followIndex, wasInactive);
            return;
          }
          if (pendingPetActors.has(inventoryItemId)) return;
          const modelUrl = getPetModelUrl(catalogItem);
          if (!modelUrl) return;
          pendingPetActors.add(inventoryItemId);
          void loadPetModelSource(modelUrl, signal).then((petModelSource) => {
            if (!petModelSource || disposed) return;
            const latest = latestPetData;
            const latestFollowingIds = getFollowingPetInventoryIds(latest)
              .filter((latestInventoryItemId) => !optimisticPetIdles.has(latestInventoryItemId));
            const latestEntity = latest.worldEntities.find((candidate) => candidate.entityKind === 'pet' && candidate.inventoryItemId === inventoryItemId && candidate.isActive);
            const latestInventory = latest.inventory.find((item) => item.id === inventoryItemId);
            const latestCatalogItem = latestInventory ? petCatalogById.get(latestInventory.catalogItemId) : undefined;
            if (!latestCatalogItem || (!latestFollowingIds.includes(inventoryItemId) && !latestEntity)) return;
            const actor = createRuntimePetActor(
              latestEntity ?? {
                id: `local-following-${inventoryItemId}`,
                inventoryItemId,
                entityKind: 'pet',
                worldLayoutVersion: 1,
                x: playerRoot.position.x,
                y: 0,
                z: playerRoot.position.z,
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
                scale: 1,
                behaviorMode: 'idle',
                roamingSlot: null,
                isActive: true,
                catalogItemId: latestCatalogItem.id,
                collisionRadius: latestCatalogItem.collisionRadius,
                assetKey: latestCatalogItem.assetKey,
                name: latestCatalogItem.name,
                displayName: latestInventory?.displayName ?? undefined,
              },
              latestCatalogItem,
              latestFollowingIds.indexOf(inventoryItemId),
              petModelSource,
            );
            // A model loaded after the initial scene build must join the live
            // actor list; otherwise it renders once but never receives
            // follow movement, hit testing, or later state transitions.
            petActors.push(actor);
            if (!latestFollowingIds.includes(inventoryItemId)) {
              updatePetActorState(actor, latestEntity!, latestCatalogItem, -1, true);
            }
          }).finally(() => pendingPetActors.delete(inventoryItemId));
        });
      };

      const updateDecorationObjects = (nextGameData: ChildGameData) => {
        const activeDecorations = new Map(
          nextGameData.worldEntities
            .filter((entity) => entity.entityKind === 'decoration' && entity.isActive)
            .map((entity) => [entity.id, entity] as const),
        );

        for (let index = decorationObjects.length - 1; index >= 0; index -= 1) {
          const entry = decorationObjects[index];
          if (activeDecorations.has(entry.entityId)) continue;
          worldScene.remove(entry.object);
          disposeObject3D(entry.object, disposalTracker);
          decorationObjects.splice(index, 1);
        }

        const updateObjectTransform = (object: Object3D, entity: ChildWorldEntity) => {
          object.visible = true;
          object.position.set(entity.x, entity.y, entity.z);
          object.rotation.set(entity.rotationX, entity.rotationY, entity.rotationZ);
          object.scale.setScalar(entity.scale);
        };
        const replaceDecorationModel = (entityId: string, previousObject: Object3D, item: GameCatalogItem, modelSource: Object3D) => {
          const entry = decorationObjects.find((candidate) => candidate.entityId === entityId && candidate.object === previousObject);
          const entity = activeDecorations.get(entityId);
          if (!entry || !entity || disposed) return;
          const replacement = createDecorationObject(THREE, item, 1, modelSource);
          replacement.userData.entityId = entityId;
          replacement.userData.catalogItemId = item.id;
          (replacement as Object3D & { castShadow?: boolean }).castShadow = true;
          updateObjectTransform(replacement, entity);
          worldScene.remove(previousObject);
          disposeObject3D(previousObject, disposalTracker);
          worldScene.add(replacement);
          entry.object = replacement;
        };

        activeDecorations.forEach((entity) => {
          const existing = decorationObjects.find((candidate) => candidate.entityId === entity.id);
          if (existing) {
            updateObjectTransform(existing.object, entity);
            return;
          }
          const item = getDecorationCatalogItem(nextGameData, entity);
          if (!item) return;
          const modelSource = decorationModelSources.get(item.id);
          const object = createDecorationObject(THREE, item, 1, modelSource);
          object.userData.entityId = entity.id;
          object.userData.catalogItemId = item.id;
          (object as Object3D & { castShadow?: boolean }).castShadow = true;
          updateObjectTransform(object, entity);
          worldScene.add(object);
          decorationObjects.push({ entityId: entity.id, object });
          if (!modelSource && getDecorationModelUrl(item)) {
            void loadDecorationModelSource(item, signal).then((loadedModel) => {
              if (loadedModel) replaceDecorationModel(entity.id, object, item, loadedModel);
            });
          }
        });

        const nextCollisions = buildCollisionCircles([...activeDecorations.values()]
          .map((entity) => getDecorationCollisionInput(nextGameData, entity)));
        decorationCollisions.splice(0, decorationCollisions.length, ...nextCollisions);
        wanderObstacles.splice(1, wanderObstacles.length - 1, ...nextCollisions);
      };

      let placementPreview: Object3D | undefined;
      const updatePlacementPreview = (placement?: PrototypeWorldRuntimePlacement) => {
        if (!placement) {
          if (placementPreview) {
            worldScene.remove(placementPreview);
            disposeObject3D(placementPreview, disposalTracker);
            placementPreview = undefined;
          }
          return;
        }

        const modelSource = decorationModelSources.get(placement.item.id);
        if (
          !placementPreview
          || placementPreview.userData.catalogItemId !== placement.item.id
          || placementPreview.userData.usesCatalogModel !== Boolean(modelSource)
        ) {
          if (placementPreview) {
            worldScene.remove(placementPreview);
            disposeObject3D(placementPreview, disposalTracker);
          }
          const preview = createDecorationObject(
            THREE,
            placement.item,
            0.5,
            modelSource,
          );
          preview.name = 'decoration-placement-preview';
          const footprint = new THREE.Mesh(
            new THREE.RingGeometry(0.72, 0.82, 40),
            new THREE.MeshBasicMaterial({
              color: 0x9cdda4,
              transparent: true,
              opacity: 0.72,
              depthWrite: false,
            }),
          );
          footprint.name = 'decoration-placement-footprint';
          footprint.rotation.x = -Math.PI / 2;
          footprint.position.y = 0.008;
          preview.add(footprint);
          worldScene.add(preview);
          placementPreview = preview;
          preview.userData.catalogItemId = placement.item.id;
          preview.userData.usesCatalogModel = Boolean(modelSource);
        }

        placementPreview.position.set(placement.transform.x, placement.transform.y, placement.transform.z);
        placementPreview.rotation.set(placement.transform.rotationX, placement.transform.rotationY, placement.transform.rotationZ);
        placementPreview.scale.setScalar(placement.transform.scale);
        const footprint = placementPreview.getObjectByName('decoration-placement-footprint') as import('three').Mesh | undefined;
        if (footprint?.material && !Array.isArray(footprint.material) && 'color' in footprint.material) {
          footprint.material.color.set(placement.isValid ? 0x9cdda4 : 0xef8b83);
        }
      };
      const ensurePlacementModel = (placement?: PrototypeWorldRuntimePlacement) => {
        if (!placement || decorationModelSources.has(placement.item.id) || !getDecorationModelUrl(placement.item)) return;
        void loadDecorationModelSource(placement.item, signal).then(() => {
          if (!disposed && latestRuntimeUpdate.placement?.item.id === placement.item.id) {
            updatePlacementPreview(latestRuntimeUpdate.placement);
          }
        });
      };

      let activeCharacterUpdateKey = getCharacterUpdateKey({
        gameData: options.gameData,
        equippedCatalogItem: options.equippedCatalogItem,
        characterRenderMode: options.characterRenderMode,
        characterModelUrl: options.characterModelUrl,
        showPetNames: options.showPetNames,
      });
      const queueCharacterUpdate = (next: PrototypeWorldRuntimeUpdate) => {
        const nextKey = getCharacterUpdateKey(next);
        if (nextKey === activeCharacterUpdateKey) return;
        activeCharacterUpdateKey = nextKey;
        const sequence = ++characterSwapSequence;
        characterSwapAbortController?.abort();
        const swapController = new AbortController();
        characterSwapAbortController = swapController;
        void (async () => {
          let nextSource: Object3D | undefined;
          try {
            let nextAnimations: AnimationClip[] = [];
            if (next.characterRenderMode === 'anime-maiden' || next.characterRenderMode === 'world-glb') {
              const characterResult = await loadGltfSafely<{ scene: Object3D; animations: AnimationClip[] }>(
                loader,
                next.characterModelUrl ?? PROTOTYPE_WORLD_ASSETS.character,
                swapController.signal,
              );
              nextSource = characterResult.scene;
              nextAnimations = characterResult.animations;
            } else {
              nextSource = options.createProceduralCharacter(THREE, next.equippedCatalogItem);
            }
            if (!nextSource || disposed || sequence !== characterSwapSequence) {
              if (nextSource) disposeObject3D(nextSource, disposalTracker);
              return;
            }
            applyWarmHandPaintedCharacterStyle(nextSource);
            if (!trackResourceRoot(nextSource)) return;
            const previousSource = characterSource;
            characterRoot.remove(previousSource);
            characterSource = nextSource;
            characterAnimations = nextAnimations;
            characterDefinition = defineAsset(THREE, characterSource);
            characterScale = PROTOTYPE_WORLD_CONFIG.characterTargetHeight / Math.max(characterDefinition.size.y, 0.001);
            characterRoot.scale.setScalar(characterScale);
            characterSource.position.copy(characterDefinition.offset);
            characterRoot.add(characterSource);
            characterFootNodes = getCharacterFootNodes(characterSource);
            configureCharacterAnimation();
            groundCharacterOnGrass();
            const previousIndex = resourceRoots.indexOf(previousSource);
            if (previousIndex >= 0) resourceRoots.splice(previousIndex, 1);
            disposeObject3D(previousSource, disposalTracker);
          } catch (error) {
            if (!disposed && !swapController.signal.aborted) console.warn('Unable to switch the world character in place.', error);
          } finally {
            if (characterSwapAbortController === swapController) characterSwapAbortController = undefined;
          }
        })();
      };

      const controller = options.controller;
      let cameraYaw = PROTOTYPE_WORLD_CONFIG.initialCameraYaw;
      let cameraPitch: number = PROTOTYPE_WORLD_CONFIG.initialCameraPitch;
      let cameraDistance: number = PROTOTYPE_WORLD_CONFIG.cameraDistanceDefault;
      let placementActive = false;
      const placementPointers = new Map<number, { point: { x: number; y: number }; startedOnDecoration: boolean }>();
      let placementGesture: { previousDistance: number; previousAngle: number } | null = null;
      updateScene = (next) => {
        const wasPlacementActive = placementActive;
        placementActive = Boolean(next.placement);
        if (placementActive) controller?.reset();
        else {
          placementPointers.clear();
          placementGesture = null;
        }
        if (!wasPlacementActive && next.placement && !next.placement.entityId) {
          options.onPlacementPositionChange?.(getPlacementStartPosition(
            { x: playerRoot.position.x, z: playerRoot.position.z },
            cameraYaw,
          ));
        }
        queueCharacterUpdate(next);
        ensurePlacementModel(next.placement);
        updatePlacementPreview(next.placement);
        if (next.gameData !== latestPetData || optimisticPetActorsDirty) {
          updatePetActors(next.gameData);
          optimisticPetActorsDirty = false;
        }
        updateDecorationObjects(next.gameData);
      };
      updateScene(latestRuntimeUpdate);

      let sceneElapsedTime = 0;
      const keys = new Set<string>();
      const clock = new THREE.Clock();
      let lastRenderedAt = Number.NEGATIVE_INFINITY;

      const resize = () => {
        const rect = options.canvas.getBoundingClientRect();
        const width = Math.max(rect.width, 1);
        const height = Math.max(rect.height, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        rendererInstance.setSize(width, height, false);
      };
      const placementRaycaster = new THREE.Raycaster();
      const placementNdc = new THREE.Vector2();
      const placementGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const placementHit = new THREE.Vector3();
      const decorationRaycaster = new THREE.Raycaster();
      const decorationNdc = new THREE.Vector2();
      const petRaycaster = new THREE.Raycaster();
      const petNdc = new THREE.Vector2();
      const pointFromEvent = (event: PointerEvent) => {
        const rect = options.canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      };
      const decorationSelectionFromEvent = (event: PointerEvent): DecorationSelection | null => {
        const point = pointFromEvent(event);
        const rect = options.canvas.getBoundingClientRect();
        decorationNdc.set(
          (point.x / Math.max(rect.width, 1)) * 2 - 1,
          -(point.y / Math.max(rect.height, 1)) * 2 + 1,
        );
        decorationRaycaster.setFromCamera(decorationNdc, camera);
        const hit = decorationRaycaster.intersectObjects(decorationObjects.map(({ object }) => object), true)[0];
        if (!hit) return null;
        const selected = decorationObjects.find(({ object }) => {
          let current: Object3D | null = hit.object;
          while (current) {
            if (current === object) return true;
            current = current.parent;
          }
          return false;
        });
        if (!selected) return null;
        selected.object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(selected.object);
        const worldPoint = selected.object.getWorldPosition(new THREE.Vector3());
        worldPoint.y = Math.max(bounds.max.y + 0.2, 0.7);
        worldPoint.project(camera);
        const rawX = ((worldPoint.x + 1) / 2) * rect.width;
        const rawY = ((-worldPoint.y + 1) / 2) * rect.height;
        return {
          entityId: selected.entityId,
          x: Math.min(Math.max(rawX, 36), Math.max(36, rect.width - 36)),
          y: Math.min(Math.max(rawY, 52), Math.max(52, rect.height - 28)),
        };
      };
      const petSelectionFromEvent = (event: PointerEvent): PetSelection | null => {
        const point = pointFromEvent(event);
        const rect = options.canvas.getBoundingClientRect();
        petNdc.set(
          (point.x / Math.max(rect.width, 1)) * 2 - 1,
          -(point.y / Math.max(rect.height, 1)) * 2 + 1,
        );
        petRaycaster.setFromCamera(petNdc, camera);
        const activePetObjects = petActors.filter((actor) => actor.active && actor.object.visible).map((actor) => actor.object);
        const hit = petRaycaster.intersectObjects(activePetObjects, true)[0];
        if (!hit) return null;
        const selected = petActors.find((actor) => {
          let current: Object3D | null = hit.object;
          while (current) {
            if (current === actor.object) return true;
            current = current.parent;
          }
          return false;
        });
        if (!selected) return null;
        selected.object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(selected.object);
        const worldPoint = selected.object.getWorldPosition(new THREE.Vector3());
        worldPoint.y = Math.max(bounds.max.y + 0.22, 0.7);
        worldPoint.project(camera);
        const rawX = ((worldPoint.x + 1) / 2) * rect.width;
        const rawY = ((-worldPoint.y + 1) / 2) * rect.height;
        const entity = latestPetData.worldEntities.find((candidate) => (
          candidate.entityKind === 'pet'
          && candidate.inventoryItemId === selected.inventoryItemId
          && candidate.isActive
        ));
        return {
          inventoryItemId: selected.inventoryItemId,
          x: Math.min(Math.max(rawX, 128), Math.max(128, rect.width - 128)),
          y: Math.min(Math.max(rawY, 60), Math.max(60, rect.height - 30)),
          worldPosition: { x: selected.object.position.x, z: selected.object.position.z },
          rotationY: selected.object.rotation.y,
          scale: entity?.scale ?? 1,
          following: selected.follow,
          behaviorMode: selected.behaviorMode,
          availableActions: Object.keys(selected.petActionActions) as PetAnimationAction[],
        };
      };
      const worldPointFromEvent = (event: PointerEvent) => {
        const point = pointFromEvent(event);
        const rect = options.canvas.getBoundingClientRect();
        placementNdc.set(
          (point.x / Math.max(rect.width, 1)) * 2 - 1,
          -(point.y / Math.max(rect.height, 1)) * 2 + 1,
        );
        placementRaycaster.setFromCamera(placementNdc, camera);
        const hit = placementRaycaster.ray.intersectPlane(placementGround, placementHit);
        return hit ? { x: hit.x, z: hit.z } : undefined;
      };
      const getPlacementGestureMetrics = (first: { x: number; y: number }, second: { x: number; y: number }) => ({
        distance: Math.max(Math.hypot(second.x - first.x, second.y - first.y), 1),
        angle: Math.atan2(second.y - first.y, second.x - first.x),
      });
      const placementPreviewHitFromEvent = (event: PointerEvent) => {
        if (!placementPreview) return false;
        const point = pointFromEvent(event);
        const rect = options.canvas.getBoundingClientRect();
        placementNdc.set(
          (point.x / Math.max(rect.width, 1)) * 2 - 1,
          -(point.y / Math.max(rect.height, 1)) * 2 + 1,
        );
        placementRaycaster.setFromCamera(placementNdc, camera);
        return placementRaycaster.intersectObject(placementPreview, true).length > 0;
      };
      const normalizePlacementAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
      let pendingDecorationSelection: { pointerId: number; point: { x: number; y: number }; selection: DecorationSelection | null } | null = null;
      let pendingPetSelection: { pointerId: number; selection: PetSelection | null } | null = null;
      const onPointerDown = (event: PointerEvent) => {
        if (options.pausedRef.current || isInteractiveTarget(event.target)) return;
        if (placementActive) {
          const point = pointFromEvent(event);
          const worldPoint = worldPointFromEvent(event);
          if (!worldPoint) return;
          event.preventDefault();
          placementPointers.set(event.pointerId, {
            point,
            startedOnDecoration: placementPreviewHitFromEvent(event),
          });
          options.canvas.setPointerCapture(event.pointerId);
          if (placementPointers.size === 2) {
            const [first, second] = [...placementPointers.values()].map(({ point: pointerPoint }) => pointerPoint);
            const metrics = getPlacementGestureMetrics(first, second);
            placementGesture = { previousDistance: metrics.distance, previousAngle: metrics.angle };
          }
          return;
        }
        const point = pointFromEvent(event);
        pendingDecorationSelection = { pointerId: event.pointerId, point, selection: decorationSelectionFromEvent(event) };
        pendingPetSelection = { pointerId: event.pointerId, selection: petSelectionFromEvent(event) };
        event.preventDefault();
        options.canvas.setPointerCapture(event.pointerId);
        const rect = options.canvas.getBoundingClientRect();
        controller?.dispatch({
          type: 'pointer-down',
          pointerId: event.pointerId,
          pointerType: event.pointerType === 'mouse' ? 'mouse' : event.pointerType === 'pen' ? 'pen' : 'touch',
          point,
          zone: event.pointerType === 'mouse' ? 'camera' : getWorldInputZone(point, rect.height),
        });
      };
      const onPointerMove = (event: PointerEvent) => {
        if (options.pausedRef.current) return;
        if (placementActive) {
          const pointer = placementPointers.get(event.pointerId);
          if (!pointer) return;
          event.preventDefault();
          pointer.point = pointFromEvent(event);
          if (placementPointers.size === 2 && placementGesture) {
            const [first, second] = [...placementPointers.values()].map(({ point }) => point);
            const metrics = getPlacementGestureMetrics(first, second);
            options.onPlacementGestureChange?.({
              scaleFactor: metrics.distance / placementGesture.previousDistance,
              rotationDelta: normalizePlacementAngle(metrics.angle - placementGesture.previousAngle),
            });
            placementGesture = { previousDistance: metrics.distance, previousAngle: metrics.angle };
            return;
          }
          const worldPoint = worldPointFromEvent(event);
          if (worldPoint && shouldMovePlacementDecoration(placementPointers.size, pointer.startedOnDecoration)) {
            options.onPlacementPositionChange?.(worldPoint);
          }
          return;
        }
        const point = pointFromEvent(event);
        if (pendingDecorationSelection?.pointerId === event.pointerId) {
          const distance = Math.hypot(point.x - pendingDecorationSelection.point.x, point.y - pendingDecorationSelection.point.y);
          if (distance > 8) {
            pendingDecorationSelection = null;
            pendingPetSelection = null;
          }
        }
        controller?.dispatch({ type: 'pointer-move', pointerId: event.pointerId, point });
      };
      const onPointerEnd = (event: PointerEvent) => {
        if (placementActive && placementPointers.has(event.pointerId)) {
          placementPointers.delete(event.pointerId);
          placementGesture = placementPointers.size === 2 ? placementGesture : null;
          if (options.canvas.hasPointerCapture(event.pointerId)) options.canvas.releasePointerCapture(event.pointerId);
          return;
        }
        if (pendingDecorationSelection?.pointerId === event.pointerId) {
          const selection = pendingDecorationSelection.selection;
          const petSelection = pendingPetSelection?.pointerId === event.pointerId
            ? pendingPetSelection.selection
            : null;
          pendingDecorationSelection = null;
          pendingPetSelection = null;
          if (event.type === 'pointerup') {
            if (petSelection) options.onPetSelect?.(petSelection);
            else options.onDecorationSelect?.(selection);
          }
        }
        controller?.dispatch({ type: event.type === 'pointercancel' ? 'pointer-cancel' : 'pointer-up', pointerId: event.pointerId });
        if (options.canvas.hasPointerCapture(event.pointerId)) options.canvas.releasePointerCapture(event.pointerId);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        if (options.pausedRef.current || placementActive || isInteractiveTarget(event.target) || (!isWorldMovementKey(key) && !isWorldCameraKey(key))) return;
        keys.add(key);
        event.preventDefault();
      };
      const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
      const resetInput = () => { keys.clear(); placementPointers.clear(); placementGesture = null; pendingDecorationSelection = null; pendingPetSelection = null; controller?.reset(); };
      options.canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
      options.canvas.addEventListener('pointermove', onPointerMove, { passive: false });
      options.canvas.addEventListener('pointerup', onPointerEnd);
      options.canvas.addEventListener('pointercancel', onPointerEnd);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('resize', resize);
      window.addEventListener('blur', resetInput);
      window.addEventListener('pagehide', resetInput);
      document.addEventListener('visibilitychange', resetInput);
      removeListeners = () => {
        options.canvas.removeEventListener('pointerdown', onPointerDown);
        options.canvas.removeEventListener('pointermove', onPointerMove);
        options.canvas.removeEventListener('pointerup', onPointerEnd);
        options.canvas.removeEventListener('pointercancel', onPointerEnd);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', resize);
        window.removeEventListener('blur', resetInput);
        window.removeEventListener('pagehide', resetInput);
        document.removeEventListener('visibilitychange', resetInput);
        removeContextLostListener?.();
      };
      resize();

      const animate = (frameTime = window.performance.now()) => {
        if (disposed) return;
        if (options.pausedRef.current) {
          pausedTimer = window.setTimeout(() => {
            pausedTimer = undefined;
            animate();
          }, 250);
          return;
        }
        animationFrame = window.requestAnimationFrame(animate);
        if (!shouldRenderWorldFrame({ now: frameTime, lastRenderedAt })) return;
        lastRenderedAt = frameTime;
        const delta = Math.min(clock.getDelta(), 0.05);
        sceneElapsedTime += delta;
        const currentInput = controller?.getSnapshot();
        let isPlayerMoving = false;
        if (currentInput && !options.pausedRef.current && !placementActive) {
          const cameraDelta = controller?.consumeCameraDeltas();
          if (cameraDelta && (cameraDelta.cameraDelta.x !== 0 || cameraDelta.cameraDelta.y !== 0)) {
            const nextCamera = applySinglePointerCameraDrag(
              { yaw: cameraYaw, pitch: cameraPitch },
              { dx: cameraDelta.cameraDelta.x, dy: cameraDelta.cameraDelta.y },
              {
                pitchMin: PROTOTYPE_WORLD_CONFIG.cameraPitchMin,
                pitchMax: PROTOTYPE_WORLD_CONFIG.cameraPitchMax,
              },
            );
            cameraYaw = nextCamera.yaw;
            cameraPitch = nextCamera.pitch;
          }
          if (cameraDelta?.zoomDelta) cameraDistance = Math.min(PROTOTYPE_WORLD_CONFIG.cameraDistanceMax, Math.max(PROTOTYPE_WORLD_CONFIG.cameraDistanceMin, cameraDistance - cameraDelta.zoomDelta * 0.012));
          const keyboardCamera = getKeyboardCameraInput(keys);
          if (keyboardCamera.yaw || keyboardCamera.pitch) {
            cameraYaw += keyboardCamera.yaw * delta * 1.8;
            cameraPitch = Math.min(
              PROTOTYPE_WORLD_CONFIG.cameraPitchMax,
              Math.max(PROTOTYPE_WORLD_CONFIG.cameraPitchMin, cameraPitch + keyboardCamera.pitch * delta * 1.2),
            );
          }
          if (keyboardCamera.zoom) {
            cameraDistance = Math.min(
              PROTOTYPE_WORLD_CONFIG.cameraDistanceMax,
              Math.max(PROTOTYPE_WORLD_CONFIG.cameraDistanceMin, cameraDistance - keyboardCamera.zoom * delta * 3.2),
            );
          }
          const keyboard = getKeyboardMovement(keys);
          const joystick = currentInput.joystick;
          const forwardInput = joystick.strength > 0 ? -joystick.y : keyboard.y;
          const sideInput = joystick.strength > 0 ? joystick.x : keyboard.x;
          if (forwardInput || sideInput) {
            const direction = new THREE.Vector3(-Math.sin(cameraYaw) * forwardInput, 0, -Math.cos(cameraYaw) * forwardInput);
            direction.add(new THREE.Vector3(Math.cos(cameraYaw) * sideInput, 0, -Math.sin(cameraYaw) * sideInput));
            direction.normalize().multiplyScalar(delta * PROTOTYPE_WORLD_CONFIG.characterMoveSpeed);
            const nextPosition = moveWorldCharacter(
              { x: playerRoot.position.x, z: playerRoot.position.z },
              { x: playerRoot.position.x + direction.x, z: playerRoot.position.z + direction.z },
              CHARACTER_COLLISION_RADIUS,
              decorationCollisions,
            );
            isPlayerMoving = Math.hypot(nextPosition.x - playerRoot.position.x, nextPosition.z - playerRoot.position.z) > 0.0001;
            playerRoot.position.x = nextPosition.x;
            playerRoot.position.z = nextPosition.z;
            if (isPlayerMoving) {
              appendFollowingTrailSample(playerFollowHistory, {
                x: playerRoot.position.x,
                z: playerRoot.position.z,
              });
            }
            const targetYaw = Math.atan2(direction.x, direction.z);
            const yawDelta = Math.atan2(Math.sin(targetYaw - characterRoot.rotation.y), Math.cos(targetYaw - characterRoot.rotation.y));
            characterRoot.rotation.y += yawDelta * Math.min(1, delta * 12);
          }
        }
        if (interactionActionState) {
          if (isPlayerMoving) {
            finishInteractionAction('walk');
          }
        }
        if (!interactionActionState) {
          playCharacterAction(isPlayerMoving ? 'walk' : 'idle');
        }
        proceduralGrass.update({ time: sceneElapsedTime });
        ambientPollen.update(sceneElapsedTime);
        butterflies.update(sceneElapsedTime);
        eastFairytaleScenery.update(sceneElapsedTime);
        const now = clock.elapsedTime;
        if (roamingActor) {
          const current = { x: roamingActor.object.position.x, z: roamingActor.object.position.z };
          const step = getWanderStep(
            current,
            delta,
            HABITHERO_ROAMING_CHARACTER_RADIUS,
            HABITHERO_ROAMING_CHARACTER_SPEED * (prefersReducedMotion ? 0.45 : 1),
            wanderObstacles,
            roamingActor.wanderState,
            now,
          );
          const isWalking = step.walking && !step.blocked;
          roamingActor.facing = step.facing;
          roamingActor.object.position.x = step.next.x;
          roamingActor.object.position.z = step.next.z;
          if (isWalking) {
            const targetYaw = Math.atan2(step.facing.x, step.facing.z);
            const yawDelta = Math.atan2(
              Math.sin(targetYaw - roamingActor.object.rotation.y),
              Math.cos(targetYaw - roamingActor.object.rotation.y),
            );
            roamingActor.object.rotation.y += yawDelta * Math.min(1, delta * 8);
          }
          roamingActor.animationTime += delta * (isWalking ? 8 : 2.4);
          if (roamingWalkAction) roamingWalkAction.paused = !isWalking;
          roamingActor.model.position.y = roamingActor.baseModelY;
          roamingActor.model.rotation.z = prefersReducedMotion
            ? 0
            : Math.sin(roamingActor.animationTime) * (isWalking ? 0.035 : 0.012);
        }
        const orderedFollowingActors = petActors
          .filter((actor) => actor.active && actor.follow)
          .sort((left, right) => left.followIndex - right.followIndex);
        const followingFrameSnapshots = new Map(
          orderedFollowingActors.map((actor) => [
            actor,
            {
              position: { x: actor.object.position.x, z: actor.object.position.z },
              trail: snapshotFollowingTrail(actor.followHistory),
            },
          ] as const),
        );
        petActors.sort((left, right) => {
          if (left.follow && !right.follow) return -1;
          if (!left.follow && right.follow) return 1;
          return left.follow && right.follow ? left.followIndex - right.followIndex : 0;
        });
        petActors.forEach((actor) => {
          if (!actor.active) return;
          if (actor.petAction) {
            actor.target = null;
            actor.followHistory.length = 0;
            actor.state = 'idle';
            updatePetAnimation(actor, false, delta, prefersReducedMotion);
            return;
          }
          const current = { x: actor.object.position.x, z: actor.object.position.z };
          if (actor.follow) {
            actor.state = 'following';
            const playerFacing = { x: Math.sin(characterRoot.rotation.y), z: Math.cos(characterRoot.rotation.y) };
            const leader = actor.followIndex > 0
              ? orderedFollowingActors.find((candidate) => candidate.followIndex === actor.followIndex - 1)
              : undefined;
            const leaderSnapshot = leader ? followingFrameSnapshots.get(leader) : undefined;
            const leaderPosition = leaderSnapshot?.position
              ?? { x: playerRoot.position.x, z: playerRoot.position.z };
            const leaderRadius = leader?.radius ?? CHARACTER_COLLISION_RADIUS;
            const followDistance = getSafeFollowingDistance(
              getFollowingDistance(actor.followIndex),
              actor.radius,
              leaderRadius,
            );
            const trailTarget = getFollowingTrailTarget(
              leaderSnapshot?.trail ?? playerFollowHistory,
              leaderPosition,
              followDistance,
            );
            const followingStep = getFollowingStep(
              current,
              leader
                ? { position: leaderPosition, facing: leader.facing }
                : { position: leaderPosition, facing: playerFacing },
              delta,
              actor.radius,
              PET_FOLLOW_SPEED * actor.movementSpeedMultiplier * (prefersReducedMotion ? 0.55 : 1),
              wanderObstacles,
              leaderRadius,
              getFollowingDistance(actor.followIndex),
              trailTarget ?? actor.target ?? undefined,
            );
            actor.target = followingStep.target;
            const moved = Math.hypot(
              followingStep.next.x - current.x,
              followingStep.next.z - current.z,
            );
            actor.object.position.x = followingStep.next.x;
            actor.object.position.z = followingStep.next.z;
            actor.object.position.y = actor.baseY;
            if (moved > 0.0001) {
              actor.facing = followingStep.facing;
              const targetYaw = Math.atan2(followingStep.facing.x, followingStep.facing.z);
              const yawDelta = Math.atan2(
                Math.sin(targetYaw - actor.object.rotation.y),
                Math.cos(targetYaw - actor.object.rotation.y),
              );
              actor.object.rotation.y += yawDelta * Math.min(1, delta * 10);
              appendFollowingTrailSample(actor.followHistory, followingStep.next);
              updatePetAnimation(actor, true, delta, prefersReducedMotion);
            } else {
              updatePetAnimation(actor, false, delta, prefersReducedMotion);
            }
            return;
          }
          if (actor.behaviorMode !== 'wander') {
            actor.state = 'idle';
            actor.object.position.y = actor.baseY;
            updatePetAnimation(actor, false, delta, prefersReducedMotion);
            return;
          }
          const step = getWanderStep(
            current,
            delta,
            actor.radius,
            PET_WANDER_SPEED * actor.movementSpeedMultiplier * (prefersReducedMotion ? 0.45 : 1),
            wanderObstacles,
            actor.wanderState,
            now,
            actor.idleAction ? PET_IDLE_PAUSE_DURATION_RANGE : PET_WALK_ONLY_PAUSE_DURATION_RANGE,
          );
          actor.facing = step.facing;
          actor.object.position.x = step.next.x;
          actor.object.position.z = step.next.z;
          if (!step.walking || step.blocked) {
            actor.state = 'idle';
            actor.object.position.y = actor.baseY;
            updatePetAnimation(actor, false, delta, prefersReducedMotion);
          } else {
            actor.state = 'wandering';
            const targetYaw = Math.atan2(step.facing.x, step.facing.z);
            const yawDelta = Math.atan2(
              Math.sin(targetYaw - actor.object.rotation.y),
              Math.cos(targetYaw - actor.object.rotation.y),
            );
            actor.object.rotation.y += yawDelta * Math.min(1, delta * 6);
            actor.object.position.y = actor.baseY;
            updatePetAnimation(actor, true, delta, prefersReducedMotion);
          }
        });
        if (mixer) mixer.update(delta);
        if (roamingMixer) roamingMixer.update(delta * (prefersReducedMotion ? 0.75 : 1));
        groundCharacterOnGrass();
        groundRoamingCharacterOnGrass();
        const zoomProgress = THREE.MathUtils.clamp((PROTOTYPE_WORLD_CONFIG.cameraDistanceDefault - cameraDistance) / (PROTOTYPE_WORLD_CONFIG.cameraDistanceDefault - PROTOTYPE_WORLD_CONFIG.cameraDistanceMin), 0, 1);
        const normalTargetHeight = THREE.MathUtils.lerp(0.38, 0.5, zoomProgress);
        const targetHeight = getGroundedCameraTargetHeight({
          pitch: cameraPitch,
          pitchMin: PROTOTYPE_WORLD_CONFIG.cameraPitchMin,
          pitchMax: PROTOTYPE_WORLD_CONFIG.cameraPitchMax,
          normalHeight: normalTargetHeight,
        });
        const horizontal = Math.cos(cameraPitch) * cameraDistance;
        const target = new THREE.Vector3(playerRoot.position.x, playerRoot.position.y + targetHeight, playerRoot.position.z);
        const cameraOffset = new THREE.Vector3(Math.sin(cameraYaw) * horizontal, Math.sin(cameraPitch) * cameraDistance + 0.16, Math.cos(cameraYaw) * horizontal);
        const cameraPosition = target.clone().add(cameraOffset);
        camera.position.lerp(cameraPosition, 1 - Math.pow(0.001, Math.min(delta, 0.05)));
        camera.lookAt(target);
        rendererInstance.render(worldScene, camera);
      };

      options.onProgress(100, '冒險地圖準備完成');
      options.onReady();
      animate();
    } catch (error) {
      if (!disposed) {
        console.error('Unable to mount the prototype terrain world.', error);
        dispose();
        options.onStatus('failed');
        options.onError(error);
      }
    }
  };

  void setup();
  return {
    dispose,
    update: (next) => {
      latestRuntimeUpdate = next;
      updateScene(next);
    },
    optimisticallySetPetIdle: (selection) => {
      optimisticPetIdles.set(selection.inventoryItemId, selection);
      optimisticPetActorsDirty = true;
      updateScene(latestRuntimeUpdate);
    },
    clearOptimisticPetIdle: (inventoryItemId) => {
      if (!optimisticPetIdles.delete(inventoryItemId)) return;
      optimisticPetActorsDirty = true;
      updateScene(latestRuntimeUpdate);
    },
    playPetAnimation: (inventoryItemId, action) => playPetAnimation(inventoryItemId, action),
    stopPetAnimation: (inventoryItemId) => stopPetAnimation(inventoryItemId),
    playInteractionAction: (action) => playInteractionAction(action),
  };
}
