import assert from 'node:assert/strict';
import test from 'node:test';
import { PARENT_CONSENT_VERSION, PRIVACY_POLICY_VERSION, parentalConsentChecklist, privacyPolicySections, supportTopics } from '../src/lib/legal-content';

test('legal content has versioned privacy, support, and parental consent sections', () => {
  assert.match(PRIVACY_POLICY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(PARENT_CONSENT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(privacyPolicySections.length >= 4);
  assert.ok(supportTopics.length >= 3);
  assert.ok(parentalConsentChecklist.length >= 3);
  assert.ok(privacyPolicySections.every((section) => section.title && section.paragraphs.length > 0));
});
