import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('dashboard header reserves space for the device top safe area', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.hh-sprite-theme\s+\.hh-dashboard-screen\s*>\s*header/);
  assert.match(css, /env\(safe-area-inset-top\)/);
});

test('settings drawer and document pages reserve the same top safe area', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(css, /\.hh-settings-drawer[\s\S]*?padding-top:\s*max\(50px,\s*calc\(env\(safe-area-inset-top\) \+ 35px\)\)/);
  assert.match(css, /\.hh-document-header[\s\S]*?padding-top:\s*max\(72px,\s*calc\(env\(safe-area-inset-top,\s*0px\) \+ 35px\)\)/);
});

test('parent signup requires explicit consent before account creation', () => {
  const source = readFileSync(new URL('../src/components/ParentSetup.tsx', import.meta.url), 'utf8');

  assert.match(source, /type="checkbox"/);
  assert.match(source, /consentAccepted/);
  assert.match(source, /ParentConsentModal/);
  assert.doesNotMatch(source, /disabled=\{!email \|\| !password \|\| !consentAccepted/);
  assert.match(source, /if \(!consentAccepted\) \{?\s*setShowConsentModal\(true\)/);
});

test('dashboard opens consent before creating child data', () => {
  const source = readFileSync(new URL('../src/components/ParentDashboard.tsx', import.meta.url), 'utf8');

  assert.match(source, /isCurrentParentConsent\(state\.parentConsentVersion\)/);
  assert.match(source, /setPendingChildAction\('new'\)/);
  assert.match(source, /ParentConsentModal/);
});

test('consent flow opens the privacy policy inside the app', () => {
  const modalSource = readFileSync(new URL('../src/components/ParentConsentModal.tsx', import.meta.url), 'utf8');
  const setupSource = readFileSync(new URL('../src/components/ParentSetup.tsx', import.meta.url), 'utf8');
  const privacyPageSource = readFileSync(new URL('../src/components/ParentPrivacyPolicyPage.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(modalSource, /privacy-policy\.html/);
  assert.doesNotMatch(setupSource, /privacy-policy\.html/);
  assert.match(modalSource, /onOpenPrivacyPolicy/);
  assert.match(setupSource, /setShowPrivacyPolicy\(true\)/);
  assert.match(setupSource, /onClose=\{\(\) => setShowPrivacyPolicy\(false\)\}/);
  assert.match(privacyPageSource, /返回同意視窗/);
  assert.match(privacyPageSource, /privacyPolicySections\.map/);
  assert.match(privacyPageSource, /is-consent-policy/);
});

test('all user-facing support email addresses use the shared address', () => {
  const sourceFiles = [
    '../src/components/ParentSettingsDocuments.tsx',
    '../public/privacy-policy.html',
    '../public/support.html',
    '../public/delete-account.html',
  ];

  for (const sourceFile of sourceFiles) {
    const source = readFileSync(new URL(sourceFile, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /support@habithero\.app/);
    assert.match(source, /vvstudiocode@gmail\.com/);
  }
});
