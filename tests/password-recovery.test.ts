import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  APP_URL_SCHEME,
  buildAppDeepLink,
  getAppLinkIntent,
  getAuthCallbackParams,
  hasAuthSessionPayload,
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

test('app link intent separates login from password recovery', () => {
  assert.equal(getAppLinkIntent(`${APP_URL_SCHEME}://login`), 'login');
  assert.equal(getAppLinkIntent(`${APP_URL_SCHEME}://reset-password`), 'password-recovery');
  assert.equal(getAppLinkIntent('https://habit-hero-gilt.vercel.app/?type=oauth'), null);
});

test('recovery handoff requires a complete session payload or authorization code', () => {
  assert.equal(hasAuthSessionPayload('com.vvstudiocode.habithero://reset-password#access_token=only'), false);
  assert.equal(hasAuthSessionPayload('com.vvstudiocode.habithero://reset-password#access_token=a&refresh_token=b'), true);
  assert.equal(hasAuthSessionPayload('com.vvstudiocode.habithero://reset-password?code=one-time-code'), true);
});

test('native recovery wiring registers App URL handling and a custom URL scheme', () => {
  const appSource = readFileSync(new URL('../src/lib/app-links.ts', import.meta.url), 'utf8');
  const adapterSource = readFileSync(new URL('../src/auth/adapter.ts', import.meta.url), 'utf8');
  const androidManifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  const iosInfo = readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8');
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies?: Record<string, string> };

  assert.match(appSource, /addListener\(['"]appUrlOpen['"]/);
  assert.match(appSource, /getLaunchUrl\(/);
  assert.match(adapterSource, /resumeAuthSessionFromUrl/);
  assert.match(androidManifest, /android:scheme="com\.vvstudiocode\.habithero"/);
  assert.match(iosInfo, /CFBundleURLTypes/);
  assert.equal(typeof packageJson.dependencies?.['@capacitor/app'], 'string');
});

test('app shell keeps recovery links on the reset screen and exposes safe handoff actions', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const loginSource = readFileSync(new URL('../src/components/AccountLogin.tsx', import.meta.url), 'utf8');
  const recoverySource = readFileSync(new URL('../src/components/PasswordRecovery.tsx', import.meta.url), 'utf8');
  const supabaseSource = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
  const deepLinkSource = readFileSync(new URL('../src/lib/auth-deep-link.ts', import.meta.url), 'utf8');

  assert.match(appSource, /getInitialAuthCallbackUrl/);
  assert.match(appSource, /registerAppLinkListener/);
  assert.match(appSource, /resumeAuthSessionFromUrl/);
  assert.match(appSource, /openAppLink\(['"]reset-password['"]/);
  assert.match(loginSource, /onOpenApp/);
  assert.match(recoverySource, /onOpenApp/);
  assert.match(supabaseSource, /import ['"]\.\/auth-deep-link['"]/);
  assert.match(deepLinkSource, /^const initialAuthCallbackUrl[^\n]*window\.location\.href/m);
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
