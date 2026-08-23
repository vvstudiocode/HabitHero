import type { Object3D } from 'three';
import type { AvatarBroadcastInput } from '../world-multiplayer/world-broadcast';
import { createRemoteAvatarController, type RemoteAvatarController, type RemoteAvatarRenderState } from '../world-multiplayer/remote-avatar-controller';
import type { RemoteAvatarStateSnapshot } from '../world-multiplayer/remote-avatar-state';

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
  createCharacter: (three: ThreeNamespace) => Object3D,
): RemoteAvatarRuntimeActor {
  const root = new THREE.Group();
  root.name = 'remote-avatar';
  const model = createCharacter(THREE);
  const bounds = new THREE.Box3().setFromObject(model);
  const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
  model.position.y -= bounds.min.y;
  root.scale.setScalar(1.65 / height);
  root.add(model);
  return { root, controller: createRemoteAvatarController() };
}

export function applyRemoteAvatarRenderState(
  actor: RemoteAvatarRuntimeActor,
  state: RemoteAvatarRenderState,
): void {
  actor.root.visible = state.visible;
  actor.root.position.set(state.x, 0, state.z);
  actor.root.rotation.y = state.rotationY;
  actor.root.rotation.z = state.motion === 'walk' ? Math.sin(Date.now() / 90) * 0.025 : 0;
}

export interface RemoteAvatarRuntimeManager {
  update: (snapshots: readonly RemoteAvatarStateSnapshot[]) => void;
  render: (now: number) => void;
}

export function createRemoteAvatarRuntimeManager(options: {
  THREE: ThreeNamespace;
  scene: Object3D;
  createCharacter: (three: ThreeNamespace) => Object3D;
  disposeRoot: (root: Object3D) => void;
}): RemoteAvatarRuntimeManager {
  const actors = new Map<string, RemoteAvatarRuntimeActor>();
  return {
    update: (snapshots) => {
      const desired = new Set(snapshots.map((snapshot) => snapshot.connectionId));
      actors.forEach((actor, connectionId) => {
        if (desired.has(connectionId)) return;
        actor.controller.dispose();
        options.scene.remove(actor.root);
        options.disposeRoot(actor.root);
        actors.delete(connectionId);
      });
      snapshots.forEach((snapshot) => {
        let actor = actors.get(snapshot.connectionId);
        if (!actor) {
          actor = createRemoteAvatarRuntimeActor(options.THREE, options.createCharacter);
          actors.set(snapshot.connectionId, actor);
          options.scene.add(actor.root);
        }
        actor.controller.ingest(snapshot);
      });
    },
    render: (now) => {
      actors.forEach((actor) => {
        const state = actor.controller.update(now);
        if (state) applyRemoteAvatarRenderState(actor, state);
      });
    },
  };
}
