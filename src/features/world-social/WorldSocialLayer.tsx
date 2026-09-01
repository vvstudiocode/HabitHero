import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
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
import { enqueueChatBubble, type ChatBubbleEntry } from '../world-chat/chat-bubble-queue';
import { useWorldMultiplayer } from '../world-multiplayer/hooks/use-world-multiplayer';
import { useFriendPresence } from '../friends/hooks/use-friend-presence';
import { useAppStore } from '../../store';
import type { FriendWorldSnapshot } from '../friends/friend-world-snapshot';
import { buildFriendWorldGameData } from '../friends/friend-world-game-data';
import { FRIEND_WORLD_FIXED_SPAWN, getFriendWorldReloadSpawnDecision } from '../friends/friend-world-visit';
import { setWorldSocialSession } from './world-social-session';
import { getEquippedCharacterCatalogItem } from '../world/world-character-loadout';
import { emptyChildGameData } from '../world/contracts';
import { getWorldCapacityMessage } from '../world-multiplayer/world-presence';
import { createSharedDecorationRepository } from '../../lib/social-data/shared-decoration-repository';
import { updateFriendWorldCollaboration } from './world-social-actions';
import { MyWorldDock } from './components/MyWorldDock';
import { DEFAULT_WORLD_LOCATION, type WorldLocation } from '../world/world-location';

interface WorldSocialLayerProps {
  childProfileId: string;
  enabled?: boolean;
  cleanMode?: boolean;
  placementMode?: boolean;
  worldLocation: WorldLocation;
  myWorldReturnLocation?: Exclude<WorldLocation, 'my-world'>;
  leaveFriendWorldRequest?: number;
  onVisitingChange?: (visiting: boolean) => void;
  onWorldLocationChange: (location: WorldLocation) => void;
  worldTransitioning?: boolean;
}

