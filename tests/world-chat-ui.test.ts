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
  it('keeps only the newest bubble for an avatar and expires it after four seconds', () => {
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
    assert.equal(BUBBLE_DURATION_MS, 4_000);
    assert.equal(getVisibleChatBubbles(queue, 5_999).length, 1);
    assert.equal(getVisibleChatBubbles(queue, 6_000).length, 0);
  });

  it('exposes an accessible dock, sheet, report action, and reduced-motion bubble classes', async () => {
    const dock = await read('src/features/world-chat/components/WorldChatDock.tsx');
    const sheet = await read('src/features/world-chat/components/WorldChatSheet.tsx');
    const bubble = await read('src/features/world-chat/components/AvatarChatBubble.tsx');
    assert.match(dock, /最新訊息/);
    assert.match(dock, /未讀/);
    assert.match(dock, /aria-label/);
    assert.match(sheet, /role="dialog"/);
    assert.match(sheet, /aria-modal="true"/);
    assert.match(sheet, /onReport/);
    assert.match(sheet, /type="submit"/);
    assert.match(bubble, /prefers-reduced-motion|motion-reduce|reduced-motion/);
    assert.match(bubble, /line-clamp-2/);
  });
});
