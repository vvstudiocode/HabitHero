import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateChildAccountPayload } from '../src/lib/data-access';
import {
  calculateJoinedDays,
  childProfileRowToViewModel,
  familyRowToViewModel,
  validateChildProfileCreation,
} from '../src/lib/data-contracts';
import type { ChildProfileRow, FamilyRow } from '../src/types';

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

  it('carries child theme overrides without requiring them before subscription features exist', () => {
    const row: ChildProfileRow = {
      id: 'child-1', family_id: 'family-1', profile_id: null, login_name: null,
      display_name: '小明', gender: 'boy', character_id: 'boy-001', joined_at: joinedAt,
      accent_color: '#4E8CFF', background_image_mobile_url: 'https://cdn.test/mobile.png',
      background_image_desktop_url: null, points_balance: 0, created_at: joinedAt, updated_at: joinedAt,
    };

    assert.deepEqual(childProfileRowToViewModel(row).theme, {
      accentColor: '#4E8CFF',
      mobileBackgroundImageUrl: 'https://cdn.test/mobile.png',
      desktopBackgroundImageUrl: null,
    });
  });
});

describe('family theme data contract', () => {
  it('preserves the amber default and future background slots', () => {
    const row: FamilyRow = {
      id: 'family-1', name: '我的家庭', created_by: 'parent-1',
      accent_color: 'amber', background_image_mobile_url: null,
      background_image_desktop_url: 'https://cdn.test/family-desktop.png',
      created_at: joinedAt, updated_at: joinedAt,
    };

    assert.deepEqual(familyRowToViewModel(row).theme, {
      accentColor: 'amber',
      mobileBackgroundImageUrl: null,
      desktopBackgroundImageUrl: 'https://cdn.test/family-desktop.png',
    });
  });
});
