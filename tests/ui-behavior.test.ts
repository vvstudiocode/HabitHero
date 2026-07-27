import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('family switching dialogs use an enter animation and remain keyboard-safe', () => {
  const picker = read('../src/components/FamilyChildPicker.tsx');
  const unlock = read('../src/components/ParentUnlockModal.tsx');
  const styles = `${read('../src/styles/base.css')}\n${read('../src/styles/index.css')}`;

  assert.match(picker, /hh-modal-panel/);
  assert.match(unlock, /hh-modal-panel/);
  assert.match(styles, /hh-modal-enter/);
  assert.match(styles, /max-height: calc\(100dvh - 32px\)/);
});

test('parent dashboard reuses shared modal and empty-state primitives', () => {
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const formModal = read('../src/components/parent-dashboard/ParentDashboardFormModal.tsx');
  const sharedUi = read('../src/components/shared/ParentDashboardUI.tsx');

  assert.match(sharedUi, /export function ModalShell/);
  assert.match(sharedUi, /export function EmptyState/);
  assert.match(formModal, /<ModalShell/);
  assert.match(dashboard, /<ModalShell variant="center"/);
  assert.match(dashboard, /<EmptyState>/);
  assert.doesNotMatch(dashboard, /hh-form-modal-panel bg-white w-full max-w-sm rounded-t-3xl/);
  assert.doesNotMatch(dashboard, /fixed inset-0 bg-black\/40 flex items-center justify-center p-6 z-\[70\]/);
});

