import assert from 'node:assert/strict';
import test from 'node:test';
import { getAccountDeletionTargets } from '../src/lib/account-deletion';

test('account deletion targets all parent families and unique child auth profiles', () => {
  assert.deepEqual(
    getAccountDeletionTargets('parent-1', [
      { family_id: 'family-a', profile_id: 'child-1' },
      { family_id: 'family-a', profile_id: 'child-1' },
      { family_id: 'family-b', profile_id: 'child-2' },
      { family_id: 'family-b', profile_id: null },
    ]),
    {
      familyIds: ['family-a', 'family-b'],
      childProfileIds: ['child-1', 'child-2'],
      parentProfileId: 'parent-1',
    },
  );
});

