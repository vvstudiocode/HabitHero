import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { AVATAR_STATE_EVENT, AVATAR_STATE_REQUEST_EVENT, WORLD_REVISION_EVENT } from './contracts';
import { flattenPresenceState, type WorldPresenceMember } from './world-presence';
import { getWorldReconnectDelay, isRecoverableWorldChannelStatus } from './world-reconnect';

export interface WorldMultiplayerChannelManagerOptions {
  client: SupabaseClient;
  topic: string;
  childProfileId: string;
  connectionId: string;
  onChannelChange: (channel: RealtimeChannel | null) => void;
  onPresence: (members: WorldPresenceMember[]) => void;
  onAvatarState: (payload: unknown) => void;
  onAvatarStateRequest: () => void;
  onWorldRevision: () => void;
  onConnected: () => void;
  onReconnecting: () => void;
}

export interface WorldMultiplayerChannelManager {
  start: () => void;
  reconnect: (immediate?: boolean) => void;
  dispose: () => void;
}

export function createWorldMultiplayerChannelManager(
  options: WorldMultiplayerChannelManagerOptions,
): WorldMultiplayerChannelManager {
  let disposed = false;
  let tracked = false;
  let setupInFlight = false;
  let reconnecting = false;
  let reconnectRequested = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let activeChannel: RealtimeChannel | null = null;
  let releaseChannel: (() => Promise<void>) | null = null;
  let onVisibilityChange: (() => void) | null = null;

  const clearReconnectTimer = () => {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const requestLatestAvatarState = (channel: RealtimeChannel, members: readonly WorldPresenceMember[]) => {
    if (disposed || activeChannel !== channel || !tracked || !members.some((member) => member.connectionId !== options.connectionId)) return;
    void channel.send({
      type: 'broadcast',
      event: AVATAR_STATE_REQUEST_EVENT,
      payload: { connectionId: options.connectionId },
    });
  };

  const notifyPresence = (channel: RealtimeChannel) => {
    const members = flattenPresenceState(channel.presenceState());
    options.onPresence(members);
    requestLatestAvatarState(channel, members);
  };

  const scheduleReconnect = (immediate = false) => {
    if (disposed || reconnectTimer) return;
    if (setupInFlight) {
      reconnectRequested = true;
      return;
    }
    if (document.visibilityState === 'hidden') return;
    const delay = immediate ? 0 : getWorldReconnectDelay(reconnectAttempt++);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void setupChannel();
    }, delay);
  };

  const recoverChannel = (immediate = false) => {
    if (disposed || reconnecting) return;
    reconnecting = true;
    tracked = false;
    options.onReconnecting();
    const release = releaseChannel;
    releaseChannel = null;
    void Promise.resolve(release?.()).finally(() => {
      reconnecting = false;
      scheduleReconnect(immediate);
    });
  };

  const setupChannel = async () => {
    if (disposed || setupInFlight || document.visibilityState === 'hidden') return;
    setupInFlight = true;
    try {
      await options.client.realtime.setAuth();
      if (disposed) return;
      const channel = options.client.channel(options.topic, { config: { private: true } });
      activeChannel = channel;
      options.onChannelChange(channel);
      const isCurrentChannel = () => !disposed && activeChannel === channel;
      let released = false;
      releaseChannel = async () => {
        if (released) return;
        released = true;
        if (activeChannel === channel) {
          activeChannel = null;
          options.onChannelChange(null);
        }
        tracked = false;
        await channel.untrack().catch(() => undefined);
        await options.client.removeChannel(channel).catch(() => undefined);
      };
      channel.on('presence', { event: 'sync' }, () => {
        if (isCurrentChannel() && tracked) notifyPresence(channel);
      });
      channel.on('presence', { event: 'join' }, () => {
        if (isCurrentChannel() && tracked) notifyPresence(channel);
      });
      channel.on('presence', { event: 'leave' }, () => {
        if (isCurrentChannel() && tracked) notifyPresence(channel);
      });
      channel.on('broadcast', { event: AVATAR_STATE_REQUEST_EVENT }, () => {
        if (isCurrentChannel() && tracked) options.onAvatarStateRequest();
      });
      channel.on('broadcast', { event: AVATAR_STATE_EVENT }, (payload) => {
        if (isCurrentChannel()) options.onAvatarState((payload as { payload?: unknown }).payload ?? payload);
      });
      channel.on('broadcast', { event: WORLD_REVISION_EVENT }, () => {
        if (isCurrentChannel()) options.onWorldRevision();
      });
      channel.subscribe((status) => {
        if (!isCurrentChannel()) return;
        if (status === 'SUBSCRIBED') {
          void channel.track({
            connectionId: options.connectionId,
            childProfileId: options.childProfileId,
            joinedAt: new Date().toISOString(),
          }).then((trackStatus) => {
            if (trackStatus !== 'ok') throw new Error(`Presence track failed: ${trackStatus}`);
            if (!isCurrentChannel()) return;
            tracked = true;
            reconnectAttempt = 0;
            notifyPresence(channel);
            options.onConnected();
          }).catch(() => {
            if (isCurrentChannel()) recoverChannel();
          });
        } else if (isRecoverableWorldChannelStatus(status)) {
          recoverChannel();
        }
      });
    } catch {
      if (!disposed) {
        options.onReconnecting();
        scheduleReconnect();
      }
    } finally {
      setupInFlight = false;
      if (reconnectRequested) {
        reconnectRequested = false;
        scheduleReconnect();
      }
    }
  };

  const reconnect = (immediate = false) => {
    if (disposed) return;
    clearReconnectTimer();
    recoverChannel(immediate);
  };

  const start = () => {
    onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        tracked = false;
        void activeChannel?.untrack().catch(() => undefined);
      } else if (!tracked) {
        reconnect(true);
      }
    };
    const onOnline = () => {
      if (document.visibilityState === 'visible') reconnect(true);
    };
    const onFocus = () => {
      if (document.visibilityState === 'visible' && !tracked) reconnect(true);
    };
    const onPageShow = () => {
      if (document.visibilityState === 'visible' && !tracked) reconnect(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    void setupChannel();
    cleanupListeners = () => {
      if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  };

  let cleanupListeners = () => undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    tracked = false;
    clearReconnectTimer();
    cleanupListeners();
    const release = releaseChannel;
    releaseChannel = null;
    void release?.();
  };

  return { start, reconnect, dispose };
}
