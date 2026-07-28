import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateChildAccountPayload } from '../src/lib/data-access';
import {
  calculateJoinedDays,
  childProfileRowToViewModel,
  validateChildProfileCreation,
} from '../src/lib/data-contracts';
import type { ChildProfileRow } from '../src/types';

const joinedAt = '2026-07-28T16:00:00.000Z';

describe('child profile creation contract', () => {
  it('requires a supported gender and a non-empty character id', () => {
    assert.equal(validateChildProfileCreation({ gender: 'boy', characterId: 'boy-001' }), null);
    assert.match(
      validateChildProfileCreation({ gender: 'other', characterId: 'boy-001' }) ?? '',
      /gender/i,
    );
    assert.match(
      validateChildProfileCreation({ gender: 'girl', characterId: '' }) ?? '',
      /character/i,
    );
  });

  it('builds the account payload with immutable child identity fields', () => {
    assert.deepEqual(buildCreateChildAccountPayload('family-1', {
      name: '小明',
      loginName: 'xiaoming',
      password: 'secret1',
      gender: 'boy',
      characterId: 'boy-001',
    }), {
      action: 'create',
      familyId: 'family-1',
      childName: '小明',
      loginName: 'xiaoming',
      password: 'secret1',
      gender: 'boy',
      characterId: 'boy-001',
    });
  });
});

describe('child profile view contract', () => {
  it('preserves identity and computes inclusive Taipei calendar days', () => {
    const row: ChildProfileRow = {
      id: 'child-1',
      family_id: 'family-1',
      profile_id: null,
      login_name: null,
      display_name: '小明',
      gender: 'boy',
      character_id: 'boy-001',
      joined_at: joinedAt,
      points_balance: 0,
      created_at: joinedAt,
      updated_at: joinedAt,
    };

    assert.equal(calculateJoinedDays(joinedAt, '2026-07-29T01:00:00.000Z'), 1);
    assert.equal(calculateJoinedDays(joinedAt, '2026-07-30T01:00:00.000Z'), 2);
    assert.equal(childProfileRowToViewModel(row).characterId, 'boy-001');
    assert.equal(childProfileRowToViewModel(row).joinedAt, joinedAt);
  });
});

