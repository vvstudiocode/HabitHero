import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('family switching dialogs use an enter animation and remain keyboard-safe', () => {
  const picker = read('../src/components/FamilyChildPicker.tsx');
  const unlock = read('../src/components/ParentUnlockModal.tsx');
  const styles = read('../src/index.css');

  assert.match(picker, /hh-modal-panel/);
  assert.match(unlock, /hh-modal-panel/);
  assert.match(styles, /hh-modal-enter/);
  assert.match(styles, /max-height: calc\(100dvh - 32px\)/);
});

test('today goal form no longer renders template shortcut buttons', () => {
  const source = read('../src/features/growth/components/GoalProposalForm.tsx');

  assert.doesNotMatch(source, /templates\.slice\(0, 8\)/);
  assert.doesNotMatch(source, /template\.name/);
});

test('parent review items are removed immediately after a successful action', () => {
  const source = read('../src/features/growth/components/GoalReviewPanel.tsx');

  assert.match(source, /resolvedProposalIds/);
  assert.match(source, /resolvedCompletionIds/);
  assert.match(source, /setResolvedProposalIds/);
  assert.match(source, /setResolvedCompletionIds/);
});

test('child goals are separated into self-created and parent-given sections', () => {
  const source = read('../src/components/ChildDashboard.tsx');

  assert.match(source, /const childGoalTasks = todoTasks\.filter\(task => task\.origin === 'child_proposed'\)/);
  assert.match(source, /const parentGoalTasks = todoTasks\.filter\(task => task\.origin !== 'child_proposed'\)/);
  assert.match(source, /goalCopy\.child\.parentTitle/);
  assert.match(source, /parentGoalTasks\.map/);
});
