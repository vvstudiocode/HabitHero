import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  BUBBLE_DURATION_MS,
  enqueueChatBubble,
  getVisibleChatBubbles,
} from '../src/features/world-chat/chat-bubble-queue';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('world chat UI contract', () => {
  it('keeps only the newest bubble for an avatar and expires it after three seconds', () => {
    const first = {
      id: 'message-1',
      worldOwnerChildProfileId: 'world-1',
      senderChildProfileId: 'sender-1',
      senderDisplayName: '小明',
      body: '第一句',
      status: 'visible' as const,
      createdAt: new Date(1_000).toISOString(),
    };
    const second = { ...first, id: 'message-2', body: '第二句' };
    const queue = enqueueChatBubble(enqueueChatBubble([], first, 1_000), second, 2_000);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].message.body, '第二句');
    assert.equal(BUBBLE_DURATION_MS, 3_000);
    assert.equal(getVisibleChatBubbles(queue, 4_999).length, 1);
    assert.equal(getVisibleChatBubbles(queue, 5_000).length, 0);
  });

  it('exposes an accessible dock, sheet, report action, and reduced-motion bubble classes', async () => {
    const dock = await read('src/features/world-chat/components/WorldChatDock.tsx');
    const sheet = await read('src/features/world-chat/components/WorldChatSheet.tsx');
    const bubble = await read('src/features/world-chat/components/AvatarChatBubble.tsx');
    const overlays = await read('src/styles/overlays.css');
    assert.match(dock, /最新訊息/);
    assert.doesNotMatch(dock, /未讀/);
    assert.match(dock, /aria-label/);
    assert.match(dock, /ChevronDown/);
    assert.match(dock, /aria-expanded/);
    assert.match(dock, /收合聊天摘要|展開聊天摘要/);
    assert.match(dock, /collapsed \?[\s\S]*latest/);
    assert.match(sheet, /role="dialog"/);
    assert.match(sheet, /aria-modal="true"/);
    assert.match(sheet, /scrollTop\s*=\s*.*scrollHeight/);
    assert.doesNotMatch(sheet, /返回/);
    assert.match(sheet, /onReport/);
    assert.match(sheet, /type="submit"/);
    assert.match(sheet, /hh-world-chat-sheet-layer/);
    assert.match(sheet, /<X\s+size=\{22\}/);
    assert.match(sheet, /hh-world-chat-sheet-close/);
    assert.match(sheet, /onClick=\{closeFromBackdrop\}/);
    assert.match(sheet, /onAnimationEnd=\{finishClose\}/);
    assert.doesNotMatch(sheet, /bg-slate-950\/35/);
    assert.match(sheet, /message\.senderDisplayName[\s\S]*?：[\s\S]*?message\.body/);
    assert.match(sheet, /hh-world-chat-message/);
    assert.doesNotMatch(sheet, /hh-world-chat-report[^\"]*min-h-11/);
    assert.match(overlays, /\.hh-world-chat-message\s*\{[\s\S]*?position:\s*relative/);
    assert.match(overlays, /\.hh-world-chat-report\s*\{[\s\S]*?position:\s*absolute[\s\S]*?min-height:\s*var\(--hh-world-chat-report-hit-size\)[\s\S]*?background:\s*transparent/);
    assert.match(overlays, /\.hh-world-chat-message-line\s*\{[\s\S]*?padding-inline-end:\s*var\(--hh-world-chat-report-hit-size\)/);
    assert.match(`${bubble}\n${overlays}`, /prefers-reduced-motion|motion-reduce|reduced-motion/);
    assert.match(bubble, /line-clamp-2/);
    assert.match(bubble, /hh-world-chat-bubble/);
    assert.match(`${bubble}\n${overlays}`, /hh-world-chat-bubble-out|fade-out/);
    assert.doesNotMatch(bubble, /<strong/);
    assert.match(overlays, /\.hh-world-chat-sheet-layer[\s\S]*?background:\s*transparent/);
    assert.match(overlays, /\.hh-world-chat-sheet-layer\.is-leaving[\s\S]*?hh-modal-overlay-out/);
    assert.match(overlays, /\.hh-world-chat-bubble[\s\S]*?background:[^;]*transparent/);
    assert.match(overlays, /\.hh-world-chat-sheet\s*\{[\s\S]*?overflow:\s*hidden[\s\S]*?border-radius:\s*24px[\s\S]*?backdrop-filter:\s*none/);
    assert.match(overlays, /\.hh-world-chat-sheet-header,[\s\S]*?\.hh-world-chat-composer\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) 42%, transparent\)/);
    assert.match(overlays, /\.hh-world-chat-input\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) 48%, transparent\)/);
    assert.match(overlays, /\.hh-world-chat-send\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--hh-primary\) 72%, transparent\)/);
  });

  it('wires new chat messages to avatar bubbles and projects every avatar to the viewport', async () => {
    const hook = await read('src/features/world-chat/hooks/use-world-chat.ts');
    const social = await read('src/features/world-social/WorldSocialLayer.tsx');
    const terrain = await read('src/features/world/TerrainWorldLayer.tsx');
    const runtime = await read('src/features/world/prototype-world-runtime.ts');
    const multiplayer = await read('src/features/world/world-runtime-multiplayer.ts');

    assert.match(hook, /latestMessage/);
    assert.match(social, /enqueueChatBubble/);
    assert.match(social, /chatBubbles/);
    assert.match(terrain, /AvatarChatBubble/);
    assert.match(terrain, /getVisibleChatBubbles/);
    assert.match(runtime, /onAvatarScreenPositionsChange/);
    assert.match(multiplayer, /getScreenPositions/);
  });
});
