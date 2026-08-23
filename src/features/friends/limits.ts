export const FRIEND_LIMITS = {
  maxFriends: 50,
  maxOutgoingPendingRequests: 20,
  maxIncomingPendingRequests: 20,
} as const;

export function canSendFriendRequest(input: {
  friendCount: number;
  outgoingPending: number;
  incomingPending: number;
}): boolean {
  return input.friendCount < FRIEND_LIMITS.maxFriends
    && input.outgoingPending < FRIEND_LIMITS.maxOutgoingPendingRequests
    && (input.incomingPending < FRIEND_LIMITS.maxIncomingPendingRequests || input.friendCount > 0 || input.outgoingPending > 0);
}

export function canAcceptFriendRequest(input: { friendCount: number; incomingPending: number }): boolean {
  return input.friendCount < FRIEND_LIMITS.maxFriends && input.incomingPending > 0;
}
