import assert from 'node:assert/strict';
import test from 'node:test';
import { updateFriendWorldCollaboration } from '../src/features/world-social/world-social-actions';

test('refreshes the owner world revision before refreshing the friend list', async () => {
  const events: string[] = [];
  const calls: Array<[string, string, boolean]> = [];
  const friend = {
    childProfileId: 'friend-child',
    displayName: 'Friend',
    isOnline: true,
    worldRevision: 7,
    canCollaborateInMyWorld: false,
  };

  await updateFriendWorldCollaboration({
    repository: {
      setCollaboration: async (ownerChildProfileId, collaboratorChildProfileId, canCollaborate) => {
        calls.push([ownerChildProfileId, collaboratorChildProfileId, canCollaborate]);
        events.push('set-collaboration');
      },
    } as never,
    childProfileId: 'owner-child',
    friend,
    reloadWorld: async () => { events.push('reload-world'); },
    reloadFriends: async () => { events.push('reload-friends'); },
  });

  assert.deepEqual(calls, [['owner-child', 'friend-child', true]]);
  assert.deepEqual(events, ['set-collaboration', 'reload-world', 'reload-friends']);
});
