import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FriendSummary } from '../friends/contracts';
import { FriendDock } from '../friends/components/FriendDock';
import { FriendListSheet } from '../friends/components/FriendListSheet';
import { useFriends } from '../friends/hooks/use-friends';
import { createFriendshipRepository } from '../../lib/social-data/friendship-repository';
import { createFriendWorldRepository } from '../../lib/social-data/friend-world-repository';
import { createWorldChatRepository } from '../../lib/social-data/world-chat-repository';
import { supabase } from '../../lib/supabase';
import { useWorldChat } from '../world-chat/hooks/use-world-chat';
import { WorldChatDock } from '../world-chat/components/WorldChatDock';
import { WorldChatSheet } from '../world-chat/components/WorldChatSheet';
import { useWorldMultiplayer } from '../world-multiplayer/hooks/use-world-multiplayer';
import { useFriendPresence } from '../friends/hooks/use-friend-presence';
import { useAppStore } from '../../store';
import type { FriendWorldSnapshot } from '../friends/friend-world-snapshot';
import { buildFriendWorldGameData } from '../friends/friend-world-game-data';
import { FRIEND_WORLD_FIXED_SPAWN, getFriendWorldReloadSpawnDecision } from '../friends/friend-world-visit';
import { setWorldSocialSession } from './world-social-session';
import { getEquippedCharacterCatalogItem } from '../world/world-character-loadout';
import { emptyChildGameData } from '../world/contracts';

interface WorldSocialLayerProps {
  childProfileId: string;
  enabled?: boolean;
  leaveFriendWorldRequest?: number;
  onVisitingChange?: (visiting: boolean) => void;
}

