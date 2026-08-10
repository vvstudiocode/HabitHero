import type { AnimationClip, Object3D } from 'three';
import type { ChildGameData, GameCatalogItem, PetBehaviorMode } from './contracts';
import {
  buildCollisionCircles,
  CENTRAL_TREE_KEEP_OUT,
  CHARACTER_COLLISION_RADIUS,
  circlesOverlap,
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
} from '../../../terrain-prototype/terrain-controls.js';
import { updateGrassInteractionState } from '../../../terrain-prototype/procedural-grass-field.js';
import { getProceduralGrassCount } from '../../../terrain-prototype/procedural-grass-field.js';
import { getProceduralFlowerCount } from '../../../terrain-prototype/procedural-flower-layout.js';
import { createProceduralGrassField } from '../../../terrain-prototype/procedural-grass-scene.js';
import { createProceduralFlowerField } from '../../../terrain-prototype/procedural-flowers.js';
import { createProceduralForest } from '../../../terrain-prototype/procedural-trees.js';
import {
  getWorldQuality,
  scaleWorldBudget,
  WORLD_QUALITY_SETTINGS,
} from './world-quality';

export const PROTOTYPE_WORLD_ASSETS = {
  tree: new URL('../../../terrain-prototype/assets/big-tree.glb', import.meta.url).href,
  character: new URL('../../../terrain-prototype/assets/anime-maiden.glb', import.meta.url).href,
  skybox: new URL('../../../terrain-prototype/assets/sky-equirectangular-day.png', import.meta.url).href,
} as const;

export const PROTOTYPE_WORLD_CONFIG = {
  gridSize: 9,
  terrainStep: 1.1,
  scenePadding: 8,
  treeFitToTile: 4.8,
  treeHeightScale: 1,
  treeRootSink: 0.03,
  characterTargetHeight: 0.76 * (2 / 3),
  characterMoveSpeed: 1.1,
  cameraDistanceDefault: 4.1,
  cameraDistanceMin: 1.45,
  cameraDistanceMax: 6.5,
  cameraPitchMin: 0.12,
  // Allow the portrait camera to reach a full 90-degree downward tilt while
  // keeping the ground immediately around the character visible.
  cameraPitchMax: Math.PI / 2,
  initialCameraYaw: Math.PI / 2,
  initialCameraPitch: 0.18,
} as const;

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
      material?: { map?: { image?: { width?: number; height?: number }; colorSpace?: string; needsUpdate?: boolean }; color?: { set: (value: number) => void }; roughness?: number; metalness?: number; needsUpdate?: boolean } | Array<{ map?: { image?: { width?: number; height?: number }; colorSpace?: string; needsUpdate?: boolean }; color?: { set: (value: number) => void }; roughness?: number; metalness?: number; needsUpdate?: boolean }>;
    };
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const image = material.map?.image;
      if (!image?.width || !image.height) {
        material.color?.set(0x9bd58d);
        material.roughness = 0.86;
        material.metalness = 0;
        material.needsUpdate = true;
      }
      if (material.map) {
        material.map.colorSpace = 'srgb';
        material.map.needsUpdate = true;
      }
    });
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

