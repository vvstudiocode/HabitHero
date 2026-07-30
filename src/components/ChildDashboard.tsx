import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { useAuthSession } from '../auth';
import { Backpack, CheckCircle2, Gift, LogOut, Plus, Star, X, Clock, History, User, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { dismissWithAnimation } from '../lib/utils';
import { Reward } from '../types';
import { GoalCard } from '../features/growth/components/GoalCard';
import { GoalProposalForm } from '../features/growth/components/GoalProposalForm';
import { GoalSubmissionForm } from '../features/growth/components/GoalSubmissionForm';
import { GrowthSummaryPanel } from '../features/growth/components/GrowthSummaryPanel';
import { goalCopy } from '../features/growth/goal-copy';
import { getChildGrowthSummary } from '../features/growth/growth-stats';
import type { GoalProposalInput, GoalReflectionInput, GrowthTask, GrowthTaskTemplate } from '../features/growth/types';
import { getTaskExecutionState, isTaskExecutableAt } from '../lib/task-time';
import { canStartTask, hasBlockingReviewTask } from '../lib/task-gating';
import { getChildMenuNotifications } from '../lib/menu-notifications';
import { DashboardCharacterHero, type CharacterMenuAction } from './DashboardCharacterHero';
import { getCharacterById } from '../features/characters/catalog';
import { PushNotificationSettings } from './PushNotificationSettings';
import { useNotificationSettings } from '../hooks/useNotificationSettings';

interface GrowthChildActions {
  proposeGoal?: (childId: string, input: GoalProposalInput) => Promise<void>;
  proposeChildGoal?: (childId: string, input: GoalProposalInput & { icon: string }) => Promise<void>;
  submitTaskReflection?: (taskId: string, input: { reflection: string; mood?: string | null; difficulty?: number | null }) => Promise<void>;
}

interface ChildDashboardProps {
  onLogout: () => void;
  onSwitchChild: () => void;
}

type ChildTab = 'goals' | 'growth' | 'wishlist' | 'history';
type ChildMenuGroup = ChildTab | 'backpack';
const HERO_MENU_EXIT_MS = 900;

function formatTaskTime(dueTime?: string | null) {
  return dueTime ? dueTime.slice(0, 5) : '全天';
}

function formatTaskWindow(task: { dueTime?: string | null; endTime?: string | null }) {
  const start = task.dueTime?.slice(0, 5) ?? '隨時';
  return task.endTime ? `${start}–${task.endTime.slice(0, 5)}` : `${start}起`;
}

export function ChildDashboard({ onLogout, onSwitchChild }: ChildDashboardProps) {
  const appStore = useAppStore() as ReturnType<typeof useAppStore> & GrowthChildActions;
  const { state, familyId, updateTaskStatus, updateTask, addTask, redeemReward, addWishlist, deleteWishlist, startTaskTimer, pauseTaskTimer, loading, error, retry, role, hasSession, isOffline } = appStore;
  const { session, loading: sessionLoading } = useAuthSession();
  const [activeTab, setActiveTab] = useState<ChildTab>('goals');
  const [heroFeature, setHeroFeature] = useState<ChildTab | null>(null);
  const [heroMenuGroup, setHeroMenuGroup] = useState<ChildMenuGroup | null>(null);
  const [heroMenuVisible, setHeroMenuVisible] = useState(false);
  const heroMenuOpenFrame = useRef<number | null>(null);
  const heroMenuCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);
  
  // A direct child session uses its own child id. In parent child-mode, the
  // parent session operates on the explicitly selected family child.
  const activeChildId = role === 'parent' ? state.parentActiveChildId : state.childLoggedInId;
  const activeChild = activeChildId
    ? state.children.find(c => c.id === activeChildId)
    : undefined;
  const activeCharacter = getCharacterById(activeChild?.characterId) ?? getCharacterById('pink-catgirl-room')!;

  const tasks = (activeChild?.tasks || []) as GrowthTask[];
  const rewards = activeChild?.rewards || [];
  const tickets = activeChild?.tickets || [];
  const wishlist = activeChild?.wishlist || [];
  const childPoints = activeChild?.points || 0;
  const taskTemplates = state.taskTemplates as GrowthTaskTemplate[];

  // Wishlist Form
  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [wishName, setWishName] = useState('');
  const [wishlistToCancel, setWishlistToCancel] = useState<import('../types').WishlistItem | null>(null);
  const [rewardToConfirm, setRewardToConfirm] = useState<Reward | null>(null);
  
  // Toast Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    setToastLeaving(false);
    toastTimer.current = setTimeout(() => {
      setToastLeaving(true);
      toastTimer.current = setTimeout(() => {
        setToastMessage(null);
        setToastLeaving(false);
        toastTimer.current = null;
      }, 280);
    }, 2720);
  };

  const notificationSettings = useNotificationSettings({
    familyId,
    childProfileId: activeChild?.id ?? null,
    onForegroundNotification: (title, body) => showToast(`${title}：${body}`),
  });

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const proposedTasks = tasks.filter(t => t.status === 'proposed' || t.status === 'proposal_revision_requested');
  const todoTasks = tasks
    .filter(t => t.status === 'todo')
    .sort((a, b) => (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'));
  const childGoalTasks = todoTasks.filter(task => task.origin === 'child_proposed');
  const parentGoalTasks = todoTasks.filter(task => task.origin !== 'child_proposed');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const revisionTasks = tasks.filter(t => t.status === 'revision_requested');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const completedTasksWithChild = activeChild ? completedTasks.map((task) => ({ ...task, childId: activeChild.id, childName: activeChild.name })) : [];
  const growthSummary = activeChild ? getChildGrowthSummary({ ...activeChild, tasks } as typeof activeChild, state.ledger) : null;
  const childMenuNotifications = getChildMenuNotifications({
    goals: proposedTasks.length + todoTasks.length + revisionTasks.length,
    rewards: rewards.length + tickets.length,
    wishlist: wishlist.length,
  });
  const [submittingTask, setSubmittingTask] = useState<GrowthTask | null>(null);

  const [now, setNow] = useState(Date.now());
  const [beepedTaskId, setBeepedTaskId] = useState<string | null>(null);

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1); // 1 sec beep
      }
    } catch(e) {
      console.error('Audio beep failed', e);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const allTasks = state.children.flatMap(c => c.tasks);

  useEffect(() => {
    const runningTask = allTasks.find(t => t.timerIsRunning && t.timerEndTime);
    if (runningTask && runningTask.timerEndTime) {
      if (now >= runningTask.timerEndTime && beepedTaskId !== runningTask.id) {
        playBeep();
        setBeepedTaskId(runningTask.id);
      }
    } else {
      if (beepedTaskId) setBeepedTaskId(null);
    }
  }, [now, allTasks, beepedTaskId]);

  const toggleTimer = (task: import('../types').Task) => {
    if (!activeChild) return;
    
    if (task.timerIsRunning) {
      pauseTaskTimer(activeChild.id, task.id);
    } else {
      if (!canStartTask(tasks, task.id)) {
        showToast('請先等待家長審核上一個任務。');
        return;
      }
      const executionState = getTaskExecutionState(task.dueTime, task.endTime);
      if (executionState !== 'available') {
        showToast(executionState === 'expired' ? `這次任務已截止，下次時間：${formatTaskWindow(task)}。` : `還沒到可開始時間：${formatTaskTime(task.dueTime)}。`);
        return;
      }
      // Check if any other task is RUNNING
      const isAnotherRunning = tasks.some(t => t.timerIsRunning && t.id !== task.id);
      if (isAnotherRunning) {
        showToast("一次只能執行一個任務喔！請先暫停其他任務。");
        return;
      }
      startTaskTimer(activeChild.id, task.id);
    }
  };

  const handleFinishTask = async (taskId: string) => {
    if (!activeChild) return;
    if (!canStartTask(tasks, taskId)) {
      showToast('請先等待家長審核上一個任務。');
      return;
    }
    const task = tasks.find((item) => item.id === taskId);
    if (task && !isTaskExecutableAt(task.dueTime, task.endTime)) {
      const executionState = getTaskExecutionState(task.dueTime, task.endTime);
      showToast(executionState === 'expired' ? `這次任務已截止，下次時間：${formatTaskWindow(task)}。` : `還沒到可開始時間：${formatTaskTime(task.dueTime)}。`);
      return;
    }
    if (task) setSubmittingTask(task);
  };

  const handleProposeGoal = async (input: GoalProposalInput) => {
    if (!activeChild) return;
    setActionPending(true);
    try {
      if (appStore.proposeGoal) {
        await appStore.proposeGoal(activeChild.id, input);
      } else if (appStore.proposeChildGoal) {
        await appStore.proposeChildGoal(activeChild.id, { ...input, icon: 'Star' });
      } else {
        await addTask(activeChild.id, { name: input.name, points: input.points, icon: 'Star', category: input.category, dueTime: input.dueTime, endTime: input.endTime, duration: input.duration, origin: 'child_proposed' } as never);
      }
      showToast('目標已建立，可以先開始做。');
    } finally {
      setActionPending(false);
    }
  };

  const handleSubmitGoalProposal = async (input: GoalProposalInput) => {
    await handleProposeGoal(input);
    dismissWithAnimation(() => setShowGoalForm(false), '.hh-goal-proposal-sheet');
  };

  const handleSubmitReflection = async (taskId: string, input: GoalReflectionInput) => {
    if (!activeChild) return;
    setActionPending(true);
    try {
      if (appStore.submitTaskReflection) {
        await appStore.submitTaskReflection(taskId, {
          reflection: input.reflection,
          mood: input.mood,
          difficulty: input.difficulty,
        });
      } else {
        await updateTask(activeChild.id, taskId, {
          reflection: input.reflection,
          mood: input.mood,
          difficulty: input.difficulty,
        } as never);
        await updateTaskStatus(activeChild.id, taskId, 'pending');
      }
      dismissWithAnimation(() => setSubmittingTask(null));
      showToast('心得已送出，等待爸媽審核。');
    } finally {
      setActionPending(false);
    }
  };

  const handleAddWish = async () => {
    if (wishName && activeChild) {
      setActionPending(true);
      try {
        await addWishlist(activeChild.id, wishName.trim());
        dismissWithAnimation(() => setShowWishlistForm(false));
        setWishName('');
        showToast('願望已送出。');
      } finally {
        setActionPending(false);
      }
    }
  };

  const handleCancelWish = async (wishlistId: string) => {
    if (!activeChild) return;
    setActionPending(true);
    try {
      await deleteWishlist(activeChild.id, wishlistId);
      showToast('已取消這個願望。');
    } finally {
      setActionPending(false);
    }
  };

  const handleRedeem = async (reward: Reward) => {
    if (!activeChild) return;
    if (childPoints >= reward.points) {
      dismissWithAnimation(() => setRewardToConfirm(null), '.hh-reward-confirm-panel');
      setActionPending(true);
      try {
        await redeemReward(activeChild.id, reward);
        showToast('兌換成功！已經通知爸媽囉～');
      } finally {
        setActionPending(false);
      }
    }
  };

  const openChildFeature = (tab: ChildTab) => {
    setActiveTab(tab);
    setHeroFeature(tab);
    setHeroMenuGroup(null);
    setHeroMenuVisible(false);
  };

  const closeHeroMenu = () => {
    if (heroMenuOpenFrame.current !== null) {
      window.cancelAnimationFrame(heroMenuOpenFrame.current);
      heroMenuOpenFrame.current = null;
    }
    if (heroMenuCloseTimer.current !== null) {
      window.clearTimeout(heroMenuCloseTimer.current);
      heroMenuCloseTimer.current = null;
    }
    setHeroMenuVisible(false);
    heroMenuCloseTimer.current = window.setTimeout(() => {
      setHeroMenuGroup(null);
      heroMenuCloseTimer.current = null;
    }, HERO_MENU_EXIT_MS);
  };

  const closeChildForm = (closeForm: () => void, selector?: string) => {
    dismissWithAnimation(closeForm, selector);
  };

  const closeChildFeature = () => {
    dismissWithAnimation(() => setHeroFeature(null), '.hh-parent-content-modal', 260);
    setHeroMenuGroup(null);
    setHeroMenuVisible(false);
  };

  const toggleHeroMenuGroup = (tab: ChildMenuGroup) => {
    if (heroMenuGroup === tab) {
      if (heroMenuVisible) closeHeroMenu();
      else {
        if (heroMenuCloseTimer.current !== null) {
          window.clearTimeout(heroMenuCloseTimer.current);
          heroMenuCloseTimer.current = null;
        }
        heroMenuOpenFrame.current = window.requestAnimationFrame(() => {
          setHeroMenuVisible(true);
          heroMenuOpenFrame.current = null;
        });
      }
      return;
    }
    if (heroMenuCloseTimer.current !== null) {
      window.clearTimeout(heroMenuCloseTimer.current);
      heroMenuCloseTimer.current = null;
    }
    setHeroMenuGroup(tab);
    setHeroMenuVisible(false);
    heroMenuOpenFrame.current = window.requestAnimationFrame(() => {
      setHeroMenuVisible(true);
      heroMenuOpenFrame.current = null;
    });
  };

  const heroRootMenuActions: CharacterMenuAction[] = [
    { id: 'goals', title: '今日目標', icon: <CheckCircle2 size={17} />, hasNotification: childMenuNotifications.goals, onSelect: () => openChildFeature('goals') },
  ];

  const heroSubMenuActions: Record<ChildMenuGroup, CharacterMenuAction[]> = {
    backpack: [
      { id: 'growth', title: '成長', icon: <Star size={17} />, onSelect: () => openChildFeature('growth') },
      { id: 'wishlist', title: '許願', icon: <Plus size={17} />, hasNotification: childMenuNotifications.wishlist, onSelect: () => openChildFeature('wishlist') },
      { id: 'history', title: '兌換', icon: <History size={17} />, hasNotification: childMenuNotifications.rewards, onSelect: () => openChildFeature('history') },
      { id: 'settings', title: '設定', icon: <Settings size={17} />, onSelect: () => setShowNotificationSettings(true) },
      { id: 'switch-child', title: '切換視角', icon: <User size={17} />, onSelect: onSwitchChild },
      { id: 'logout', title: '登出', icon: <LogOut size={17} />, onSelect: onLogout },
    ],
    goals: [],
    growth: [],
    wishlist: [],
    history: [],
  };

  const heroMenuActions = heroMenuGroup ? heroSubMenuActions[heroMenuGroup] : heroRootMenuActions;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (sessionLoading || loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-blue-50 p-6 text-center text-blue-700">正在載入我的任務…</div>;
  }

  if (!hasSession || !session || (role !== 'child' && role !== 'parent')) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-blue-50 p-6 text-center text-blue-900">
        <p role="alert">登入狀態已失效或此帳號不是孩子成員，無法顯示孩子資料。</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => void retry()} className="rounded-xl bg-blue-500 px-5 py-3 font-bold text-white">重試</button>
          <button type="button" onClick={onLogout} className="rounded-xl bg-gray-200 px-5 py-3 font-bold text-gray-700">登出</button>
        </div>
      </div>
    );
  }

  if (error || !activeChild) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-blue-50 p-6 text-center text-blue-900">
        <p role="alert">{error || '找不到目前帳號對應的孩子資料。'}</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => void retry()} className="rounded-xl bg-blue-500 px-5 py-3 font-bold text-white">重試</button>
          <button type="button" onClick={onLogout} className="rounded-xl bg-gray-200 px-5 py-3 font-bold text-gray-700">登出</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hh-dashboard-screen hh-dashboard-screen--child flex flex-col min-h-[100dvh] bg-blue-50 pb-24">
      <DashboardCharacterHero
        sceneImage={activeCharacter.imageUrl}
        sceneImageDesktop={activeCharacter.desktopImageUrl}
        sceneAlt={`${activeCharacter.name}的冒險場景`}
        theme={activeChild.theme}
        eyebrow=""
        title={`早安，${activeChild.name}！`}
        subtitle=""
        firstStatLabel="加入天數"
        firstStatValue={activeChild.joinedDays}
        firstStatSuffix="天"
        secondStatLabel="我的點數"
        secondStatValue={childPoints}
        secondStatSuffix="pt"
        menuActions={heroMenuActions}
        rootMenuActions={heroRootMenuActions}
        activeMenuId={heroMenuGroup}
        menuVariant="child"
        onMenuClose={closeHeroMenu}
        menuOpen={heroMenuVisible}
        onMenuOpenChange={setHeroMenuVisible}
        actions={(
          <>
            <button
              onClick={() => toggleHeroMenuGroup('backpack')}
              aria-label={heroMenuGroup === 'backpack' && heroMenuVisible ? '收合功能選單' : '開啟功能選單'}
              title="功能選單"
              className="hh-character-icon-button"
              aria-expanded={heroMenuGroup === 'backpack' && heroMenuVisible}
            >
              <Backpack size={18} />
            </button>
          </>
        )}
      />

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 p-6 pb-28",
          heroFeature ? "hh-parent-content-modal" : "hh-parent-content-hidden"
        )}
        role={heroFeature ? 'dialog' : undefined}
        aria-modal={heroFeature ? true : undefined}
        aria-label={heroFeature ? '小孩功能頁面' : undefined}
      >
        {heroFeature && (
          <div className="hh-parent-content-modal-bar">
            <strong>{heroRootMenuActions.find((action) => action.id === heroFeature)?.title}</strong>
            <button type="button" onClick={closeChildFeature} aria-label="關閉功能頁面" className="hh-character-icon-button">
              <X size={18} />
            </button>
          </div>
        )}
        {isOffline && (
          <div role="status" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span>目前離線，變更尚未同步。</span>
            <button type="button" onClick={() => void retry()} disabled={loading} className="shrink-0 font-bold underline disabled:opacity-50">重試</button>
          </div>
        )}
        {/* Fixed Bottom Oval Capsule Tabs Bar */}
        <nav
          aria-label="選單分頁"
          className="hh-bottom-nav hh-bottom-nav--child"
          style={{ '--active-index': ['goals', 'growth', 'wishlist', 'history'].indexOf(activeTab), '--item-count': 4 } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={cn(
              "hh-bottom-nav-button",
              activeTab === 'goals' && "is-active"
            )}
          >
            目標
            {(proposedTasks.length + pendingTasks.length + revisionTasks.length) > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('growth')}
            className={cn(
              "hh-bottom-nav-button",
              activeTab === 'growth' && "is-active"
            )}
          >
            成長
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wishlist')}
            className={cn(
              "hh-bottom-nav-button",
              activeTab === 'wishlist' && "is-active"
            )}
          >
            許願
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cn(
              "hh-bottom-nav-button",
              activeTab === 'history' && "is-active"
            )}
          >
            兌換
          </button>
        </nav>

        {activeTab === 'goals' && (
          <div className="space-y-6">
            {proposedTasks.length > 0 && (
              <section className="space-y-3">
                <h3 className="px-2 font-black text-gray-600">{goalCopy.child.proposedTitle}</h3>
                {proposedTasks.map(task => <GoalCard key={task.id} task={task} />)}
              </section>
            )}

            {revisionTasks.length > 0 && (
              <section className="space-y-3">
                <h3 className="px-2 font-black text-orange-700">{goalCopy.child.revisionTitle}</h3>
                {revisionTasks.map(task => (
                  <GoalCard
                    key={task.id}
                    task={task}
                    action={(
                      <button
                        onClick={() => setSubmittingTask(task)}
                        className="flex min-h-12 min-w-16 items-center justify-center rounded-full bg-orange-500 px-4 text-sm font-black text-white shadow-md"
                      >
                        補充
                      </button>
                    )}
                  />
                ))}
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3 px-2">
                <div>
                <h3 className="font-black text-gray-700">{goalCopy.child.title}</h3>
                <p className="text-sm text-gray-500">{goalCopy.child.subtitle}</p>
                </div>
                <button type="button" className="hh-goal-proposal-inline" onClick={() => setShowGoalForm(true)} aria-label="新增今日目標">
                  <Plus size={18} /> 新增
                </button>
              </div>
            {childGoalTasks.map(task => {
              const hasTimer = typeof task.duration === 'number';
              const isRunning = task.timerIsRunning;
              const executionState = getTaskExecutionState(task.dueTime, task.endTime);
              const isReviewGateOpen = canStartTask(tasks, task.id);
              const isExecutable = executionState === 'available' && isReviewGateOpen;
              
              let timeLeft = hasTimer ? task.duration! * 60 : 0;
              
              if (isRunning) {
                if (task.timerEndTime) {
                  timeLeft = Math.max(0, Math.ceil((task.timerEndTime - now) / 1000));
                }
              } else {
                if (task.timerRemainingMs !== undefined && task.timerRemainingMs !== null) {
                  timeLeft = Math.max(0, Math.ceil(task.timerRemainingMs / 1000));
                }
              }

              const isFinished = hasTimer && timeLeft === 0 && (isRunning || (task.timerRemainingMs === 0));

              return (
                <GoalCard
                  key={task.id}
                  task={task}
                  action={hasTimer && !isFinished ? (
                    <button
                      onClick={() => toggleTimer(task)}
                      disabled={!isExecutable}
                      className={cn(
                        "flex min-h-16 min-w-[104px] max-w-[124px] px-5 py-3 flex-col items-center justify-center gap-1 rounded-full text-sm font-black text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500",
                        isRunning ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                      )}
                    >
                      {isRunning && <Clock size={24} />}
                      <span>{isReviewGateOpen ? (isExecutable ? (isRunning ? '暫停' : '開始') : executionState === 'expired' ? '已截止' : '未到') : '等待審核'}</span>
                      {hasTimer && <span className="text-xs opacity-90">{formatTime(timeLeft)}</span>}
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleFinishTask(task.id)}
                      disabled={actionPending || !isExecutable}
                      className="flex min-h-16 min-w-[104px] max-w-[124px] px-5 py-3 flex-col items-center justify-center gap-1 rounded-full bg-green-500 text-sm font-black text-white shadow-md transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      <CheckCircle2 size={28} />
                      <span>{isReviewGateOpen ? (isExecutable ? '完成' : executionState === 'expired' ? '已截止' : '未到') : '等待審核'}</span>
                    </button>
                  )}
                />
              );
            })}

            {childGoalTasks.length === 0 && (
              <div className="bg-green-50 p-8 rounded-3xl text-center border border-green-100">
                <CheckCircle2 size={64} className="mx-auto text-green-400 mb-4" />
                <h2 className="text-xl font-bold text-green-700 mb-2">{goalCopy.child.emptyChildTitle}</h2>
                <p className="text-green-600">{goalCopy.child.emptyChildBody}</p>
              </div>
            )}
            </section>

            <section className="space-y-3">
              <div className="px-2">
                <h3 className="font-black text-teal-800">{goalCopy.child.parentTitle}</h3>
                <p className="text-sm text-gray-500">{goalCopy.child.parentSubtitle}</p>
              </div>
              {parentGoalTasks.map(task => {
                const hasTimer = typeof task.duration === 'number';
                const isRunning = task.timerIsRunning;
                const executionState = getTaskExecutionState(task.dueTime, task.endTime);
                const isReviewGateOpen = canStartTask(tasks, task.id);
                const isExecutable = executionState === 'available' && isReviewGateOpen;

                let timeLeft = hasTimer ? task.duration! * 60 : 0;
                if (isRunning && task.timerEndTime) {
                  timeLeft = Math.max(0, Math.ceil((task.timerEndTime - now) / 1000));
                } else if (!isRunning && task.timerRemainingMs !== undefined && task.timerRemainingMs !== null) {
                  timeLeft = Math.max(0, Math.ceil(task.timerRemainingMs / 1000));
                }

                const isFinished = hasTimer && timeLeft === 0 && (isRunning || task.timerRemainingMs === 0);

                return (
                  <GoalCard
                    key={task.id}
                    task={task}
                    action={hasTimer && !isFinished ? (
                      <button
                        onClick={() => toggleTimer(task)}
                        disabled={!isExecutable}
                        className={cn(
                          "flex min-h-16 min-w-[104px] max-w-[124px] px-5 py-3 flex-col items-center justify-center gap-1 rounded-full text-sm font-black text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500",
                          isRunning ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                        )}
                      >
                        {isRunning && <Clock size={24} />}
                        <span>{isReviewGateOpen ? (isExecutable ? (isRunning ? '暫停' : '開始') : executionState === 'expired' ? '已截止' : '未到') : '等待審核'}</span>
                        <span className="text-xs opacity-90">{formatTime(timeLeft)}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleFinishTask(task.id)}
                        disabled={actionPending || !isExecutable}
                        className="flex min-h-16 min-w-[104px] max-w-[124px] px-5 py-3 flex-col items-center justify-center gap-1 rounded-full bg-green-500 text-sm font-black text-white shadow-md transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                      >
                        <CheckCircle2 size={28} />
                        <span>{isReviewGateOpen ? (isExecutable ? '完成' : executionState === 'expired' ? '已截止' : '未到') : '等待審核'}</span>
                      </button>
                    )}
                  />
                );
              })}
              {parentGoalTasks.length === 0 && (
                <div className="rounded-3xl border border-teal-100 bg-teal-50 p-6 text-center">
                  <p className="font-bold text-teal-800">{goalCopy.child.emptyParentTitle}</p>
                </div>
              )}
            </section>

            {pendingTasks.length > 0 && (
              <section className="space-y-3">
              <h3 className="text-gray-500 font-bold px-2">{goalCopy.child.pendingTitle}</h3>
                {hasBlockingReviewTask(pendingTasks) && (
                  <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">
                    這個任務需要家長審核後，才能繼續其他任務。
                  </p>
                )}
                <div className="space-y-3">
                  {pendingTasks.map(task => (
                    <GoalCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

          </div>
        )}

        {activeTab === 'growth' && growthSummary && (
          <GrowthSummaryPanel summaries={[growthSummary]} title="我的成長紀錄" completedTasks={completedTasksWithChild} />
        )}

        {activeTab === 'wishlist' && (
          <div className="space-y-6">
            <button
              onClick={() => setShowWishlistForm(true)}
              className="w-full bg-white border-2 border-dashed border-yellow-300 text-yellow-600 p-5 rounded-3xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-50 transition-colors"
            >
              <Plus size={24} /> 告訴爸媽我想要什麼...
            </button>

            <section className="space-y-3" aria-labelledby="pending-wishlist-title">
              <div className="flex items-center justify-between px-2">
                <div>
                  <h2 id="pending-wishlist-title" className="text-lg font-black text-gray-800">正在許願</h2>
                  <p className="text-sm text-gray-500">送出後等爸媽核准，就會變成可以兌換的獎勵。</p>
                </div>
                {wishlist.length > 0 && <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-bold text-yellow-700">{wishlist.length} 個等待中</span>}
              </div>
              {wishlist.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">目前沒有等待核准的願望。</div>
              ) : (
                <div className="space-y-3">
                  {wishlist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                      <div className="min-w-0">
                        <div className="break-words font-bold text-gray-800">{item.name}</div>
                        <div className="mt-1 text-xs font-bold text-yellow-700">等待爸媽核准</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWishlistToCancel(item)}
                        disabled={actionPending}
                        aria-label={`取消願望：${item.name}`}
                        className="min-h-11 shrink-0 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                      >
                        取消許願
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="grid grid-cols-2 gap-4">
              {rewards.map(reward => {
                const canAfford = childPoints >= reward.points;
                return (
                  <div key={reward.id} className={cn("bg-white p-5 rounded-3xl border shadow-sm flex flex-col items-center text-center relative overflow-hidden", canAfford ? "border-yellow-200" : "border-gray-100 opacity-80")}>
                    <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mb-3", canAfford ? "bg-yellow-100 text-yellow-600" : "bg-gray-100 text-gray-400")}>
                      <Gift size={32} />
                    </div>
                    <div className="text-lg font-bold text-gray-800 mb-2 line-clamp-2">{reward.name}</div>
                    <div className={cn("text-lg font-black mb-4", canAfford ? "text-yellow-500" : "text-gray-400")}>
                      {reward.points} pt
                    </div>
                    <button
                      onClick={() => setRewardToConfirm(reward)}
                      disabled={!canAfford || actionPending}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold transition-all",
                        canAfford ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-md active:scale-95" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      {canAfford ? '兌換' : '點數不夠'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 px-2 flex items-center gap-2">
              <History size={20} className="text-purple-500" />
              我的兌換紀錄
            </h2>
            {tickets.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl text-center border border-gray-100">
                <Gift size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">還沒有兌換過獎勵喔</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...tickets].reverse().map(ticket => (
                  <div key={ticket.id} className={cn("p-4 rounded-2xl border flex flex-col gap-2", ticket.status === 'fulfilled' ? "bg-gray-50 border-gray-200 opacity-70" : "bg-purple-50 border-purple-200")}>
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-gray-800 text-lg">{ticket.rewardName}</div>
                      <div className={cn("px-3 py-1 rounded-full text-xs font-bold", ticket.status === 'fulfilled' ? "bg-gray-200 text-gray-600" : "bg-purple-200 text-purple-700")}>
                        {ticket.status === 'fulfilled' ? '已使用' : '等待兌現'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 font-medium">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Overlays */}
      {showGoalForm && (
        <div className="hh-goal-proposal-overlay" role="dialog" aria-modal="true" aria-label="新增今日目標">
          <button type="button" className="hh-goal-proposal-backdrop" aria-label="關閉新增目標" onClick={() => closeChildForm(() => setShowGoalForm(false), '.hh-goal-proposal-sheet')} />
          <div className="hh-goal-proposal-sheet">
            <div className="hh-goal-proposal-sheet-bar">
              <strong>新增今日目標</strong>
              <button type="button" onClick={() => closeChildForm(() => setShowGoalForm(false), '.hh-goal-proposal-sheet')} aria-label="關閉新增目標" className="hh-character-icon-button"><X size={18} /></button>
            </div>
            <GoalProposalForm templates={taskTemplates} loading={actionPending || loading} onSubmit={handleSubmitGoalProposal} />
          </div>
        </div>
      )}
      {submittingTask && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="hh-form-modal-panel w-full max-w-md animate-slide-up">
            <GoalSubmissionForm
              task={submittingTask}
              loading={actionPending}
              onCancel={() => dismissWithAnimation(() => setSubmittingTask(null))}
              onSubmit={(input) => handleSubmitReflection(submittingTask.id, input)}
            />
          </div>
        </div>
      )}

      {showWishlistForm && (
        <div className="hh-safe-modal-shell fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[70]">
          <div className="hh-form-modal-panel bg-white w-full max-w-sm animate-slide-up rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">我要許願</h3>
              <button onClick={() => closeChildForm(() => setShowWishlistForm(false))} aria-label="關閉新增許願" className="p-2 text-gray-400 bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <input
              type="text"
              value={wishName}
              onChange={e => setWishName(e.target.value)}
              className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-400 outline-none text-lg mb-6"
              placeholder="例如：想要去遊樂園"
            />
            <button onClick={() => void handleAddWish()} disabled={actionPending || !wishName.trim()} className="w-full p-4 rounded-xl font-bold bg-yellow-400 text-yellow-900 text-lg disabled:cursor-not-allowed disabled:opacity-60">送出願望</button>
          </div>
        </div>
      )}

      {rewardToConfirm && (
        <div className="hh-safe-modal-shell fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6">
          <div className="hh-reward-confirm-panel w-full max-w-sm animate-slide-up rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-gray-900">確認兌換獎勵</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">確定要用 {rewardToConfirm.points} pt 兌換「{rewardToConfirm.name}」嗎？</p>
              </div>
              <button type="button" onClick={() => dismissWithAnimation(() => setRewardToConfirm(null), '.hh-reward-confirm-panel')} aria-label="關閉" className="flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => dismissWithAnimation(() => setRewardToConfirm(null), '.hh-reward-confirm-panel')} className="min-h-12 rounded-2xl bg-gray-100 px-4 font-black text-gray-600">先不要</button>
              <button type="button" onClick={() => void handleRedeem(rewardToConfirm)} disabled={actionPending} className="min-h-12 rounded-2xl bg-yellow-400 px-4 font-black text-yellow-950 disabled:cursor-wait disabled:opacity-60">確認兌換</button>
            </div>
          </div>
        </div>
      )}

      {wishlistToCancel && (
        <div className="hh-safe-modal-shell fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6">
          <div className="hh-wishlist-cancel-panel w-full max-w-sm animate-slide-up rounded-3xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="wishlist-cancel-title">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 id="wishlist-cancel-title" className="text-xl font-black text-gray-900">確認取消許願</h3>
                <p className="mt-2 break-words text-sm leading-6 text-gray-500">確定要取消「{wishlistToCancel.name}」嗎？取消後需要重新許願才能再請爸媽核准。</p>
              </div>
              <button type="button" onClick={() => dismissWithAnimation(() => setWishlistToCancel(null), '.hh-wishlist-cancel-panel')} aria-label="關閉" className="flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => dismissWithAnimation(() => setWishlistToCancel(null), '.hh-wishlist-cancel-panel')} className="min-h-12 rounded-2xl bg-gray-100 px-4 font-black text-gray-600">先不要</button>
              <button
                type="button"
                onClick={() => {
                  const item = wishlistToCancel;
                  dismissWithAnimation(() => setWishlistToCancel(null), '.hh-wishlist-cancel-panel');
                  void handleCancelWish(item.id);
                }}
                disabled={actionPending}
                className="min-h-12 rounded-2xl bg-red-500 px-4 font-black text-white disabled:cursor-wait disabled:opacity-60"
              >
                確認取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotificationSettings && (
        <div className="hh-safe-modal-shell fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm animate-slide-up rounded-3xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="child-notification-settings-title">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-blue-500">背包設定</p>
                <h3 id="child-notification-settings-title" className="mt-1 text-xl font-black text-gray-900">通知設定</h3>
              </div>
              <button type="button" onClick={() => setShowNotificationSettings(false)} aria-label="關閉通知設定" className="flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <PushNotificationSettings settings={notificationSettings} />
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={cn('hh-toast fixed top-4 left-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-[100] flex items-center gap-2 whitespace-nowrap', toastLeaving && 'is-leaving')}>
          <Star size={16} className="text-yellow-400 fill-yellow-400" />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
