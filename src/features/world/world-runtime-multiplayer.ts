import type { AnimationAction, AnimationClip, AnimationMixer, Object3D } from 'three';
import type { AvatarBroadcastInput } from '../world-multiplayer/world-broadcast';
import type { AvatarEmote } from '../world-multiplayer/contracts';
import { createRemoteAvatarController, type RemoteAvatarController, type RemoteAvatarRenderState } from '../world-multiplayer/remote-avatar-controller';
import type { RemoteAvatarStateSnapshot } from '../world-multiplayer/remote-avatar-state';
import { getPetAnimationActionClipName, getPetAnimationActionPlayback, type PetAnimationAction } from './pet-animation';
import { groundWorldCharacter, mountWorldCharacterModel } from './world-character-runtime';
import { createInPlaceAnimationClip, getCharacterAnimationClip, getWalkAnimationClip } from './world-runtime-animation';
import {
  getWalkIdlePoseTime,
  PROTOTYPE_WORLD_CONFIG,
} from './world-runtime-geometry';

export type LocalAvatarBroadcastInput = Omit<AvatarBroadcastInput, 'otherMemberCount'>;

export interface WorldRuntimePlayerState {
  now: number;
  x: number;
  z: number;
  rotationY: number;
  motion: 'idle' | 'walk';
  emote: 'none' | 'wave' | 'sit' | 'dance';
}

export interface WorldRuntimeMultiplayer {
  remoteAvatars: readonly RemoteAvatarStateSnapshot[];
  broadcastState: (input: LocalAvatarBroadcastInput) => boolean;
}

export interface WorldRuntimeSession {
  fixedSpawn?: { x: number; z: number };
  multiplayer?: WorldRuntimeMultiplayer;
}

export interface RemoteAvatarRuntimeActor {
  root: Object3D;
  controller: RemoteAvatarController;
  model: Object3D;
  footNodes: Object3D[];
  characterAssetKey?: string;
  characterLoadVersion: number;
  animation?: RemoteAvatarAnimationState;
}

interface RemoteAvatarAnimationState {
  mixer: AnimationMixer;
  idleAction?: AnimationAction;
  walkAction?: AnimationAction;
  actionActions: Partial<Record<Exclude<AvatarEmote, 'none'>, AnimationAction>>;
  activeAction?: AnimationAction;
  activeEmote?: Exclude<AvatarEmote, 'none'>;
}

export interface RemoteAvatarLoadedCharacter {
  model: Object3D;
  animations: readonly AnimationClip[];
}

export function applyFixedSpawnIfChanged(
  root: Object3D,
  requested: { x: number; z: number } | undefined,
  applied: { x: number; z: number } | null,
  reset: () => void,
): { x: number; z: number } | null {
  if (!requested || (applied && requested.x === applied.x && requested.z === applied.z)) return applied;
  root.position.set(requested.x, 0, requested.z);
  reset();
  return { ...requested };
}

type ThreeNamespace = typeof import('three');

export function createRemoteAvatarRuntimeActor(
  THREE: ThreeNamespace,
  createCharacter: (three: ThreeNamespace, characterAssetKey?: string) => Object3D,
  characterAssetKey?: string,
): RemoteAvatarRuntimeActor {
  const root = new THREE.Group();
  root.name = 'remote-avatar';
  const model = createCharacter(THREE, characterAssetKey);
  const actor: RemoteAvatarRuntimeActor = {
    root,
    controller: createRemoteAvatarController(),
    model,
    footNodes: [],
    characterLoadVersion: 0,
  };
  mountRemoteAvatarModel(THREE, actor, model);
  return actor;
}

function mountRemoteAvatarModel(
  THREE: ThreeNamespace,
  actor: RemoteAvatarRuntimeActor,
  model: Object3D,
): void {
  const mount = mountWorldCharacterModel(THREE, {
    root: actor.root,
    model,
    targetHeight: PROTOTYPE_WORLD_CONFIG.characterTargetHeight,
  });
  actor.model = model;
  actor.footNodes = mount.footNodes;
}

