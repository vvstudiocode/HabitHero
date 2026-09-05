import type {
  AnimationAction,
  AnimationClip,
  Camera,
  Object3D,
} from 'three';
import type { GameCatalogItem, WorldNpcSummary } from './contracts';
import type { WorldNpcScreenPosition } from './world-npc-runtime';
import { getCharacterNpcAnimation, isWorldNpcNearby } from './world-npc-runtime';
import type { CollisionCircle, RadialWorldBoundary } from './world-collision';
import { createInPlaceAnimationClip } from './world-runtime-animation';
import {
  createWanderState,
  getWanderStep,
  hashWanderSeed,
  PET_WANDER_SPEED,
  type WanderState,
} from './world-roaming';
import {
  groundWorldCharacter,
  mountWorldCharacterModel,
  type WorldCharacterAssetDefinition,
} from './world-character-runtime';
import {
  clampWorldNpcRoamingPosition,
  findWorldNpcPetSpawnPosition,
  isWorldNpcPetPositionAvailable,
} from './world-npc-spawn';
import {
  createWorldNameLabel,
  getWorldNameLabelY,
  WORLD_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER,
} from './world-name-label';

type ThreeNamespace = typeof import('three');

export interface WorldNpcModelSource {
  scene: Object3D;
  animations: AnimationClip[];
}

export interface WorldNpcPetPresentation {
  modelScale: number;
  groundOffset: number;
  radius: number;
  groundShadowScaleMultiplier?: number;
  nameLabelScaleMultiplier?: number;
  hideGroundShadow?: boolean;
  movementSpeedMultiplier?: number;
}

export interface WorldNpcSceneRuntimeOptions {
  THREE: ThreeNamespace;
  scene: Object3D;
  sceneId: string;
  npcs: readonly WorldNpcSummary[];
  catalog: readonly GameCatalogItem[];
  characterHeight: number;
  groundY: number;
  wanderObstacles: readonly CollisionCircle[];
  showNames: boolean;
  cloneSkinnedObject: (source: Object3D) => Object3D;
  loadCharacterModel: (assetKey: string) => Promise<WorldNpcModelSource | undefined>;
  loadPetModel: (item: GameCatalogItem) => Promise<WorldNpcModelSource | undefined>;
  createFallbackCharacter: (THREE: ThreeNamespace, item?: GameCatalogItem) => Object3D;
  getPetPresentation?: (item: GameCatalogItem, definition: WorldCharacterAssetDefinition) => WorldNpcPetPresentation | undefined;
  getNpcGroundY?: (position: { x: number; z: number }) => number;
  getNpcGroundOffset?: (npc: Pick<WorldNpcSummary, 'id' | 'sceneId' | 'npcType'>) => number | undefined;
  getNpcFacingY?: (npc: Pick<WorldNpcSummary, 'id' | 'sceneId' | 'npcType'>) => number | undefined;
  walkableBoundary?: number;
  walkableRadialBoundary?: RadialWorldBoundary;
  isPetPositionWalkable?: (position: { x: number; z: number }) => boolean;
}

export interface WorldNpcSceneRuntime {
  getNearbyScreenPosition: (playerPosition: { x: number; z: number }, camera: Camera, canvas: HTMLCanvasElement) => WorldNpcScreenPosition | null;
  setDialogueOpen: (npcId: string | null, open: boolean) => void;
  update: (delta: number, now: number, reducedMotion: boolean) => void;
}

interface NpcActor {
  npc: WorldNpcSummary;
  object: Object3D;
  model: Object3D;
  footNodes: readonly Object3D[];
  mixer?: import('three').AnimationMixer;
  activeAction?: AnimationAction;
  walkAction?: AnimationAction;
  danceAction?: AnimationAction;
  wanderState?: WanderState;
  paused: boolean;
  radius: number;
  groundY: number;
  groundOffset: number;
  movementSpeedMultiplier: number;
  waitingForDanceCompletion: boolean;
}