export function WorldSocialLayer({ childProfileId, enabled = true, leaveFriendWorldRequest = 0, onVisitingChange }: WorldSocialLayerProps) {
  const { role, state } = useAppStore();
  const previewMode = role === 'parent' && !enabled;
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTargetChildProfileId, setChatTargetChildProfileId] = useState(childProfileId);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [worldOwnerChildProfileId, setWorldOwnerChildProfileId] = useState(childProfileId);
  const [snapshot, setSnapshot] = useState<FriendWorldSnapshot | null>(null);
  const [visitError, setVisitError] = useState<string | null>(null);
  const friendshipRepository = useMemo(() => supabase ? createFriendshipRepository(supabase) : null, []);
  const friendWorldRepository = useMemo(() => supabase ? createFriendWorldRepository(supabase) : null, []);
  const chatRepository = useMemo(() => supabase ? createWorldChatRepository(supabase) : null, []);
  const friends = useFriends(friendshipRepository, enabled);
  const friendPresence = useFriendPresence({ client: supabase, friendIds: friends.friends.map((friend) => friend.childProfileId), enabled: friendsOpen && enabled });
  const ownWorldChat = useWorldChat(chatRepository, childProfileId, enabled, childProfileId);
  const activeChatOwnerChildProfileId = snapshot?.worldOwnerChildProfileId ?? chatTargetChildProfileId;
  const chat = useWorldChat(chatRepository, activeChatOwnerChildProfileId, enabled && (Boolean(snapshot) || chatOpen), childProfileId);
  const isOwnWorldChat = !snapshot && activeChatOwnerChildProfileId === childProfileId;
  const displayedChat = isOwnWorldChat ? ownWorldChat : chat;
  const reloadVisitorWorld = useCallback(() => {
    if (!friendWorldRepository || worldOwnerChildProfileId === childProfileId) return;
    void friendWorldRepository.getFriendWorldSnapshot(worldOwnerChildProfileId)
      .then(setSnapshot)
      .catch(() => setVisitError('好友世界已更新，但目前無法重新載入。'));
  }, [childProfileId, friendWorldRepository, worldOwnerChildProfileId]);
  const localGameData = state.gameDataByChildId[childProfileId];
  const characterAssetKey = getEquippedCharacterCatalogItem(localGameData ?? emptyChildGameData()).assetKey;
  const multiplayer = useWorldMultiplayer({ client: supabase, worldOwnerChildProfileId, childProfileId, characterAssetKey, enabled, onWorldRevision: reloadVisitorWorld });
  const showWorldChatDock = Boolean(snapshot) || friends.friends.length > 0 || multiplayer.remoteAvatars.length > 0 || ownWorldChat.messages.length > 0;

  useEffect(() => {
    if (!enabled) {
      setWorldSocialSession(null);
      return;
    }
    const spawn = getFriendWorldReloadSpawnDecision({
      reason: snapshot ? 'enter_friend_world' : 'enter_own_world',
      fixedSpawn: FRIEND_WORLD_FIXED_SPAWN,
    });
    setWorldSocialSession({
      worldOwnerChildProfileId,
      snapshot,
      gameData: snapshot ? buildFriendWorldGameData(snapshot) : undefined,
      fixedSpawn: spawn.position,
      multiplayer,
    });
  }, [childProfileId, enabled, multiplayer.broadcastState, multiplayer.remoteAvatars, snapshot, worldOwnerChildProfileId]);

  useEffect(() => () => setWorldSocialSession(null), []);

  useEffect(() => {
    if (!previewMode) setPreviewNotice(null);
  }, [previewMode]);

  useEffect(() => {
    setChatTargetChildProfileId(childProfileId);
  }, [childProfileId]);

  useEffect(() => {
    onVisitingChange?.(Boolean(snapshot));
  }, [onVisitingChange, snapshot]);

  const showPreviewNotice = () => {
    setPreviewNotice('目前是家長預覽模式；請用小孩帳號登入後，才能使用好友世界與聊天。');
  };

  const closeChat = () => {
    setChatOpen(false);
    if (!snapshot) setChatTargetChildProfileId(childProfileId);
  };

  const leaveFriendWorld = useCallback(() => {
    setSnapshot(null);
    setWorldOwnerChildProfileId(childProfileId);
    setChatTargetChildProfileId(childProfileId);
    setChatOpen(false);
    setFriendsOpen(false);
    setVisitError(null);
  }, [childProfileId]);

  useEffect(() => {
    if (leaveFriendWorldRequest <= 0) return;
    leaveFriendWorld();
  }, [leaveFriendWorld, leaveFriendWorldRequest]);

  const openFriendChat = (friend: FriendSummary) => {
    setChatTargetChildProfileId(friend.childProfileId);
    setFriendsOpen(false);
    setChatOpen(true);
  };

  const visitFriend = async (friend: FriendSummary) => {
    if (!friendWorldRepository) return;
    setVisitError(null);
    try {
      const nextSnapshot = await friendWorldRepository.getFriendWorldSnapshot(friend.childProfileId);
      setSnapshot(nextSnapshot);
      setWorldOwnerChildProfileId(friend.childProfileId);
      setChatTargetChildProfileId(friend.childProfileId);
      setFriendsOpen(false);
    } catch (error) {
      setVisitError(error instanceof Error ? error.message : '好友世界目前無法進入。');
    }
  };

  if (!enabled && !previewMode) return null;
  return (
    <>
      {visitError && <div className="pointer-events-auto fixed left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-800 shadow-lg" role="alert">{visitError}</div>}
      {previewNotice && <div className="pointer-events-auto fixed top-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-black text-indigo-900 shadow-lg" role="status">{previewNotice}</div>}
      <FriendDock friendCount={friends.friends.length} pendingCount={friends.requests.filter((request) => request.direction === 'incoming').length} unreadChatCount={ownWorldChat.unreadCount} onOpen={previewMode ? showPreviewNotice : () => setFriendsOpen(true)} />
      {showWorldChatDock && <WorldChatDock messages={snapshot ? chat.messages : ownWorldChat.messages} worldOwnerDisplayName={snapshot?.displayName ?? '我的世界'} onOpen={previewMode ? showPreviewNotice : () => setChatOpen(true)} />}
      {friendsOpen && enabled && <FriendListSheet code={friends.code} friends={friends.friends} requests={friends.requests} onlineFriendIds={friendPresence.onlineFriendIds} checkedFriendIds={friendPresence.checkedFriendIds} loading={friends.loading} error={friends.error ?? visitError} onClose={() => setFriendsOpen(false)} onSendRequest={async (code) => { await friends.sendRequest(code); }} onAccept={async (id) => { await friends.acceptRequest(id); }} onDecline={async (id) => { await friends.declineRequest(id); }} onVisit={visitFriend} onChat={!snapshot ? openFriendChat : undefined} onRemove={async (id) => { await friends.removeFriend(id); }} />}
      {chatOpen && enabled && <WorldChatSheet title={`與${snapshot?.displayName ?? (isOwnWorldChat ? '好友' : friends.friends.find((friend) => friend.childProfileId === activeChatOwnerChildProfileId)?.displayName ?? '好友')}聊天`} messages={displayedChat.messages} loading={displayedChat.loading} sending={displayedChat.sending} error={displayedChat.error} onClose={closeChat} onSend={displayedChat.send} onReport={displayedChat.report} />}
    </>
  );
}