function createRemoteAvatarAnimationState(
  THREE: ThreeNamespace,
  model: Object3D,
  animations: readonly AnimationClip[],
): RemoteAvatarAnimationState | undefined {
  if (animations.length === 0) return undefined;
  const mixer = new THREE.AnimationMixer(model);
  const walkClip = getWalkAnimationClip(animations);
  const idleClip = getCharacterAnimationClip(animations, 'idle');
  const walkAction = walkClip ? mixer.clipAction(createInPlaceAnimationClip(walkClip)) : undefined;
  const idleAction = idleClip ? mixer.clipAction(idleClip) : undefined;
  const actionActions: Partial<Record<Exclude<AvatarEmote, 'none'>, AnimationAction>> = {};
  (['sit', 'wave', 'dance'] as const).forEach((actionName: PetAnimationAction) => {
    const clipName = getPetAnimationActionClipName(animations.map((clip) => clip.name), actionName);
    const clip = clipName ? animations.find((candidate) => candidate.name === clipName) : undefined;
    if (!clip) return;
    const action = mixer.clipAction(createInPlaceAnimationClip(clip));
    if (getPetAnimationActionPlayback(actionName) === 'repeat') {
      action.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actionActions[actionName] = action;
  });
  [walkAction, idleAction].forEach((action) => action?.setLoop(THREE.LoopRepeat, Infinity));
  const animation: RemoteAvatarAnimationState = { mixer, walkAction, idleAction, actionActions };
  if (idleAction) {
    idleAction.reset().play();
    animation.activeAction = idleAction;
  } else if (walkAction) {
    walkAction.reset().play();
    walkAction.time = getWalkIdlePoseTime(walkAction.getClip().duration);
    mixer.update(0);
    walkAction.paused = true;
    animation.activeAction = walkAction;
  }
  return animation;
}

function disposeRemoteAvatarAnimation(animation: RemoteAvatarAnimationState | undefined, model: Object3D): void {
  if (!animation) return;
  animation.mixer.stopAllAction();
  animation.mixer.uncacheRoot(model);
}

function updateRemoteAvatarAnimation(actor: RemoteAvatarRuntimeActor, motion: 'idle' | 'walk', emote: AvatarEmote, delta: number): void {
  const animation = actor.animation;
  if (!animation) return;
  const requestedEmote = emote === 'none' ? undefined : emote;
  const emoteAction = requestedEmote ? animation.actionActions[requestedEmote] : undefined;
  if (emoteAction && animation.activeEmote !== requestedEmote) {
    emoteAction.reset().setEffectiveWeight(1).play();
    if (animation.activeAction) emoteAction.crossFadeFrom(animation.activeAction, 0.12, true);
    animation.activeAction = emoteAction;
    animation.activeEmote = requestedEmote;
  }
  if (animation.activeEmote && animation.activeEmote === requestedEmote && emoteAction) {
    emoteAction.paused = false;
    animation.mixer.update(delta);
    return;
  }
  animation.activeEmote = undefined;
  const nextAction = motion === 'walk' ? animation.walkAction ?? animation.idleAction : animation.idleAction ?? animation.walkAction;
  if (nextAction && nextAction !== animation.activeAction) {
    nextAction.reset().setEffectiveWeight(1).play();
    if (animation.activeAction) nextAction.crossFadeFrom(animation.activeAction, 0.12, true);
    animation.activeAction = nextAction;
  }
  if (nextAction) {
    if (motion === 'idle' && !animation.idleAction) {
      nextAction.time = getWalkIdlePoseTime(nextAction.getClip().duration);
      nextAction.paused = true;
    } else {
      nextAction.paused = false;
    }
  }
  animation.mixer.update(delta);
}

export function applyRemoteAvatarRenderState(
  actor: RemoteAvatarRuntimeActor,
  state: RemoteAvatarRenderState,
): void {
  actor.root.visible = state.visible;
  // Preserve the one-time foot calibration. Recomputing a world-space
  // bounding box every frame makes animated rigs' feet move the whole avatar
  // up and down, which is especially visible on remote actors.
  actor.root.position.set(state.x, actor.root.position.y, state.z);
  actor.root.rotation.y = state.rotationY;
  actor.root.rotation.z = state.motion === 'walk' ? Math.sin(Date.now() / 90) * 0.025 : 0;
}

export interface RemoteAvatarRuntimeManager {
  update: (snapshots: readonly RemoteAvatarStateSnapshot[]) => void;
  render: (now: number) => void;
  dispose: () => void;
}

export function createRemoteAvatarRuntimeManager(options: {
  THREE: ThreeNamespace;
  scene: Object3D;
  createCharacter: (three: ThreeNamespace, characterAssetKey?: string) => Object3D;
  loadCharacter?: (characterAssetKey: string) => Promise<RemoteAvatarLoadedCharacter | undefined>;
  disposeRoot: (root: Object3D) => void;
}): RemoteAvatarRuntimeManager {
  const actors = new Map<string, RemoteAvatarRuntimeActor>();
  let disposed = false;
  let lastRenderAt: number | undefined;

  const disposeActor = (connectionId: string, actor: RemoteAvatarRuntimeActor) => {
    actor.characterLoadVersion += 1;
    actor.controller.dispose();
    disposeRemoteAvatarAnimation(actor.animation, actor.model);
    options.scene.remove(actor.root);
    options.disposeRoot(actor.root);
    actors.delete(connectionId);
  };

  const requestCharacter = (connectionId: string, actor: RemoteAvatarRuntimeActor, characterAssetKey: string | undefined) => {
    actor.characterAssetKey = characterAssetKey;
    actor.characterLoadVersion += 1;
    const requestVersion = actor.characterLoadVersion;
    if (!characterAssetKey || !options.loadCharacter) return;
    void options.loadCharacter(characterAssetKey).then((model) => {
      if (!model) return;
      const currentActor = actors.get(connectionId);
      if (disposed || currentActor !== actor || actor.controller.isDisposed() || actor.characterLoadVersion !== requestVersion) {
        options.disposeRoot(model);
        return;
      }
      disposeRemoteAvatarAnimation(actor.animation, actor.model);
      options.disposeRoot(actor.model);
      actor.root.remove(actor.model);
      actor.model = model.model;
      actor.animation = createRemoteAvatarAnimationState(options.THREE, model.model, model.animations);
      mountRemoteAvatarModel(options.THREE, actor, model.model);
    }).catch(() => undefined);
  };

  return {
    update: (snapshots) => {
      if (disposed) return;
      const desired = new Set(snapshots.map((snapshot) => snapshot.connectionId));
      actors.forEach((actor, connectionId) => {
        if (desired.has(connectionId)) return;
        disposeActor(connectionId, actor);
      });
      snapshots.forEach((snapshot) => {
        let actor = actors.get(snapshot.connectionId);
        if (!actor) {
          actor = createRemoteAvatarRuntimeActor(options.THREE, options.createCharacter, snapshot.characterAssetKey);
          actors.set(snapshot.connectionId, actor);
          options.scene.add(actor.root);
        }
        if (snapshot.characterAssetKey !== actor.characterAssetKey) {
          requestCharacter(snapshot.connectionId, actor, snapshot.characterAssetKey);
        }
        actor.controller.ingest(snapshot);
      });
    },
    render: (now) => {
      const delta = lastRenderAt === undefined ? 0 : Math.min(Math.max(now - lastRenderAt, 0) / 1000, 0.05);
      lastRenderAt = now;
      actors.forEach((actor) => {
        const state = actor.controller.update(now);
        if (state) applyRemoteAvatarRenderState(actor, state);
        updateRemoteAvatarAnimation(actor, state?.motion ?? 'idle', state?.emote ?? 'none', delta);
        groundWorldCharacter(options.THREE, {
          root: actor.root,
          model: actor.model,
          footNodes: actor.footNodes,
        });
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      [...actors.entries()].forEach(([connectionId, actor]) => disposeActor(connectionId, actor));
    },
  };
}