interface NpcAnimationState {
  mixer: import('three').AnimationMixer;
  activeAction: AnimationAction;
  walkAction?: AnimationAction;
  danceAction?: AnimationAction;
}

function findCatalogItem(npc: WorldNpcSummary, catalog: readonly GameCatalogItem[]): GameCatalogItem | undefined {
  return (npc.catalogItemId ? catalog.find((item) => item.id === npc.catalogItemId) : undefined)
    ?? catalog.find((item) => item.assetKey === npc.assetKey);
}

export function isWorldNpcRoamingPet(npc: Pick<WorldNpcSummary, 'npcType'>): boolean {
  return npc.npcType === 'roaming_pet';
}

function playLoopingAnimation(
  THREE: ThreeNamespace,
  model: Object3D,
  animations: readonly AnimationClip[],
  preferredName: string,
  fallbackToFirst = true,
): NpcAnimationState | undefined {
  if (animations.length === 0) return undefined;
  const selected = animations.find((clip) => clip.name === preferredName)
    ?? animations.find((clip) => new RegExp(preferredName, 'i').test(clip.name))
    ?? (fallbackToFirst ? animations[0] : undefined);
  if (!selected) return undefined;
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(createInPlaceAnimationClip(selected));
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  return { mixer, activeAction: action };
}

export function getWorldNpcPetWalkClip(animations: readonly AnimationClip[]): AnimationClip | undefined {
  return animations.find((clip) => /walk|run/i.test(clip.name));
}

export function getWorldNpcPetDanceClip(animations: readonly AnimationClip[]): AnimationClip | undefined {
  return animations.find((clip) => /dance/i.test(clip.name));
}

function createLoopingAction(
  THREE: ThreeNamespace,
  mixer: import('three').AnimationMixer,
  clip: AnimationClip,
  loop: typeof THREE.LoopRepeat | typeof THREE.LoopOnce = THREE.LoopRepeat,
): AnimationAction {
  const action = mixer.clipAction(createInPlaceAnimationClip(clip));
  action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
  if (loop === THREE.LoopOnce) action.clampWhenFinished = true;
  return action;
}

function createPetAnimation(
  THREE: ThreeNamespace,
  model: Object3D,
  animations: readonly AnimationClip[],
): NpcAnimationState | undefined {
  const walkClip = getWorldNpcPetWalkClip(animations);
  if (!walkClip) return undefined;
  const mixer = new THREE.AnimationMixer(model);
  const walkAction = createLoopingAction(THREE, mixer, walkClip);
  const danceClip = getWorldNpcPetDanceClip(animations);
  const danceAction = danceClip ? createLoopingAction(THREE, mixer, danceClip, THREE.LoopOnce) : undefined;
  walkAction.play();
  return { mixer, activeAction: walkAction, walkAction, danceAction };
}

function setObjectShadows(root: Object3D, enabled = true) {
  root.traverse((object) => {
    const mesh = object as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
    if (mesh.isMesh) {
      mesh.castShadow = enabled;
      mesh.receiveShadow = enabled;
    }
  });
}

function switchNpcAnimation(actor: NpcActor, nextAnimation?: AnimationAction): void {
  if (!nextAnimation) return;
  if (actor.activeAction !== nextAnimation) {
    nextAnimation.reset().setEffectiveWeight(1).play();
    if (actor.activeAction) nextAnimation.crossFadeFrom(actor.activeAction, 0.16, false);
    actor.activeAction = nextAnimation;
    nextAnimation.paused = false;
    return;
  }
  if (!(nextAnimation === actor.danceAction && isNpcAnimationComplete(nextAnimation))) nextAnimation.paused = false;
}

function isNpcAnimationComplete(action?: AnimationAction): boolean {
  if (!action) return true;
  const duration = action.getClip().duration;
  return duration <= 0 || action.time >= duration;
}