test('neutral theme keeps surfaces white without applying a grayscale filter', () => {
  const entry = read('../src/main.tsx');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(entry, /import ['"]\.\/styles\/neutral-theme\.css['"]/);
  assert.match(neutralTheme, /--hh-neutral-body: #ffffff/);
  assert.match(neutralTheme, /--hh-neutral-line:/);
  assert.doesNotMatch(neutralTheme, /grayscale\(/);
  assert.doesNotMatch(neutralTheme, /linear-gradient/);
});

test('character hitbox stays transparent when hovered', () => {
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(neutralTheme, /\.hh-character-hero-hitbox:hover[\s\S]*?background:\s*transparent\s*!important/);
});

test('child feature pages do not create horizontal overflow from the sticky header', () => {
  const characterStyles = read('../src/styles/character.css');
  const overlayStyles = read('../src/styles/overlays.css');

  assert.match(characterStyles, /\.hh-parent-content-modal\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(overlayStyles, /\.hh-parent-content-modal\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.doesNotMatch(`${characterStyles}\n${overlayStyles}`, /inset:\s*0\s+-100vw/);
});

test('dashboard tab changes reset the page scroll position', () => {
  const parentDashboard = read('../src/components/ParentDashboard.tsx');
  const childDashboard = read('../src/components/ChildDashboard.tsx');

  assert.match(parentDashboard, /useEffect\(\(\) => \{[\s\S]*window\.scrollTo\(0, 0\)[\s\S]*\}, \[activeTab\]\)/);
  assert.match(childDashboard, /useEffect\(\(\) => \{[\s\S]*window\.scrollTo\(0, 0\)[\s\S]*\}, \[activeTab\]\)/);
});

test('login and child password fields provide show-password controls', () => {
  const login = read('../src/components/AccountLogin.tsx');
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const childSettings = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');
  const dashboardPasswordControls = `${dashboard}\n${childSettings}`;

  assert.match(login, /Eye|EyeOff/);
  assert.match(login, /type=\{showPassword \? 'text' : 'password'\}/);
  assert.match(login, /aria-label=\{showPassword \? '隱藏密碼' : '顯示密碼'\}/);
  assert.match(dashboardPasswordControls, /Eye|EyeOff/);
  assert.match(dashboardPasswordControls, /type=\{showNewChildPassword \? 'text' : 'password'\}/);
  assert.match(dashboardPasswordControls, /type=\{showResetChildPassword \? 'text' : 'password'\}/);
  assert.match(dashboardPasswordControls, /type=\{showAccountSetupPassword \? 'text' : 'password'\}/);
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

test('cancelling a wishlist item requires confirmation before deletion', () => {
  const source = read('../src/components/ChildDashboard.tsx');

  assert.match(source, /wishlistToCancel/);
  assert.match(source, /確認取消許願/);
  assert.match(source, /先不要/);
  assert.match(source, /handleCancelWish\(item\.id\)/);
});

test('all task start-time inputs use numeric hour and minute selectors', () => {
  const parentDashboard = read('../src/components/ParentDashboard.tsx');
  const goalForm = read('../src/features/growth/components/GoalProposalForm.tsx');
  const timeInput = read('../src/components/TaipeiTimeInput.tsx');

  assert.equal((parentDashboard.match(/<TaipeiTimeInput/g) ?? []).length, 6);
  assert.match(goalForm, /<TaipeiTimeInput/);
  assert.match(timeInput, /length: 24/);
  assert.match(timeInput, /length: 60/);
  assert.doesNotMatch(parentDashboard + goalForm + timeInput, /type="time"|上午|下午|AM|PM/);
});

test('child account creation shows a pending state and prevents duplicate submissions', () => {
  const source = read('../src/components/ParentDashboard.tsx');

  assert.match(source, /childAccountSubmitting/);
  assert.match(source, /建立中…/);
  assert.match(source, /disabled=\{[^}]*childAccountSubmitting/);
  assert.match(source, /childAccountSubmissionInFlight/);
});

test('task creation explains that a child is required', () => {
  const source = read('../src/components/ParentDashboard.tsx');

  assert.match(source, /尚未建立小孩/);
  assert.match(source, /才能建立任務/);
  assert.match(source, /state\.children\.length === 0/);
});

test('first-use guide covers the complete parent and child workflow', () => {
  const guide = read('../src/components/FirstUseGuide.tsx');
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const dashboardContent = read('../src/components/parent-dashboard/ParentDashboardContent.tsx');
  const dashboardUi = `${dashboard}\n${dashboardContent}`;

  assert.match(guide, /建立小孩/);
  assert.match(guide, /小孩登入/);
  assert.match(guide, /任務/);
  assert.match(guide, /心得/);
  assert.match(guide, /審核/);
  assert.match(guide, /獎勵/);
  assert.match(guide, /localStorage/);
  assert.match(guide, /aria-modal="true"/);
  assert.match(guide, /spotlight/);
  assert.match(guide, /getBoundingClientRect/);
  assert.match(guide, /mask/);
  assert.doesNotMatch(guide, /bg-white/);
  assert.doesNotMatch(guide, /操作路徑/);
  assert.doesNotMatch(guide, /正在尋找下一個操作位置/);
  assert.match(guide, /text-shadow/);
  assert.match(guide, /min-h-8/);
  assert.doesNotMatch(guide, /fixed inset-x-4/);
  assert.match(guide, /positionReady/);
  assert.match(guide, /hh-first-use-guide-fade-in/);
  assert.match(guide, /guide-backdrop-\$\{stepIndex\}-\$\{positionReady/);
  assert.match(guide, /guide-copy-\$\{stepIndex\}-\$\{positionReady/);
  assert.doesNotMatch(guide, /<svg[^>]*hh-first-use-guide-fade-in/);
  const baseStyles = read('../src/styles/base.css');
  assert.match(baseStyles, /hh-first-use-guide-fade-in/);
  assert.match(baseStyles, /animation: hh-first-use-guide-fade-in 240ms/);
  assert.match(baseStyles, /prefers-reduced-motion/);
  assert.doesNotMatch(guide, /transition-\[top,left\]/);
  assert.doesNotMatch(guide, /transition-all duration-200/);
  assert.match(dashboard, /data-tour="settings"/);
  assert.match(dashboard, /data-tour="task-add"/);
  assert.match(dashboard, /data-tour=\{index === 0 \? 'task-card'/);
  assert.match(dashboardUi, /\{ id: 'rewards', label: '獎勵', tour: 'rewards-tab' \}/);
  assert.match(dashboardUi, /data-tour=\{tab\.tour\}[\s\S]*onClick=\{\(\) => onTabChange\(tab\.id\)\}/);
  assert.match(dashboard, /openTaskForm\(undefined, true\)/);
  assert.match(guide, /step\.target === 'task-name'/);
  assert.match(guide, /settleDelay = step\.target === 'task-name' \|\| step\.target === 'new-child-name' \? 240/);
  assert.match(guide, /target: 'new-child-name'/);
  assert.match(guide, /step\.target === 'new-child-name'/);
  assert.match(dashboard, /FirstUseGuide/);
  assert.match(dashboard, /重新觀看新手指引/);
  assert.doesNotMatch(dashboard, /Sparkles size=\{18\}[^\n]*重新觀看新手指引/);
  assert.match(dashboard, /signupConsentAccepted \|\| !hasCompletedFirstUseGuide\(\)/);
});
