import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AVATAR_KEEPALIVE_INTERVAL_MS,
  AVATAR_POSITION_DELTA_THRESHOLD,
  AVATAR_ROTATION_DELTA_RADIANS,
  MAX_AVATAR_BROADCASTS_PER_SECOND,
  createAvatarBroadcastController,
} from '../src/features/world-multiplayer/world-broadcast';

const input = (overrides: Partial<Parameters<ReturnType<typeof createAvatarBroadcastController>['next']>[0]> = {}) => ({
  now: 0,
  x: 0,
  z: 0,
  rotationY: 0,
  motion: 'idle' as const,
  emote: 'none' as const,
  otherMemberCount: 1,
  ...overrides,
});

describe('world multiplayer avatar throttle', () => {
  it('does not broadcast while the local player is alone', () => {
    const sender = createAvatarBroadcastController({ connectionId: 'connection-1', childProfileId: 'child-1' });

    assert.equal(sender.next(input({ otherMemberCount: 0 })).event, null);
    assert.equal(sender.next(input({ now: 2000, otherMemberCount: 0, x: 2 })).event, null);
  });

  it('limits movement to eight events per second and suppresses tiny changes', () => {
    const sender = createAvatarBroadcastController({ connectionId: 'connection-1', childProfileId: 'child-1' });

    assert.ok(sender.next(input()).event);
    assert.equal(sender.next(input({ now: 100, x: AVATAR_POSITION_DELTA_THRESHOLD })).event, null);
    assert.equal(sender.next(input({ now: 125, x: 0.05, rotationY: AVATAR_ROTATION_DELTA_RADIANS - 0.0001 })).event, null);
    assert.ok(sender.next(input({ now: 125, x: 0.2 })).event);
    assert.equal(MAX_AVATAR_BROADCASTS_PER_SECOND, 8);
    assert.equal(sender.next(input({ now: 200, x: 0.4 })).event, null);
    assert.ok(sender.next(input({ now: 250, x: 0.4 })).event);
  });

  it('sends one final stop state and static keepalives no more often than two seconds', () => {
    const sender = createAvatarBroadcastController({ connectionId: 'connection-1', childProfileId: 'child-1' });

    assert.ok(sender.next(input({ now: 0, motion: 'walk', x: 0.2 })).event);
    assert.ok(sender.next(input({ now: 125, motion: 'idle', x: 0.21 })).event);
    assert.equal(sender.next(input({ now: 125, motion: 'idle', x: 0.21 })).event, null);
    assert.equal(sender.next(input({ now: AVATAR_KEEPALIVE_INTERVAL_MS + 124, motion: 'idle', x: 0.21 })).event, null);
    assert.ok(sender.next(input({ now: AVATAR_KEEPALIVE_INTERVAL_MS + 125, motion: 'idle', x: 0.21 })).event);
  });

  it('changes sequence only for an emitted event and remains compact', () => {
    const sender = createAvatarBroadcastController({ connectionId: 'connection-1', childProfileId: 'child-1' });
    const first = sender.next(input());
    const skipped = sender.next(input({ now: 50, x: 1 }));
    const second = sender.next(input({ now: 125, x: 1 }));

    assert.equal(first.event?.seq, 1);
    assert.equal(skipped.event, null);
    assert.equal(second.event?.seq, 2);
    assert.ok(JSON.stringify(second.event).length < 512);
  });

  it('broadcasts a character change even when the avatar has not moved', () => {
    const sender = createAvatarBroadcastController({ connectionId: 'connection-1', childProfileId: 'child-1' });
    assert.ok(sender.next(input({ characterAssetKey: 'character.arthur' })).event);
    const changed = sender.next(input({ now: 125, characterAssetKey: 'character.elina' }));

    assert.equal(changed.event?.characterAssetKey, 'character.elina');
  });
});
