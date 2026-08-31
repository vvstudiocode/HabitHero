import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('initial loading view gives the HabitHero title a dedicated larger style', () => {
  const appSource = read('../src/App.tsx');
  const loginStyles = read('../src/styles/login.css');

  assert.match(appSource, /className="hh-loading-title text-lg/);
  assert.match(loginStyles, /\.hh-loading-title\s*\{[\s\S]*?font-size:\s*clamp\(/);
});

test('background notification uses the same green switch colors as background music', () => {
  const modalStyles = read('../src/styles/modals.css');

  assert.match(modalStyles, /\.hh-notification-toggle-track\s*\{[\s\S]*?background:\s*#d7e4d6;/);
  assert.match(modalStyles, /\.hh-notification-toggle\.is-on\s+\.hh-notification-toggle-track\s*\{[\s\S]*?background:\s*#5b9c69;/);
});

test('parent login keeps password recovery below signup as one vertical action group', () => {
  const login = read('../src/components/AccountLogin.tsx');
  const loginStyles = read('../src/styles/login.css');

  assert.match(login, /className="hh-login-secondary-actions flex flex-col gap-1"/);
  assert.match(login, /hh-login-secondary-actions[\s\S]*onGoSignup[\s\S]*onForgotPassword/);
  assert.match(loginStyles, /\.hh-secondary-button\s*\{[\s\S]*?width:\s*100%;/);
});

test('app login action appears for either revealed login form below the submit action', () => {
  const login = read('../src/components/AccountLogin.tsx');
  const appActionIndex = login.indexOf('已安裝 App？開啟 App 登入');
  const submitIndex = login.indexOf('type="submit"');

  assert.ok(appActionIndex > submitIndex, 'App login action should follow the login submit button');
  assert.match(login, /\{onOpenApp && <button type="button"[\s\S]*已安裝 App？開啟 App 登入/);
  assert.doesNotMatch(login, /mode === 'parent' && onOpenApp && <button[\s\S]*已安裝 App？開啟 App 登入/);
});

test('login entry keeps the title compact and the selected surfaces translucent', () => {
  const loginStyles = read('../src/styles/login.css');
  const dashboardStyles = read('../src/styles/dashboard.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(dashboardStyles, /\.hh-login-copy h1\s*\{[\s\S]*?font-size:\s*clamp\(50px, 11vw, 56px\);/);
  assert.match(loginStyles, /\.hh-login-tabs\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) 40%, transparent\);/);
  assert.match(loginStyles, /\.hh-login-screen--entry \.hh-login-fields\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--hh-neutral-surface\) 40%, transparent\);/);
  assert.match(neutralTheme, /\.hh-bottom-nav\s*\{[\s\S]*?background:\s*var\(--hh-neutral-surface\) !important;/);
  assert.doesNotMatch(neutralTheme, /\.hh-bottom-nav,\s*\.hh-login-tabs\s*\{/);
  assert.doesNotMatch(loginStyles, /\.hh-login-tabs\s*\{[^}]*backdrop-filter:/);
  assert.doesNotMatch(loginStyles, /\.hh-login-screen--entry \.hh-login-fields\s*\{[^}]*backdrop-filter:/);
});
