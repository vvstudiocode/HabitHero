import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getFriendOperationMessage } from '../src/lib/social-data/friendship-repository';

const migration = readFileSync(new URL('../supabase/migrations/20260824120000_friendship_realtime.sql', import.meta.url), 'utf8');
const friendsHook = readFileSync(new URL('../src/features/friends/hooks/use-friends.ts', import.meta.url), 'utf8');
const friendSheet = readFileSync(new URL('../src/features/friends/components/FriendListSheet.tsx', import.meta.url), 'utf8');
const socialLayer = readFileSync(new URL('../src/features/world-social/WorldSocialLayer.tsx', import.meta.url), 'utf8');

describe('friendship realtime contracts', () => {
  it('publishes request and friendship changes with complete row identity', () => {
    for (const table of ['child_friend_requests', 'child_friendships']) {
      assert.match(migration, new RegExp(`alter table public\\.${table} replica identity full`, 'i'));
      assert.match(migration, new RegExp(`alter publication supabase_realtime add table public\\.${table}`, 'i'));
    }
  });

  it('connects the friend state hook to realtime and exposes outgoing status', () => {
    assert.match(friendsHook, /useFriendRealtime/);
    assert.match(friendSheet, /已送出的邀請/);
    assert.match(friendSheet, /等待對方接受/);
    assert.doesNotMatch(socialLayer, /friendNotice/);
    assert.doesNotMatch(socialLayer, /收到.*好友邀請/);
  });

  it('translates duplicate relationship states without exposing raw database errors', () => {
    assert.match(migration, /friend request already sent/i);
    assert.match(migration, /friend request received/i);
    assert.match(migration, /already friends/i);
    assert.equal(getFriendOperationMessage('friend request already sent'), '好友邀請已送出，等待對方接受。');
    assert.equal(getFriendOperationMessage('friend request received'), '對方已送出好友邀請，請到待處理邀請接受。');
    assert.equal(getFriendOperationMessage('already friends'), '你們已經是好友。');
    assert.equal(getFriendOperationMessage('unexpected database detail'), '好友操作目前無法完成。');
  });
});
