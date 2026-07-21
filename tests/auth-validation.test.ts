import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateChildPassword,
  validateChildUsername,
  childAccountEmail,
  validateParentLoginCredentials,
  validateParentRegistrationCredentials,
  validatePasswordConfirmation,
} from '../src/lib/auth-validation';

describe('auth validation', () => {
  it('accepts a valid parent registration', () => {
    assert.deepEqual(validateParentRegistrationCredentials('parent@example.com', 'Abcdef12'), { ok: true });
  });

  it('rejects malformed parent registration email', () => {
    assert.deepEqual(validateParentRegistrationCredentials('not-an-email', 'Abcdef12'), {
      ok: false,
      message: '請輸入有效的 Email。',
    });
  });

  it('requires parent registration passwords to be at least eight characters with uppercase and lowercase letters', () => {
    assert.deepEqual(validateParentRegistrationCredentials('parent@example.com', 'abcdef12'), {
      ok: false,
      message: '密碼需至少 8 碼，並包含大小寫英文字母。',
    });
    assert.deepEqual(validateParentRegistrationCredentials('parent@example.com', 'ABCDEF12'), {
      ok: false,
      message: '密碼需至少 8 碼，並包含大小寫英文字母。',
    });
    assert.deepEqual(validateParentRegistrationCredentials('parent@example.com', 'Abc12'), {
      ok: false,
      message: '密碼需至少 8 碼，並包含大小寫英文字母。',
    });
  });

  it('keeps parent login validation limited to email format and non-empty password', () => {
    assert.deepEqual(validateParentLoginCredentials('parent@example.com', 'legacy'), { ok: true });
    assert.deepEqual(validateParentLoginCredentials('not-an-email', 'legacy'), {
      ok: false,
      message: '請輸入有效的 Email。',
    });
    assert.deepEqual(validateParentLoginCredentials('parent@example.com', ''), {
      ok: false,
      message: '請輸入密碼。',
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

  it('validates child account names and normalizes their auth alias', () => {
    assert.deepEqual(validateChildUsername('ab'), { ok: false, message: '小孩帳號需 3–32 碼，只能使用英文字母、數字與底線。' });
    assert.deepEqual(validateChildUsername('Leo-123'), { ok: false, message: '小孩帳號需 3–32 碼，只能使用英文字母、數字與底線。' });
    assert.deepEqual(validateChildUsername(' Leo123 '), { ok: true });
    assert.equal(childAccountEmail(' Leo123 '), 'leo123@children.habithero.local');
  });
});
