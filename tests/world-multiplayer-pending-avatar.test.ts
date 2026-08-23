import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type RemoteAvatarStateSnapshot,
} from '../src/features/world-multiplayer/remote-avatar-state';
import {
  createPendingRemoteAvatarStateBuffer,
  createPendingRemoteAvatarStateQueue,
} from '../src/features/world-multiplayer/pending-remote-avatar-state';

const snapshot = (overrides: Partial<RemoteAvatarStateSnapshot> = {}): RemoteAvatarStateSnapshot => ({
  v: 1,
  connectionId: 'connection-1',
  childProfileId: 'child-1',
  seq: 1,
  x: 0,
  z: 0,
  rotationY: 0,
  motion: 'idle',
  emote: 'none',
  sentAt: 0,
  receivedAt: 10,
  ...overrides,
});

describe('pending remote avatar state', () => {
  it('keeps an avatar broadcast received before presence sync and flushes it once ready', () => {
    const pending = createPendingRemoteAvatarStateQueue();
    const first = snapshot();

    pending.enqueue(first);
    assert.equal(pending.size(), 1);
    assert.deepEqual(pending.flush({ presenceMembers: [], acceptedConnectionIds: [] }), []);
    assert.equal(pending.size(), 1);
    assert.deepEqual(pending.flush({
      presenceMembers: [{ connectionId: first.connectionId, childProfileId: first.childProfileId, joinedAt: 10 }],
      acceptedConnectionIds: [first.connectionId],
    }), [first]);
    assert.equal(pending.size(), 0);
  });

  it('keeps only the newest sequence for each connection during the sync race', () => {
    const pending = createPendingRemoteAvatarStateQueue();
    pending.enqueue(snapshot({ seq: 1, x: 1 }));
    pending.enqueue(snapshot({ seq: 2, x: 2, receivedAt: 20 }));
    pending.enqueue(snapshot({ connectionId: 'connection-2', childProfileId: 'child-2', seq: 1, x: 3 }));

    assert.deepEqual(pending.flush({
      presenceMembers: [
        { connectionId: 'connection-1', childProfileId: 'child-1', joinedAt: 10 },
        { connectionId: 'connection-2', childProfileId: 'child-2', joinedAt: 10 },
      ],
      acceptedConnectionIds: ['connection-1', 'connection-2'],
    }).map((state) => [state.connectionId, state.seq, state.x]), [
      ['connection-1', 2, 2],
      ['connection-2', 1, 3],
    ]);
  });
});
