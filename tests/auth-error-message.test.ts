import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toChildAccountErrorMessage } from '../src/auth';

describe('child account error messages', () => {
  it('maps duplicate auth aliases to a child account name prompt', () => {
    assert.equal(
      toChildAccountErrorMessage(new Error('A user with this email address has already been registered')),
      '這個小孩帳號名稱已被使用，請換一個。',
    );
    assert.equal(
      toChildAccountErrorMessage(new Error('child account name is already in use')),
      '這個小孩帳號名稱已被使用，請換一個。',
    );
  });

  it('keeps the shared auth fallback for unrelated failures', () => {
    assert.equal(
      toChildAccountErrorMessage(new Error('network request failed')),
      '目前無法連線，請檢查網路後重試。',
    );
  });
});
