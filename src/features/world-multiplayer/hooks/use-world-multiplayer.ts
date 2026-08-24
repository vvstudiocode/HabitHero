import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  AVATAR_STATE_EVENT,
  createAvatarBroadcastController,
  type AvatarBroadcastInput,
} from '../world-broadcast';
import { getPresenceAdmissionDecision, type PresenceAdmissionDecision, type WorldPresenceMember } from '../world-presence';
import { getFriendWorldLiveTopic } from '../world-topic';
import { createRemoteAvatarStateReceiver, type RemoteAvatarStateSnapshot } from '../remote-avatar-state';
import { createPendingRemoteAvatarStateBuffer } from '../pending-remote-avatar-state';
import { REMOTE_AVATAR_STALE_AFTER_MS } from '../limits';
import { createWorldMultiplayerChannelManager } from '../world-multiplayer-channel';

interface WorldMultiplayerOptions {
  client: SupabaseClient | null;
  worldOwnerChildProfileId: string | null;
  childProfileId: string | null;
  characterAssetKey?: string | null;
  enabled?: boolean;
  onWorldRevision?: () => void;
}

type LocalAvatarBroadcastInput = Omit<AvatarBroadcastInput, 'otherMemberCount'>;

export function useWorldMultiplayer({ client, worldOwnerChildProfileId, childProfileId, characterAssetKey, enabled = true, onWorldRevision }: WorldMultiplayerOptions) {
  const [presenceMembers, setPresenceMembers] = useState<WorldPresenceMember[]>([]);
  const [remoteAvatars, setRemoteAvatars] = useState<RemoteAvatarStateSnapshot[]>([]);
  const [crowded, setCrowded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectionIdRef = useRef<string>(createConnectionId());
  const receiverRef = useRef(createRemoteAvatarStateReceiver());
  const controllerRef = useRef(createAvatarBroadcastController({ connectionId: connectionIdRef.current, childProfileId: childProfileId ?? 'unknown' }));
  const pendingRemoteAvatarStatesRef = useRef(createPendingRemoteAvatarStateBuffer());
  const latestLocalAvatarInputRef = useRef<LocalAvatarBroadcastInput | null>(null);
  const characterAssetKeyRef = useRef(characterAssetKey);
  const presenceMembersRef = useRef<WorldPresenceMember[]>([]);
  const admissionRef = useRef<PresenceAdmissionDecision>(createEmptyAdmissionDecision());
  const crowdedRef = useRef(false);
  const trackedRef = useRef(false);
  characterAssetKeyRef.current = characterAssetKey;

  useEffect(() => {
    receiverRef.current.clear();
    pendingRemoteAvatarStatesRef.current.clear();
    latestLocalAvatarInputRef.current = null;
    controllerRef.current = createAvatarBroadcastController({ connectionId: connectionIdRef.current, childProfileId: childProfileId ?? 'unknown' });
  }, [childProfileId]);

  const sendAvatarState = useCallback((input: LocalAvatarBroadcastInput, force = false): boolean => {
    const channel = channelRef.current;
    const admission = admissionRef.current;
    if (!channel || !trackedRef.current || crowdedRef.current || !admission.accepted) return false;
    const otherMemberCount = admission.acceptedConnectionIds.filter((id) => id !== connectionIdRef.current).length;
    if (otherMemberCount < 1) return false;
    const result = controllerRef.current.next({
      ...input,
      characterAssetKey: characterAssetKeyRef.current ?? undefined,
      otherMemberCount,
    }, { force });
    if (!result.event) return false;
    void channel.send({ type: 'broadcast', event: AVATAR_STATE_EVENT, payload: result.event });
    return true;
  }, []);

  useEffect(() => {
    if (!enabled || !client || !worldOwnerChildProfileId || !childProfileId) return undefined;
    setCrowded(false);
    crowdedRef.current = false;
    trackedRef.current = false;
    setError(null);
    let staleAvatarTimer: ReturnType<typeof setInterval> | null = null;
    let manager: ReturnType<typeof createWorldMultiplayerChannelManager>;

    const sendLatestAvatarState = () => {
      const latest = latestLocalAvatarInputRef.current;
      if (!latest) return;
      sendAvatarState({ ...latest, now: Date.now() }, true);
    };
    const onPresence = (members: WorldPresenceMember[]) => {
      if (!members.some((member) => member.connectionId === connectionIdRef.current) && members.length > 0) return;
      presenceMembersRef.current = members;
      setPresenceMembers(members);
      const decision = getPresenceAdmissionDecision(members, connectionIdRef.current);
      admissionRef.current = decision;
      crowdedRef.current = decision.shouldUntrack;
      setCrowded(decision.shouldUntrack);
      const acceptedConnections = new Set(decision.acceptedConnectionIds);
      const now = Date.now();
      setRemoteAvatars((current) => current.filter((avatar) => {
        if (acceptedConnections.has(avatar.connectionId)) return true;
        const stillPresent = members.some((member) => member.connectionId === avatar.connectionId);
        return !stillPresent && now - avatar.receivedAt < REMOTE_AVATAR_STALE_AFTER_MS;
      }));
      const pendingStates = pendingRemoteAvatarStatesRef.current.flush({
        presenceMembers: members,
        acceptedConnectionIds: decision.acceptedConnectionIds,
      });
      if (pendingStates.length > 0) {
        setRemoteAvatars((current) => pendingStates.reduce(
          (next, state) => [...next.filter((avatar) => avatar.connectionId !== state.connectionId), state],
          current,
        ));
      }
      if (decision.shouldUntrack) manager.reconnect();
    };
    const onAvatarState = (payload: unknown) => {
      const accepted = receiverRef.current.accept(payload, Date.now());
      if (!accepted.accepted || accepted.state.childProfileId === childProfileId) return;
      const admission = admissionRef.current;
      const member = presenceMembersRef.current.find((candidate) => candidate.connectionId === accepted.state.connectionId);
      if (!member
        || member.childProfileId !== accepted.state.childProfileId
        || !admission.acceptedConnectionIds.includes(accepted.state.connectionId)) {
        pendingRemoteAvatarStatesRef.current.enqueue(accepted.state);
        return;
      }
      setRemoteAvatars((current) => [...current.filter((avatar) => avatar.connectionId !== accepted.state.connectionId), accepted.state]);
    };

    manager = createWorldMultiplayerChannelManager({
      client,
      topic: getFriendWorldLiveTopic(worldOwnerChildProfileId),
      childProfileId,
      connectionId: connectionIdRef.current,
      onChannelChange: (channel) => { channelRef.current = channel; },
      onPresence,
      onAvatarState,
      onAvatarStateRequest: sendLatestAvatarState,
      onWorldRevision: () => onWorldRevision?.(),
      onConnected: () => {
        trackedRef.current = true;
        setError(null);
        sendLatestAvatarState();
      },
      onReconnecting: () => {
        trackedRef.current = false;
        presenceMembersRef.current = [];
        admissionRef.current = createEmptyAdmissionDecision();
        setPresenceMembers([]);
        setError('多人世界正在重新連線。');
      },
    });
    staleAvatarTimer = setInterval(() => {
      const cutoff = Date.now() - REMOTE_AVATAR_STALE_AFTER_MS;
      setRemoteAvatars((current) => {
        const next = current.filter((avatar) => avatar.receivedAt >= cutoff);
        return next.length === current.length ? current : next;
      });
    }, 2000);
    manager.start();
    return () => {
      trackedRef.current = false;
      if (staleAvatarTimer) clearInterval(staleAvatarTimer);
      receiverRef.current.clear();
      pendingRemoteAvatarStatesRef.current.clear();
      latestLocalAvatarInputRef.current = null;
      presenceMembersRef.current = [];
      admissionRef.current = createEmptyAdmissionDecision();
      crowdedRef.current = false;
      setRemoteAvatars([]);
      manager.dispose();
      channelRef.current = null;
    };
  }, [childProfileId, client, enabled, onWorldRevision, sendAvatarState, worldOwnerChildProfileId]);

  const broadcastState = useCallback((input: LocalAvatarBroadcastInput) => {
    latestLocalAvatarInputRef.current = { ...input };
    return sendAvatarState(input);
  }, [sendAvatarState]);

  return {
    connectionId: connectionIdRef.current,
    childProfileId,
    worldOwnerChildProfileId,
    presenceMembers,
    remoteAvatars,
    crowded,
    error,
    broadcastState,
  };
}

function createEmptyAdmissionDecision(): PresenceAdmissionDecision {
  return { accepted: false, shouldUntrack: true, acceptedConnectionIds: [], rejectedConnectionIds: [] };
}

function createConnectionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `connection-${Math.random().toString(36).slice(2)}`;
}
