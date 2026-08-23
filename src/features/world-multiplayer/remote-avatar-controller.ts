import { getShortestAngleDistance, normalizeWorldAngle } from './world-broadcast';
import type { AvatarEmote, AvatarMotion } from './contracts';
import type { RemoteAvatarStateSnapshot } from './remote-avatar-state';

export interface RemoteAvatarRenderState {
  connectionId: string;
  childProfileId: string;
  x: number;
  z: number;
  rotationY: number;
  motion: AvatarMotion;
  emote: AvatarEmote;
  visible: boolean;
}

export interface RemoteAvatarController {
  ingest(snapshot: RemoteAvatarStateSnapshot): boolean;
  update(now: number): RemoteAvatarRenderState | null;
  getLatest(): RemoteAvatarStateSnapshot | null;
  dispose(): void;
  isDisposed(): boolean;
}

function interpolateAngle(from: number, to: number, progress: number): number {
  return normalizeWorldAngle(from + getShortestAngleDistance(from, to) * progress);
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toRenderState(
  previous: RemoteAvatarStateSnapshot,
  target: RemoteAvatarStateSnapshot,
  progress: number,
): RemoteAvatarRenderState {
  return {
    connectionId: target.connectionId,
    childProfileId: target.childProfileId,
    x: previous.x + (target.x - previous.x) * progress,
    z: previous.z + (target.z - previous.z) * progress,
    rotationY: interpolateAngle(previous.rotationY, target.rotationY, progress),
    motion: target.motion,
    emote: target.emote,
    visible: true,
  };
}

export function createRemoteAvatarController(): RemoteAvatarController {
  let previous: RemoteAvatarStateSnapshot | null = null;
  let target: RemoteAvatarStateSnapshot | null = null;
  let latestSequence = 0;
  let disposed = false;

  const ingest = (snapshot: RemoteAvatarStateSnapshot): boolean => {
    if (disposed || !Number.isFinite(snapshot.receivedAt) || snapshot.receivedAt < 0 || snapshot.seq <= latestSequence) return false;
    latestSequence = snapshot.seq;
    if (!target) {
      previous = snapshot;
      target = snapshot;
      return true;
    }
    previous = target;
    target = snapshot;
    return true;
  };

  const update = (now: number): RemoteAvatarRenderState | null => {
    if (disposed || !previous || !target || !Number.isFinite(now)) return null;
    if (previous === target || target.receivedAt <= previous.receivedAt) return toRenderState(target, target, 1);
    const progress = clampProgress((now - previous.receivedAt) / (target.receivedAt - previous.receivedAt));
    return toRenderState(previous, target, progress);
  };

  return {
    ingest,
    update,
    getLatest: () => (target ? { ...target } : null),
    dispose: () => {
      disposed = true;
      previous = null;
      target = null;
      latestSequence = 0;
    },
    isDisposed: () => disposed,
  };
}
