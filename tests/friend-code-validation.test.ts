import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FRIEND_CODE_LENGTH,
  formatFriendCode,
  normalizeFriendCode,
  validateFriendCode,
} from '../src/features/friends/friend-code';
import {
  FRIEND_LIMITS,
  canAcceptFriendRequest,
  canSendFriendRequest,
} from '../src/features/friends/limits';

describe('friend code validation', () => {
  it('normalizes case, whitespace, separators, and compatibility forms', () => {
    const raw = ' abcd-１２３４ efgh-5678 ijkl-9012 mnop-3456 ';
    assert.equal(normalizeFriendCode(raw), 'ABCD1234EFGH5678IJKL9012MNOP3456');
  });

  it('accepts only a complete high-entropy normalized code', () => {
    const code = 'ABCD1234EFGH5678IJKL9012MNOP3456';
    assert.equal(FRIEND_CODE_LENGTH, 32);
    assert.deepEqual(validateFriendCode(code), { valid: true, normalized: code });
    assert.deepEqual(validateFriendCode(formatFriendCode(code)), { valid: true, normalized: code });
    assert.equal(validateFriendCode('A'.repeat(FRIEND_CODE_LENGTH - 1)).valid, false);
    assert.equal(validateFriendCode('A'.repeat(FRIEND_CODE_LENGTH + 1)).valid, false);
    assert.equal(validateFriendCode('ABCD1234EFGH5678IJKL9012MNOP345!').valid, false);
  });

  it('formats only validated values into UI groups', () => {
    assert.equal(formatFriendCode('abcd1234efgh5678ijkl9012mnop3456'), 'ABCD-1234-EFGH-5678-IJKL-9012-MNOP-3456');
    assert.throws(() => formatFriendCode('not-a-code'), /invalid/i);
  });

  it('keeps friend and pending-request limits enforceable as pure functions', () => {
    assert.deepEqual(FRIEND_LIMITS, {
      maxFriends: 50,
      maxOutgoingPendingRequests: 20,
      maxIncomingPendingRequests: 20,
    });
    assert.equal(canSendFriendRequest({ friendCount: 49, outgoingPending: 19, incomingPending: 20 }), true);
    assert.equal(canSendFriendRequest({ friendCount: 50, outgoingPending: 0, incomingPending: 0 }), false);
    assert.equal(canSendFriendRequest({ friendCount: 0, outgoingPending: 20, incomingPending: 0 }), false);
    assert.equal(canSendFriendRequest({ friendCount: 0, outgoingPending: 0, incomingPending: 20 }), false);
    assert.equal(canAcceptFriendRequest({ friendCount: 49, incomingPending: 1 }), true);
    assert.equal(canAcceptFriendRequest({ friendCount: 50, incomingPending: 1 }), false);
  });
});
