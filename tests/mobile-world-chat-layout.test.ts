import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('mobile world layout has separate portrait and landscape interaction contracts', () => {
  const controls = read('../src/styles/world-controls.css');
  const world = read('../src/styles/world.css');
  const character = read('../src/styles/character.css');
  const runtime = read('../src/features/world/prototype-world-runtime.ts');
  const input = read('../src/features/world/input/world-input-types.ts');
  const overlays = read('../src/styles/overlays.css');

  assert.match(controls, /orientation:\s*landscape/);
  assert.match(controls, /var\(--hh-character-content-left,\s*12px\)/);
  assert.match(controls, /bottom:\s*max\(/);
  assert.match(world, /height:\s*100dvh/);
  assert.match(character, /\.hh-dashboard-screen--child[\s\S]*height:\s*100dvh/);
  assert.match(runtime, /ResizeObserver/);
  assert.match(runtime, /orientationchange/);
  assert.match(input, /viewportWidth/);
  assert.match(overlays, /@media \(orientation:\s*landscape\)[\s\S]*?\.hh-world-social-dock-group[\s\S]*?left:\s*calc\(50% \+ var\(--hh-world-chat-landscape-half-width\)/);
  assert.match(character, /@media \(orientation:\s*landscape\)[\s\S]*?data-active-menu="backpack"[\s\S]*?gap:\s*0/);
});

test('world chat is only docked for a visited friend world and supports own-world friend chat', () => {
  const character = read('../src/styles/character.css');
  const social = read('../src/features/world-social/WorldSocialLayer.tsx');
  const dock = read('../src/features/world-chat/components/WorldChatDock.tsx');
  const friendList = read('../src/features/friends/components/FriendListSheet.tsx');
  const friendDock = read('../src/features/friends/components/FriendDock.tsx');
  const overlays = read('../src/styles/overlays.css');

  assert.match(social, /<WorldChatDock/);
  assert.match(social, /showWorldChatDock/);
  assert.match(social, /friends\.friends\.length > 0/);
  assert.match(social, /onChat=/);
  assert.match(social, /unreadChatCount=\{ownWorldChat\.unreadCount\}/);
  assert.match(dock, /hh-world-chat-dock-message/);
  assert.match(dock, /hh-world-chat-dock-toggle/);
  assert.match(dock, /is-collapsed/);
  assert.match(friendList, /onChat\?:/);
  assert.match(friendDock, /unreadChatCount/);
  assert.match(overlays, /orientation:\s*portrait/);
  assert.match(overlays, /orientation:\s*landscape/);
  assert.match(overlays, /nth-last-child\(n \+ 5\)/);
  assert.match(overlays, /max-height:\s*calc\(1\.45em \* 6\)/);
  assert.doesNotMatch(dock, /hh-world-chat-dock[^\n]*backdrop-blur/);
  assert.match(dock, /text-\[10px\]/);
  assert.doesNotMatch(dock, /未讀/);
  assert.match(overlays, /\.hh-world-chat-dock\s*\{[\s\S]*?left:\s*50%[\s\S]*?transform:\s*translateX\(-50%\)/);
  assert.match(overlays, /orientation:\s*landscape[\s\S]*?\.hh-world-chat-dock[\s\S]*?left:\s*50%[\s\S]*?bottom:\s*max\(/);
  assert.match(overlays, /orientation:\s*landscape[\s\S]*?width:\s*min\(var\(--hh-world-chat-landscape-width\),\s*calc\(100vw - var\(--hh-world-landscape-controls-reserved-width\)\)\)/);
  assert.match(character, /max-width:\s*760px[\s\S]*?orientation:\s*landscape[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.doesNotMatch(social, /hh-world-visit-status/);
});