function groundNpcCharacter(
  options: WorldNpcSceneRuntimeOptions,
  actor: NpcActor,
): void {
  const groundOffset = options.getNpcGroundOffset?.(actor.npc) ?? 0;
  const terrainGroundY = isWorldNpcRoamingPet(actor.npc)
    ? options.getNpcGroundY?.({
      x: actor.object.position.x,
      z: actor.object.position.z,
    }) ?? options.groundY
    : actor.groundY;
  groundWorldCharacter(options.THREE, {
    root: actor.object,
    model: actor.model,
    footNodes: actor.footNodes,
    groundY: terrainGroundY + groundOffset,
  });
}

function createGroundShadow(
  THREE: ThreeNamespace,
  definition: WorldCharacterAssetDefinition,
  scaleMultiplier = 1,
): Object3D {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: 0x173226, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  shadow.name = 'world-npc-ground-shadow';
  shadow.rotation.x = -Math.PI / 2;
  const footprint = Math.max(definition.size.x, definition.size.z, 0.08);
  shadow.scale.set(footprint * 0.62 * scaleMultiplier, footprint * 0.32 * scaleMultiplier, 1);
  shadow.position.y = 0.006;
  return shadow;
}

async function createNpcActor(
  options: WorldNpcSceneRuntimeOptions,
  npc: WorldNpcSummary,
  catalogItem: GameCatalogItem | undefined,
): Promise<NpcActor | undefined> {
  const { THREE } = options;
  const source = npc.npcType === 'character_vendor'
    ? await options.loadCharacterModel(npc.assetKey)
    : catalogItem ? await options.loadPetModel(catalogItem) : undefined;
  const model = source
    ? options.cloneSkinnedObject(source.scene)
    : npc.npcType === 'character_vendor'
      ? options.createFallbackCharacter(THREE, catalogItem)
      : undefined;
  if (!model) return undefined;
  const object = new THREE.Group();
  object.name = `world-npc-${npc.id}`;
  object.position.set(npc.position.x, npc.position.y, npc.position.z);
  const authoredFacingY = options.getNpcFacingY?.(npc);
  if (authoredFacingY !== undefined && Number.isFinite(authoredFacingY)) object.rotation.y = authoredFacingY;
  const isPet = isWorldNpcRoamingPet(npc);
  const targetHeight = npc.npcType === 'character_vendor'
    ? options.characterHeight
    : options.characterHeight * 0.42;
  const npcGroundOffset = options.getNpcGroundOffset?.(npc) ?? 0;
  const getGroundY = (position: { x: number; z: number }) => (
    options.getNpcGroundY?.(position) ?? options.groundY
  );
  const npcGroundY = getGroundY({ x: npc.position.x, z: npc.position.z });
  const mount = mountWorldCharacterModel(THREE, {
    root: object,
    model,
    targetHeight,
    groundY: npcGroundY + npcGroundOffset,
  });
  const petPresentation = isPet && catalogItem
    ? options.getPetPresentation?.(catalogItem, mount.definition)
    : undefined;
  const visualScale = petPresentation?.modelScale ?? mount.scale;
  if (petPresentation) {
    object.scale.setScalar(visualScale);
    object.position.y = npcGroundY + npcGroundOffset
      + petPresentation.groundOffset;
  }
  object.userData.worldNpcId = npc.id;
  object.userData.worldNpcSceneId = options.sceneId;
  setObjectShadows(object, !isPet || !petPresentation?.hideGroundShadow);
  if (isPet && !petPresentation?.hideGroundShadow) {
    object.add(createGroundShadow(THREE, mount.definition, petPresentation?.groundShadowScaleMultiplier));
  }
  const nameLabel = createWorldNameLabel(
    THREE,
    npc.name,
    options.showNames,
    petPresentation?.nameLabelScaleMultiplier ?? WORLD_NAME_LABEL_DEFAULT_SCALE_MULTIPLIER,
    visualScale,
  );
  if (nameLabel) {
    nameLabel.position.y = getWorldNameLabelY(mount.definition.size.y, visualScale);
    object.add(nameLabel);
  }
  const characterAnimation = npc.npcType === 'character_vendor'
    ? getCharacterNpcAnimation(source?.animations.map((clip) => clip.name) ?? [])
    : undefined;
  const preferredAnimationName = characterAnimation?.animationName ?? 'Idle';
  if (npc.npcType === 'character_vendor' && source && characterAnimation?.usedFallback) {
    console.warn(`World NPC ${npc.id} has no Dance animation; using Idle.`);
  }
  const animation = source
    ? isPet
      ? createPetAnimation(THREE, model, source.animations)
      : playLoopingAnimation(THREE, model, source.animations, preferredAnimationName)
    : undefined;
  const radius = isPet
    ? petPresentation?.radius ?? Math.max(0.2, visualScale * 0.45)
    : 0.4;
  const movementSpeedMultiplier = petPresentation?.movementSpeedMultiplier ?? 1;
  const initialPosition = findWorldNpcPetSpawnPosition(options, npc, radius);
  object.position.x = initialPosition.x;
  object.position.z = initialPosition.z;
  const initialPositionChanged = initialPosition.x !== npc.position.x || initialPosition.z !== npc.position.z;
  const initialGroundY = isPet || initialPositionChanged ? getGroundY(initialPosition) : npcGroundY;
  if (petPresentation) {
    object.position.y = initialGroundY + npcGroundOffset + petPresentation.groundOffset;
  }
  return {
    npc,
    object,
    model,
    footNodes: mount.footNodes,
    mixer: animation?.mixer,
    activeAction: animation?.activeAction,
    walkAction: animation?.walkAction,
    danceAction: animation?.danceAction,
    wanderState: isPet
      ? createWanderState(hashWanderSeed(`world-npc:${npc.id}`), { x: 0, z: 1 })
      : undefined,
    paused: false,
    radius,
    groundY: initialGroundY,
    groundOffset: petPresentation?.groundOffset ?? 0,
    movementSpeedMultiplier,
    waitingForDanceCompletion: false,
  };
}

