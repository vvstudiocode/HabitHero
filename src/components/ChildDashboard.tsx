import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { useAuthSession } from '../auth';
import { Backpack, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Flower2, Gift, LogOut, MessageCircle, Plus, ScrollText, ShoppingBag as ShoppingBagIcon, Star, X, History, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { dismissWithAnimation } from '../lib/utils';
import { formatTaskTime, formatTaskWindow, haveSameIds } from '../lib/child-dashboard-display';
import {
  preventNativeAppContextMenu,
  preventNativeAppDragStart,
} from '../lib/mobile-interaction';
import { Reward } from '../types';
import { GoalProposalForm } from '../features/growth/components/GoalProposalForm';
import { GrowthSummaryPanel } from '../features/growth/components/GrowthSummaryPanel';
import { getChildGrowthSummary } from '../features/growth/growth-stats';
import type { GoalProposalInput, GrowthTask, GrowthTaskTemplate } from '../features/growth/types';
import { getTaskExecutionState } from '../lib/task-time';
import {
  startTimerCompletionMusic,
  stopTimerCompletionMusic,
  TIMER_COMPLETION_MUSIC_SRC,
} from '../lib/task-completion-audio';
import { getChildMenuNotifications } from '../lib/menu-notifications';
import { DashboardCharacterHero } from './DashboardCharacterHero';
import { ChildDashboardBackgroundMusic } from './ChildDashboardBackgroundMusic';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { WorldPreparingScreen } from './WorldPreparingScreen';
import type { ChildGamePanelKind } from '../features/world/components/ChildGamePanel';
import { emptyChildGameData, type GamePurchaseResult, type WorldMutationResult } from '../features/world/contracts';
import { getFollowingPetInventoryIds } from '../features/world/following-pet-state';
import { getPetActionPlan, type PetAction } from '../features/world/pet-action-state';
import { getRoamingPetSnapshot } from '../features/world/components/roaming-pet-state';
import type { PetSelection } from '../features/world/prototype-world-runtime';
import { getPetNameDisplayPreference, setPetNameDisplayPreference } from '../features/world/pet-name-display-preference';
import {
  CLEAN_MODE_DOUBLE_TAP_MAX_INTERVAL_MS,
  CLEAN_MODE_DOUBLE_TAP_MAX_MOVEMENT_PX,
  CLEAN_MODE_DOUBLE_TAP_MAX_TAP_DURATION_MS,
  isSingleFingerDoubleTapGesture,
} from '../features/world/clean-screen-mode';
import { buildCollisionCircles } from '../features/world/world-collision';
import { toWorldMutationErrorMessage } from '../features/world/world-errors';
import { WorldSocialLayer } from '../features/world-social/WorldSocialLayer';
import { useWorldSocialSession } from '../features/world-social/world-social-session';
import { SharedDecorationShareDialog } from '../features/shared-decorations/SharedDecorationShareDialog';
import { isDecorationPlacementValid } from '../features/world/world-placement';
import {
  createChildDecorationActions,
  type DecorationPlacementSession,
  type DecorationPurchasePrompt,
  type SharedDecorationItem,
} from '../features/shared-decorations/child-decoration-actions';
import { getBackgroundMusicPreference, setBackgroundMusicPreference } from '../lib/background-music-preference';
import { useSafeAreaCutoutSide } from '../hooks/useSafeAreaCutoutSide';
import { useDayNightPreference } from '../features/world/use-day-night-preference';
import { ChildAdventureBoard } from '../features/adventures/components/ChildAdventureBoard';
import { AdventureTableDialogue } from '../features/adventures/components/AdventureTableDialogue';
import type { AdventureTableScreenPosition } from '../features/world/adventure-table';
import { AdventureRewardCelebration } from '../features/adventures/components/AdventureRewardCelebration';
import { TodayAdventureSummary } from '../features/adventures/components/TodayAdventureSummary';
import {
  getAdventureTaskState,
  hasStartedAdventureTimer,
} from '../features/adventures/adventure-progress';
import {
  createAdventureRewardBundle,
  createInitialAdventureRewardNoticeState,
  getApprovedAdventureRewardEvents,
  getUnseenAdventureRewardEvents,
  markAdventureRewardTaskSubmitted,
  markAdventureRewardEventsSeen,
  readAdventureRewardNoticeState,
  writeAdventureRewardNoticeState,
  type AdventureRewardBundle,
} from '../features/adventures/adventure-reward-notice';
import type { AdventureCompletionInput, AdventureTask } from '../features/adventures/types';
import { selectChildAdventureState } from '../lib/child-dashboard-adventure-state';
import { PointValue } from './shared/PointValue';
import { PointLedgerHistory } from './PointLedgerHistory';

interface GrowthChildActions {
  proposeGoal?: (childId: string, input: GoalProposalInput) => Promise<void>;
  proposeChildGoal?: (childId: string, input: GoalProposalInput & { icon: string }) => Promise<string>;
  submitAdventureCompletion?: (taskId: string, input: AdventureCompletionInput) => Promise<void>;
}

interface ChildDashboardProps {
  onLogout: () => void;
  onSwitchChild: () => void;
}

type ChildTab = 'goals' | 'growth' | 'wishlist';
type ChildFeature = ChildTab | ChildGamePanelKind;
type ChildMenuGroup = ChildFeature | 'backpack';
type ChildAdventureRewardNotice =
  | { mode: 'submitted'; taskName: string; pendingStars: number }
  | { mode: 'approved'; bundle: AdventureRewardBundle };
const REWARDS_PER_PAGE = 18;
const TerrainWorldLayer = lazy(() => import('../features/world/TerrainWorldLayer').then((module) => ({ default: module.TerrainWorldLayer })));
const ChildGamePanel = lazy(() => import('../features/world/components/ChildGamePanel').then((module) => ({ default: module.ChildGamePanel })));

export function ChildDashboard({ onLogout, onSwitchChild }: ChildDashboardProps) {
  const appStore = useAppStore() as ReturnType<typeof useAppStore> & GrowthChildActions;
  const landscapeCutoutSide = useSafeAreaCutoutSide();
  const {
    state,
    familyId,
    addTask,
    redeemReward,
    abandonChildAdventure,
    loadPointLedgerPage,
    addWishlist,
    deleteWishlist,
    startTaskTimer,
    pauseTaskTimer,
    ensureDailyAdventureOccurrences,
    startAdventureTimer,
    pauseAdventureTimer,
    resumeAdventureTimer,
    loading,
    error,
    retry,
    role,
    hasSession,
    isOffline,
    mutationPending,
    purchaseGameItem,
    equipGameCharacter,
    setPetDisplayName,
    setFollowingPets,
    setRoamingPets,
    placeWorldEntity,
    updateWorldEntityTransform,
    removeWorldEntity,
    collectAllWorldDecorations,
  } = appStore;
  const { session, loading: sessionLoading } = useAuthSession();
  const [activeTab, setActiveTab] = useState<ChildTab>('goals');
  const [rewardPage, setRewardPage] = useState(1);
  const [heroFeature, setHeroFeature] = useState<ChildFeature | null>(null);
  const [decorationPurchasePrompt, setDecorationPurchasePrompt] = useState<DecorationPurchasePrompt | null>(null);
  const [decorationPlacement, setDecorationPlacement] = useState<DecorationPlacementSession | null>(null);
  const [decorationPlacementPending, setDecorationPlacementPending] = useState(false);
  const placementSubmissionInFlightRef = useRef(false);
  const [shareDecorationItem, setShareDecorationItem] = useState<SharedDecorationItem | null>(null);
  const [, setHeroMenuGroup] = useState<ChildMenuGroup | null>(null);
  const [, setHeroMenuVisible] = useState(false);
  const [isVisitingFriendWorld, setIsVisitingFriendWorld] = useState(false);
  const [leaveFriendWorldRequest, setLeaveFriendWorldRequest] = useState(0);
  const [cleanMode, setCleanMode] = useState(false);
  const [cleanModeHintVisible, setCleanModeHintVisible] = useState(false);
  const featureContentRef = useRef<HTMLElement>(null);
  const hasShownCleanModeHint = useRef(false);
  const cleanModeGestureRef = useRef<{
    active: {
      pointerId: number;
      x: number;
      y: number;
      startedAt: number;
      maxMovementPx: number;
    } | null;
    tapCount: number;
    lastTapAt: number;
    maxMovementPx: number;
    maxTapDurationMs: number;
  } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    featureContentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab, heroFeature]);
  
  // A direct child session uses its own child id. In parent child-mode, the
  // parent session operates on the explicitly selected family child.
  const activeChildId = role === 'parent' ? state.parentActiveChildId : state.childLoggedInId;
  const activeChild = activeChildId
    ? state.children.find(c => c.id === activeChildId)
    : undefined;
  const gameData = activeChildId ? state.gameDataByChildId[activeChildId] ?? emptyChildGameData() : emptyChildGameData();
  const socialSession = useWorldSocialSession();
  const worldGameData = socialSession?.gameData ?? gameData;
  const activeDecorationCollisionCircles = buildCollisionCircles(
    worldGameData.worldEntities
      .filter((entity) => entity.entityKind === 'decoration' && entity.isActive && entity.id !== decorationPlacement?.entityId)
      .map((entity) => ({
        positionX: entity.x,
        positionZ: entity.z,
        collisionRadius: entity.collisionRadius ?? 0.3,
        scale: entity.scale,
      })),
  );
  const placementItem = decorationPlacement
    ? worldGameData.catalog.find((item) => item.id === decorationPlacement.catalogItemId && item.itemType === 'decoration')
    : undefined;
  const placementValid = Boolean(
    decorationPlacement
      && placementItem
      && isDecorationPlacementValid(decorationPlacement.draft, placementItem, activeDecorationCollisionCircles),
  );
  const [showPetNames, setShowPetNames] = useState(() => getPetNameDisplayPreference(activeChildId ?? '')), [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(() => getBackgroundMusicPreference(activeChildId ?? ''));
  const { dayNightEnabled, onDayNightChange } = useDayNightPreference(activeChildId);

  useEffect(() => {
    setShowPetNames(getPetNameDisplayPreference(activeChildId ?? ''));
    setBackgroundMusicEnabled(getBackgroundMusicPreference(activeChildId ?? ''));
    setDecorationPurchasePrompt(null);
    setDecorationPlacement(null);
    setShareDecorationItem(null);
    setCleanMode(false);
    setCleanModeHintVisible(false);
    hasShownCleanModeHint.current = false;
  }, [activeChildId]);

  useEffect(() => {
    cleanModeGestureRef.current = {
      active: null,
      tapCount: 0,
      lastTapAt: 0,
      maxMovementPx: 0,
      maxTapDurationMs: 0,
    };
    if (!cleanMode) return undefined;

    const eventTime = (event: PointerEvent) => Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
    const resetGesture = () => {
      cleanModeGestureRef.current = {
        active: null,
        tapCount: 0,
        lastTapAt: 0,
        maxMovementPx: 0,
        maxTapDurationMs: 0,
      };
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (event.target instanceof Element && event.target.closest('[data-clean-mode-hint]')) {
        resetGesture();
        return;
      }
      let gesture = cleanModeGestureRef.current;
      if (!gesture) {
        resetGesture();
        gesture = cleanModeGestureRef.current;
      }
      if (!gesture) return;
      if (gesture.active) {
        resetGesture();
        return;
      }
      const now = eventTime(event);
      if (gesture.tapCount > 0 && now - gesture.lastTapAt > CLEAN_MODE_DOUBLE_TAP_MAX_INTERVAL_MS) {
        resetGesture();
        gesture = cleanModeGestureRef.current;
      }
      if (!gesture) return;
      gesture.active = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startedAt: now,
        maxMovementPx: 0,
      };
    };
    const handlePointerMove = (event: PointerEvent) => {
      const gesture = cleanModeGestureRef.current;
      const active = gesture?.active;
      if (!gesture || !active || active.pointerId !== event.pointerId) return;
      active.maxMovementPx = Math.max(
        active.maxMovementPx,
        Math.hypot(event.clientX - active.x, event.clientY - active.y),
      );
    };
    const handlePointerEnd = (event: PointerEvent, cancelled: boolean) => {
      const gesture = cleanModeGestureRef.current;
      const active = gesture?.active;
      if (!gesture || !active || active.pointerId !== event.pointerId) return;
      gesture.active = null;
      if (cancelled) {
        resetGesture();
        return;
      }
      const now = eventTime(event);
      const tapDurationMs = now - active.startedAt;
      if (tapDurationMs < 0 || tapDurationMs > CLEAN_MODE_DOUBLE_TAP_MAX_TAP_DURATION_MS || active.maxMovementPx > CLEAN_MODE_DOUBLE_TAP_MAX_MOVEMENT_PX) {
        resetGesture();
        return;
      }

      const intervalMs = gesture.tapCount === 0 ? 0 : now - gesture.lastTapAt;
      if (gesture.tapCount > 0 && (intervalMs < 0 || intervalMs > CLEAN_MODE_DOUBLE_TAP_MAX_INTERVAL_MS)) {
        gesture.tapCount = 0;
        gesture.maxMovementPx = 0;
        gesture.maxTapDurationMs = 0;
      }
      gesture.tapCount += 1;
      gesture.lastTapAt = now;
      gesture.maxMovementPx = Math.max(gesture.maxMovementPx, active.maxMovementPx);
      gesture.maxTapDurationMs = Math.max(gesture.maxTapDurationMs, tapDurationMs);
      const shouldRestore = isSingleFingerDoubleTapGesture({
        tapCount: gesture.tapCount,
        intervalMs: gesture.tapCount === 2 ? intervalMs : 0,
        maxMovementPx: gesture.maxMovementPx,
        maxTapDurationMs: gesture.maxTapDurationMs,
      });
      if (shouldRestore) {
        setCleanMode(false);
        setCleanModeHintVisible(false);
        resetGesture();
      } else if (gesture.tapCount >= 2) {
        resetGesture();
      }
    };

    const handlePointerUp = (event: PointerEvent) => handlePointerEnd(event, false);
    const handlePointerCancel = (event: PointerEvent) => handlePointerEnd(event, true);
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerCancel, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      cleanModeGestureRef.current = null;
    };
  }, [cleanMode]);

  const handleShowPetNamesChange = (visible: boolean) => {
    if (!activeChildId) return;
    setShowPetNames(visible);
    setPetNameDisplayPreference(activeChildId, visible);
  };

  const handleBackgroundMusicChange = (enabled: boolean) => {
    if (!activeChildId) return;
    setBackgroundMusicEnabled(enabled);
    setBackgroundMusicPreference(activeChildId, enabled);
  };

  const toggleCleanMode = () => {
    if (cleanMode) {
      setCleanMode(false);
      setCleanModeHintVisible(false);
      return;
    }
    setCleanMode(true);
    if (hasShownCleanModeHint.current) return;
    hasShownCleanModeHint.current = true;
    setCleanModeHintVisible(true);
  };
  const activeGeneralAdventureGroup = state.adventureGroups?.find(
    (group) => group.childProfileId === activeChildId && group.status === 'active',
  );

  const tasks = (activeChild?.tasks || []) as GrowthTask[];
  const rewards = activeChild?.rewards || [];
  const tickets = activeChild?.tickets || [];
  const wishlist = activeChild?.wishlist || [];
  const childPoints = activeChild?.points || 0;
  const rewardTotalPages = Math.max(1, Math.ceil(rewards.length / REWARDS_PER_PAGE));
  const visibleRewards = rewards.slice((rewardPage - 1) * REWARDS_PER_PAGE, rewardPage * REWARDS_PER_PAGE);
  const taskTemplates = state.taskTemplates as GrowthTaskTemplate[];

  useEffect(() => {
    setRewardPage(1);
  }, [activeChildId, rewards.length]);

  useEffect(() => {
    if (rewardPage > rewardTotalPages) setRewardPage(rewardTotalPages);
  }, [rewardPage, rewardTotalPages]);

  // Wishlist Form
  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [adventureOpenRequest, setAdventureOpenRequest] = useState<{ id: string; requestId: number } | null>(null);
  const [wishName, setWishName] = useState('');
  const [wishlistToCancel, setWishlistToCancel] = useState<import('../types').WishlistItem | null>(null);
  const [rewardToConfirm, setRewardToConfirm] = useState<Reward | null>(null);
  const [adventureRewardNotice, setAdventureRewardNotice] = useState<ChildAdventureRewardNotice | null>(null);
  const [adventureTablePromptPosition, setAdventureTablePromptPosition] = useState<AdventureTableScreenPosition | null>(null);
  const [adventureTableScreenPosition, setAdventureTableScreenPosition] = useState<AdventureTableScreenPosition | null>(null);
  const [adventureBoardOpen, setAdventureBoardOpen] = useState(false);

  useEffect(() => {
    if (!heroFeature && !decorationPlacement && !adventureRewardNotice) return;
    setCleanMode(false);
    setCleanModeHintVisible(false);
  }, [adventureRewardNotice, decorationPlacement, heroFeature]);
  
  // Toast Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPointsRef = useRef<{ childId: string; points: number } | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const completionMusicTaskIdRef = useRef<string | null>(null);
  const completionAudioRef = useRef<HTMLAudioElement | null>(null);
  const completionAlarmDismissedTaskIdsRef = useRef<Set<string>>(new Set());

  const displayedPoints = childPoints;
  const displayedScrolls = gameData.walletBalance;
  
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

  useEffect(() => {
    if (!activeChild) return;
    const previous = previousPointsRef.current;
    if (previous && previous.childId === activeChild.id && previous.points !== activeChild.points) {
      const delta = activeChild.points - previous.points;
      showToast(delta > 0 ? `點數增加 ${delta} 點！` : `點數減少 ${Math.abs(delta)} 點`);
    }
    previousPointsRef.current = { childId: activeChild.id, points: activeChild.points };
  }, [activeChild?.id, activeChild?.points]);

  const notificationSettings = useNotificationSettings({
    familyId,
    childProfileId: activeChild?.id ?? null,
  });

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // The adventure board is the only place that starts or completes an
  // adventure. Today's Goals is a read-only progress and history summary.
  const { adventureTasks, adventureDate, todayAdventureSummary } = selectChildAdventureState(tasks, now);

  useEffect(() => {
    setAdventureRewardNotice(null);
  }, [activeChildId]);

  useEffect(() => {
    setAdventureTablePromptPosition(null);
    setAdventureTableScreenPosition(null);
    setAdventureBoardOpen(false);
  }, [activeChildId]);

  useEffect(() => {
    if (!activeChildId || !activeChild || loading || adventureRewardNotice) return;
    const events = getApprovedAdventureRewardEvents(adventureTasks);
    const storedState = readAdventureRewardNoticeState(activeChildId);
    if (!storedState.initialized) {
      writeAdventureRewardNoticeState(
        activeChildId,
        createInitialAdventureRewardNoticeState(events, storedState.submittedTaskIds),
      );
      return;
    }
    const unseenEvents = getUnseenAdventureRewardEvents(events, storedState.seenTaskIds);
    if (unseenEvents.length === 0) return;
    const bundle = createAdventureRewardBundle(unseenEvents);
    setAdventureRewardNotice({ mode: 'approved', bundle });
  }, [activeChild, activeChildId, adventureRewardNotice, adventureTasks, loading]);

  const growthTasksWithChild = activeChild ? tasks.map((task) => ({ ...task, childId: activeChild.id, childName: activeChild.name })) : [];
  const growthSummary = activeChild ? getChildGrowthSummary({ ...activeChild, tasks } as typeof activeChild, state.ledger) : null;
  const childMenuNotifications = getChildMenuNotifications({
    goals: todayAdventureSummary.daily.filter((task) => getAdventureTaskState(task) !== 'completed').length + todayAdventureSummary.generalActive.length,
    rewardTickets: tickets.length,
    wishlist: wishlist.length,
  });

  const getCompletionAudio = () => {
    if (!completionAudioRef.current) {
      const audio = new Audio(TIMER_COMPLETION_MUSIC_SRC);
      audio.preload = 'auto';
      completionAudioRef.current = audio;
    }
    return completionAudioRef.current;
  };

  const stopCompletionMusic = () => {
    if (completionAudioRef.current) {
      stopTimerCompletionMusic(completionAudioRef.current);
    }
    completionMusicTaskIdRef.current = null;
  };

  const dismissCompletionAlarm = (taskId: string) => {
    completionAlarmDismissedTaskIdsRef.current.add(taskId);
    if (completionMusicTaskIdRef.current === taskId) {
      stopCompletionMusic();
    }
  };

  useEffect(() => () => {
    stopCompletionMusic();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeChildId || isOffline) return;
    void ensureDailyAdventureOccurrences(activeChildId, adventureDate).catch(() => {
      showToast('每日冒險同步失敗，請稍後重試。');
    });
  }, [activeChildId, adventureDate, isOffline]);

  useEffect(() => {
    const completionCandidates = tasks.filter(
      (task) => (task.status === 'todo' || task.status === 'revision_requested')
        && task.timerIsRunning
        && task.timerEndTime !== null
        && task.timerEndTime !== undefined
        && now >= task.timerEndTime,
    );
    const activeCompletionTaskIds = new Set(completionCandidates.map((task) => task.id));
    for (const taskId of completionAlarmDismissedTaskIdsRef.current) {
      if (!activeCompletionTaskIds.has(taskId)) {
        completionAlarmDismissedTaskIdsRef.current.delete(taskId);
      }
    }

    const completedTask = tasks.find(
      (task) => activeCompletionTaskIds.has(task.id)
        && !completionAlarmDismissedTaskIdsRef.current.has(task.id),
    );

    if (!completedTask) {
      if (completionMusicTaskIdRef.current !== null) {
        stopCompletionMusic();
      }
      return;
    }

    if (completionMusicTaskIdRef.current === completedTask.id) return;

    stopCompletionMusic();
    completionMusicTaskIdRef.current = completedTask.id;
    void startTimerCompletionMusic(getCompletionAudio()).then((didPlay) => {
      if (!didPlay && completionMusicTaskIdRef.current === completedTask.id) {
        completionMusicTaskIdRef.current = null;
      }
    });
  }, [now, tasks]);

  const toggleTimer = async (task: import('../types').Task) => {
    if (!activeChild) return;

    const timerStarted = hasStartedAdventureTimer(task);
    const timerComplete = task.timerIsRunning
      && task.timerEndTime !== null
      && task.timerEndTime !== undefined
      && now >= task.timerEndTime;
    
    if (task.timerIsRunning) {
      if (timerComplete) dismissCompletionAlarm(task.id);
      if (task.adventureType || task.requiresTimer) await pauseAdventureTimer(task.id);
      else pauseTaskTimer(activeChild.id, task.id);
    } else {
      const executionState = getTaskExecutionState(task.dueTime, task.endTime);
      if (!timerStarted && executionState !== 'available') {
        showToast(executionState === 'expired' ? `這次任務已截止，下次時間：${formatTaskWindow(task)}。` : `還沒到可開始時間：${formatTaskTime(task.dueTime)}。`);
        return;
      }
      if (timerStarted && task.timerRemainingMs !== undefined && task.timerRemainingMs !== null && task.timerRemainingMs <= 0) {
        showToast('計時已完成，請送出任務。');
        return;
      }
      // Check if any other task is RUNNING
      const isAnotherRunning = tasks.some(t => t.timerIsRunning && t.id !== task.id);
      if (isAnotherRunning) {
        showToast("一次只能執行一個任務喔！請先暫停其他任務。");
        return;
      }
      if (task.adventureType || task.requiresTimer) {
        if (task.timerRemainingMs !== undefined && task.timerRemainingMs !== null) {
          await resumeAdventureTimer(task.id);
        } else {
          await startAdventureTimer(task.id);
        }
      } else {
        startTaskTimer(activeChild.id, task.id);
      }
    }
  };

  const handleProposeGoal = async (input: GoalProposalInput): Promise<string | null> => {
    if (!activeChild) return null;
    setActionPending(true);
    try {
      let taskId: string | null = null;
      if (appStore.proposeGoal) {
        await appStore.proposeGoal(activeChild.id, input);
      } else if (appStore.proposeChildGoal) {
        taskId = await appStore.proposeChildGoal(activeChild.id, { ...input, icon: 'Star' });
      } else {
        await addTask(activeChild.id, { name: input.name, points: input.points, icon: 'Star', category: input.category, dueTime: input.dueTime, endTime: input.endTime, duration: input.duration, origin: 'child_proposed' } as never);
      }
      showToast('一般冒險已建立，現在就可以開始。');
      return taskId;
    } finally {
      setActionPending(false);
    }
  };

  const handleSubmitGoalProposal = async (input: GoalProposalInput) => {
    await handleProposeGoal(input);
    dismissWithAnimation(() => setShowGoalForm(false), '.hh-goal-proposal-overlay');
  };

  const handleAdventureCompletion = async (task: AdventureTask, input: AdventureCompletionInput) => {
    if (!activeChild) return;
    setActionPending(true);
    try {
      if (!appStore.submitAdventureCompletion) {
        throw new Error('目前無法安全送出冒險，請重新整理後再試。');
      }
      await appStore.submitAdventureCompletion(task.id, input);
      const noticeState = readAdventureRewardNoticeState(activeChild.id);
      writeAdventureRewardNoticeState(
        activeChild.id,
        markAdventureRewardTaskSubmitted(noticeState, task.id),
      );
      setAdventureRewardNotice((current) => current ?? {
          mode: 'submitted',
          taskName: task.name,
          pendingStars: Math.max(0, Math.trunc(task.points)),
        });
    } finally {
      setActionPending(false);
    }
  };

  const handleAbandonAdventure = async (task: AdventureTask) => {
    setActionPending(true);
    try {
      await abandonChildAdventure(task.id);
      showToast('已放棄這個冒險，家長仍看得到紀錄。');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '放棄冒險失敗，請再試一次。');
      throw error;
    } finally {
      setActionPending(false);
    }
  };

  const dismissAdventureRewardNotice = () => {
    const notice = adventureRewardNotice;
    if (notice?.mode === 'approved' && activeChildId) {
      const currentState = readAdventureRewardNoticeState(activeChildId);
      writeAdventureRewardNoticeState(
        activeChildId,
        markAdventureRewardEventsSeen(currentState, notice.bundle.events),
      );
    }
    setAdventureRewardNotice(null);
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

  const handleGamePurchase = async (
    catalogItemId: string,
    quantity: number,
    idempotencyKey: string,
  ): Promise<GamePurchaseResult> => {
    if (!activeChild) throw new Error('找不到目前的孩子資料。');
    const result = await purchaseGameItem(activeChild.id, catalogItemId, quantity, idempotencyKey);
    const item = gameData.catalog.find((candidate) => candidate.id === catalogItemId);
    if (item?.itemType === 'decoration') {
      setDecorationPurchasePrompt({ inventoryItemId: result.inventoryItemId, item });
    }
    return result;
  };

  const openChildFeature = (feature: ChildFeature) => {
    if (feature === 'goals' || feature === 'growth' || feature === 'wishlist') setActiveTab(feature);
    setHeroFeature(feature);
    setHeroMenuGroup(null);
    setHeroMenuVisible(false);
  };

  const leaveFriendWorld = () => {
    setLeaveFriendWorldRequest((request) => request + 1);
  };

  const closeChildForm = (closeForm: () => void, selector?: string) => {
    dismissWithAnimation(closeForm, selector);
  };

  const closeChildFeature = (afterClose?: () => void) => {
    dismissWithAnimation(() => {
      setHeroFeature(null);
      afterClose?.();
    }, '.hh-parent-content-modal', 260);
    setHeroMenuGroup(null);
    setHeroMenuVisible(false);
  };

  const {
    startDecorationPlacement,
    startOwnedDecorationPlacement,
    startExistingDecorationPlacement,
    collectSelectedDecoration,
    leaveDecorationInInventory,
    handleDecorationPlacementPositionChange,
    handleDecorationPlacementControl,
    handleDecorationPlacementGesture,
    completeDecorationPlacement,
    shareDecorationWithFriend,
    collectAllSharedDecorations,
    cancelDecorationPlacement,
  } = createChildDecorationActions({
    activeChildId,
    gameData,
    worldGameData,
    socialSession,
    decorationPurchasePrompt,
    decorationPlacement,
    placementItem,
    placementValid,
    decorationPlacementPending,
    placementSubmissionInFlight: placementSubmissionInFlightRef,
    shareDecorationItem,
    closeChildFeature,
    showToast,
    setDecorationPurchasePrompt,
    setDecorationPlacement,
    setDecorationPlacementPending,
    setShareDecorationItem,
    setHeroFeature,
    setHeroMenuGroup,
    setHeroMenuVisible,
    removeWorldEntity,
    updateWorldEntityTransform,
    placeWorldEntity,
  });

  const handlePetAction = async (selection: PetSelection, action: PetAction) => {
    if (!activeChildId || mutationPending) return false;

    const currentFollowingIds = getFollowingPetInventoryIds(gameData);
    const currentRoamingIds = getRoamingPetSnapshot(gameData);
    const plan = getPetActionPlan({
      action,
      inventoryItemId: selection.inventoryItemId,
      followingIds: currentFollowingIds,
      roamingIds: currentRoamingIds,
    });
    const existingActivePetEntity = action === 'idle' && selection.following
      ? gameData.worldEntities.find((entity) => (
        entity.entityKind === 'pet'
        && entity.inventoryItemId === selection.inventoryItemId
        && entity.isActive
      ))
      : undefined;
    const transform = {
      x: selection.worldPosition.x,
      y: 0,
      z: selection.worldPosition.z,
      rotationX: 0,
      rotationY: selection.rotationY,
      rotationZ: 0,
      scale: selection.scale,
    };

    try {
      let expectedRevision = gameData.worldRevision;
      if (action === 'idle' && selection.following && existingActivePetEntity) {
        const result = await removeWorldEntity(activeChildId, {
          inventoryItemId: selection.inventoryItemId,
          entityId: existingActivePetEntity.id,
          expectedRevision,
        });
        expectedRevision = result.revision;
      }
      const syncFollowing = async () => {
        if (haveSameIds(currentFollowingIds, plan.followingIds)) return;
        const result = await setFollowingPets(activeChildId, plan.followingIds);
        expectedRevision = result.revision;
      };
      const syncRoaming = async () => {
        if (haveSameIds(currentRoamingIds, plan.roamingIds)) return;
        const positionOverrides = action === 'wander'
          ? { [selection.inventoryItemId]: transform }
          : undefined;
        const result = await setRoamingPets(
          activeChildId,
          plan.roamingIds,
          positionOverrides,
        );
        expectedRevision = result.revision;
      };

      // A pet cannot be in both queues. Remove it from roaming before adding
      // it to following, otherwise the database guard rejects the transition.
      if (action === 'follow') {
        await syncRoaming();
        await syncFollowing();
      } else {
        await syncFollowing();
        await syncRoaming();
      }

      if (action === 'wander') {
        const result = await updateWorldEntityTransform(activeChildId, {
          inventoryItemId: selection.inventoryItemId,
          expectedRevision,
          transform,
        });
        expectedRevision = result.revision;
        showToast('寵物開始巡遊了。');
        return true;
      }

      if (action === 'follow') {
        showToast('寵物加入跟隨隊列了。');
        return true;
      }

      if (action === 'idle' && plan.shouldPlaceIdleEntity) {
        await placeWorldEntity(activeChildId, {
          inventoryItemId: selection.inventoryItemId,
          expectedRevision,
          transform,
          behaviorMode: 'idle',
          roamingSlot: null,
        });
        showToast('寵物已在這裡待機。');
        return true;
      }

      showToast('寵物會在這裡待機。');
      return true;
    } catch (error) {
      showToast(toWorldMutationErrorMessage(error, '寵物動作更新失敗，請再試一次。'));
      return false;
    }
  };

  const childFeatureNavigation: Array<{
    id: ChildFeature;
    title: string;
    icon: React.ReactNode;
    hasNotification?: boolean;
  }> = [
    { id: 'inventory', title: '背包', icon: <Backpack size={17} aria-hidden="true" /> },
    { id: 'goals', title: '冒險', icon: <CheckCircle2 size={17} aria-hidden="true" />, hasNotification: childMenuNotifications.goals },
    { id: 'shop', title: '商店', icon: <ShoppingBagIcon size={17} aria-hidden="true" /> },
    { id: 'wishlist', title: '獎勵', icon: <Gift size={17} aria-hidden="true" />, hasNotification: childMenuNotifications.wishlist || childMenuNotifications.rewards },
    { id: 'growth', title: '成長', icon: <Star size={17} aria-hidden="true" /> },
    { id: 'settings', title: '設定', icon: <Settings size={17} aria-hidden="true" /> },
  ];
  const isGameFeature = heroFeature === 'inventory' || heroFeature === 'shop' || heroFeature === 'settings';

  const handleOpenAdventureTask = (task: AdventureTask) => {
    setAdventureOpenRequest({ id: task.id, requestId: Date.now() });
    setAdventureBoardOpen(true);
  };

  const openAdventureBoard = () => {
    setAdventureBoardOpen(true);
  };

  const closeAdventureBoard = () => {
    setAdventureBoardOpen(false);
  };

  if (sessionLoading || loading) {
    return <WorldPreparingScreen detail="正在同步孩子的世界資料…" />;
  }

  if (!hasSession || !session || (role !== 'child' && role !== 'parent')) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-blue-50 p-6 text-center text-blue-900">
        <p role="alert">登入狀態已失效或此帳號不是孩子成員，無法顯示孩子資料。</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => void retry({ recoverWorldMutations: true })} className="rounded-xl bg-blue-500 px-5 py-3 font-bold text-white">重試</button>
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
          <button type="button" onClick={() => void retry({ recoverWorldMutations: true })} className="rounded-xl bg-blue-500 px-5 py-3 font-bold text-white">重試</button>
          <button type="button" onClick={onLogout} className="rounded-xl bg-gray-200 px-5 py-3 font-bold text-gray-700">登出</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`hh-dashboard-screen hh-dashboard-screen--child hh-app-interaction-surface flex flex-col min-h-[100dvh] bg-blue-50${decorationPlacement ? ' is-decoration-placement' : ''}${cleanMode ? ' is-clean-mode' : ''}`}
      data-landscape-cutout-side={landscapeCutoutSide}
      style={{ '--hh-character-theme-color': '#2f7f78' } as React.CSSProperties}
      onContextMenu={preventNativeAppContextMenu}
      onDragStart={preventNativeAppDragStart}
    >
      <ChildDashboardBackgroundMusic enabled={backgroundMusicEnabled} />
      <DashboardCharacterHero
        sceneImage=""
        theme={{ ...activeChild.theme, accentColor: '#2f7f78', mobileBackgroundImageUrl: undefined, desktopBackgroundImageUrl: undefined }}
        stats={[
          { label: '加入天數', value: activeChild.joinedDays, icon: <CalendarDays className="hh-character-stat-days-icon" size={17} strokeWidth={2.5} /> },
          { label: '我的點數', value: displayedPoints, target: 'points', icon: <Star className="hh-character-stat-points" size={17} strokeWidth={2.5} /> },
          { label: '我的卷軸', value: displayedScrolls, target: 'scroll', icon: <ScrollText size={17} strokeWidth={2.5} /> },
        ]}
        statsPulse={Boolean(adventureRewardNotice)}
        sceneLayer={(
          <Suspense fallback={<WorldPreparingScreen detail="正在載入 3D 世界…" />}>
            <TerrainWorldLayer
              key={activeChild.id}
              childId={activeChild.id}
              gameData={gameData}
              showPetNames={showPetNames}
              dayNightEnabled={dayNightEnabled}
              paused={Boolean((heroFeature && !decorationPlacement) || adventureRewardNotice || adventureBoardOpen)}
              placement={decorationPlacement ?? undefined}
              placementValid={placementValid}
              placementPending={decorationPlacementPending}
              onPlacementPositionChange={handleDecorationPlacementPositionChange}
              onPlacementControl={handleDecorationPlacementControl}
              onPlacementGestureChange={handleDecorationPlacementGesture}
              onCompletePlacement={() => void completeDecorationPlacement()}
              onCancelPlacement={cancelDecorationPlacement}
              onStartDecorationPlacement={startExistingDecorationPlacement}
              onCollectDecoration={collectSelectedDecoration}
              onPetAction={handlePetAction}
              onAdventureTableScreenPositionChange={setAdventureTablePromptPosition}
              onAdventureTableIndicatorScreenPositionChange={setAdventureTableScreenPosition}
              cleanMode={cleanMode}
              cleanModeHintVisible={cleanModeHintVisible}
              onCleanModeToggle={toggleCleanMode}
              onCleanModeHintDismiss={() => setCleanModeHintVisible(false)}
            />
          </Suspense>
        )}
        menuVariant="child"
        actions={(
          <>
            {isVisitingFriendWorld && (
              <button
                type="button"
                className="hh-character-icon-button hh-character-leave-button"
                aria-label="離開好友世界"
                title="離開好友世界"
                onClick={leaveFriendWorld}
              >
                <LogOut size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => openChildFeature('inventory')}
              aria-label="開啟背包"
              title="背包"
              className="hh-character-icon-button"
            >
              <Backpack size={18} aria-hidden="true" />
            </button>
          </>
        )}
      />
      <WorldSocialLayer
        childProfileId={activeChild.id}
        enabled={role === 'child'}
        cleanMode={cleanMode}
        placementMode={Boolean(decorationPlacement)}
        leaveFriendWorldRequest={leaveFriendWorldRequest}
        onVisitingChange={setIsVisitingFriendWorld}
      />
      {childMenuNotifications.goals
        && !adventureBoardOpen
        && !heroFeature
        && !decorationPlacement
        && !cleanMode
        && !adventureRewardNotice
        && adventureTableScreenPosition
        && (
          <span
            className="hh-adventure-table-notification"
            style={{
              left: `${adventureTableScreenPosition.x}px`,
              top: `${adventureTableScreenPosition.y}px`,
            }}
            role="status"
            aria-label="有新的冒險"
          >
            <svg className="hh-adventure-table-notification-icon" width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true">
              <path d="M14 5V18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="14" cy="25" r="2" fill="currentColor" />
            </svg>
          </span>
      )}
      {adventureTablePromptPosition
        && !adventureBoardOpen
        && !heroFeature
        && !decorationPlacement
        && !cleanMode
        && !adventureRewardNotice
        && (
          <>
            <AdventureTableDialogue
              position={adventureTablePromptPosition}
              onOpenBoard={openAdventureBoard}
            />
            <button
              type="button"
              className="hh-adventure-table-dialogue-trigger"
              aria-label="開始冒險"
              title="開始冒險"
              onClick={openAdventureBoard}
            >
              <MessageCircle size={23} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </>
      )}
      <ChildAdventureBoard
        open={adventureBoardOpen}
        onRequestClose={closeAdventureBoard}
        tasks={adventureTasks}
        generalGroupId={activeGeneralAdventureGroup?.id}
        generalTitle={activeGeneralAdventureGroup?.title}
        now={now}
        loading={actionPending}
        requestedTask={adventureOpenRequest}
        isTaskExecutable={(task) => {
          if (task.status === 'proposed') return { allowed: false, reason: '等待爸媽確認後，就能開始這個冒險。' };
          if (task.status === 'proposal_revision_requested') return { allowed: false, reason: '請先補充冒險內容，再交給爸媽確認。' };
          if (task.status === 'pending' || task.status === 'completed') return { allowed: false };
          if (hasStartedAdventureTimer(task)) return { allowed: true };
          const executionState = getTaskExecutionState(task.dueTime, task.endTime);
          if (executionState === 'not_started') return { allowed: false, reason: `還沒到可開始時間：${formatTaskTime(task.dueTime)}。` };
          if (executionState === 'expired') return { allowed: false, reason: `這次冒險已截止：${formatTaskWindow(task)}。` };
          return { allowed: true };
        }}
        onCreateGeneral={() => setShowGoalForm(true)}
        onTimerToggle={(task) => {
          void toggleTimer(task).catch(() => showToast('計時狀態更新失敗，請再試一次。'));
        }}
        onComplete={handleAdventureCompletion}
        onAbandon={handleAbandonAdventure}
      />

      {/* Main Content */}
      {heroFeature && <div className="hh-child-feature-backdrop" aria-hidden="true" />}
      <main
        ref={featureContentRef}
        className={cn(
          "flex-1 p-6 pb-28",
          heroFeature ? "hh-parent-content-modal hh-parent-content-modal--child" : "hh-parent-content-hidden"
        )}
        role={heroFeature ? 'dialog' : undefined}
        aria-modal={heroFeature ? true : undefined}
        aria-label={heroFeature ? '小孩功能頁面' : undefined}
      >
        {heroFeature && (
          <div className="hh-parent-content-modal-bar hh-parent-content-modal-bar--child">
            <nav className="hh-child-feature-nav" aria-label="小孩功能導覽">
              {childFeatureNavigation.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'hh-child-feature-nav-button',
                    item.id === 'settings' && 'is-settings',
                    heroFeature === item.id && 'is-active',
                  )}
                  aria-current={heroFeature === item.id ? 'page' : undefined}
                  aria-label={item.title}
                  title={item.title}
                  onClick={() => openChildFeature(item.id)}
                >
                  <span className="hh-child-feature-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="hh-child-feature-nav-label">{item.title}</span>
                  {item.hasNotification && <span className="hh-child-feature-nav-notification" aria-label="有新項目" />}
                </button>
              ))}
            </nav>
            <div className="hh-child-feature-header-actions">
              <div className="hh-child-feature-balance-pill">
                <span className="sr-only">我的點數</span>
                <PointValue value={childPoints} iconSize={15} className="hh-child-feature-points" />
              </div>
              {(heroFeature === 'inventory' || heroFeature === 'shop') && (
                <div className="hh-child-feature-balance-pill" aria-label={`目前有 ${displayedScrolls} 張卷軸`}>
                  <ScrollText size={15} strokeWidth={2.5} aria-hidden="true" />
                  <span className="sr-only">我的卷軸</span>
                  <strong>{displayedScrolls}</strong>
                </div>
              )}
              {heroFeature === 'wishlist' && (
                <button
                  type="button"
                  onClick={() => setShowWishlistForm(true)}
                  aria-label="告訴爸媽我想要什麼"
                  title="告訴爸媽我想要什麼"
                  className="flex min-h-11 items-center gap-1 rounded-full border-2 border-dashed border-yellow-300 bg-white px-3 text-sm font-black text-yellow-600 transition-colors hover:bg-yellow-50"
                >
                  <Plus size={18} aria-hidden="true" />
                  <span>告訴爸媽</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => openChildFeature('settings')}
                aria-label="設定"
                title="設定"
                aria-current={heroFeature === 'settings' ? 'page' : undefined}
                className={cn('hh-character-icon-button', 'hh-child-feature-settings-button', heroFeature === 'settings' && 'is-active')}
              >
                <Settings size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => closeChildFeature()} aria-label="關閉功能頁面" title="關閉" className="hh-character-icon-button">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        {isOffline && (
          <div role="status" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span>目前離線，變更尚未同步。</span>
            <button type="button" onClick={() => void retry({ recoverWorldMutations: true })} disabled={loading} className="shrink-0 font-bold underline disabled:opacity-50">重試</button>
          </div>
        )}
        {isGameFeature && (
          <Suspense fallback={<div className="hh-game-panel-loading" role="status">正在打開世界功能…</div>}>
            <ChildGamePanel
              kind={heroFeature}
              gameData={gameData}
              mutationPending={actionPending || mutationPending}
              notificationSettings={notificationSettings}
              onPurchase={handleGamePurchase}
              onEquipCharacter={async (inventoryItemId) => {
                closeChildFeature();
                await equipGameCharacter(activeChild.id, inventoryItemId);
              }}
              onRenamePet={(inventoryItemId, displayName) => setPetDisplayName(activeChild.id, inventoryItemId, displayName)}
              onSetFollowingPets={(inventoryItemIds): Promise<WorldMutationResult> => setFollowingPets(activeChild.id, inventoryItemIds)}
              onSetRoamingPets={(inventoryItemIds): Promise<WorldMutationResult> => setRoamingPets(activeChild.id, inventoryItemIds)}
              onStartDecorationPlacement={startOwnedDecorationPlacement}
              onStartExistingDecorationPlacement={startExistingDecorationPlacement}
              onShareDecoration={role === 'child' ? (inventoryItemId, item) => setShareDecorationItem({ inventoryItemId, item }) : undefined}
              onUpdateDecoration={(payload) => updateWorldEntityTransform(activeChild.id, payload)}
              onRemoveDecoration={(entityId, inventoryItemId, expectedRevision) => removeWorldEntity(activeChild.id, { entityId, inventoryItemId, expectedRevision })}
              onCollectAllDecorations={(expectedRevision) => collectAllWorldDecorations(activeChild.id, expectedRevision)}
              onCollectAllSharedDecorations={!socialSession?.snapshot && socialSession?.worldOwnerChildProfileId === activeChild.id ? collectAllSharedDecorations : undefined}
              onSwitchChild={onSwitchChild}
              onLogout={onLogout}
              showPetNames={showPetNames}
              onShowPetNamesChange={handleShowPetNamesChange}
              backgroundMusicEnabled={backgroundMusicEnabled}
              onBackgroundMusicChange={handleBackgroundMusicChange}
              dayNightEnabled={dayNightEnabled}
              onDayNightChange={onDayNightChange}
            />
          </Suspense>
        )}
        {/* Fixed Bottom Oval Capsule Tabs Bar */}
        <nav
          aria-label="選單分頁"
          className="hh-bottom-nav hh-bottom-nav--child"
          style={{ '--active-index': ['goals', 'growth', 'wishlist'].indexOf(activeTab), '--item-count': 3 } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={cn(
              "hh-bottom-nav-button",
              activeTab === 'goals' && "is-active"
            )}
          >
            冒險
            {childMenuNotifications.goals && (
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
            獎勵
          </button>
        </nav>

        {!isGameFeature && activeTab === 'goals' && (
          <TodayAdventureSummary summary={todayAdventureSummary} today={adventureDate} onTaskSelect={handleOpenAdventureTask} />
        )}

        {!isGameFeature && activeTab === 'growth' && growthSummary && (
          <GrowthSummaryPanel summaries={[growthSummary]} title="我的成長紀錄" tasks={growthTasksWithChild} />
        )}

        {!isGameFeature && activeTab === 'wishlist' && (
          <div className="hh-child-feature-page hh-child-feature-page--wishlist space-y-6">
            <section className="hh-child-feature-section space-y-3" aria-labelledby="pending-wishlist-title">
              <div className="flex items-center justify-between px-2">
                <div>
                  <h2 id="pending-wishlist-title" className="text-lg font-black text-gray-800">正在許願</h2>
                </div>
                {wishlist.length > 0 && <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-bold text-yellow-700">{wishlist.length} 個等待中</span>}
              </div>
              {wishlist.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">目前沒有等待核准的願望。</div>
              ) : (
                <div className="hh-child-wishlist-list space-y-3">
                  {wishlist.map((item) => (
                    <div key={item.id} className="hh-child-wishlist-item flex items-center justify-between gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
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

            <section className="hh-child-feature-section space-y-3" aria-labelledby="available-rewards-title">
              <div className="flex items-center justify-between gap-3 px-2">
                <h2 id="available-rewards-title" className="flex items-center gap-2 text-lg font-black text-gray-900">
                  <Gift size={19} className="text-yellow-500" aria-hidden="true" />
                  可兌換獎勵
                </h2>
                {rewards.length > 0 && <span className="shrink-0 text-xs font-bold text-gray-500">共 {rewards.length} 項</span>}
              </div>
              {rewards.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-bold text-gray-500">
                  目前還沒有可兌換的獎勵，請等爸媽設定喔。
                </div>
              ) : (
                <div className="hh-child-reward-grid grid grid-cols-3 gap-3">
                  {visibleRewards.map(reward => {
                    const canAfford = childPoints >= reward.points;
                    return (
                      <div key={reward.id} className={cn("hh-child-reward-card flex min-w-0 flex-col items-center rounded-3xl border bg-white p-3 text-center shadow-sm", canAfford ? "border-yellow-200" : "border-gray-100 opacity-80")}>
                        <div className={cn("hh-child-reward-icon mb-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full", canAfford ? "bg-yellow-100 text-yellow-600" : "bg-gray-100 text-gray-400")}>
                          <Gift size={25} aria-hidden="true" />
                        </div>
                        <div className="hh-child-reward-name mb-1 min-h-10 w-full break-words text-sm font-bold leading-5 text-gray-800 line-clamp-2">{reward.name}</div>
                        <div className={cn("hh-child-reward-price text-base font-black", canAfford ? "text-yellow-500" : "text-gray-400")}>
                          <PointValue value={reward.points} iconSize={15} />
                        </div>
                        <div className="min-h-5 text-xs font-bold text-rose-600">
                          {!canAfford && `還差 ${reward.points - childPoints} 點`}
                        </div>
                        <button
                          type="button"
                          onClick={() => setRewardToConfirm(reward)}
                          disabled={!canAfford || actionPending}
                          className={cn(
                            "hh-child-reward-action mt-2 min-h-11 w-full rounded-xl px-1 py-2 text-sm font-bold transition-all",
                            canAfford ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-md active:scale-95" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          )}
                        >
                          {canAfford ? '兌換' : '點數不夠'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {rewardTotalPages > 1 && (
                <nav className="flex items-center justify-between gap-2 pt-1" aria-label="可兌換獎勵頁碼">
                  <button
                    type="button"
                    onClick={() => setRewardPage((current) => Math.max(1, current - 1))}
                    disabled={rewardPage === 1}
                    className="flex min-h-11 items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 text-xs font-black text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={15} aria-hidden="true" /> 上一頁
                  </button>
                  <span className="text-xs font-black text-gray-500" aria-live="polite">第 {rewardPage} / {rewardTotalPages} 頁</span>
                  <button
                    type="button"
                    onClick={() => setRewardPage((current) => Math.min(rewardTotalPages, current + 1))}
                    disabled={rewardPage === rewardTotalPages}
                    className="flex min-h-11 items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 text-xs font-black text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一頁 <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </nav>
              )}
            </section>

            <PointLedgerHistory
              childProfileId={activeChild.id}
              childName={activeChild.name}
              loadPage={loadPointLedgerPage}
              collapsible
              defaultOpen={false}
            />

            <details className="space-y-4" defaultOpen={false}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-2 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <History size={20} className="text-purple-500" aria-hidden="true" />
                  <span id="child-redemption-history-title" role="heading" aria-level={2}>我的兌換紀錄</span>
                </span>
                <span className="flex items-center gap-2">
                  {tickets.length > 0 && <span className="text-xs font-bold text-gray-500">共 {tickets.length} 筆</span>}
                  <ChevronDown size={20} className="text-gray-500" aria-hidden="true" />
                </span>
              </summary>
              <div className="space-y-4" aria-labelledby="child-redemption-history-title">
                {tickets.length === 0 ? (
                  <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center">
                    <Gift size={48} className="mx-auto mb-4 text-gray-300" aria-hidden="true" />
                    <p className="text-gray-500">還沒有兌換過獎勵喔</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...tickets].reverse().map(ticket => (
                      <div key={ticket.id} className={cn("flex flex-col gap-2 rounded-2xl border p-4", ticket.status === 'fulfilled' ? "border-gray-200 bg-gray-50 opacity-70" : "border-purple-200 bg-purple-50")}>
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-bold text-gray-800">{ticket.rewardName}</div>
                          <div className={cn("rounded-full px-3 py-1 text-xs font-bold", ticket.status === 'fulfilled' ? "bg-gray-200 text-gray-600" : "bg-purple-200 text-purple-700")}>
                            {ticket.status === 'fulfilled' ? '已使用' : '等待兌現'}
                          </div>
                        </div>
                        <div className="text-xs font-medium text-gray-400">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </div>
        )}
      </main>

      {/* Overlays */}
      {showGoalForm && (
        <div className="hh-goal-proposal-overlay" role="dialog" aria-modal="true" aria-label="新增一般冒險">
          <button type="button" className="hh-goal-proposal-backdrop" aria-label="關閉新增一般冒險" onClick={() => closeChildForm(() => setShowGoalForm(false), '.hh-goal-proposal-overlay')} />
          <div className="hh-goal-proposal-sheet">
            <div className="hh-goal-proposal-sheet-bar">
              <button type="button" onClick={() => closeChildForm(() => setShowGoalForm(false), '.hh-goal-proposal-overlay')} aria-label="關閉新增一般冒險" className="hh-goal-proposal-close hh-character-icon-button"><X size={18} /></button>
            </div>
            <GoalProposalForm templates={taskTemplates} loading={actionPending || loading} onSubmit={handleSubmitGoalProposal} />
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
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  確定要用 <PointValue value={rewardToConfirm.points} /> 兌換「{rewardToConfirm.name}」嗎？
                </p>
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

      {decorationPurchasePrompt && (
        <div className="hh-decoration-purchase-choice" role="dialog" aria-modal="true" aria-labelledby="decoration-purchase-choice-title">
          <button type="button" className="hh-decoration-purchase-choice-backdrop" aria-label="關閉裝飾放置選擇" onClick={leaveDecorationInInventory} />
          <div className="hh-decoration-purchase-choice-card">
            <div className="hh-decoration-purchase-choice-icon">
              {decorationPurchasePrompt.item.thumbnailUrl ? (
                <img src={decorationPurchasePrompt.item.thumbnailUrl} alt="" />
              ) : (
                <Flower2 size={28} aria-hidden="true" />
              )}
            </div>
            <div className="hh-decoration-purchase-choice-copy">
              <p className="hh-decoration-purchase-choice-eyebrow">已加入背包</p>
              <h2 id="decoration-purchase-choice-title">要現在放置「{decorationPurchasePrompt.item.name}」嗎？</h2>
              <p>可以先放到世界，也可以之後從背包慢慢挑位置。</p>
            </div>
            <div className="hh-decoration-purchase-choice-actions">
              <button type="button" className="hh-decoration-purchase-choice-secondary" onClick={leaveDecorationInInventory}>稍後再放</button>
              <button type="button" className="hh-decoration-purchase-choice-primary" onClick={startDecorationPlacement}>現在放置</button>
            </div>
          </div>
        </div>
      )}

      {adventureRewardNotice && (
        <AdventureRewardCelebration
          mode={adventureRewardNotice.mode}
          taskName={adventureRewardNotice.mode === 'submitted' ? adventureRewardNotice.taskName : undefined}
          pendingStars={adventureRewardNotice.mode === 'submitted' ? adventureRewardNotice.pendingStars : undefined}
          bundle={adventureRewardNotice.mode === 'approved' ? adventureRewardNotice.bundle : undefined}
          onDismiss={dismissAdventureRewardNotice}
        />
      )}

      {shareDecorationItem && socialSession?.friends && (
        <SharedDecorationShareDialog
          item={shareDecorationItem.item}
          friends={socialSession.friends}
          onClose={() => setShareDecorationItem(null)}
          onShare={shareDecorationWithFriend}
        />
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
