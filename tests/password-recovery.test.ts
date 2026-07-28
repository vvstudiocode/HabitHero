import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPasswordRecoveryRedirectUrl,
  validateParentResetPassword,
} from '../src/lib/auth-validation';
import { isPublicAuthView } from '../src/lib/view-access';

test('password recovery redirect stays on the current app origin', () => {
  assert.equal(
    getPasswordRecoveryRedirectUrl('https://habit-hero-gilt.vercel.app'),
    'https://habit-hero-gilt.vercel.app',
  );
  assert.equal(
    getPasswordRecoveryRedirectUrl('http://localhost:3000/'),
    'http://localhost:3000',
  );
});

test('parent reset password uses the same strong password policy as signup', () => {
  assert.equal(validateParentResetPassword('short').ok, false);
  assert.equal(validateParentResetPassword('lowercase8').ok, false);
  assert.equal(validateParentResetPassword('Uppercase8').ok, true);
});

test('password recovery views remain available before a session exists', () => {
  assert.equal(isPublicAuthView('forgotPassword'), true);
  assert.equal(isPublicAuthView('resetPassword'), true);
  assert.equal(isPublicAuthView('login'), true);
  assert.equal(isPublicAuthView('parentDashboard'), false);
});
