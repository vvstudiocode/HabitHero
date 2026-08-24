import type { FriendSummary } from '../friends/contracts';
import type { SharedDecorationRepository } from '../../lib/social-data/shared-decoration-repository';

export async function updateFriendWorldCollaboration(input: {
  repository: SharedDecorationRepository;
  childProfileId: string;
  friend: FriendSummary;
  reloadWorld: () => Promise<void>;
  reloadFriends: () => Promise<void>;
}): Promise<void> {
  await input.repository.setCollaboration(
    input.childProfileId,
    input.friend.childProfileId,
    input.friend.canCollaborateInMyWorld !== true,
  );
  await input.reloadWorld();
  await input.reloadFriends();
}
