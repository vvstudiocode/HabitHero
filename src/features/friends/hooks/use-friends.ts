import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FriendState } from '../contracts';
import { createFriendService, emptyFriendState } from '../friend-service';
import type { FriendshipRepository } from '../../../lib/social-data/friendship-repository';

export function useFriends(repository: FriendshipRepository | null, enabled = true) {
  const [state, setState] = useState<FriendState>(() => ({ ...emptyFriendState(), loading: enabled }));
  const service = useMemo(() => repository ? createFriendService(repository) : null, [repository]);
  const reload = useCallback(async () => {
    if (!service) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    try { setState(await service.load()); } catch { setState((current) => ({ ...current, loading: false, error: '好友資料目前無法取得。' })); }
  }, [service]);
  useEffect(() => { if (enabled) void reload(); }, [enabled, reload]);
  const mutate = useCallback(async (operation: () => Promise<void>) => {
    try { await operation(); await reload(); } catch { setState((current) => ({ ...current, error: '好友操作目前無法完成。' })); }
  }, [reload]);
  return {
    ...state,
    reload,
    sendRequest: (code: string) => mutate(() => service?.sendRequest(code) ?? Promise.resolve()),
    acceptRequest: (id: string) => mutate(() => service?.acceptRequest(id) ?? Promise.resolve()),
    declineRequest: (id: string) => mutate(() => service?.declineRequest(id) ?? Promise.resolve()),
    removeFriend: (id: string) => mutate(() => service?.removeFriend(id) ?? Promise.resolve()),
    blockChild: (id: string) => mutate(() => service?.blockChild(id) ?? Promise.resolve()),
  };
}
