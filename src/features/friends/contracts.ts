export interface FriendSummary {
  childProfileId: string;
  displayName: string;
  isOnline: boolean;
  worldRevision: number;
  canCollaborateInMyWorld?: boolean;
}

export interface FriendRequest {
  id: string;
  direction: 'incoming' | 'outgoing';
  childProfileId: string;
  displayName: string;
  createdAt: string;
}

export interface FriendState {
  code: string | null;
  friends: FriendSummary[];
  requests: FriendRequest[];
  loading: boolean;
  error: string | null;
}
