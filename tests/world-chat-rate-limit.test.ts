import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHAT_RATE_LIMITS,
  canSendChatMessage,
  pruneChatTimestamps,
} from '../src/features/world-chat/limits';

describe('world chat rate limits', () => {
  it('enforces five messages per ten seconds and thirty per minute', () => {
    assert.deepEqual(CHAT_RATE_LIMITS, {
      shortWindowMs: 10_000,
      shortWindowMax: 5,
      longWindowMs: 60_000,
      longWindowMax: 30,
    });
    const now = 100_000;
    const fiveRecent = Array.from({ length: 5 }, (_, index) => now - index * 1_000);
    assert.equal(canSendChatMessage(fiveRecent, now), false);
    assert.equal(canSendChatMessage(fiveRecent.slice(1), now), true);

    const thirtyRecent = Array.from({ length: 30 }, (_, index) => now - index * 2_200);
    assert.equal(canSendChatMessage(thirtyRecent, now), false);
    assert.equal(canSendChatMessage(thirtyRecent.slice(1), now), true);
  });

  it('does not let stale timestamps consume the current window', () => {
    const now = 100_000;
    const timestamps = [now - 60_001, now - 10_001, now - 9_999, now];
    assert.deepEqual(pruneChatTimestamps(timestamps, now), [now - 9_999, now]);
  });

  it('rejects message content that could become a contact or unsafe control payload', async () => {
    const { validateChatMessageText } = await import('../src/features/world-chat/limits');
    for (const value of [
      'www.example.com',
      'email me at kid@example.org',
      '+886 912 345 678',
      'line\tbreak',
      'zero\u0000byte',
    ]) {
      assert.equal(validateChatMessageText(value).ok, false, value);
    }
  });
});
