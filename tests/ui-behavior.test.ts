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

test('child goal proposal controls use the neutral black and white system', () => {
  const characterStyles = read('../src/styles/character.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');
  const inlineStyles = `${characterStyles.slice(characterStyles.indexOf('.hh-goal-proposal-inline'), characterStyles.indexOf('.hh-goal-proposal-overlay'))}\n${neutralTheme}`;

  assert.match(neutralTheme, /\.hh-goal-proposal-inline\s*\{[\s\S]*?background:\s*var\(--hh-neutral-surface\)/);
  assert.match(neutralTheme, /\.hh-goal-proposal-inline\s*\{[\s\S]*?border:\s*1px solid var\(--hh-neutral-line\)/);
  assert.match(neutralTheme, /\.hh-goal-proposal-inline\s*\{[\s\S]*?color:\s*var\(--hh-neutral-ink\)/);
  assert.match(neutralTheme, /\.hh-sprite-theme \.hh-goal-proposal-trigger:hover,[\s\n]*\s*\.hh-sprite-theme \.hh-goal-proposal-inline:hover\s*\{[\s\S]*?background:\s*var\(--hh-neutral-soft\)/);
  assert.doesNotMatch(inlineStyles, /#1b7776|#f4fffb|#8edbd0/);
});

test('character hitbox stays transparent when hovered', () => {
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(neutralTheme, /\.hh-character-hero-hitbox:hover[\s\S]*?background:\s*transparent\s*!important/);
});

test('character preview keeps the full portrait image inside the desktop art frame', () => {
  const modalStyles = read('../src/styles/modals.css');

  assert.match(modalStyles, /\.hh-character-preview-art\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?min-height:\s*0;/);
  assert.match(modalStyles, /\.hh-character-preview-art img\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?min-height:\s*0;[\s\S]*?object-fit:\s*contain;/);
});

test('child feature pages do not create horizontal overflow from the sticky header', () => {
  const characterStyles = read('../src/styles/character.css');
  const overlayStyles = read('../src/styles/overlays.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(characterStyles, /\.hh-parent-content-modal\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(overlayStyles, /\.hh-parent-content-modal\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(overlayStyles, /\.hh-parent-content-modal\s*\{[\s\S]*?scrollbar-width:\s*none/);
  assert.match(overlayStyles, /\.hh-parent-content-modal::\-webkit-scrollbar[\s\S]*?display:\s*none/);
  assert.match(neutralTheme, /\.hh-parent-content-modal-bar[\s\S]*?margin-top:\s*-24px\s*!important/);
  assert.match(neutralTheme, /\.hh-parent-content-modal-bar[\s\S]*?top:\s*-24px\s*!important/);
  assert.match(neutralTheme, /\.hh-parent-content-modal-bar[\s\S]*?box-shadow:\s*none\s*!important/);
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

test('parent child deletion shows success feedback after the card is removed', () => {
  const source = read('../src/components/ParentDashboard.tsx');

  assert.match(source, /toastMessage/);
  assert.match(source, /小孩已刪除/);
  assert.match(source, /await deleteChild\(childToDelete\)/);
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
  const childSettings = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');
  const dashboardContent = read('../src/components/parent-dashboard/ParentDashboardContent.tsx');

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
  assert.match(childSettings, /data-tour="add-child-trigger"/);
  assert.match(childSettings, /data-tour="add-child"/);
  assert.doesNotMatch(dashboardContent, /ParentDashboardTabBar/);
  assert.doesNotMatch(dashboardContent, /review-tab|tasks-tab|growth-tab|rewards-tab|wishlist-tab/);
  assert.doesNotMatch(dashboard, /onTabChange=\{setActiveTab\}/);
  assert.match(dashboard, /data-tour=\{index === 0 \? 'task-card'/);
  assert.match(dashboard, /id: 'review', title: '審核',[\s\S]*tour: 'review-menu'/);
  assert.match(dashboard, /id: 'tasks', title: '任務',[\s\S]*tour: 'tasks-menu'/);
  assert.match(dashboard, /id: 'growth', title: '成長',[\s\S]*tour: 'growth-menu'/);
  assert.match(dashboard, /id: 'rewards', title: '獎勵',[\s\S]*tour: 'rewards-menu'/);
  assert.match(dashboard, /id: 'wishlist', title: '許願',[\s\S]*tour: 'wishlist-menu'/);
  assert.match(dashboard, /id: 'add-task', title: '新增任務',[\s\S]*tour: 'add-task-menu'/);
  assert.match(dashboard, /openHeroForm\('tasks'/);
  assert.match(dashboard, /showNewChildForm/);
  assert.match(guide, /target: 'add-child'/);
  assert.match(guide, /target: 'growth-menu'/);
  assert.match(guide, /target: 'wishlist-menu'/);
  assert.match(guide, /step\.target === 'add-child'/);
  assert.match(guide, /'add-child-trigger',[\s\S]*'add-task-menu',[\s\S]*'wishlist-menu',[\s\S]*\.includes\(step\.target\) \? 240/);
  assert.match(guide, /getComputedStyle\(target\)\.position !== 'fixed'/);
  assert.match(dashboard, /FirstUseGuide/);
  assert.match(dashboard, /重新觀看新手指引/);
  assert.doesNotMatch(dashboard, /Sparkles size=\{18\}[^\n]*重新觀看新手指引/);
  assert.match(dashboard, /signupConsentAccepted \|\| !hasCompletedFirstUseGuide\(\)/);
});

test('parent hero menu avoids duplicate destinations', () => {
  const dashboard = read('../src/components/ParentDashboard.tsx');

  assert.match(dashboard, /id: 'review-goals', title: '審核項目'/);
  assert.doesNotMatch(dashboard, /id: 'review-completions'/);
  assert.doesNotMatch(dashboard, /id: 'growth-record'|id: 'completed-tasks'/);
  assert.match(dashboard, /id: 'growth', title: '成長',[\s\S]*openHeroFeature\('growth'\)/);
  assert.match(dashboard, /id: 'task-form', title: '任務表單'/);
  assert.doesNotMatch(dashboard, /id: 'today-tasks'|id: 'task-templates'/);
  assert.doesNotMatch(dashboard, /id: 'pending-rewards'/);
  assert.match(dashboard, /id: 'reward-list', title: '獎勵清單'/);
});

test('child growth menu opens the growth feature directly', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');

  assert.match(dashboard, /id: 'growth', title: '成長',[\s\S]*onSelect: \(\) => openChildFeature\('growth'\)/);
  assert.match(dashboard, /toggleHeroMenuGroup\('backpack'\)/);
  assert.match(dashboard, /title: '今日目標'/);
  assert.match(dashboard, /<Backpack size=\{18\}/);
  assert.match(dashboard, /id: 'wishlist', title: '許願'/);
  assert.match(dashboard, /id: 'history', title: '兌換'/);
  assert.match(dashboard, /id: 'switch-child', title: '切換視角'/);
  assert.match(dashboard, /id: 'logout', title: '登出'/);
});

test('child submenu keeps settings immediately above logout and animates every action', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const characterStyles = read('../src/styles/character.css');

  assert.match(dashboard, /id: 'switch-child',[\s\S]*id: 'settings',[\s\S]*id: 'logout'/);
  assert.match(characterStyles, /data-active-menu="backpack"[\s\S]*?nth-child\(6\)[\s\S]*?transition-delay: 750ms/);
  assert.match(characterStyles, /data-active-menu="backpack"[\s\S]*?is-collapsed[\s\S]*?nth-child\(6\)[\s\S]*?transition-delay: 0ms/);
});

test('switching child views does not disable the saved notification preference', () => {
  const hook = read('../src/hooks/useNotificationSettings.ts');

  assert.doesNotMatch(hook, /useEffect\(\(\) => \{[\s\S]*disablePushDevicesForProfile\(client, profileId\)/);
});

test('child feature menu keeps the submenu mounted while it animates closed', () => {
  const hero = read('../src/components/DashboardCharacterHero.tsx');
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const characterStyles = read('../src/styles/character.css');

  assert.match(hero, /menuOpen === false \? 'is-collapsed' : ''/);
  assert.match(dashboard, /const HERO_MENU_EXIT_MS = 900/);
  assert.match(dashboard, /window\.setTimeout\(\(\) => \{[\s\S]*setHeroMenuGroup\(null\)[\s\S]*\}, HERO_MENU_EXIT_MS\)/);
  assert.match(dashboard, /requestAnimationFrame\(\(\) => \{[\s\S]*setHeroMenuVisible\(true\)/);
  assert.match(characterStyles, /data-active-menu="backpack"[\s\S]*?translateY\(-6px\)/);
  assert.match(characterStyles, /data-active-menu="backpack"[\s\S]*?top: calc\(9px \+ var\(--hh-menu-submenu-offset\)\)/);
  assert.match(characterStyles, /nth-child\(2\)[\s\S]*?transition-delay: 150ms/);
  assert.match(characterStyles, /nth-child\(3\)[\s\S]*?transition-delay: 300ms/);
  assert.match(characterStyles, /nth-child\(5\)[\s\S]*?transition-delay: 0ms/);
  assert.match(characterStyles, /prefers-reduced-motion: reduce/);
  assert.match(characterStyles, /data-menu-variant="child"[\s\S]*?--hh-menu-action-size: 84px/);
});

test('child feature pages omit the duplicate modal title while keeping the close control', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const overlays = read('../src/styles/overlays.css');

  assert.match(dashboard, /<div className="hh-parent-content-modal-bar hh-parent-content-modal-bar--child">\s*<button/);
  assert.match(overlays, /\.hh-parent-content-modal-bar--child[\s\S]*?justify-content: flex-end[\s\S]*?min-height: 48px/);
});
