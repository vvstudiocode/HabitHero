import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getPresenceAdmissionDecision,
  getPresenceLifecycleDecision,
  selectWorldMembers,
  type WorldPresenceMember,
} from '../src/features/world-multiplayer/world-presence';
import { MAX_WORLD_MEMBERS } from '../src/features/world-multiplayer/limits';

const members: WorldPresenceMember[] = Array.from({ length: 9 }, (_, index) => ({
  connectionId: `connection-${String(index + 1).padStart(2, '0')}`,
  childProfileId: `child-${index + 1}`,
  joinedAt: `2026-08-23T00:00:0${index}.000Z`,
}));

describe('world multiplayer capacity', () => {
  it('allows the local client while the initial presence sync is still empty', () => {
    assert.deepEqual(getPresenceAdmissionDecision([], 'connection-01'), {
      accepted: true,
      shouldUntrack: false,
      acceptedConnectionIds: ['connection-01'],
      rejectedConnectionIds: [],
    });
  });

  it('keeps exactly eight members using joinedAt then connectionId order', () => {
    const selected = selectWorldMembers([...members].reverse());

    assert.equal(MAX_WORLD_MEMBERS, 8);
    assert.deepEqual(selected.accepted.map((member) => member.connectionId), members.slice(0, 8).map((member) => member.connectionId));
    assert.deepEqual(selected.rejected.map((member) => member.connectionId), ['connection-09']);
  });

  it('produces the same admission result for every shuffled race', () => {
    const expected = selectWorldMembers(members).accepted.map((member) => member.connectionId);
    const permutations = [
      [...members].reverse(),
      [members[8], ...members.slice(0, 4), ...members.slice(4, 8)],
      [members[3], members[0], members[7], members[2], members[8], members[1], members[6], members[5], members[4]],
    ];

    for (const permutation of permutations) {
      assert.deepEqual(selectWorldMembers(permutation).accepted.map((member) => member.connectionId), expected);
    }
  });

  it('returns a deterministic untrack decision for a connection outside capacity', () => {
    const decision = getPresenceAdmissionDecision(members, 'connection-09');

    assert.equal(decision.shouldUntrack, true);
    assert.equal(decision.accepted, false);
    assert.deepEqual(decision.acceptedConnectionIds, members.slice(0, 8).map((member) => member.connectionId));
    assert.deepEqual(decision.rejectedConnectionIds, ['connection-09']);
  });

  it('untracks presence while backgrounded without invoking channel lifecycle code', () => {
    assert.deepEqual(getPresenceLifecycleDecision({ isBackgrounded: true }), {
      action: 'untrack',
      shouldBroadcast: false,
    });
    assert.deepEqual(getPresenceLifecycleDecision({ isBackgrounded: false }), {
      action: 'keep',
      shouldBroadcast: true,
    });
  });
});
