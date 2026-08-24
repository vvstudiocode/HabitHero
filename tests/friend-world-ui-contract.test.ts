import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('friend world hides the deferred co-op card and gates return navigation behind the backpack', () => {
  const social = read('../src/features/world-social/WorldSocialLayer.tsx');
  const dashboard = read('../src/components/ChildDashboard.tsx');

  assert.doesNotMatch(social, /<CoopAdventureCard/);
  assert.doesNotMatch(social, /FriendWorldViewer/);
  assert.match(social, /leaveFriendWorldRequest/);
  assert.match(dashboard, /leave-friend-world/);
});

test('a friend entering my world keeps the live chat dock visible', () => {
  const social = read('../src/features/world-social/WorldSocialLayer.tsx');
  const dock = read('../src/features/world-chat/components/WorldChatDock.tsx');

  assert.match(social, /remoteAvatars\.length > 0/);
  assert.match(social, /ownWorldChat\.messages/);
  assert.match(social, /worldOwnerDisplayName/);
  assert.match(dock, /世界聊天/);
});

test('opens own-world chat from the same live message state shown in the dock', () => {
  const social = read('../src/features/world-social/WorldSocialLayer.tsx');

  assert.match(social, /isOwnWorldChat/);
  assert.match(social, /displayedChat/);
  assert.match(social, /displayedChat\.messages/);
});

test('surfaces a Chinese capacity warning without exposing transient connection warnings', () => {
  const social = read('../src/features/world-social/WorldSocialLayer.tsx');

  assert.doesNotMatch(social, /multiplayer\.error/);
  assert.match(social, /multiplayer\.crowded/);
  assert.match(social, /getWorldCapacityMessage/);
});

test('the visiting friend world exposes a leave action under settings', () => {
  const social = read('../src/features/world-social/WorldSocialLayer.tsx');
  const dashboard = read('../src/components/ChildDashboard.tsx');

  assert.match(social, /leaveFriendWorldRequest/);
  assert.match(social, /onVisitingChange/);
  assert.match(dashboard, /leave-friend-world/);
  assert.match(dashboard, /設定[\s\S]*leave-friend-world/);
  assert.match(dashboard, /LogOut[\s\S]*#050505/);
});