export function WorldSocialLayer({ childProfileId, enabled = true, cleanMode = false, placementMode = false, worldLocation = DEFAULT_WORLD_LOCATION, myWorldReturnLocation = 'sunrise-village', leaveFriendWorldRequest = 0, onVisitingChange, onWorldLocationChange, worldTransitioning = false }: WorldSocialLayerProps) {
  const { role, state, retry } = useAppStore();
  const previewMode = role === 'parent' && !enabled;
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTargetChildProfileId, setChatTargetChildProfileId] = useState(childProfileId);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const previewNoticeCloseButtonRef = useRef<HTMLButtonElement>(null);
  const [worldOwnerChildProfileId, setWorldOwnerChildProfileId] = useState(childProfileId);
  const [snapshot, setSnapshot] = useState<FriendWorldSnapshot | null>(null);
  const [visitError, setVisitError] = useState<string | null>(null);
  const friendshipRepository = useMemo(() => supabase ? createFriendshipRepository(supabase) : null, []);
  const friendWorldRepository = useMemo(() => supabase ? createFriendWorldRepository(supabase) : null, []);
  const sharedDecorationRepository = useMemo(() => supabase ? createSharedDecorationRepository(supabase) : null, []);
  const chatRepository = useMemo(() => supabase ? createWorldChatRepository(supabase) : null, []);
  const friends = useFriends(friendshipRepository, childProfileId, enabled);
  const friendPresence = useFriendPresence({ client: supabase, friendIds: friends.friends.map((friend) => friend.childProfileId), enabled: friendsOpen && enabled });
  const ownWorldChat = useWorldChat(chatRepository, childProfileId, enabled, childProfileId);
  const activeChatOwnerChildProfileId = snapshot?.worldOwnerChildProfileId ?? chatTargetChildProfileId;
  const chat = useWorldChat(chatRepository, activeChatOwnerChildProfileId, enabled && (Boolean(snapshot) || chatOpen), childProfileId);
  const isOwnWorldChat = !snapshot && activeChatOwnerChildProfileId === childProfileId;
  const displayedChat = isOwnWorldChat ? ownWorldChat : chat;
  const [chatBubbles, setChatBubbles] = useState<ChatBubbleEntry[]>([]);
  const bubbledMessageIdRef = useRef<string | null>(null);
  const reloadVisitorWorld = useCallback(async () => {
    if (!friendWorldRepository || worldOwnerChildProfileId === childProfileId) return;
    try {
      const nextSnapshot = await friendWorldRepository.getFriendWorldSnapshot(worldOwnerChildProfileId);
      setSnapshot(nextSnapshot);
    } catch (error) {
      setVisitError('好友世界已更新，但目前無法重新載入。');
      throw error;
    }
  }, [childProfileId, friendWorldRepository, worldOwnerChildProfileId]);
  const reloadOwnWorld = useCallback(() => retry({ recoverWorldMutations: true }), [retry]);
  const localGameData = state.gameDataByChildId[childProfileId];
  const characterAssetKey = getEquippedCharacterCatalogItem(localGameData ?? emptyChildGameData()).assetKey;
  const multiplayer = useWorldMultiplayer({ client: supabase, worldOwnerChildProfileId, childProfileId, characterAssetKey, enabled: enabled && (worldLocation === 'my-world' || Boolean(snapshot)), onWorldRevision: reloadVisitorWorld });
  const worldCapacityNotice = multiplayer.crowded ? getWorldCapacityMessage() : null;
  const socialControlsHidden = cleanMode || placementMode;
  const showWorldChatDock = !socialControlsHidden && (Boolean(snapshot) || friends.friends.length > 0 || multiplayer.remoteAvatars.length > 0 || ownWorldChat.messages.length > 0);

  useEffect(() => {
    setChatBubbles([]);
    bubbledMessageIdRef.current = null;
  }, [worldOwnerChildProfileId]);

  useEffect(() => {
    const message = displayedChat.latestMessage;
    if (!message || message.worldOwnerChildProfileId !== worldOwnerChildProfileId || message.id === bubbledMessageIdRef.current) return;
    bubbledMessageIdRef.current = message.id;
    setChatBubbles((current) => enqueueChatBubble(current, message, Date.now()));
  }, [displayedChat.latestMessage, worldOwnerChildProfileId]);

  useEffect(() => {
    if (!enabled) {
      setWorldSocialSession(null);
      return;
    }
    if (!snapshot && worldLocation !== 'my-world') {
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
      friends: friends.friends,
      chatBubbles,
      friendWorldRepository: friendWorldRepository ?? undefined,
      sharedDecorationRepository: sharedDecorationRepository ?? undefined,
      reloadSnapshot: worldOwnerChildProfileId !== childProfileId ? reloadVisitorWorld : reloadOwnWorld,
    });
  }, [chatBubbles, childProfileId, enabled, friendWorldRepository, friends.friends, multiplayer.broadcastState, multiplayer.remoteAvatars, reloadOwnWorld, reloadVisitorWorld, retry, sharedDecorationRepository, snapshot, worldLocation, worldOwnerChildProfileId]);

  useEffect(() => () => setWorldSocialSession(null), []);

  useEffect(() => {
    if (!previewMode) setPreviewNotice(null);
  }, [previewMode]);

  useEffect(() => {
    if (!previewNotice) return undefined;
    previewNoticeCloseButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewNotice(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [previewNotice]);

  useEffect(() => {
    if (!socialControlsHidden) return;
    setFriendsOpen(false);
    setChatOpen(false);
    setPreviewNotice(null);
  }, [socialControlsHidden]);

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

  const toggleFriendWorldCollaboration = async (friend: FriendSummary) => {
    if (!sharedDecorationRepository) return;
    await updateFriendWorldCollaboration({
      repository: sharedDecorationRepository,
      childProfileId,
      friend,
      reloadWorld: retry,
      reloadFriends: friends.reload,
    });
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
      {!socialControlsHidden && worldCapacityNotice && <div className="hh-toast pointer-events-auto fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-full bg-rose-50 px-6 py-3 text-center text-rose-800 shadow-lg" role="alert" aria-live="assertive">{worldCapacityNotice}</div>}
      {previewNotice && <div className="hh-preview-notice pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="家長預覽提示">
        <section className="hh-preview-notice-card relative w-full max-w-sm rounded-3xl bg-white p-6 pr-16 shadow-2xl">
          <button ref={previewNoticeCloseButtonRef} type="button" className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-500" aria-label="關閉提示" title="關閉" onClick={() => setPreviewNotice(null)}>
            <X size={22} aria-hidden="true" />
          </button>
          <p className="text-center text-lg font-black leading-7 text-indigo-950">{previewNotice}</p>
        </section>
      </div>}
      {!socialControlsHidden && <div className="hh-world-social-dock-group">
        {!snapshot && <MyWorldDock worldLocation={worldLocation} returnLocation={myWorldReturnLocation} transitioning={worldTransitioning} onEnterMyWorld={previewMode ? () => showPreviewNotice() : onWorldLocationChange} />}
        {!socialControlsHidden && <FriendDock friendCount={friends.friends.length} pendingCount={friends.requests.filter((request) => request.direction === 'incoming').length} unreadChatCount={ownWorldChat.unreadCount} onOpen={previewMode ? showPreviewNotice : () => setFriendsOpen(true)} />}
      </div>}
      {!socialControlsHidden && showWorldChatDock && <WorldChatDock messages={snapshot ? chat.messages : ownWorldChat.messages} worldOwnerDisplayName={snapshot?.displayName ?? '我的世界'} onOpen={previewMode ? showPreviewNotice : () => setChatOpen(true)} />}
      {!socialControlsHidden && friendsOpen && enabled && <FriendListSheet code={friends.code} friends={friends.friends} requests={friends.requests} onlineFriendIds={friendPresence.onlineFriendIds} checkedFriendIds={friendPresence.checkedFriendIds} loading={friends.loading} error={friends.error ?? visitError} onClose={() => setFriendsOpen(false)} onSendRequest={async (code) => { await friends.sendRequest(code); }} onAccept={async (id) => { await friends.acceptRequest(id); }} onDecline={async (id) => { await friends.declineRequest(id); }} onVisit={visitFriend} onChat={!snapshot ? openFriendChat : undefined} onRemove={async (id) => { await friends.removeFriend(id); }} onToggleCollaboration={toggleFriendWorldCollaboration} />}
      {!socialControlsHidden && chatOpen && enabled && <WorldChatSheet title={`與${snapshot?.displayName ?? (isOwnWorldChat ? '好友' : friends.friends.find((friend) => friend.childProfileId === activeChatOwnerChildProfileId)?.displayName ?? '好友')}聊天`} messages={displayedChat.messages} loading={displayedChat.loading} sending={displayedChat.sending} error={displayedChat.error} onClose={closeChat} onSend={displayedChat.send} onReport={displayedChat.report} />}
    </>
  );
}