function chooseWanderTarget(current: { x: number; z: number }, radius: number, obstacles: readonly CollisionCircle[]) {
  const limit = 4.8 - radius - 0.08;
  const minimumDistance = Math.max(0.45, radius * 1.75);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = { x: (Math.random() * 2 - 1) * limit, z: (Math.random() * 2 - 1) * limit };
    if (Math.hypot(candidate.x - current.x, candidate.z - current.z) < minimumDistance) continue;
    if (obstacles.some((obstacle) => circlesOverlap({ ...candidate, radius }, obstacle))) continue;
    return candidate;
  }
  return undefined;
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
    disposeTexture(skyboxTexture, disposalTracker);
    renderer = undefined;
    scene = undefined;
  };

  const setup = async () => {
    let mixer: import('three').AnimationMixer | undefined;
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
      const contextAttributes = { antialias: true, alpha: false };
      const webglContext = options.canvas.getContext('webgl2', contextAttributes)
        ?? options.canvas.getContext('webgl', contextAttributes);
      if (!webglContext) throw new Error('WebGL context is unavailable for the terrain canvas.');
      const rendererInstance = new THREE.WebGLRenderer({ canvas: options.canvas, context: webglContext as WebGL2RenderingContext, antialias: true, alpha: false });
      renderer = rendererInstance;
      rendererInstance.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualitySettings.maxPixelRatio));
      rendererInstance.outputColorSpace = THREE.SRGBColorSpace;
      rendererInstance.toneMapping = THREE.ACESFilmicToneMapping;
      rendererInstance.toneMappingExposure = 1.15;
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
      worldScene.background = new THREE.Color(0x2d9fe3);
      worldScene.fog = new THREE.Fog(new THREE.Color(0x9cd3ee), 9, 23);
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
        },
      );
      skyboxTexture = texture;

      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      worldScene.add(new THREE.HemisphereLight(0xdffbff, 0x456d42, 2.1));
      const sun = new THREE.DirectionalLight(0xffdda0, 3.2);
      sun.position.set(-4, 2.9, -14);
      sun.castShadow = qualitySettings.shadows;
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
      const loader = new GLTFLoader();
      const treeResult = await loadGltfSafely<{ scene: Object3D }>(loader, PROTOTYPE_WORLD_ASSETS.tree, signal);
      const treeSource = treeResult.scene;
      if (!trackResourceRoot(treeSource)) return;
      if (disposed) return;
      options.onProgress(54, '生成森林邊界…');
      let characterSource: Object3D;
      let characterAnimations: AnimationClip[] = [];
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
      const treeScale = (terrainStep * PROTOTYPE_WORLD_CONFIG.treeFitToTile) / Math.max(treeDefinition.size.x, treeDefinition.size.z);
      const tree = placeAsset(THREE, treeDefinition, { x: 0, y: -PROTOTYPE_WORLD_CONFIG.treeRootSink, z: 0 }, treeScale);
      tree.scale.y *= PROTOTYPE_WORLD_CONFIG.treeHeightScale;
      terrain.add(tree);
      const centralTreeHeight = treeDefinition.size.y * treeScale * PROTOTYPE_WORLD_CONFIG.treeHeightScale;
      terrain.add(createProceduralForest(THREE, {
        terrainLimit,
        groundHeight: 0,
        heightLimit: centralTreeHeight * 0.5,
        layers: qualitySettings.forestLayers,
      }));
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
        new THREE.CircleGeometry(0.16, 32),
        new THREE.MeshBasicMaterial({ color: 0x1d665b, transparent: true, opacity: 0.24 }),
      );
      playerMarker.name = 'player-ground-shadow';
      playerMarker.rotation.x = -Math.PI / 2;
      playerMarker.position.y = 0.006;
      playerRoot.add(playerMarker);

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
      const followingPetInventoryId = options.gameData.loadout?.followingPetInventoryId;
      const followingPetInventory = followingPetInventoryId
        ? options.gameData.inventory.find((inventory) => inventory.id === followingPetInventoryId)
        : undefined;
      const followingPet = followingPetInventory
        ? options.gameData.catalog.find((item) => item.id === followingPetInventory.catalogItemId && item.itemType === 'pet')
        : undefined;
      const petActors: Array<{ mesh: import('three').Mesh; behaviorMode: PetBehaviorMode; follow: boolean; radius: number; state: 'following' | 'wandering' | 'idle'; target: { x: number; z: number } | null; nextDecisionAt: number }> = [];
      options.gameData.worldEntities.forEach((entity) => {
        const isPet = entity.entityKind === 'pet';
        const mesh = new THREE.Mesh(
          isPet ? new THREE.SphereGeometry(0.26, 12, 8) : new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8),
          new THREE.MeshStandardMaterial({ color: isPet ? 0xf5b75a : 0xe87972, roughness: 0.9 }),
        );
        mesh.position.set(entity.x, entity.y + (isPet ? 0.28 : 0.3), entity.z);
        mesh.rotation.y = entity.rotationY;
        mesh.scale.setScalar(entity.scale);
        mesh.castShadow = true;
        worldScene.add(mesh);
        if (isPet) {
          const follow = entity.inventoryItemId === followingPetInventoryId;
          petActors.push({ mesh, behaviorMode: entity.behaviorMode, follow, radius: entity.collisionRadius ?? 0.28, state: getPetActorState(entity.behaviorMode, follow), target: null, nextDecisionAt: 0 });
        }
      });
      if (followingPet && !petActors.some((actor) => actor.follow)) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8ec5ff, roughness: 0.9 }));
        mesh.position.set(playerRoot.position.x - 0.7, 0.28, playerRoot.position.z + 0.7);
        mesh.castShadow = true;
        worldScene.add(mesh);
        petActors.push({ mesh, behaviorMode: 'idle', follow: true, radius: followingPet.collisionRadius, state: 'following', target: null, nextDecisionAt: 0 });
      }

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
      const onPointerDown = (event: PointerEvent) => {
        if (options.pausedRef.current || isInteractiveTarget(event.target)) return;
        event.preventDefault();
        options.canvas.setPointerCapture(event.pointerId);
        const point = pointFromEvent(event);
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
        controller?.dispatch({ type: 'pointer-move', pointerId: event.pointerId, point: pointFromEvent(event) });
      };
      const onPointerEnd = (event: PointerEvent) => {
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
            const nextCamera = applySinglePointerCameraDrag({ yaw: cameraYaw, pitch: cameraPitch }, { dx: cameraDelta.cameraDelta.x, dy: cameraDelta.cameraDelta.y }, { pitchMin: PROTOTYPE_WORLD_CONFIG.cameraPitchMin, pitchMax: PROTOTYPE_WORLD_CONFIG.cameraPitchMax });
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
        const now = clock.elapsedTime;
        petActors.forEach((actor) => {
          const current = { x: actor.mesh.position.x, z: actor.mesh.position.z };
          if (actor.follow) {
            actor.state = 'following';
            actor.target = { x: playerRoot.position.x - 0.7, z: playerRoot.position.z + 0.7 };
            const deltaX = actor.target.x - current.x;
            const deltaZ = actor.target.z - current.z;
            const distance = Math.hypot(deltaX, deltaZ);
            const step = Math.min(distance, delta * 1.5);
            if (distance > 0 && step > 0) {
              const next = moveWorldCharacter(current, { x: current.x + (deltaX / distance) * step, z: current.z + (deltaZ / distance) * step }, actor.radius, decorationCollisions);
              actor.mesh.position.x = next.x;
              actor.mesh.position.z = next.z;
              actor.mesh.rotation.y = Math.atan2(deltaX, deltaZ);
            }
            return;
          }
          if (actor.behaviorMode !== 'wander') { actor.state = 'idle'; actor.target = null; return; }
          if (actor.state === 'idle' && now >= actor.nextDecisionAt) {
            actor.target = chooseWanderTarget(current, actor.radius, wanderObstacles);
            actor.state = actor.target ? 'wandering' : 'idle';
            actor.nextDecisionAt = actor.target ? now : now + 1.2;
          }
          if (actor.state !== 'wandering' || !actor.target) return;
          const deltaX = actor.target.x - current.x;
          const deltaZ = actor.target.z - current.z;
          const distance = Math.hypot(deltaX, deltaZ);
          if (distance <= 0.08) { actor.mesh.position.x = actor.target.x; actor.mesh.position.z = actor.target.z; actor.target = null; actor.state = 'idle'; actor.nextDecisionAt = now + 0.8; return; }
          const step = Math.min(distance, delta * 0.75);
          const next = moveWorldCharacter(current, { x: current.x + (deltaX / distance) * step, z: current.z + (deltaZ / distance) * step }, actor.radius, decorationCollisions);
          actor.mesh.position.x = next.x;
          actor.mesh.position.z = next.z;
          if (next.x !== current.x || next.z !== current.z) actor.mesh.rotation.y = Math.atan2(deltaX, deltaZ);
        });
        if (mixer) mixer.update(delta);
        const zoomProgress = THREE.MathUtils.clamp((PROTOTYPE_WORLD_CONFIG.cameraDistanceDefault - cameraDistance) / (PROTOTYPE_WORLD_CONFIG.cameraDistanceDefault - PROTOTYPE_WORLD_CONFIG.cameraDistanceMin), 0, 1);
        const targetHeight = THREE.MathUtils.lerp(0.38, 0.5, zoomProgress);
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
