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

test('shared modal close action matches the feature page transparent black close control', () => {
  const sharedUi = read('../src/components/shared/ParentDashboardUI.tsx');
  const parentContent = read('../src/components/parent-dashboard/ParentDashboardContent.tsx');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(sharedUi, /className="hh-character-icon-button hh-modal-close-button"/);
  assert.match(parentContent, /className="hh-character-icon-button hh-modal-close-button ml-auto"/);
  assert.doesNotMatch(sharedUi, /rounded-full bg-gray-100 text-gray-400/);
  assert.match(neutralTheme, /\.hh-modal-close-button,[\s\n]*\.hh-modal-close-button:hover,[\s\n]*\.hh-modal-close-button:focus-visible\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*var\(--hh-neutral-ink\);[\s\S]*?box-shadow:\s*none;/);
});

test('forest-paper theme keeps surfaces warm without applying a grayscale filter', () => {
  const entry = read('../src/main.tsx');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(entry, /import ['"]\.\/styles\/neutral-theme\.css['"]/);
  assert.match(neutralTheme, /--hh-neutral-body: var\(--hh-surface-soft\)/);
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

test('character preview keeps the full portrait image inside the shared lightbox frame', () => {
  const modalStyles = read('../src/styles/modals.css');

  assert.match(modalStyles, /\.hh-game-item-lightbox-content img\s*\{[\s\S]*?width:\s*min\(78vw, 440px\);[\s\S]*?height:\s*min\(78vw, 440px\);[\s\S]*?object-fit:\s*contain;/);
});

test('child feature pages do not create horizontal overflow from the sticky header', () => {
  const characterStyles = read('../src/styles/character.css');
  const overlayStyles = read('../src/styles/overlays.css');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(characterStyles, /\.hh-parent-content-modal\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(overlayStyles, /\.hh-parent-content-modal\s*\{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(characterStyles, />\*:not\(\.hh-parent-content-modal-bar\):not\(\.hh-modal-overlay\)/);
  assert.match(overlayStyles, />\*:not\(\.hh-parent-content-modal-bar\):not\(\.hh-modal-overlay\)/);
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
  const parentContent = read('../src/components/parent-dashboard/ParentDashboardContent.tsx');

  assert.match(parentDashboard, /featureContentRef\.current\?\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
  assert.match(childDashboard, /featureContentRef\.current\?\.scrollTo\(\{ top: 0, left: 0, behavior: 'auto' \}\)/);
  assert.match(parentDashboard, /\}, \[activeTab, heroFeature\]\)/);
  assert.match(childDashboard, /\}, \[activeTab, heroFeature\]\)/);
  assert.match(parentContent, /contentRef: RefObject<HTMLElement \| null>/);
  assert.match(parentContent, /ref=\{contentRef\}/);
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

test('parent reward cards keep child names readable at the compact text size', () => {
  const source = read('../src/components/ParentDashboard.tsx');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(source, /text-sm font-bold text-gray-800">\{c\.childName\}/);
  assert.doesNotMatch(source, /bg-blue-100 text-blue-700 text-xs px-1\.5 py-0\.5 rounded font-bold">\{c\.childName\}/);
  assert.match(source, /className="hh-reward-management-action p-2 text-gray-400/);
  assert.match(neutralTheme, /\.hh-reward-management-action[\s\S]*?background: transparent !important;[\s\S]*?border: 0 !important;[\s\S]*?box-shadow: none !important/);
});

test('settings and child adventure controls keep icon-only neutral treatments', () => {
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const childDashboard = read('../src/components/ChildDashboard.tsx');
  const children = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');
  const neutralTheme = read('../src/styles/neutral-theme.css');

  assert.match(children, /aria-label="刪除小孩"/);
  assert.match(children, /className="hh-child-delete-action text-red-500/);
  assert.match(children, /<Trash2 size=\{20\} \/>/);
  assert.doesNotMatch(children, /hover:bg-red-50[^>]*>\s*<Trash2/);
  assert.match(childDashboard, /className="hh-goal-proposal-close hh-character-icon-button"/);
  assert.match(neutralTheme, /\.hh-goal-proposal-sheet-bar \.hh-character-icon-button[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/);
});

test('parent settings action buttons share the same compact height and padding', () => {
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const guideButton = /mb-3 flex min-h-12 w-full[^\n]*px-4 py-3/;
  const logoutButton = /className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3/;

  assert.match(dashboard, guideButton);
  assert.match(dashboard, logoutButton);
  assert.match(dashboard, /重新觀看新手指引/);
  assert.match(dashboard, /登出家長端/);
});

test('parent review items are removed immediately after a successful action', () => {
  const source = read('../src/features/growth/components/GoalReviewPanel.tsx');

  assert.match(source, /resolvedProposalIds/);
  assert.match(source, /resolvedCompletionIds/);
  assert.match(source, /setResolvedProposalIds/);
  assert.match(source, /setResolvedCompletionIds/);
});

test('child today goals show the new adventure summary instead of legacy goal sections', () => {
  const source = read('../src/components/ChildDashboard.tsx');
  const adventureState = read('../src/lib/child-dashboard-adventure-state.ts');

  assert.match(adventureState, /const adventureTasks = tasks\.filter\(\(task\) => !isLegacyGrowthTask\(task\)\)/);
  assert.match(adventureState, /todayAdventureSummary: getTodayAdventureSummary\(adventureTasks, adventureDate\)/);
  assert.match(source, /<TodayAdventureSummary summary=\{todayAdventureSummary\}/);
  assert.doesNotMatch(source, /<GoalCard/);
  assert.doesNotMatch(source, /parentGoalTasks|childGoalTasks|goalCopy\.child\.parentTitle/);
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

test('child password reset shows a pending state and prevents duplicate submissions', () => {
  const source = read('../src/components/ParentDashboard.tsx');

  assert.match(source, /resetChildPasswordSubmitting/);
  assert.match(source, /resetChildPasswordSubmissionInFlight/);
  assert.match(source, /aria-busy=\{resetChildPasswordSubmitting\}/);
  assert.match(source, /disabled=\{resetChildPasswordSubmitting\}/);
  assert.match(source, /儲存中…/);
  assert.match(source, /animate-spin motion-reduce:animate-none/);
});

test('duplicate child account names show a child-specific recovery message', () => {
  const source = read('../src/components/ParentDashboard.tsx');

  assert.match(source, /toChildAccountErrorMessage/);
  assert.match(source, /setNewChildError\(toChildAccountErrorMessage\(error\)\)/);
});

test('parent child deletion closes the confirmation immediately and reports async completion', () => {
  const source = read('../src/components/ParentDashboard.tsx');

  assert.match(source, /toastMessage/);
  assert.match(source, /小孩已刪除/);
  assert.match(source, /deletingChildId/);
  assert.match(source, /const deletion = deleteChild\(targetChildId\)/);
  assert.match(source, /setChildToDelete\(null\)/);
  assert.match(source, /await deletion/);
  assert.doesNotMatch(source, /await deleteChild\(childToDelete\);\s*dismissWithAnimation/);
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
  assert.doesNotMatch(guide, /孩子可以登入自己的畫面|讓孩子知道怎麼用/);
  assert.match(guide, /冒險/);
  assert.match(guide, /心得/);
  assert.match(guide, /審核/);
  assert.match(guide, /獎勵/);
  assert.match(guide, /localStorage/);
  assert.match(guide, /aria-modal="true"/);
  assert.match(guide, /createPortal/);
  assert.match(guide, /z-\[120\]/);
  assert.match(guide, /const usesLightCopy = step\.target === 'add-child' \|\| step\.target === 'task-name'/);
  assert.match(guide, /const copyTopLimit = window\.innerWidth <= 640 \? 72 : 24/);
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
  assert.doesNotMatch(dashboard, /id: 'wishlist', title: '許願',[\s\S]*tour: 'wishlist-menu'/);
  assert.match(dashboard, /id: 'task-form', title: '冒險管理',[\s\S]*tour: 'add-task-menu'/);
  assert.match(dashboard, /openAdventureForm\('daily'\)/);
  assert.match(dashboard, /openAdventureForm\('general'\)/);
  assert.match(dashboard, /showNewChildForm/);
  assert.match(guide, /target: 'add-child'/);
  assert.match(guide, /target: 'growth-menu'/);
  assert.doesNotMatch(guide, /target: 'wishlist-menu'/);
  assert.match(guide, /獎勵中心/);
  assert.match(guide, /step\.target === 'add-child'/);
  assert.match(guide, /'add-child-trigger',[\s\S]*'add-task-menu',[\s\S]*'growth-menu',[\s\S]*\.includes\(step\.target\) \? 240/);
  assert.match(guide, /getComputedStyle\(target\)\.position !== 'fixed'/);
  assert.match(dashboard, /FirstUseGuide/);
  assert.match(dashboard, /重新觀看新手指引/);
  assert.doesNotMatch(dashboard, /Sparkles size=\{18\}[^\n]*重新觀看新手指引/);
  assert.match(dashboard, /signupConsentAccepted \|\| !hasCompletedFirstUseGuide\(\)/);
});

test('recent approvals are collapsed by default and paginate twenty records at a time', () => {
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const approvals = read('../src/components/parent-dashboard/RecentApprovedTasks.tsx');

  assert.match(dashboard, /<RecentApprovedTasks/);
  assert.match(approvals, /const PAGE_SIZE = 20/);
  assert.match(approvals, /useState\(false\)/);
  assert.match(approvals, /aria-expanded=\{expanded\}/);
  assert.match(approvals, /expanded &&/);
  assert.match(approvals, /slice\(pageStart, pageStart \+ PAGE_SIZE\)/);
  assert.match(approvals, /第 \{safePage\} \/ \{pageCount\} 頁/);
  assert.match(approvals, /aria-label=\{`第 \$\{pageNumber\} 頁`\}/);
});

test('mobile toast feedback clears the notch with extra breathing room', () => {
  const overlays = read('../src/styles/overlays.css');

  assert.match(overlays, /@media \(max-width: 760px\)[\s\S]*?\.hh-toast\s*\{\s*top: max\(52px, calc\(env\(safe-area-inset-top, 0px\) \+ 52px\)\)/);
});

test('parent hero menu avoids duplicate destinations', () => {
  const dashboard = read('../src/components/ParentDashboard.tsx');
  const dashboardContent = read('../src/components/parent-dashboard/ParentDashboardContent.tsx');

  assert.match(dashboard, /id: 'review', title: '審核',[\s\S]*openHeroFeature\('review'\)/);
  assert.doesNotMatch(dashboard, /id: 'review-goals'/);
  assert.doesNotMatch(dashboard, /id: 'review-completions'/);
  assert.doesNotMatch(dashboard, /id: 'growth-record'|id: 'completed-tasks'/);
  assert.match(dashboard, /id: 'growth', title: '成長',[\s\S]*openHeroFeature\('growth'\)/);
  assert.match(dashboard, /id: 'task-form', title: '冒險管理'/);
  assert.match(dashboard, /id: 'add-daily-adventure', title: '每日冒險'/);
  assert.match(dashboard, /id: 'add-general-adventure', title: '一般冒險'/);
  assert.doesNotMatch(dashboard, /id: 'add-template'|id: 'back', title: '返回'/);
  assert.doesNotMatch(dashboard, /id: 'today-tasks'|id: 'task-templates'/);
  assert.doesNotMatch(dashboard, /id: 'pending-rewards'/);
  assert.match(dashboard, /id: 'rewards', title: '獎勵',[\s\S]*openHeroFeature\('rewards'\)/);
  assert.doesNotMatch(dashboard, /id: 'wishlist', title: '許願'/);
  assert.doesNotMatch(dashboard, /id: 'review-tickets'/);
  assert.match(dashboard, /兌換紀錄/);
  assert.match(dashboard, /openHeroFeature\('wishlist'\)/);
  assert.match(dashboardContent, /heroFeature === 'wishlist'/);
  assert.match(dashboardContent, /onBackFeature/);
  assert.match(dashboard, /onBackFeature=\{\(\) => openHeroFeature\('rewards'\)\}/);
});

test('completion review opens in a fading modal instead of expanding the card', () => {
  const panel = read('../src/features/growth/components/GoalReviewPanel.tsx');
  const overlays = read('../src/styles/overlays.css');
  const modals = read('../src/styles/modals.css');

  assert.match(panel, /role="dialog"/);
  assert.match(panel, /aria-modal="true"/);
  assert.match(panel, /hh-review-dialog-overlay/);
  assert.match(panel, /hh-review-dialog-panel/);
  assert.doesNotMatch(panel, /reviewingTaskId === task\.id \? \(/);
  assert.match(overlays, /\.hh-review-dialog-overlay[\s\S]*animation:\s*hh-review-dialog-overlay-in/);
  assert.match(modals, /\.hh-review-dialog-panel[\s\S]*animation:\s*hh-review-dialog-panel-in/);
});

test('completion review form uses the forest-paper theme outside the app portal root', () => {
  const form = read('../src/features/growth/components/ParentFeedbackForm.tsx');
  const modals = read('../src/styles/modals.css');
  const overlays = read('../src/styles/overlays.css');

  assert.match(form, /hh-review-dialog-card/);
  assert.doesNotMatch(form, /border-blue-100|bg-white|text-gray-|bg-orange-500|bg-blue-500/);
  assert.match(modals, /\.hh-review-dialog-card[\s\S]*color:\s*var\(--hh-ink\)/);
  assert.match(modals, /\.hh-review-dialog-request[\s\S]*background:\s*var\(--hh-accent\)/);
  assert.match(modals, /\.hh-review-dialog-approve[\s\S]*background:\s*var\(--hh-success\)/);
  assert.match(overlays, /\.hh-review-dialog-backdrop[\s\S]*background:\s*rgb\(18 57 59 \/ 52%\)/);
});

test('child feature pages expose one compact navigation row', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');

  assert.match(dashboard, /const childFeatureNavigation[\s\S]*?id: 'inventory', title: '背包',[\s\S]*?id: 'goals', title: '冒險',[\s\S]*?id: 'shop', title: '商店',[\s\S]*?id: 'wishlist', title: '獎勵',[\s\S]*?id: 'growth', title: '成長',[\s\S]*?id: 'settings', title: '設定'/);
  assert.match(dashboard, /hh-child-feature-nav/);
  assert.match(dashboard, /aria-label="小孩功能導覽"/);
  assert.match(dashboard, /heroFeature === item\.id/);
  assert.match(dashboard, /onClick=\{\(\) => openChildFeature\(item\.id\)\}/);
  assert.match(dashboard, /onClick=\{\(\) => openChildFeature\('inventory'\)\}/);
  assert.doesNotMatch(dashboard, /toggleHeroMenuGroup/);
  assert.match(dashboard, /<Backpack size=\{18\}/);
  assert.doesNotMatch(dashboard, /id: 'history'/);
  assert.match(dashboard, /child-redemption-history-title/);
  assert.match(dashboard, /activeTab === 'goals'[\s\S]*?>\s*冒險\s*\{/);
  assert.doesNotMatch(dashboard, /冒險日記/);
  assert.doesNotMatch(dashboard, /id: 'switch-child', title: '切換視角'/);
  assert.doesNotMatch(dashboard, /id: 'logout', title: '登出'/);
});

test('child feature navigation keeps settings as the account entry point', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');

  assert.match(dashboard, /const childFeatureNavigation[\s\S]*id: 'wishlist',[\s\S]*id: 'growth',[\s\S]*id: 'settings'/);
  assert.match(dashboard, /onSwitchChild=\{onSwitchChild\}/);
  assert.match(dashboard, /onLogout=\{onLogout\}/);
  assert.doesNotMatch(dashboard, /toggleHeroMenuGroup/);
});

test('switching child views does not disable the saved notification preference', () => {
  const hook = read('../src/hooks/useNotificationSettings.ts');

  assert.doesNotMatch(hook, /useEffect\(\(\) => \{[\s\S]*disablePushDevicesForProfile\(client, profileId\)/);
});

test('child 3D world does not render foreground push notifications as a toast', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');

  assert.match(dashboard, /const notificationSettings = useNotificationSettings\(\{[\s\S]*?familyId,[\s\S]*?childProfileId: activeChild\?\.id \?\? null,[\s\S]*?\}\);/);
  assert.doesNotMatch(dashboard, /onForegroundNotification: \(title, body\) => showToast/);
});

test('child backpack opens the feature page directly instead of a hero submenu', () => {
  const hero = read('../src/components/DashboardCharacterHero.tsx');
  const dashboard = read('../src/components/ChildDashboard.tsx');

  assert.match(hero, /const hasMenu = rootActions\.length > 0 \|\| subActions\.length > 0/);
  assert.match(dashboard, /onClick=\{\(\) => openChildFeature\('inventory'\)\}/);
  assert.match(dashboard, /aria-label="開啟背包"/);
  assert.doesNotMatch(dashboard, /toggleHeroMenuGroup/);
  assert.doesNotMatch(dashboard, /menuActions=\{heroMenuActions\}/);
});

test('character menu floating animation remains compositor-safe on iOS touch browsers', () => {
  const characterStyles = read('../src/styles/character.css');
  const floatingKeyframes = characterStyles.match(/@keyframes hh-menu-float[\s\S]*?\n}\n\n\.hh-character-stats small/)?.[0] ?? '';

  assert.match(floatingKeyframes, /translate:\s*0 0;[\s\S]*?50%[\s\S]*?translate:\s*0 -4px;/);
  assert.doesNotMatch(floatingKeyframes, /margin-top/);
  assert.doesNotMatch(characterStyles, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*?\.hh-character-menu-action\s*\{\s*animation:\s*none;/);
});

test('child feature pages omit the duplicate modal title while keeping the close control', () => {
  const dashboard = read('../src/components/ChildDashboard.tsx');
  const overlays = read('../src/styles/overlays.css');
  const characterStyles = read('../src/styles/character.css');

  assert.match(dashboard, /<div className="hh-parent-content-modal-bar hh-parent-content-modal-bar--child">\s*<nav className="hh-child-feature-nav"/);
  assert.match(overlays, /\.hh-parent-content-modal-bar--child[\s\S]*?justify-content: initial[\s\S]*?min-height: 48px/);
  assert.match(characterStyles, /\.hh-dashboard-screen\s*\{[\s\S]*?--hh-character-top-offset:\s*44px/);
  assert.match(overlays, /\.hh-parent-content-modal-bar--child\s*\{[\s\S]*?top:\s*0[\s\S]*?justify-content: initial/);
  assert.match(overlays, /@media \(max-width: 760px\)[\s\S]*?\.hh-parent-content-modal-bar--child[\s\S]*?padding-top:\s*calc\(16px \+ var\(--hh-character-top-offset\)\)/);
  assert.match(overlays, /@media \(max-width: 760px\)[\s\S]*?\.hh-child-feature-nav[\s\S]*?order:\s*2/);
});
