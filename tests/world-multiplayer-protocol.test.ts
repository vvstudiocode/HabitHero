import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  AVATAR_STATE_EVENT,
  PROTOCOL_VERSION,
  buildAvatarStatePayload,
  getWorldEventByteLength,
  validateWorldEventEnvelope,
} from '../src/features/world-multiplayer/world-broadcast';
import {
  FRIEND_WORLD_TOPIC_PREFIX,
  getFriendWorldTopic,
  getPrivateFriendWorldChannelOptions,
  isFriendWorldTopic,
} from '../src/features/world-multiplayer/world-topic';

describe('world multiplayer protocol', () => {
  it('waits for an existing topic to be removed before registering presence handlers', () => {
    const source = readFileSync(new URL('../src/features/world-multiplayer/hooks/use-world-multiplayer.ts', import.meta.url), 'utf8');

    assert.match(source, /await client\.removeChannel\(existingChannel\)/);
    assert.match(source, /if \(disposed\) return;/);
  });

  it('builds one deterministic private topic for a world owner', () => {
    assert.equal(getFriendWorldTopic('owner-child-1'), 'friend-world:owner-child-1');
    assert.equal(FRIEND_WORLD_TOPIC_PREFIX, 'friend-world:');
    assert.equal(isFriendWorldTopic('friend-world:owner-child-1'), true);
    assert.equal(isFriendWorldTopic('public-world:owner-child-1'), false);
    assert.deepEqual(getPrivateFriendWorldChannelOptions('owner-child-1'), {
      topic: 'friend-world:owner-child-1',
      private: true,
    });
    assert.throws(() => getFriendWorldTopic('   '), /world owner/i);
  });

  it('uses versioned, bounded, compact avatar state events', () => {
    const payload = buildAvatarStatePayload({
      connectionId: 'connection-1',
      childProfileId: 'child-1',
      seq: 1,
      x: 0.2,
      z: -1.4,
      rotationY: Math.PI / 2,
      motion: 'walk',
      emote: 'none',
      sentAt: 1234,
    });

    assert.deepEqual(payload, {
      v: PROTOCOL_VERSION,
      connectionId: 'connection-1',
      childProfileId: 'child-1',
      seq: 1,
      x: 0.2,
      z: -1.4,
      rotationY: Math.PI / 2,
      motion: 'walk',
      emote: 'none',
      sentAt: 1234,
    });
    assert.equal(getWorldEventByteLength({ event: AVATAR_STATE_EVENT, payload }) < 512, true);
    assert.deepEqual(validateWorldEventEnvelope({ event: AVATAR_STATE_EVENT, payload }), {
      accepted: true,
      payload,
    });
  });

  it('rejects unsupported versions, missing sequence, non-finite and oversized events', () => {
    const base = {
      v: PROTOCOL_VERSION,
      connectionId: 'connection-1',
      childProfileId: 'child-1',
      seq: 1,
      x: 0,
      z: 0,
      rotationY: 0,
      motion: 'idle' as const,
      emote: 'none' as const,
      sentAt: 1234,
    };

    assert.equal(validateWorldEventEnvelope({
      event: AVATAR_STATE_EVENT,
      payload: { ...base, v: PROTOCOL_VERSION + 1 },
    }).accepted, false);
    assert.equal(validateWorldEventEnvelope({
      event: AVATAR_STATE_EVENT,
      payload: { ...base, seq: undefined },
    }).accepted, false);
    assert.equal(validateWorldEventEnvelope({
      event: AVATAR_STATE_EVENT,
      payload: { ...base, x: Number.NaN },
    }).accepted, false);
    assert.equal(validateWorldEventEnvelope({
      event: AVATAR_STATE_EVENT,
      payload: { ...base, z: 4.81 },
    }).accepted, false);
    assert.equal(validateWorldEventEnvelope({
      event: AVATAR_STATE_EVENT,
      payload: { ...base, extra: 'x'.repeat(2100) },
    }).accepted, false);
  });
});
