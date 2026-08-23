export const FRIEND_WORLD_TOPIC_PREFIX = 'friend-world:';

function normalizeOwnerId(value: string): string {
  if (typeof value !== 'string') throw new TypeError('A world owner child profile ID is required.');
  const ownerId = value.trim();
  if (!ownerId || /[\u0000-\u001f\u007f]/u.test(ownerId)) {
    throw new TypeError('A valid world owner child profile ID is required.');
  }
  return ownerId;
}

export function getFriendWorldTopic(worldOwnerChildProfileId: string): string {
  return `${FRIEND_WORLD_TOPIC_PREFIX}${normalizeOwnerId(worldOwnerChildProfileId)}`;
}

export const getPrivateFriendWorldTopic = getFriendWorldTopic;

export function isFriendWorldTopic(topic: unknown): topic is string {
  if (typeof topic !== 'string' || !topic.startsWith(FRIEND_WORLD_TOPIC_PREFIX)) return false;
  const ownerId = topic.slice(FRIEND_WORLD_TOPIC_PREFIX.length);
  return ownerId.length > 0 && !/[\u0000-\u001f\u007f]/u.test(ownerId);
}

export function getPrivateFriendWorldChannelOptions(worldOwnerChildProfileId: string): {
  topic: string;
  private: true;
} {
  return { topic: getFriendWorldTopic(worldOwnerChildProfileId), private: true };
}