export async function createWorldNpcSceneRuntime(
  options: WorldNpcSceneRuntimeOptions,
): Promise<WorldNpcSceneRuntime> {
  const actors = (await Promise.all(
    options.npcs
      .filter((npc) => npc.sceneId === options.sceneId && npc.isActive)
      .map(async (npc) => createNpcActor(options, npc, findCatalogItem(npc, options.catalog))),
  )).filter((actor): actor is NpcActor => Boolean(actor));
  actors.forEach((actor) => options.scene.add(actor.object));
  const actorForId = (npcId: string) => actors.find((actor) => actor.npc.id === npcId);
  const screenPoint = new options.THREE.Vector3();
  const bounds = new options.THREE.Box3();
  let dialogueNpcId: string | null = null;
  let nearbyNpcId: string | null = null;

  return {
    getNearbyScreenPosition: (playerPosition, camera, canvas) => {
      if (dialogueNpcId) {
        nearbyNpcId = null;
        return null;
      }
      const currentActor = nearbyNpcId ? actorForId(nearbyNpcId) : undefined;
      const currentDistance = currentActor
        ? Math.hypot(currentActor.object.position.x - playerPosition.x, currentActor.object.position.z - playerPosition.z)
        : Number.POSITIVE_INFINITY;
      const selected = currentActor && isWorldNpcNearby(currentDistance, true)
        ? currentActor
        : actors
          .map((actor) => ({
            actor,
            distance: Math.hypot(actor.object.position.x - playerPosition.x, actor.object.position.z - playerPosition.z),
          }))
          .filter(({ distance }) => isWorldNpcNearby(distance, false))
          .sort((left, right) => left.distance - right.distance)[0]?.actor;
      nearbyNpcId = selected?.npc.id ?? null;
      if (!selected) return null;

      const rect = canvas.getBoundingClientRect();
      selected.object.updateMatrixWorld(true);
      bounds.setFromObject(selected.object);
      screenPoint.set(
        selected.object.position.x,
        Math.max(bounds.max.y + 0.22, selected.object.position.y + 0.72),
        selected.object.position.z,
      );
      screenPoint.project(camera);
      if (screenPoint.z < -1 || screenPoint.z > 1 || screenPoint.x < -1 || screenPoint.x > 1 || screenPoint.y < -1 || screenPoint.y > 1) return null;
      return {
        sceneId: options.sceneId as WorldNpcScreenPosition['sceneId'],
        npcId: selected.npc.id,
        npcType: selected.npc.npcType,
        npcName: selected.npc.name,
        x: rect.left + ((screenPoint.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - screenPoint.y) / 2) * rect.height,
        scale: 1,
      };
    },
    setDialogueOpen: (npcId, open) => {
      dialogueNpcId = open ? npcId : null;
      if (open) nearbyNpcId = null;
      actors.forEach((actor) => {
        if (isWorldNpcRoamingPet(actor.npc) && (!npcId || actor.npc.id === npcId)) actor.paused = open;
      });
    },
    update: (delta, now, reducedMotion) => {
      actors.forEach((actor) => {
        actor.mixer?.update(delta * (reducedMotion ? 0.75 : 1));
        if (!isWorldNpcRoamingPet(actor.npc)) {
          // Character vendors use the same animated model grounding as the
          // player. Their Dance/Idle pose can change the lowest foot point,
          // so the mount-time correction alone is not enough.
          groundNpcCharacter(options, actor);
          return;
        }
        if (!actor.wanderState) return;
        if (actor.paused) {
          switchNpcAnimation(actor, actor.danceAction);
          return;
        }
        if (actor.activeAction === actor.danceAction && !isNpcAnimationComplete(actor.danceAction)) {
          // A patrol pause owns the complete Dance clip. Do not let the next
          // steering tick interrupt it halfway through.
          actor.waitingForDanceCompletion = true;
          return;
        }
        actor.waitingForDanceCompletion = false;
        const current = { x: actor.object.position.x, z: actor.object.position.z };
        const step = getWanderStep(
          current,
          delta,
          actor.radius,
          PET_WANDER_SPEED * actor.movementSpeedMultiplier * (reducedMotion ? 0.45 : 1),
          options.wanderObstacles,
          actor.wanderState,
          now,
          undefined,
          options.walkableBoundary,
          options.walkableRadialBoundary,
        );
        const boundedNext = clampWorldNpcRoamingPosition(step.next, actor.npc, actor.radius);
        const next = isWorldNpcPetPositionAvailable(options, actor.npc, boundedNext, actor.radius)
          ? boundedNext
          : current;
        const moved = Math.hypot(next.x - current.x, next.z - current.z);
        const isWalking = step.walking && !step.blocked && moved > 0.0001;
        actor.object.position.x = next.x;
        actor.object.position.z = next.z;
        actor.groundY = options.getNpcGroundY?.(next) ?? options.groundY;
        actor.object.position.y = actor.groundY + actor.groundOffset;
        if (!isWalking && moved <= 0.0001 && (step.next.x !== current.x || step.next.z !== current.z)) {
          actor.wanderState.explorationTarget = null;
          actor.wanderState.nextExploreAt = now;
        }
        const nextAnimation = isWalking ? actor.walkAction : actor.danceAction;
        switchNpcAnimation(actor, nextAnimation);
        if (isWalking) {
          const movement = { x: next.x - current.x, z: next.z - current.z };
          const targetYaw = Math.atan2(movement.x, movement.z);
          const currentYaw = actor.object.rotation.y;
          const yawDelta = Math.atan2(Math.sin(targetYaw - currentYaw), Math.cos(targetYaw - currentYaw));
          actor.object.rotation.y += yawDelta * Math.min(1, delta * 6);
        }
      });
    },
  };
}
