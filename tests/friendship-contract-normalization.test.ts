import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFriendshipRepository } from '../src/lib/social-data/friendship-repository';

describe('friend collaboration capability normalization', () => {
  it('reads the server capability flag and defaults missing legacy fields to false', async () => {
    const client = {
      rpc: async (name: string) => {
        if (name === 'list_my_friends') {
          return {
            data: [
              { child_profile_id: 'friend-a', display_name: '小華', is_online: true, world_revision: 3, can_collaborate_in_my_world: true },
              { child_profile_id: 'friend-b', display_name: '小美', is_online: false, world_revision: 4 },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      },
    };

    const friends = await createFriendshipRepository(client as never).listFriends();
    assert.equal(friends[0]?.canCollaborateInMyWorld, true);
    assert.equal(friends[1]?.canCollaborateInMyWorld, false);
  });
});
