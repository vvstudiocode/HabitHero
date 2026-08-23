import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { AVATAR_EMOTE_EVENT, AVATAR_STATE_EVENT, createAvatarBroadcastController, type AvatarBroadcastInput } from '../world-broadcast';
import { WORLD_REVISION_EVENT } from '../contracts';
import { flattenPresenceState, getPresenceAdmissionDecision, type PresenceAdmissionDecision, type WorldPresenceMember } from '../world-presence';
import { getFriendWorldTopic } from '../world-topic';
import { createRemoteAvatarStateReceiver, type RemoteAvatarStateSnapshot } from '../remote-avatar-state';

interface WorldMultiplayerOptions {
  client: SupabaseClient | null;
  worldOwnerChildProfileId: string | null;
  childProfileId: string | null;
  enabled?: boolean;
  onWorldRevision?: () => void;
}

export function useWorldMultiplayer({ client, worldOwnerChildProfileId, childProfileId, enabled = true, onWorldRevision }: WorldMultiplayerOptions) {
  const [presenceMembers, setPresenceMembers] = useState<WorldPresenceMember[]>([]);
  const [remoteAvatars, setRemoteAvatars] = useState<RemoteAvatarStateSnapshot[]>([]);
  const [crowded, setCrowded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectionIdRef = useRef<string>(createConnectionId());
  const receiverRef = useRef(createRemoteAvatarStateReceiver());
  const controllerRef = useRef(createAvatarBroadcastController({ connectionId: connectionIdRef.current, childProfileId: childProfileId ?? 'unknown' }));
  const presenceMembersRef = useRef<WorldPresenceMember[]>([]);
  const admissionRef = useRef<PresenceAdmissionDecision>({ accepted: false, shouldUntrack: true, acceptedConnectionIds: [], rejectedConnectionIds: [] });
  const crowdedRef = useRef(false);
  const trackedRef = useRef(false);

  useEffect(() => {
    receiverRef.current.clear();
    controllerRef.current = createAvatarBroadcastController({ connectionId: connectionIdRef.current, childProfileId: childProfileId ?? 'unknown' });
  }, [childProfileId]);

  useEffect(() => {
    if (!enabled || !client || !worldOwnerChildProfileId || !childProfileId) return undefined;
    setCrowded(false);
    crowdedRef.current = false;
    trackedRef.current = false;
    setError(null);
    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let onVisibilityChange: (() => void) | null = null;
    const topic = getFriendWorldTopic(worldOwnerChildProfileId);

    const setupChannel = async () => {
      const existingChannel = client.getChannels().find((candidate) => candidate.topic === `realtime:${topic}`);
      if (existingChannel) await client.removeChannel(existingChannel);
      if (disposed) return;

      await client.realtime.setAuth();
      if (disposed) return;

      channel = client.channel(topic, { config: { private: true } });
      channelRef.current = channel;
      const activeChannel = channel;
      const updatePresence = () => {
        if (!trackedRef.current) return;
        const members = flattenPresenceState(activeChannel.presenceState());
        presenceMembersRef.current = members;
        setPresenceMembers(members);
        const decision = getPresenceAdmissionDecision(members, connectionIdRef.current);
        admissionRef.current = decision;
        crowdedRef.current = decision.shouldUntrack;
        setCrowded(decision.shouldUntrack);
        const acceptedConnections = new Set(decision.acceptedConnectionIds);
        setRemoteAvatars((current) => current.filter((avatar) => acceptedConnections.has(avatar.connectionId)));
        if (decision.shouldUntrack) {
          void activeChannel.untrack();
          void client.removeChannel(activeChannel);
          if (channelRef.current === activeChannel) channelRef.current = null;
        }
      };
      activeChannel.on('presence', { event: 'sync' }, updatePresence);
      activeChannel.on('presence', { event: 'join' }, updatePresence);
      activeChannel.on('presence', { event: 'leave' }, updatePresence);
      activeChannel.on('broadcast', { event: AVATAR_STATE_EVENT }, (payload) => {
        const accepted = receiverRef.current.accept((payload as { payload?: unknown }).payload ?? payload, Date.now());
        if (!accepted.accepted || accepted.state.childProfileId === childProfileId) return;
        const admission = admissionRef.current;
        const member = presenceMembersRef.current.find((candidate) => candidate.connectionId === accepted.state.connectionId);
        if (!member
          || member.childProfileId !== accepted.state.childProfileId
          || !admission.acceptedConnectionIds.includes(accepted.state.connectionId)) return;
        setRemoteAvatars((current) => [...current.filter((avatar) => avatar.connectionId !== accepted.state.connectionId), accepted.state]);
      });
      activeChannel.on('broadcast', { event: AVATAR_EMOTE_EVENT }, () => undefined);
      activeChannel.on('broadcast', { event: WORLD_REVISION_EVENT }, () => onWorldRevision?.());
      activeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          trackedRef.current = true;
          void activeChannel.track({ connectionId: connectionIdRef.current, childProfileId, joinedAt: new Date().toISOString() });
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('多人世界連線目前不穩定。');
      });
      onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          trackedRef.current = false;
          void activeChannel.untrack();
        } else {
          trackedRef.current = true;
          void activeChannel.track({ connectionId: connectionIdRef.current, childProfileId, joinedAt: new Date().toISOString() });
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
    };
    void setupChannel().catch(() => {
      if (!disposed) setError('多人世界連線目前不穩定。');
    });
    return () => {
      disposed = true;
      trackedRef.current = false;
      if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
      receiverRef.current.clear();
      presenceMembersRef.current = [];
      admissionRef.current = { accepted: false, shouldUntrack: true, acceptedConnectionIds: [], rejectedConnectionIds: [] };
      crowdedRef.current = false;
      setRemoteAvatars([]);
      if (channel) {
        void channel.untrack();
        void client.removeChannel(channel);
        if (channelRef.current === channel) channelRef.current = null;
      }
    };
  }, [childProfileId, client, enabled, onWorldRevision, worldOwnerChildProfileId]);

  const broadcastState = useCallback((input: Omit<AvatarBroadcastInput, 'otherMemberCount'>) => {
    const channel = channelRef.current;
    const admission = admissionRef.current;
    if (!channel || crowdedRef.current || !admission.accepted) return false;
    const otherMemberCount = admission.acceptedConnectionIds.filter((id) => id !== connectionIdRef.current).length;
    if (otherMemberCount < 1) return false;
    const result = controllerRef.current.next({ ...input, otherMemberCount });
    if (!result.event) return false;
    void channel.send({ type: 'broadcast', event: AVATAR_STATE_EVENT, payload: result.event });
    return true;
  }, []);

  return { connectionId: connectionIdRef.current, presenceMembers, remoteAvatars, crowded, error, broadcastState };
}

function createConnectionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `connection-${Math.random().toString(36).slice(2)}`;
}
