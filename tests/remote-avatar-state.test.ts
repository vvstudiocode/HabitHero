import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createRemoteAvatarStateReceiver,
  type RemoteAvatarStateSnapshot,
} from '../src/features/world-multiplayer/remote-avatar-state';
import { createRemoteAvatarController } from '../src/features/world-multiplayer/remote-avatar-controller';
import { AVATAR_STATE_EVENT } from '../src/features/world-multiplayer/world-broadcast';

const payload = (overrides: Record<string, unknown> = {}) => ({
  v: 1,
  connectionId: 'connection-1',
  childProfileId: 'child-1',
  seq: 1,
  x: 0,
  z: 0,
  rotationY: 0,
  motion: 'idle',
  emote: 'none',
  characterAssetKey: 'character.arthur',
  sentAt: 0,
  ...overrides,
});

const event = (overrides: Record<string, unknown> = {}) => ({
  event: AVATAR_STATE_EVENT,
  payload: payload(overrides),
});

describe('remote avatar state', () => {
  it('accepts valid state and drops old sequence numbers per connection', () => {
    const receiver = createRemoteAvatarStateReceiver();
    const first = receiver.accept(event(), 0);
    const old = receiver.accept(event({ seq: 1, x: 1 }), 50);
    const next = receiver.accept(event({ seq: 2, x: 1, sentAt: 100 }), 100);

    assert.equal(first.accepted, true);
    assert.equal(old.accepted, false);
    assert.equal(old.reason, 'stale-sequence');
    assert.equal(next.accepted, true);
    assert.equal(next.state?.x, 1);
  });

  it('drops bad versions, non-finite values, out-of-bounds positions and oversized events', () => {
    const receiver = createRemoteAvatarStateReceiver();

    assert.equal(receiver.accept(event({ v: 2 }), 0).reason, 'unsupported-version');
    assert.equal(receiver.accept(event({ seq: 2, x: Number.NaN }), 0).reason, 'non-finite-position');
    assert.equal(receiver.accept(event({ seq: 3, z: 4.81 }), 0).reason, 'out-of-bounds-position');
    assert.equal(receiver.accept({
      event: AVATAR_STATE_EVENT,
      payload: payload({ seq: 4, extra: 'x'.repeat(2100) }),
    }, 0).reason, 'event-too-large');
  });

  it('interpolates accepted states and disposes all controller state', () => {
    const receiver = createRemoteAvatarStateReceiver();
    const controller = createRemoteAvatarController();
    const first = receiver.accept(event(), 0);
    const second = receiver.accept(event({ seq: 2, x: 1, z: 2, sentAt: 100 }), 100);

    assert.equal(first.accepted, true);
    assert.equal(second.accepted, true);
    controller.ingest(first.state as RemoteAvatarStateSnapshot);
    controller.ingest(second.state as RemoteAvatarStateSnapshot);

    assert.deepEqual(controller.update(50), {
      connectionId: 'connection-1',
      childProfileId: 'child-1',
      x: 0.5,
      z: 1,
      rotationY: 0,
      motion: 'idle',
      emote: 'none',
      characterAssetKey: 'character.arthur',
      visible: true,
    });
    assert.equal(controller.update(100)?.x, 1);

    controller.dispose();
    assert.equal(controller.isDisposed(), true);
    assert.equal(controller.update(150), null);
    assert.equal(controller.ingest(second.state as RemoteAvatarStateSnapshot), false);
  });

  it('interpolates rotation over the shortest angular path', () => {
    const receiver = createRemoteAvatarStateReceiver();
    const controller = createRemoteAvatarController();
    const first = receiver.accept(event({ rotationY: (350 * Math.PI) / 180 }), 0);
    const second = receiver.accept(event({ seq: 2, rotationY: (10 * Math.PI) / 180, sentAt: 100 }), 100);

    controller.ingest(first.state as RemoteAvatarStateSnapshot);
    controller.ingest(second.state as RemoteAvatarStateSnapshot);

    assert.ok(Math.abs((controller.update(50)?.rotationY ?? 0) - 2 * Math.PI) < 0.001 || Math.abs(controller.update(50)?.rotationY ?? 0) < 0.001);
  });

  it('briefly predicts walking after a packet gap instead of freezing at the last snapshot', () => {
    const receiver = createRemoteAvatarStateReceiver();
    const controller = createRemoteAvatarController();
    const first = receiver.accept(event({ x: 0, motion: 'walk' }), 0);
    const second = receiver.accept(event({ seq: 2, x: 0.5, motion: 'walk', sentAt: 100 }), 100);

    controller.ingest(first.state as RemoteAvatarStateSnapshot);
    controller.ingest(second.state as RemoteAvatarStateSnapshot);

    const predicted = controller.update(180);
    assert.ok((predicted?.x ?? 0) > 0.5);
    assert.ok((predicted?.x ?? 0) < 1);
  });
});
