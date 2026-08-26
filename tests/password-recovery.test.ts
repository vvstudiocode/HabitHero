import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_URL_SCHEME,
  buildAppDeepLink,
  getAuthCallbackParams,
  isPasswordRecoveryCallbackUrl,
} from '../src/lib/auth-deep-link';
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
  assert.equal(
    getPasswordRecoveryRedirectUrl('capacitor://localhost', {
      isNative: true,
      publicWebOrigin: 'https://habit-hero-gilt.vercel.app/',
    }),
    'https://habit-hero-gilt.vercel.app',
  );
});

test('password recovery callback accepts Supabase hash tokens and marks the reset intent', () => {
  const callbackUrl = 'https://habit-hero-gilt.vercel.app/#access_token=access-123&refresh_token=refresh-456&type=recovery&expires_in=3600';
  const params = getAuthCallbackParams(callbackUrl);

  assert.equal(params.type, 'recovery');
  assert.equal(params.accessToken, 'access-123');
  assert.equal(params.refreshToken, 'refresh-456');
  assert.equal(isPasswordRecoveryCallbackUrl(callbackUrl), true);
});

test('password recovery app deep link preserves the recovery token and target screen', () => {
  const callbackUrl = 'https://habit-hero-gilt.vercel.app/#access_token=access-123&refresh_token=refresh-456&type=recovery';
  const appUrl = buildAppDeepLink('reset-password', callbackUrl);
  const appParams = getAuthCallbackParams(appUrl);

  assert.equal(appUrl.startsWith(`${APP_URL_SCHEME}://reset-password`), true);
  assert.equal(appParams.type, 'recovery');
  assert.equal(appParams.accessToken, 'access-123');
  assert.equal(appParams.refreshToken, 'refresh-456');
  assert.equal(isPasswordRecoveryCallbackUrl(appUrl), true);
});

test('password recovery deep link does not copy unrelated query data', () => {
  const callbackUrl = 'https://habit-hero-gilt.vercel.app/?utm_source=mail&next=https%3A%2F%2Fevil.example/#access_token=access-123&refresh_token=refresh-456&type=recovery';
  const appUrl = buildAppDeepLink('reset-password', callbackUrl);

  assert.equal(appUrl.includes('utm_source'), false);
  assert.equal(appUrl.includes('evil.example'), false);
  assert.equal(appUrl.includes('access-123'), true);
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
