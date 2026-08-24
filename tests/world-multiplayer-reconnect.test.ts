import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getWorldReconnectDelay,
  isRecoverableWorldChannelStatus,
  WORLD_RECONNECT_MAX_DELAY_MS,
} from '../src/features/world-multiplayer/world-reconnect';

describe('world multiplayer reconnect policy', () => {
  it('backs off reconnect attempts and applies bounded jitter', () => {
    assert.equal(getWorldReconnectDelay(0, 0), 750);
    assert.equal(getWorldReconnectDelay(1, 1), 2500);
    assert.equal(getWorldReconnectDelay(20, 0.5), WORLD_RECONNECT_MAX_DELAY_MS);
  });

  it('recognizes channel states that need a fresh channel', () => {
    assert.equal(isRecoverableWorldChannelStatus('CHANNEL_ERROR'), true);
    assert.equal(isRecoverableWorldChannelStatus('TIMED_OUT'), true);
    assert.equal(isRecoverableWorldChannelStatus('CLOSED'), true);
    assert.equal(isRecoverableWorldChannelStatus('SUBSCRIBED'), false);
  });
});
