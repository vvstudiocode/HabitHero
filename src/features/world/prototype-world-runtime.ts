import type { AnimationClip, Object3D } from 'three';
import type { ChildGameData, GameCatalogItem, GameLootDrop, PetBehaviorMode } from './contracts';
import {
  GAME_LOOT_STAR_GLOW_RADIUS,
  GAME_LOOT_SCROLL_VISUAL_SCALE,
  GAME_LOOT_STAR_VISUAL_SCALE,
  getLootAnimationDuration,
  getLootAnimationDelay,
  getLootTargetStat,
  isLootDropInPickupRange,
  type LootAnimationEvent,
} from './game-loot';
import {
  buildCollisionCircles,
  CENTRAL_TREE_KEEP_OUT,
  CHARACTER_COLLISION_RADIUS,
  circlesOverlap,
  WORLD_BOUNDARY,
  moveWorldCharacter,
  type CollisionCircle,
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
import { updateGrassInteractionState } from '../../../terrain-prototype/procedural-grass-field.js';
import { getProceduralGrassCount } from '../../../terrain-prototype/procedural-grass-field.js';
import { getProceduralFlowerCount } from '../../../terrain-prototype/procedural-flower-layout.js';
import { createProceduralGrassField } from '../../../terrain-prototype/procedural-grass-scene.js';
import { createProceduralFlowerField } from '../../../terrain-prototype/procedural-flowers.js';
import { createProceduralForest } from '../../../terrain-prototype/procedural-trees.js';
import { createAmbientPollenField, createSunlightPatchField } from '../../../terrain-prototype/natural-world-atmosphere.js';
import { createButterflyField } from '../../../terrain-prototype/natural-world-creatures.js';
import { createNaturalBoundaryScenery } from '../../../terrain-prototype/natural-boundary-scenery.js';
import { createEastFairytaleScenery } from '../../../terrain-prototype/east-fairytale-scenery.js';
import { getNaturalWorldVisualSettings } from '../../../terrain-prototype/natural-world-visuals.js';
import {
  getWorldQuality,
  scaleWorldBudget,
  WORLD_QUALITY_SETTINGS,
} from './world-quality';
import {
  chooseRoamingTarget,
  getRoamingStep,
  HABITHERO_ROAMING_CHARACTER_ASSET_KEY,
  HABITHERO_ROAMING_CHARACTER_MODEL_URL,
  HABITHERO_ROAMING_CHARACTER_PAUSE,
  HABITHERO_ROAMING_CHARACTER_RADIUS,
  HABITHERO_ROAMING_CHARACTER_SPEED,
  HABITHERO_ROAMING_CHARACTER_VISUAL_SCALE,
} from './world-roaming';
import {
  getFollowingStep,
  PET_FOLLOW_DISTANCE,
  PET_FOLLOW_SPEED,
} from './pet-following';

export const PROTOTYPE_WORLD_ASSETS = {
  tree: new URL('../../../terrain-prototype/assets/big-tree.glb', import.meta.url).href,
  character: new URL('../../../terrain-prototype/assets/anime-maiden.glb', import.meta.url).href,
  roamingCharacter: HABITHERO_ROAMING_CHARACTER_MODEL_URL,
  skybox: new URL('../../../terrain-prototype/assets/sky-equirectangular-day.png', import.meta.url).href,
} as const;

export const PROTOTYPE_WORLD_CONFIG = {
  gridSize: 9,
  terrainStep: 1.1,
  scenePadding: 8,
  treeFitToTile: 3.6,
  treeHeightScale: 1,
  treeRootSink: 0.03,
  treePosition: { x: 1.1, z: -1.65 },
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

export const PET_MODEL_URL = '/assets/starlight-sprout-pet.glb';
export const PET_WORLD_SCALE_MULTIPLIER = 1.3;
export const PET_WANDER_SPEED = 0.5;
const PET_WANDER_RETRY_DELAY = 0.22;
const PET_WANDER_PAUSE = 0.42;

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

export interface PrototypeWorldRuntimeOptions {
  canvas: HTMLCanvasElement;
  gameData: ChildGameData;
  equippedCatalogItem?: GameCatalogItem;
  characterRenderMode: 'anime-maiden' | 'world-glb' | 'procedural';
  characterModelUrl?: string;
  createProceduralCharacter: (THREE: ThreeNamespace, item?: GameCatalogItem) => Object3D;
  controller: PointerInputController | null;
  pausedRef: { current: boolean };
  lootDropsRef: { current: GameLootDrop[] };
  onLootPickupRef: { current: ((dropId: string) => Promise<boolean>) | undefined };
  onLootPickupBatchRef: { current: ((dropIds: string[]) => Promise<string[]>) | undefined };
  onLootAnimationRef: { current: ((event: LootAnimationEvent) => void) | undefined };
  onLootAnimationBatchRef: { current: ((events: LootAnimationEvent[]) => void) | undefined };
  onStatus: (status: RuntimeStatus) => void;
  onProgress: (value: number, detail: string) => void;
  onReady: () => void;
  onError: (error: unknown) => void;
}

export interface PrototypeWorldRuntime {
  dispose: () => void;
}

type DisposableScene = { traverse: (callback: (object: unknown) => void) => void };

interface DisposalTracker {
  geometries: Set<object>;
  materials: Set<object>;
  textures: Set<object>;
}

function createDisposalTracker(): DisposalTracker {
  return { geometries: new Set(), materials: new Set(), textures: new Set() };
}

const MATERIAL_TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularMap',
  'specularColorMap',
  'specularIntensityMap',
  'thicknessMap',
  'transmissionMap',
] as const;

function disposeTexture(texture: unknown, tracker: DisposalTracker) {
  if (!texture || typeof texture !== 'object' || !('dispose' in texture) || typeof texture.dispose !== 'function') return;
  const disposableTexture = texture as object & { dispose: () => void };
  if (tracker.textures.has(disposableTexture)) return;
  tracker.textures.add(disposableTexture);
  disposableTexture.dispose();
}

function disposeObject3D(scene: DisposableScene, tracker = createDisposalTracker()) {
  scene.traverse((object) => {
    const mesh = object as {
      geometry?: object & { dispose?: () => void };
      material?: object & Record<string, unknown> & { dispose?: () => void } | Array<object & Record<string, unknown> & { dispose?: () => void }>;
    };
    if (mesh.geometry && !tracker.geometries.has(mesh.geometry)) {
      tracker.geometries.add(mesh.geometry);
      mesh.geometry.dispose?.();
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach((material) => {
      if (tracker.materials.has(material)) return;
      MATERIAL_TEXTURE_KEYS.forEach((key) => disposeTexture(material[key], tracker));
      tracker.materials.add(material);
      material.dispose?.();
    });
  });
}

function disposeScene(scene: DisposableScene, renderer: { dispose: () => void }, tracker: DisposalTracker) {
  disposeObject3D(scene, tracker);
  renderer.dispose();
}

function loadGltfSafely<T extends { scene: DisposableScene }>(
  loader: { loadAsync: (url: string) => Promise<T> },
  url: string,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (!settled) {
        settled = true;
        reject(new DOMException('GLTF loading aborted', 'AbortError'));
      }
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    void loader.loadAsync(url).then((result) => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted || settled) {
        disposeObject3D(result.scene);
        return;
      }
      settled = true;
      resolve(result);
    }).catch((error: unknown) => {
      signal.removeEventListener('abort', abort);
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
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

type LootVisualAssets = {
  starGeometry: InstanceType<ThreeNamespace['ExtrudeGeometry']>;
  starMaterial: InstanceType<ThreeNamespace['MeshStandardMaterial']>;
  glowGeometry: InstanceType<ThreeNamespace['SphereGeometry']>;
  glowMaterial: InstanceType<ThreeNamespace['MeshBasicMaterial']>;
  starShadowGeometry: InstanceType<ThreeNamespace['CircleGeometry']>;
  scrollPaperGeometry: InstanceType<ThreeNamespace['BoxGeometry']>;
  scrollPaperMaterial: InstanceType<ThreeNamespace['MeshStandardMaterial']>;
  scrollRollGeometry: InstanceType<ThreeNamespace['CylinderGeometry']>;
  scrollRollMaterial: InstanceType<ThreeNamespace['MeshStandardMaterial']>;
  scrollShadowGeometry: InstanceType<ThreeNamespace['CircleGeometry']>;
  shadowMaterial: InstanceType<ThreeNamespace['MeshBasicMaterial']>;
};

const lootVisualAssetsCache = new WeakMap<object, LootVisualAssets>();

function getLootVisualAssets(THREE: ThreeNamespace): LootVisualAssets {
  const cacheKey = THREE as unknown as object;
  const cached = lootVisualAssetsCache.get(cacheKey);
  if (cached) return cached;
  const shape = new THREE.Shape();
  const points = 10;
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2 - Math.PI / 2;
    const radius = index % 2 === 0 ? 0.17 : 0.075;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const assets: LootVisualAssets = {
    starGeometry: new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.012, bevelThickness: 0.012 }),
    starMaterial: new THREE.MeshStandardMaterial({ color: 0xffc928, emissive: 0xffa400, emissiveIntensity: 0.34, roughness: 0.55, metalness: 0.08 }),
    glowGeometry: new THREE.SphereGeometry(GAME_LOOT_STAR_GLOW_RADIUS, 10, 6),
    glowMaterial: new THREE.MeshBasicMaterial({ color: 0xffd75a, transparent: true, opacity: 0.13, depthWrite: false }),
    starShadowGeometry: new THREE.CircleGeometry(0.14, 16),
    scrollPaperGeometry: new THREE.BoxGeometry(0.24, 0.16, 0.045),
    scrollPaperMaterial: new THREE.MeshStandardMaterial({ color: 0xffedb0, emissive: 0x7a4e18, emissiveIntensity: 0.08, roughness: 0.72 }),
    scrollRollGeometry: new THREE.CylinderGeometry(0.045, 0.045, 0.19, 10),
    scrollRollMaterial: new THREE.MeshStandardMaterial({ color: 0xd58c32, roughness: 0.62, metalness: 0.08 }),
    scrollShadowGeometry: new THREE.CircleGeometry(0.09, 16),
    shadowMaterial: new THREE.MeshBasicMaterial({ color: 0x173226, transparent: true, opacity: 0.18, depthWrite: false }),
  };
  lootVisualAssetsCache.set(cacheKey, assets);
  return assets;
}

function createLootDropObject(THREE: ThreeNamespace, drop: GameLootDrop): Object3D {
  const assets = getLootVisualAssets(THREE);
  const root = new THREE.Group();
  root.name = `loot-drop-${drop.id}`;
  root.userData.lootDropId = drop.id;
  root.position.set(drop.x, drop.y, drop.z);

  const shadow = new THREE.Mesh(
    drop.kind === 'star' ? assets.starShadowGeometry : assets.scrollShadowGeometry,
    assets.shadowMaterial,
  );
  shadow.name = 'loot-drop-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -drop.y + 0.008;
  shadow.scale.set(1, 0.58, 1);
  root.add(shadow);
  const visualRoot = new THREE.Group();
  visualRoot.scale.setScalar(drop.kind === 'scroll' ? GAME_LOOT_SCROLL_VISUAL_SCALE : 1);
  root.add(visualRoot);

  if (drop.kind === 'star') {
    const star = new THREE.Mesh(assets.starGeometry, assets.starMaterial);
    star.name = 'loot-drop-star';
    star.scale.setScalar(GAME_LOOT_STAR_VISUAL_SCALE);
    star.rotation.x = -0.12;
    star.position.z = -0.028;
    visualRoot.add(star);
    const glow = new THREE.Mesh(assets.glowGeometry, assets.glowMaterial);
    glow.name = 'loot-drop-star-glow';
    visualRoot.add(glow);
  } else {
    const paper = new THREE.Mesh(assets.scrollPaperGeometry, assets.scrollPaperMaterial);
    paper.name = 'loot-drop-scroll-paper';
    paper.position.y = 0.02;
    visualRoot.add(paper);
    for (const x of [-0.13, 0.13]) {
      const roll = new THREE.Mesh(assets.scrollRollGeometry, assets.scrollRollMaterial);
      roll.name = 'loot-drop-scroll-roll';
      roll.rotation.z = Math.PI / 2;
      roll.position.set(x, 0.02, 0);
      visualRoot.add(roll);
    }
  }
  return root;
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

function getPetModelUrl(item: GameCatalogItem | undefined): string {
  const metadataModel = item?.metadata.model;
  return typeof metadataModel === 'string'
    && metadataModel.startsWith('/assets/')
    && metadataModel.toLowerCase().endsWith('.glb')
    ? metadataModel
    : PET_MODEL_URL;
}

interface PetModelInstance {
  root: Object3D;
  model: Object3D;
  mixer?: import('three').AnimationMixer;
  walkAction?: import('three').AnimationAction;
}

function createPetModel(
  THREE: ThreeNamespace,
  cloneSkinnedObject: (source: Object3D) => Object3D,
  source: Object3D,
  animations: readonly AnimationClip[],
  characterWorldHeight: number,
  requestedScale: number,
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
  root.name = 'starlight-sprout-pet';
  root.scale.setScalar(modelScale);
  model.position.copy(definition.offset);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: 0x173226, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  shadow.name = 'starlight-sprout-pet-shadow';
  shadow.rotation.x = -Math.PI / 2;
  const footprint = Math.max(definition.size.x, definition.size.z, 0.08);
  shadow.scale.set(footprint * 0.62, footprint * 0.32, 1);
  shadow.position.y = 0.006;
  root.add(shadow, model);

  let mixer: import('three').AnimationMixer | undefined;
  let walkAction: import('three').AnimationAction | undefined;
  if (animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    walkAction = mixer.clipAction(getAnimationClip(animations, 'walk'));
    walkAction.setLoop(THREE.LoopRepeat, Infinity);
    walkAction.play();
    walkAction.paused = true;
  }
  return { root, model, mixer, walkAction };
}

function updatePetAnimation(
  actor: { model: Object3D; mixer?: import('three').AnimationMixer; walkAction?: import('three').AnimationAction; animationTime: number },
  isWalking: boolean,
  delta: number,
  prefersReducedMotion: boolean,
) {
  actor.animationTime += delta * (isWalking ? 8 : 2.4);
  if (actor.walkAction) actor.walkAction.paused = !isWalking;
  if (actor.mixer) actor.mixer.update(delta * (prefersReducedMotion ? 0.75 : 1));
  actor.model.rotation.z = prefersReducedMotion
    ? 0
    : Math.sin(actor.animationTime) * (isWalking ? 0.035 : 0.012);
}

function getAnimationClip(clips: readonly AnimationClip[], state: 'idle' | 'walk') {
  const pattern = state === 'walk' ? /walk|run/i : /idle|iddle|stand|rest/i;
  return clips.find((clip) => pattern.test(clip.name)) ?? clips[0];
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('button, input, textarea, select, [role="dialog"], a'));
}

function getPetActorState(behaviorMode: PetBehaviorMode, following: boolean) {
  if (following) return 'following' as const;
  return behaviorMode === 'wander' ? 'wandering' as const : 'idle' as const;
}

function isWalkablePetPosition(position: { x: number; z: number }, radius: number, obstacles: readonly CollisionCircle[]) {
  return Math.abs(position.x) + radius <= WORLD_BOUNDARY
    && Math.abs(position.z) + radius <= WORLD_BOUNDARY
    && !obstacles.some((obstacle) => circlesOverlap({ ...position, radius }, obstacle));
}

function getSafePetSpawnPosition(
  current: { x: number; z: number },
  radius: number,
  obstacles: readonly CollisionCircle[],
) {
  if (isWalkablePetPosition(current, radius, obstacles)) return current;
  const candidates = [
    { x: -3.4, z: -3.2 },
    { x: 0, z: -3.2 },
    { x: 3.4, z: -3.2 },
    { x: -3.4, z: 3.2 },
    { x: 3.4, z: 3.2 },
  ];
  return candidates.find((candidate) => isWalkablePetPosition(candidate, radius, obstacles))
    ?? chooseRoamingTarget({ x: 0, z: -3.2 }, radius, obstacles)
    ?? { x: 0, z: -3.2 };
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
  let threeNamespace: ThreeNamespace | undefined;
  let dracoDecoderLoader: { setDecoderPath: (path: string) => unknown; dispose: () => void } | undefined;
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
    if (threeNamespace) lootVisualAssetsCache.delete(threeNamespace as unknown as object);
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
      threeNamespace = THREE;
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
      const contextAttributes = { antialias: true, alpha: false };
      const webglContext = options.canvas.getContext('webgl2', contextAttributes)
        ?? options.canvas.getContext('webgl', contextAttributes);
      if (!webglContext) throw new Error('WebGL context is unavailable for the terrain canvas.');
      const rendererInstance = new THREE.WebGLRenderer({ canvas: options.canvas, context: webglContext as WebGL2RenderingContext, antialias: true, alpha: false });
      renderer = rendererInstance;
      rendererInstance.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualitySettings.maxPixelRatio));
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

      const followingPetInventoryId = options.gameData.loadout?.followingPetInventoryId;
      const followingPetInventory = followingPetInventoryId
        ? options.gameData.inventory.find((inventory) => inventory.id === followingPetInventoryId)
        : undefined;
      const followingPet = followingPetInventory
        ? options.gameData.catalog.find((item) => item.id === followingPetInventory.catalogItemId && item.itemType === 'pet')
        : undefined;
      const petCatalogById = new Map(options.gameData.catalog.filter((item) => item.itemType === 'pet').map((item) => [item.id, item]));
      const petModelEntries = new Map<string, string>();
      const registerPetModel = (item: GameCatalogItem | undefined, assetKey?: string) => {
        const resolvedAssetKey = item?.assetKey ?? assetKey;
        if (resolvedAssetKey) petModelEntries.set(resolvedAssetKey, getPetModelUrl(item));
      };
      registerPetModel(followingPet);
      options.gameData.worldEntities
        .filter((entity) => entity.entityKind === 'pet')
        .forEach((entity) => registerPetModel(entity.catalogItemId ? petCatalogById.get(entity.catalogItemId) : undefined, entity.assetKey));
      const petModelSources = new Map<string, { scene: Object3D; animations: AnimationClip[] }>();
      const petModelUrls = [...new Set(petModelEntries.values())];
      if (petModelUrls.length > 0) {
        options.onProgress(64, '讀取星芽獸木偶模型…');
        await Promise.all(petModelUrls.map(async (modelUrl) => {
          try {
            const petResult = await loadGltfSafely<{ scene: Object3D; animations: AnimationClip[] }>(loader, modelUrl, signal);
            if (trackResourceRoot(petResult.scene)) petModelSources.set(modelUrl, petResult);
          } catch (error) {
            if (!disposed && !signal.aborted) console.warn(`Unable to load pet model ${modelUrl}; skipping that pet.`, error);
          }
        }));
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
        viewportWidth: window.innerWidth,
        pixelRatio: window.devicePixelRatio || 1,
        count: scaleWorldBudget(
          getProceduralGrassCount({ width: window.innerWidth, pixelRatio: window.devicePixelRatio || 1 }),
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
      const treeScale = (terrainStep * PROTOTYPE_WORLD_CONFIG.treeFitToTile) / Math.max(treeDefinition.size.x, treeDefinition.size.z);
      const tree = placeAsset(THREE, treeDefinition, {
        x: PROTOTYPE_WORLD_CONFIG.treePosition.x,
        y: -PROTOTYPE_WORLD_CONFIG.treeRootSink,
        z: PROTOTYPE_WORLD_CONFIG.treePosition.z,
      }, treeScale);
      tree.scale.y *= PROTOTYPE_WORLD_CONFIG.treeHeightScale;
      terrain.add(tree);
      const centralTreeHeight = treeDefinition.size.y * treeScale * PROTOTYPE_WORLD_CONFIG.treeHeightScale;
      terrain.add(createProceduralForest(THREE, {
        terrainLimit,
        groundHeight: 0,
        heightLimit: centralTreeHeight * 0.5,
        layers: qualitySettings.forestLayers,
      }));
      terrain.add(createNaturalBoundaryScenery(THREE, {
        boundary: terrainLimit,
        quality,
      }).group);
      const eastFairytaleScenery = createEastFairytaleScenery(THREE, { quality });
      terrain.add(eastFairytaleScenery.group);
      const butterflies = createButterflyField(THREE, {
        count: visualSettings.butterflyCount,
        center: {
          x: PROTOTYPE_WORLD_CONFIG.treePosition.x,
          z: PROTOTYPE_WORLD_CONFIG.treePosition.z,
        },
        radius: 0.9,
        minHeight: 0.78,
        maxHeight: 1.35,
      });
      terrain.add(butterflies.group);
      worldScene.add(terrain);

      const playerRoot = new THREE.Group();
      playerRoot.name = 'player-root';
      playerRoot.position.set(0, 0, terrainStep * 2.08);
      const characterDefinition = defineAsset(THREE, characterSource);
      const characterScale = PROTOTYPE_WORLD_CONFIG.characterTargetHeight / Math.max(characterDefinition.size.y, 0.001);
      const characterRoot = new THREE.Group();
      characterRoot.name = 'player-character';
      characterRoot.scale.setScalar(characterScale);
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
        baseModelY: number;
        target: { x: number; z: number } | null;
        nextDecisionAt: number;
        animationTime: number;
        facing: { x: number; z: number };
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
          const walkClip = getAnimationClip(roamingCharacterAnimations, 'walk');
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
          baseModelY: roamingModel.position.y,
          target: null,
          nextDecisionAt: 0,
          animationTime: 0,
          facing: { x: 0, z: 1 },
        };
      }

      if (characterAnimations.length > 0) {
        mixer = new THREE.AnimationMixer(characterSource);
      }
      const characterActions = new Map<'idle' | 'walk', import('three').AnimationAction>();
      characterAnimations.forEach((clip) => {
        const name = clip.name.toLowerCase();
        if (name.includes('walk') || name.includes('run')) characterActions.set('walk', mixer!.clipAction(clip));
        if (name.includes('idle') || name.includes('iddle') || name.includes('stand') || name.includes('rest')) characterActions.set('idle', mixer!.clipAction(clip));
      });
      characterActions.forEach((action) => action.setLoop(THREE.LoopRepeat, Infinity));
      let activeCharacterAction: import('three').AnimationAction | undefined;
      const playCharacterAction = (name: 'idle' | 'walk') => {
        const fallbackClip = getAnimationClip(characterAnimations, name);
        const nextAction = characterActions.get(name) ?? (fallbackClip && mixer ? mixer.clipAction(fallbackClip) : undefined);
        if (!nextAction || nextAction === activeCharacterAction) return;
        nextAction.reset().fadeIn(0.16).play();
        activeCharacterAction?.fadeOut(0.16);
        activeCharacterAction = nextAction;
      };
      playCharacterAction('idle');

      const decorationCollisions = buildCollisionCircles(options.gameData.worldEntities
        .filter((entity) => entity.entityKind === 'decoration')
        .map((entity) => ({ positionX: entity.x, positionZ: entity.z, collisionRadius: entity.collisionRadius ?? 0.3, scale: entity.scale })));
      const wanderObstacles = [CENTRAL_TREE_KEEP_OUT, ...decorationCollisions];
      const characterWorldHeight = characterDefinition.size.y * characterScale;
      const petActors: Array<{
        object: import('three').Object3D;
        model: Object3D;
        mixer?: import('three').AnimationMixer;
        walkAction?: import('three').AnimationAction;
        behaviorMode: PetBehaviorMode;
        follow: boolean;
        radius: number;
        baseY: number;
        animationTime: number;
        facing: { x: number; z: number };
        state: 'following' | 'wandering' | 'idle';
        target: { x: number; z: number } | null;
        nextDecisionAt: number;
      }> = [];
      options.gameData.worldEntities.filter((entity) => entity.isActive).forEach((entity) => {
        const isPet = entity.entityKind === 'pet';
        const catalogItem = entity.catalogItemId ? petCatalogById.get(entity.catalogItemId) : undefined;
        const petModelSource = isPet ? petModelSources.get(getPetModelUrl(catalogItem)) : undefined;
        const petWorldScale = Math.max(entity.scale, 0.01) * PET_WORLD_SCALE_MULTIPLIER;
        const petRadius = Math.max(entity.collisionRadius ?? 0.28, 0.08) * petWorldScale;
        const petModel = isPet && petModelSource
          ? createPetModel(THREE, cloneSkinnedObject, petModelSource.scene, petModelSource.animations, characterWorldHeight, petWorldScale)
          : undefined;
        if (isPet && !petModel) return;
        const object = isPet
          ? petModel!.root
          : new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8),
            new THREE.MeshStandardMaterial({ color: 0xe87972, roughness: 0.9 }),
          );
        if (!isPet) {
          object.position.set(entity.x, entity.y + 0.3, entity.z);
          object.rotation.y = entity.rotationY;
          object.scale.setScalar(entity.scale);
        } else {
          const spawn = getSafePetSpawnPosition({ x: entity.x, z: entity.z }, petRadius, wanderObstacles);
          object.position.set(spawn.x, entity.y, spawn.z);
          object.rotation.set(entity.rotationX, entity.rotationY, entity.rotationZ);
        }
        if (!isPet) (object as Object3D & { castShadow?: boolean }).castShadow = true;
        worldScene.add(object);
        if (isPet) {
          const follow = entity.inventoryItemId === followingPetInventoryId;
          petActors.push({ object, model: petModel!.model, mixer: petModel!.mixer, walkAction: petModel!.walkAction, behaviorMode: entity.behaviorMode, follow, radius: petRadius, baseY: entity.y, animationTime: 0, facing: { x: Math.sin(PROTOTYPE_WORLD_CONFIG.initialCameraYaw), z: Math.cos(PROTOTYPE_WORLD_CONFIG.initialCameraYaw) }, state: getPetActorState(entity.behaviorMode, follow), target: null, nextDecisionAt: 0 });
        }
      });
      if (followingPet && !petActors.some((actor) => actor.follow)) {
        const petModelSource = petModelSources.get(getPetModelUrl(followingPet));
        if (petModelSource) {
          const petModel = createPetModel(THREE, cloneSkinnedObject, petModelSource.scene, petModelSource.animations, characterWorldHeight, followingPet.maxScale * PET_WORLD_SCALE_MULTIPLIER);
          const object = petModel.root;
          const initialFacing = { x: Math.sin(characterRoot.rotation.y), z: Math.cos(characterRoot.rotation.y) };
          const initialFollowDistance = Math.max(
            PET_FOLLOW_DISTANCE,
            CHARACTER_COLLISION_RADIUS + followingPet.collisionRadius * PET_WORLD_SCALE_MULTIPLIER + 0.12,
          );
          object.position.set(
            playerRoot.position.x - initialFacing.x * initialFollowDistance,
            0,
            playerRoot.position.z - initialFacing.z * initialFollowDistance,
          );
          worldScene.add(object);
          petActors.push({ object, model: petModel.model, mixer: petModel.mixer, walkAction: petModel.walkAction, behaviorMode: 'idle', follow: true, radius: followingPet.collisionRadius * PET_WORLD_SCALE_MULTIPLIER, baseY: 0, animationTime: 0, facing: { x: Math.sin(PROTOTYPE_WORLD_CONFIG.initialCameraYaw), z: Math.cos(PROTOTYPE_WORLD_CONFIG.initialCameraYaw) }, state: 'following', target: null, nextDecisionAt: 0 });
        }
      }

      const lootDropObjects = new Map<string, Object3D>();
      const collectingLootIds = new Set<string>();
      const claimedLootIds = new Set<string>();
      const syncLootDrops = () => {
        const currentDrops = options.lootDropsRef.current;
        const liveIds = new Set(currentDrops.map((drop) => drop.id));
        for (const [dropId, object] of lootDropObjects) {
          if (!liveIds.has(dropId) || claimedLootIds.has(dropId) || collectingLootIds.has(dropId)) {
            object.visible = false;
            continue;
          }
          const drop = currentDrops.find((candidate) => candidate.id === dropId);
          if (drop) {
            object.position.set(drop.x, drop.y, drop.z);
            object.visible = true;
          }
        }
        for (const drop of currentDrops) {
          if (claimedLootIds.has(drop.id) || collectingLootIds.has(drop.id) || lootDropObjects.has(drop.id)) continue;
          const object = createLootDropObject(THREE, drop);
          worldScene.add(object);
          lootDropObjects.set(drop.id, object);
        }
      };
      syncLootDrops();

      let cameraYaw = PROTOTYPE_WORLD_CONFIG.initialCameraYaw;
      let cameraPitch: number = PROTOTYPE_WORLD_CONFIG.initialCameraPitch;
      let cameraDistance: number = PROTOTYPE_WORLD_CONFIG.cameraDistanceDefault;
      let sceneElapsedTime = 0;
      const previousPlayerPosition = new THREE.Vector3().copy(playerRoot.position);
      let playerGrassInteraction = { direction: { x: 0, z: 1 }, strength: 0 };
      const grassInteractors = [{ position: playerRoot.position, direction: playerGrassInteraction.direction, strength: 0 }];
      const keys = new Set<string>();
      const clock = new THREE.Clock();
      const controller = options.controller;

      const resize = () => {
        const rect = options.canvas.getBoundingClientRect();
        const width = Math.max(rect.width, 1);
        const height = Math.max(rect.height, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        rendererInstance.setSize(width, height, false);
      };
      const pointFromEvent = (event: PointerEvent) => {
        const rect = options.canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      };
      const lootRaycaster = new THREE.Raycaster();
      const lootPointer = new THREE.Vector2();
      const getLootDropIdFromObject = (object: Object3D | undefined): string | undefined => {
        let current = object;
        while (current) {
          const lootDropId = current.userData?.lootDropId;
          if (typeof lootDropId === 'string') return lootDropId;
          current = current.parent ?? undefined;
        }
        return undefined;
      };
      const getLootDropAtPoint = (point: { x: number; y: number }) => {
        const rect = options.canvas.getBoundingClientRect();
        lootPointer.set(
          (point.x / Math.max(rect.width, 1)) * 2 - 1,
          -(point.y / Math.max(rect.height, 1)) * 2 + 1,
        );
        lootRaycaster.setFromCamera(lootPointer, camera);
        const hit = lootRaycaster.intersectObjects([...lootDropObjects.values()], true).find((entry) => entry.object.visible);
        return getLootDropIdFromObject(hit?.object);
      };
      const getScreenPointForLoot = (drop: GameLootDrop, object: Object3D) => {
        const rect = options.canvas.getBoundingClientRect();
        const worldPoint = new THREE.Vector3(drop.x, drop.y + 0.08, drop.z);
        object.getWorldPosition(worldPoint);
        worldPoint.project(camera);
        return {
          x: rect.left + ((worldPoint.x + 1) / 2) * rect.width,
          y: rect.top + ((-worldPoint.y + 1) / 2) * rect.height,
        };
      };
      const getLootHudTarget = (kind: GameLootDrop['kind']) => {
        const stat = document.querySelector<HTMLElement>(`[data-hh-stat-target="${getLootTargetStat(kind)}"]`);
        if (stat) {
          const rect = stat.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        const rect = options.canvas.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      };
      const requestLootPickupBatch = async (dropIds: string[]) => {
        const pickupBatch = options.onLootPickupBatchRef.current;
        const pickupSingle = options.onLootPickupRef.current;
        if (!pickupBatch && !pickupSingle) return;
        const drops = dropIds.map((dropId) => {
          const drop = options.lootDropsRef.current.find((candidate) => candidate.id === dropId);
          const object = lootDropObjects.get(dropId);
          return drop && object && object.visible && !collectingLootIds.has(dropId) && !claimedLootIds.has(dropId)
            ? { drop, object }
            : undefined;
        }).filter((entry): entry is { drop: GameLootDrop; object: Object3D } => Boolean(entry));
        if (drops.length === 0) return;
        drops.forEach(({ drop }) => collectingLootIds.add(drop.id));
        const events = drops.map(({ drop, object }, index): LootAnimationEvent => ({
          id: `${drop.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
          dropId: drop.id,
          kind: drop.kind,
          amount: drop.amount,
          from: getScreenPointForLoot(drop, object),
          to: getLootHudTarget(drop.kind),
          durationMs: getLootAnimationDuration(prefersReducedMotion),
          delayMs: getLootAnimationDelay(index, prefersReducedMotion),
        }));
        if (options.onLootAnimationBatchRef.current) options.onLootAnimationBatchRef.current(events);
        else events.forEach((event) => options.onLootAnimationRef.current?.(event));
        syncLootDrops();
        let collectedIds: string[] = [];
        try {
          if (pickupBatch) {
            collectedIds = await pickupBatch(drops.map(({ drop }) => drop.id));
          } else if (pickupSingle) {
            for (const { drop } of drops) {
              if (await pickupSingle(drop.id)) collectedIds.push(drop.id);
            }
          }
        } catch {
          collectedIds = [];
        }
        const collected = new Set(collectedIds);
        drops.forEach(({ drop }) => {
          collectingLootIds.delete(drop.id);
          if (collected.has(drop.id)) claimedLootIds.add(drop.id);
        });
        syncLootDrops();
      };
      const requestLootPickup = (dropId: string) => {
        void requestLootPickupBatch([dropId]);
      };
      let lootPointerState: { pointerId: number; dropId: string; startX: number; startY: number; moved: boolean } | null = null;
      const onPointerDown = (event: PointerEvent) => {
        if (options.pausedRef.current || isInteractiveTarget(event.target)) return;
        const point = pointFromEvent(event);
        const lootDropId = getLootDropAtPoint(point);
        if (lootDropId) {
          event.preventDefault();
          options.canvas.setPointerCapture(event.pointerId);
          lootPointerState = { pointerId: event.pointerId, dropId: lootDropId, startX: point.x, startY: point.y, moved: false };
          return;
        }
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
        const point = pointFromEvent(event);
        if (lootPointerState?.pointerId === event.pointerId) {
          if (Math.hypot(point.x - lootPointerState.startX, point.y - lootPointerState.startY) > 10) lootPointerState.moved = true;
          return;
        }
        controller?.dispatch({ type: 'pointer-move', pointerId: event.pointerId, point });
      };
      const onPointerEnd = (event: PointerEvent) => {
        if (lootPointerState?.pointerId === event.pointerId) {
          const state = lootPointerState;
          lootPointerState = null;
          if (event.type === 'pointerup' && !state.moved) void requestLootPickup(state.dropId);
          if (options.canvas.hasPointerCapture(event.pointerId)) options.canvas.releasePointerCapture(event.pointerId);
          return;
        }
        controller?.dispatch({ type: event.type === 'pointercancel' ? 'pointer-cancel' : 'pointer-up', pointerId: event.pointerId });
        if (options.canvas.hasPointerCapture(event.pointerId)) options.canvas.releasePointerCapture(event.pointerId);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        if (options.pausedRef.current || isInteractiveTarget(event.target) || (!isWorldMovementKey(key) && !isWorldCameraKey(key))) return;
        keys.add(key);
        event.preventDefault();
      };
      const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
      const resetInput = () => { keys.clear(); controller?.reset(); };
      options.canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
      options.canvas.addEventListener('pointermove', onPointerMove, { passive: true });
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

      const grassMotionScale = Math.min(
        qualitySettings.motionScale,
        qualitySettings.swayAmplitude / WORLD_QUALITY_SETTINGS.high.swayAmplitude,
      );
      const animate = () => {
        if (disposed) return;
        if (options.pausedRef.current) {
          pausedTimer = window.setTimeout(() => {
            pausedTimer = undefined;
            animate();
          }, 250);
          return;
        }
        animationFrame = window.requestAnimationFrame(animate);
        const delta = Math.min(clock.getDelta(), 0.05);
        sceneElapsedTime += delta;
        previousPlayerPosition.copy(playerRoot.position);
        const currentInput = controller?.getSnapshot();
        let isPlayerMoving = false;
        if (currentInput && !options.pausedRef.current) {
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
            isPlayerMoving = true;
            const direction = new THREE.Vector3(-Math.sin(cameraYaw) * forwardInput, 0, -Math.cos(cameraYaw) * forwardInput);
            direction.add(new THREE.Vector3(Math.cos(cameraYaw) * sideInput, 0, -Math.sin(cameraYaw) * sideInput));
            direction.normalize().multiplyScalar(delta * PROTOTYPE_WORLD_CONFIG.characterMoveSpeed);
            const nextPosition = moveWorldCharacter(
              { x: playerRoot.position.x, z: playerRoot.position.z },
              { x: playerRoot.position.x + direction.x, z: playerRoot.position.z + direction.z },
              CHARACTER_COLLISION_RADIUS,
              decorationCollisions,
            );
            playerRoot.position.x = nextPosition.x;
            playerRoot.position.z = nextPosition.z;
            const targetYaw = Math.atan2(direction.x, direction.z);
            const yawDelta = Math.atan2(Math.sin(targetYaw - characterRoot.rotation.y), Math.cos(targetYaw - characterRoot.rotation.y));
            characterRoot.rotation.y += yawDelta * Math.min(1, delta * 12);
          }
        }
        playCharacterAction(isPlayerMoving ? 'walk' : 'idle');
        playerGrassInteraction = updateGrassInteractionState({ previousPosition: previousPlayerPosition, currentPosition: playerRoot.position, previousStrength: playerGrassInteraction.strength, previousDirection: playerGrassInteraction.direction, delta });
        grassInteractors[0].direction = playerGrassInteraction.direction;
        grassInteractors[0].strength = playerGrassInteraction.strength;
        proceduralGrass.update({ time: sceneElapsedTime, motionScale: grassMotionScale, interactors: grassInteractors });
        ambientPollen.update(sceneElapsedTime);
        butterflies.update(sceneElapsedTime);
        eastFairytaleScenery.update(sceneElapsedTime);
        const now = clock.elapsedTime;
        syncLootDrops();
        for (const [dropId, object] of lootDropObjects) {
          if (!object.visible) continue;
          const drop = options.lootDropsRef.current.find((candidate) => candidate.id === dropId);
          if (!drop) continue;
          const bob = prefersReducedMotion ? 0 : Math.sin(sceneElapsedTime * 3.2 + dropId.length) * 0.035;
          object.position.y = drop.y + bob;
          object.rotation.y += delta * (drop.kind === 'star' ? 0.9 : 0.45);
        }
        const touchCollectedDropIds: string[] = [];
        for (const drop of options.lootDropsRef.current) {
          const object = lootDropObjects.get(drop.id);
          if (
            !object
            || !object.visible
            || collectingLootIds.has(drop.id)
            || claimedLootIds.has(drop.id)
            || !isLootDropInPickupRange(playerRoot.position, drop, CHARACTER_COLLISION_RADIUS)
          ) continue;
          touchCollectedDropIds.push(drop.id);
        }
        if (touchCollectedDropIds.length > 0) void requestLootPickupBatch(touchCollectedDropIds);
        if (roamingActor) {
          const current = { x: roamingActor.object.position.x, z: roamingActor.object.position.z };
          if (!roamingActor.target && now >= roamingActor.nextDecisionAt) {
            roamingActor.target = chooseRoamingTarget(current, HABITHERO_ROAMING_CHARACTER_RADIUS, wanderObstacles);
            roamingActor.nextDecisionAt = roamingActor.target ? now : now + 1.5;
          }
          const isWalking = Boolean(roamingActor.target);
          if (roamingActor.target) {
            const step = getRoamingStep(
              current,
              roamingActor.target,
              delta,
              HABITHERO_ROAMING_CHARACTER_RADIUS,
              HABITHERO_ROAMING_CHARACTER_SPEED * (prefersReducedMotion ? 0.45 : 1),
              wanderObstacles,
            );
            roamingActor.object.position.x = step.next.x;
            roamingActor.object.position.z = step.next.z;
            if (step.arrived || step.blocked) {
              roamingActor.target = null;
              roamingActor.nextDecisionAt = now + (step.arrived ? HABITHERO_ROAMING_CHARACTER_PAUSE : PET_WANDER_RETRY_DELAY);
            } else {
              roamingActor.facing = step.facing;
              const targetYaw = Math.atan2(step.facing.x, step.facing.z);
              const yawDelta = Math.atan2(
                Math.sin(targetYaw - roamingActor.object.rotation.y),
                Math.cos(targetYaw - roamingActor.object.rotation.y),
              );
              roamingActor.object.rotation.y += yawDelta * Math.min(1, delta * 8);
            }
          }
          roamingActor.animationTime += delta * (isWalking ? 8 : 2.4);
          if (roamingWalkAction) roamingWalkAction.paused = !isWalking;
          const bob = prefersReducedMotion
            ? 0
            : isWalking
              ? Math.abs(Math.sin(roamingActor.animationTime)) * 0.018
              : Math.sin(roamingActor.animationTime) * 0.006;
          roamingActor.model.position.y = roamingActor.baseModelY + bob;
          roamingActor.model.rotation.z = prefersReducedMotion
            ? 0
            : Math.sin(roamingActor.animationTime) * (isWalking ? 0.035 : 0.012);
        }
        petActors.forEach((actor) => {
          const current = { x: actor.object.position.x, z: actor.object.position.z };
          if (actor.follow) {
            actor.state = 'following';
            const playerFacing = { x: Math.sin(characterRoot.rotation.y), z: Math.cos(characterRoot.rotation.y) };
            const followingStep = getFollowingStep(
              current,
              { position: { x: playerRoot.position.x, z: playerRoot.position.z }, facing: playerFacing },
              delta,
              actor.radius,
              PET_FOLLOW_SPEED * (prefersReducedMotion ? 0.55 : 1),
              wanderObstacles,
              CHARACTER_COLLISION_RADIUS,
            );
            actor.target = followingStep.target;
            if (!followingStep.arrived || followingStep.rerouted) {
              actor.facing = followingStep.facing;
              actor.object.position.x = followingStep.next.x;
              actor.object.position.z = followingStep.next.z;
              const targetYaw = Math.atan2(followingStep.facing.x, followingStep.facing.z);
              const yawDelta = Math.atan2(
                Math.sin(targetYaw - actor.object.rotation.y),
                Math.cos(targetYaw - actor.object.rotation.y),
              );
              actor.object.rotation.y += yawDelta * Math.min(1, delta * 10);
              actor.object.position.y = actor.baseY;
              updatePetAnimation(actor, true, delta, prefersReducedMotion);
            } else {
              actor.object.position.y = actor.baseY;
              updatePetAnimation(actor, false, delta, prefersReducedMotion);
            }
            return;
          }
          if (actor.behaviorMode !== 'wander') {
            actor.state = 'idle';
            actor.target = null;
            actor.object.position.y = actor.baseY;
            updatePetAnimation(actor, false, delta, prefersReducedMotion);
            return;
          }
          if (!actor.target && now >= actor.nextDecisionAt) {
            actor.target = chooseRoamingTarget(current, actor.radius, wanderObstacles);
            actor.state = actor.target ? 'wandering' : 'idle';
            actor.nextDecisionAt = actor.target ? now : now + 1.2;
          }
          if (actor.state !== 'wandering' || !actor.target) {
            actor.object.position.y = actor.baseY;
            updatePetAnimation(actor, false, delta, prefersReducedMotion);
            return;
          }
          const step = getRoamingStep(
            current,
            actor.target,
            delta,
            actor.radius,
            PET_WANDER_SPEED * (prefersReducedMotion ? 0.45 : 1),
            wanderObstacles,
          );
          actor.object.position.x = step.next.x;
          actor.object.position.z = step.next.z;
          if (step.arrived || step.blocked) {
            actor.target = null;
            actor.state = 'idle';
            actor.nextDecisionAt = now + (step.arrived ? PET_WANDER_PAUSE : PET_WANDER_RETRY_DELAY);
            actor.object.position.y = actor.baseY;
            updatePetAnimation(actor, false, delta, prefersReducedMotion);
          } else {
            actor.facing = step.facing;
            actor.object.rotation.y = Math.atan2(step.facing.x, step.facing.z);
            actor.object.position.y = actor.baseY;
            updatePetAnimation(actor, true, delta, prefersReducedMotion);
          }
        });
        if (mixer) mixer.update(delta);
        if (roamingMixer) roamingMixer.update(delta * (prefersReducedMotion ? 0.75 : 1));
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
  return { dispose };
}
