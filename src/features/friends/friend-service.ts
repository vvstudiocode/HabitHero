import { validateFriendCode } from './friend-code';
import type { FriendRequest, FriendState, FriendSummary } from './contracts';
import type { FriendshipRepository } from '../../lib/social-data/friendship-repository';

export interface FriendService {
  load(): Promise<FriendState>;
  sendRequest(code: string): Promise<void>;
  acceptRequest(requestId: string): Promise<void>;
  declineRequest(requestId: string): Promise<void>;
  removeFriend(childProfileId: string): Promise<void>;
  blockChild(childProfileId: string): Promise<void>;
}

export function createFriendService(repository: FriendshipRepository): FriendService {
  return {
    async load() {
      const [code, friends, requests] = await Promise.all([repository.getMyCode(), repository.listFriends(), repository.listRequests()]);
      return { code, friends, requests, loading: false, error: null };
    },
    async sendRequest(code) {
      const result = validateFriendCode(code);
      if ('reason' in result) throw new Error(result.reason);
      await repository.sendRequest(result.normalized);
    },
    acceptRequest: (requestId) => repository.acceptRequest(requestId),
    declineRequest: (requestId) => repository.declineRequest(requestId),
    removeFriend: (childProfileId) => repository.removeFriend(childProfileId),
    blockChild: (childProfileId) => repository.blockChild(childProfileId),
  };
}

export function emptyFriendState(): FriendState {
  return { code: null, friends: [], requests: [], loading: false, error: null };
}

export function mergeFriendState(state: FriendState, friends: FriendSummary[], requests: FriendRequest[]): FriendState {
  return { ...state, friends, requests, error: null };
}
