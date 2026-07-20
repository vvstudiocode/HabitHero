import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateChildPassword,
  validateParentCredentials,
  validatePasswordConfirmation,
} from '../src/lib/auth-validation';

describe('auth validation', () => {
  it('accepts a valid parent registration', () => {
    assert.deepEqual(validateParentCredentials('parent@example.com', 'Abcd12'), { ok: true });
  });

  it('rejects a malformed parent email and short password', () => {
    assert.deepEqual(validateParentCredentials('not-an-email', '123'), {
      ok: false,
      message: '請輸入有效的 Email，密碼至少 6 碼。',
    });
  });

  it('requires child passwords to be at least six alphanumeric characters', () => {
    assert.deepEqual(validateChildPassword('abc12'), { ok: false, message: '小孩密碼需至少 6 碼，且只能使用英文字母與數字。' });
    assert.deepEqual(validateChildPassword('abc123!'), { ok: false, message: '小孩密碼需至少 6 碼，且只能使用英文字母與數字。' });
    assert.deepEqual(validateChildPassword('Abc123'), { ok: true });
  });

  it('rejects blank and mismatched child password confirmation', () => {
    assert.deepEqual(validatePasswordConfirmation('Abc123', ''), { ok: false, message: '請再次輸入相同的小孩密碼。' });
    assert.deepEqual(validatePasswordConfirmation('Abc123', 'Abc124'), { ok: false, message: '兩次輸入的密碼不一致。' });
    assert.deepEqual(validatePasswordConfirmation('Abc123', 'Abc123'), { ok: true });
  });
});
