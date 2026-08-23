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
import { FriendWorldViewer } from '../friends/components/FriendWorldViewer';
import { createCoopAdventureRepository } from '../../lib/social-data/coop-adventure-repository';
import { useCoopAdventures } from '../co-op-adventures/hooks/use-coop-adventures';
import { useAppStore } from '../../store';
import { CoopAdventureCard } from '../co-op-adventures/components/CoopAdventureCard';
import { CoopCompletionSummary } from '../co-op-adventures/components/CoopCompletionSummary';
import { buildCoopCompletionSummary } from '../co-op-adventures/coop-adventure-state';
import type { FriendWorldSnapshot } from '../friends/friend-world-snapshot';
import { buildFriendWorldGameData } from '../friends/friend-world-game-data';
import { FRIEND_WORLD_FIXED_SPAWN, getFriendWorldReloadSpawnDecision } from '../friends/friend-world-visit';
import { setWorldSocialSession } from './world-social-session';

interface WorldSocialLayerProps {
  childProfileId: string;
  enabled?: boolean;
  generalTaskId?: string;
}

export function WorldSocialLayer({ childProfileId, enabled = true, generalTaskId }: WorldSocialLayerProps) {
  const { role } = useAppStore();
  const previewMode = role === 'parent' && !enabled;
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [worldOwnerChildProfileId, setWorldOwnerChildProfileId] = useState(childProfileId);
  const [snapshot, setSnapshot] = useState<FriendWorldSnapshot | null>(null);
  const [visitError, setVisitError] = useState<string | null>(null);
  const friendshipRepository = useMemo(() => supabase ? createFriendshipRepository(supabase) : null, []);
  const friendWorldRepository = useMemo(() => supabase ? createFriendWorldRepository(supabase) : null, []);
  const chatRepository = useMemo(() => supabase ? createWorldChatRepository(supabase) : null, []);
  const coopRepository = useMemo(() => supabase ? createCoopAdventureRepository(supabase) : null, []);
  const friends = useFriends(friendshipRepository, enabled);
  const chat = useWorldChat(chatRepository, worldOwnerChildProfileId, enabled, childProfileId);
  const coop = useCoopAdventures(coopRepository, worldOwnerChildProfileId, enabled);
  const reloadVisitorWorld = useCallback(() => {
    if (!friendWorldRepository || worldOwnerChildProfileId === childProfileId) return;
    void friendWorldRepository.getFriendWorldSnapshot(worldOwnerChildProfileId)
      .then(setSnapshot)
      .catch(() => setVisitError('好友世界已更新，但目前無法重新載入。'));
  }, [childProfileId, friendWorldRepository, worldOwnerChildProfileId]);
  const multiplayer = useWorldMultiplayer({ client: supabase, worldOwnerChildProfileId, childProfileId, enabled, onWorldRevision: reloadVisitorWorld });

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

  const showPreviewNotice = () => {
    setPreviewNotice('目前是家長預覽模式；請用小孩帳號登入後，才能使用好友世界與聊天。');
  };

  const visitFriend = async (friend: FriendSummary) => {
    if (!friendWorldRepository) return;
    setVisitError(null);
    try {
      const nextSnapshot = await friendWorldRepository.getFriendWorldSnapshot(friend.childProfileId);
      setSnapshot(nextSnapshot);
      setWorldOwnerChildProfileId(friend.childProfileId);
      setFriendsOpen(false);
    } catch (error) {
      setVisitError(error instanceof Error ? error.message : '好友世界目前無法進入。');
    }
  };

  const coopSummary = coop.adventures[0] ? buildCoopCompletionSummary(coop, coop.adventures[0].id) : null;
  const currentParticipant = coop.participants.find((participant) => participant.childProfileId === childProfileId);
  const submitOwnCompletion = async () => {
    if (!currentParticipant) return;
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') throw new Error('目前裝置無法建立完成識別碼。');
    await coop.submitCompletion(currentParticipant.id, { idempotencyKey: crypto.randomUUID() });
    await coop.reload();
  };

  if (!enabled && !previewMode) return null;
  return (
    <>
      {snapshot && <FriendWorldViewer snapshot={snapshot} onReturn={() => { setSnapshot(null); setWorldOwnerChildProfileId(childProfileId); setVisitError(null); }} />}
      {(multiplayer.crowded || multiplayer.error) && <div className="pointer-events-auto fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-900 shadow" role="status">{multiplayer.error ?? '這個世界目前有點擁擠，稍後再試。'}</div>}
      {enabled && (snapshot || generalTaskId) && <div className="pointer-events-auto fixed right-4 top-24 z-30 w-72 max-w-[calc(100vw-2rem)]"><CoopAdventureCard adventure={coop.adventures[0]} loading={coop.loading} error={coop.error} onJoin={snapshot ? coop.join : undefined} onCreate={generalTaskId ? () => coop.createFromTask(generalTaskId).then(() => coop.reload()).then(() => undefined) : undefined} />{coopSummary && <CoopCompletionSummary summary={coopSummary} loading={coop.loading} error={coop.error} currentParticipantId={currentParticipant?.id} onSubmit={currentParticipant ? submitOwnCompletion : undefined} />}</div>}
      {(snapshot || visitError) && <div className="pointer-events-auto fixed top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-black text-indigo-900 shadow-lg" role="status">{visitError ?? `正在參觀 ${snapshot?.displayName ?? '好友'} 的世界`}<button type="button" className="min-h-11 rounded-lg px-2 text-indigo-600 underline" onClick={() => { setSnapshot(null); setWorldOwnerChildProfileId(childProfileId); setVisitError(null); }}>回到我的世界</button></div>}
      {previewNotice && <div className="pointer-events-auto fixed top-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-black text-indigo-900 shadow-lg" role="status">{previewNotice}</div>}
      <FriendDock friendCount={friends.friends.length} pendingCount={friends.requests.filter((request) => request.direction === 'incoming').length} onOpen={previewMode ? showPreviewNotice : () => setFriendsOpen(true)} />
      <WorldChatDock messages={chat.messages} unreadCount={chat.unreadCount} onOpen={previewMode ? showPreviewNotice : () => { setChatOpen(true); void chat.markRead(chat.messages.at(-1)?.id); }} />
      {friendsOpen && enabled && <FriendListSheet code={friends.code} friends={friends.friends} requests={friends.requests} loading={friends.loading} error={friends.error ?? visitError} onClose={() => setFriendsOpen(false)} onSendRequest={async (code) => { await friends.sendRequest(code); }} onAccept={async (id) => { await friends.acceptRequest(id); }} onDecline={async (id) => { await friends.declineRequest(id); }} onVisit={visitFriend} onRemove={async (id) => { await friends.removeFriend(id); }} />}
      {chatOpen && enabled && <WorldChatSheet messages={chat.messages} loading={chat.loading} sending={chat.sending} error={chat.error} onClose={() => setChatOpen(false)} onBack={() => setChatOpen(false)} onSend={chat.send} onReport={chat.report} />}
    </>
  );
}
