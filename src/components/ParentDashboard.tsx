import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { dismissWithAnimation } from '../lib/utils';
import { groupParentTodoTasks, type GroupedTask } from '../lib/parent-task-grouping';
import { groupParentRewards, type GroupedReward } from '../lib/parent-reward-grouping';
import { TaipeiTimeInput } from './TaipeiTimeInput';
import { CalendarDays, Check, Circle, Clock, Eye, EyeOff, Gift, LoaderCircle, LogOut, MinusCircle, Plus, PlusCircle, ShoppingBag, Star, Users, X, Trash2, Edit2, PlayCircle, Settings } from 'lucide-react';
import { TaskStatus, Task, Reward, type ChildGender } from '../types';
import { validateChildPassword, validateChildUsername, validatePasswordConfirmation } from '../lib/auth-validation';
import { CategoryBadge } from '../features/growth/components/CategoryBadge';
import { GoalReviewPanel } from '../features/growth/components/GoalReviewPanel';
import { GrowthSummaryPanel } from '../features/growth/components/GrowthSummaryPanel';
import { ParentSettingsDocuments, type ParentSettingsDocument } from './ParentSettingsDocuments';
import { ParentConsentModal } from './ParentConsentModal';
import { ParentPrivacyPolicyPage } from './ParentPrivacyPolicyPage';
import { FamilyChildPicker } from './FamilyChildPicker';
import { deleteCurrentAccount, toAuthErrorMessage, toChildAccountErrorMessage, updateCurrentParentPassword, verifyCurrentParentPassword } from '../auth';
import { isCurrentParentConsent, PARENT_CONSENT_VERSION } from '../lib/legal-content';
import { TASK_CATEGORIES, DEFAULT_TASK_CATEGORY } from '../features/growth/constants';
import { buildGrowthStats } from '../features/growth/growth-stats';
import { validateRewardPoints } from '../lib/reward-validation';
import { getParentMenuNotifications } from '../lib/menu-notifications';
import { FirstUseGuide, hasCompletedFirstUseGuide } from './FirstUseGuide';
import { DashboardCharacterHero, type CharacterMenuAction } from './DashboardCharacterHero';
import { ParentDashboardBackgroundMusic } from './ParentDashboardBackgroundMusic';
import { ParentDashboardContent, type ParentDashboardTab } from './parent-dashboard/ParentDashboardContent';
import { ParentSettingsChildrenSection, type NewChildProfile } from './parent-dashboard/ParentSettingsChildrenSection';
import { ParentDashboardFormModal } from './parent-dashboard/ParentDashboardFormModal';
import { RecentApprovedTasks } from './parent-dashboard/RecentApprovedTasks';
import { toParentCalendarTaskGroup } from './parent-dashboard/parent-dashboard-selectors';
import { EmptyState, ModalShell } from './shared/ParentDashboardUI';
import { PointValue } from './shared/PointValue';
import { PointLedgerHistory } from './PointLedgerHistory';
import { PushNotificationSettings } from './PushNotificationSettings';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import {
  preventNativeAppContextMenu,
  preventNativeAppDragStart,
} from '../lib/mobile-interaction';
import type { GoalConfirmationInput, GoalReviewInput, GrowthTask, GrowthTaskTemplate, GrowthTaskWithChild, TaskCategory } from '../features/growth/types';
import { getTodayInTaipei, type ParentCalendarAdventureTask } from '../features/adventures/components/ParentAdventureCalendar';
import {
  ParentAdventureWorkspace,
  type CreateAdventureScheduleInput,
  type CreateGeneralAdventureInput,
} from '../features/adventures/components/ParentAdventureWorkspace';
import { ParentGamePricePanel } from '../features/world/components/ParentGamePricePanel';
import { CURRENT_WORLD_CHARACTER_ID, WORLD_CHARACTER_CATALOG } from '../features/characters/world-character-catalog';
import { getParentBackgroundMusicPreference, setParentBackgroundMusicPreference } from '../lib/parent-background-music-preference';
import { validatePointLedgerAdjustment } from '../lib/point-ledger';

interface ParentDashboardProps {
  onSwitchToChild: (childId?: string) => void;
  onLogout: () => void;
  signupConsentAccepted?: boolean;
}

type ParentTab = ParentDashboardTab;

export function ParentDashboard({ onSwitchToChild, onLogout, signupConsentAccepted = false }: ParentDashboardProps) {
  const appStore = useAppStore() as ReturnType<typeof useAppStore> & {
    confirmGoal?: (childId: string, taskId: string, input: GoalConfirmationInput) => Promise<void>;
    confirmChildGoal?: (taskId: string, input: GoalConfirmationInput) => Promise<void>;
    returnGoal?: (childId: string, taskId: string, revisionNote: string) => Promise<void>;
    returnChildGoal?: (taskId: string, revisionNote: string) => Promise<void>;
    reviewTaskCompletion?: (taskId: string, input: {
      approved: boolean;
      approvedPoints: number;
      feedback?: string | null;
      correction?: string | null;
      tone?: string | null;
      revisionNote?: string | null;
    }) => Promise<void>;
    createAdventureSchedule: (input: CreateAdventureScheduleInput) => Promise<void>;
    createGeneralAdventure: (input: CreateGeneralAdventureInput) => Promise<void>;
    updateGeneralAdventureTitle: (childId: string, title: string) => Promise<void>;
    batchReviewDailyAdventures: (taskIds: string[]) => Promise<{ failedTaskIds: string[] }>;
    disableAdventureSchedule: (scheduleId: string) => Promise<void>;
    revokeTaskApproval?: (taskId: string) => Promise<void>;
  };
  const { state, familyId, loading, error, retry, isOffline, mutationPending, updateTaskStatus, addTask, deleteTask, updateTask, addReward, deleteReward, updateReward, fulfillTicket, approveWishlist, loadPointLedgerPage, adjustChildPoints, addChild, updateChildPassword, updateChildName, deleteChild, addTaskTemplate, updateTaskTemplate, deleteTaskTemplate, recordParentConsent, revokeTaskApproval, setFamilyGameItemPrice, resetFamilyGameItemPrice } = appStore;
  const [activeTab, setActiveTab] = useState<ParentTab>('review');
  const [parentBackgroundMusicEnabled, setParentBackgroundMusicEnabled] = useState(() => getParentBackgroundMusicPreference(familyId ?? ''));
  const [heroFeature, setHeroFeature] = useState<ParentTab | null>(null);
  const [heroMenuGroup, setHeroMenuGroup] = useState<ParentTab | null>(null);
  const [heroMenuVisible, setHeroMenuVisible] = useState(false);
  const [heroFormReturnGroup, setHeroFormReturnGroup] = useState<ParentTab | null>(null);
  const [adventureFormRequest, setAdventureFormRequest] = useState<{ type: 'daily' | 'general'; requestId: number } | null>(null);
  const [mutationKind, setMutationKind] = useState<'task' | 'template' | 'reward' | null>(null);
  const featureContentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    featureContentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab, heroFeature]);

  const observedLoading = useRef(false);
  const consentAutoRecordAttempted = useRef(false);
  const allowPendingChildAction = useRef(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [pendingChildAction, setPendingChildAction] = useState<'new' | 'existing' | null>(null);

  useEffect(() => {
    if (!signupConsentAccepted || isCurrentParentConsent(state.parentConsentVersion) || consentAutoRecordAttempted.current) return;
    consentAutoRecordAttempted.current = true;
    void recordParentConsent(PARENT_CONSENT_VERSION).catch(() => {
      // The required consent document remains visible so the parent can retry.
    });
  }, [recordParentConsent, signupConsentAccepted, state.parentConsentVersion]);

  useEffect(() => {
    if (signupConsentAccepted || !hasCompletedFirstUseGuide()) setShowFirstUseGuide(true);
  }, [signupConsentAccepted]);

  const allTasks = state.children.flatMap(c => (c.tasks as GrowthTask[]).map(t => ({ ...t, childId: c.id, childName: c.name }))) as GrowthTaskWithChild[];
  const proposedTasks = allTasks.filter(t => t.status === 'proposed' || t.status === 'proposal_revision_requested' || (t.origin === 'child_proposed' && t.status === 'todo' && !t.confirmedAt));
  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const todoTasks = allTasks.filter(t => t.status === 'todo');
  const completedTasks = allTasks.filter(t => t.status === 'completed');
  const growthSummaries = buildGrowthStats(state.children, state.ledger);
  const todayDateKey = getTodayInTaipei();
  const calendarTasks: ParentCalendarAdventureTask[] = allTasks.map(task => ({
    id: task.id,
    childId: task.childId,
    childName: task.childName,
    name: task.name,
    occurrenceDate: task.occurrenceDate
      ?? task.dueOn
      ?? (task.isDaily ? todayDateKey : String(task.createdAt).slice(0, 10)),
    adventureType: task.adventureType ?? (task.isDaily ? 'daily' : 'general'),
    adventureGroupId: task.adventureGroupId,
    status: task.status,
    points: task.points,
    duration: task.duration,
    dueTime: task.dueTime,
    endTime: task.endTime,
    category: task.category,
    isDaily: task.isDaily,
    requiresReviewBeforeNextTask: task.requiresReviewBeforeNextTask,
  }));
  const activeGeneralGroups = state.adventureGroups?.filter(group => group.status === 'active') ?? [];
  const generalAdventureTitle = activeGeneralGroups[0]?.title ?? '一般冒險';

  const groupedTodoTasks = groupParentTodoTasks(todoTasks, DEFAULT_TASK_CATEGORY);

  const groupedRewards = groupParentRewards(state.children);

  const allTickets = state.children.flatMap(c => c.tickets.map(t => ({ ...t, childId: c.id, childName: c.name })));
  const pendingTickets = allTickets.filter(t => t.status === 'pending');

  const allWishlist = state.children.flatMap(c => c.wishlist.map(w => ({ ...w, childId: c.id, childName: c.name })));
  const totalPoints = state.children.reduce((acc, c) => acc + c.points, 0);
  const priceChildId = state.parentActiveChildId ?? state.children[0]?.id ?? null;
  const priceGameData = priceChildId ? state.gameDataByChildId[priceChildId] : undefined;
  const reviewCount = proposedTasks.length + pendingTasks.length + pendingTickets.length;
  const parentMenuNotifications = getParentMenuNotifications({
    review: proposedTasks.length + pendingTasks.length,
    rewards: pendingTickets.length,
    wishlist: allWishlist.length,
  });

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<(GroupedTask & { isDaily?: boolean }) | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState(5);
  const [newTaskDuration, setNewTaskDuration] = useState<number | ''>(''); // in minutes
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [newTaskEndTime, setNewTaskEndTime] = useState('');
  const [newTaskIsDaily, setNewTaskIsDaily] = useState(true);
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>(DEFAULT_TASK_CATEGORY);
  const [newTaskTargetChildIds, setNewTaskTargetChildIds] = useState<string[]>([]);

  // Reward form
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingReward, setEditingReward] = useState<GroupedReward | null>(null);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardPoints, setNewRewardPoints] = useState<number | ''>(50);
  const [rewardFormError, setRewardFormError] = useState('');
  const [newRewardTargetChildIds, setNewRewardTargetChildIds] = useState<string[]>([]);
  const [pointAdjustment, setPointAdjustment] = useState<{ childId: string; mode: 'grant' | 'deduct' } | null>(null);
  const [pointAmount, setPointAmount] = useState<number | ''>(10);
  const [pointReason, setPointReason] = useState('');
  const [pointAdjustmentError, setPointAdjustmentError] = useState('');
  const [pointHistoryChildId, setPointHistoryChildId] = useState<string | null>(null);

  // Templates
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GrowthTaskTemplate | null>(null);
  const [assigningTemplate, setAssigningTemplate] = useState<GrowthTaskTemplate | null>(null);

  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [showNewChildForm, setShowNewChildForm] = useState(false);
  const [showFirstUseGuide, setShowFirstUseGuide] = useState(false);
  const [showChildPicker, setShowChildPicker] = useState(false);
  const [settingsDocument, setSettingsDocument] = useState<ParentSettingsDocument | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [newChildUsername, setNewChildUsername] = useState('');
  const [newChildPassword, setNewChildPassword] = useState('');
  const [newChildPasswordConfirmation, setNewChildPasswordConfirmation] = useState('');
  const [showNewChildPassword, setShowNewChildPassword] = useState(false);
  const [showNewChildPasswordConfirmation, setShowNewChildPasswordConfirmation] = useState(false);
  const [newChildError, setNewChildError] = useState('');
  const [newChildGender, setNewChildGender] = useState<ChildGender | ''>('');
  const [newChildCharacterId, setNewChildCharacterId] = useState(WORLD_CHARACTER_CATALOG[0]?.id ?? CURRENT_WORLD_CHARACTER_ID);
  const [accountSetupChildId, setAccountSetupChildId] = useState<string | null>(null);
  const [accountSetupUsername, setAccountSetupUsername] = useState('');
  const [accountSetupPassword, setAccountSetupPassword] = useState('');
  const [accountSetupConfirmation, setAccountSetupConfirmation] = useState('');
  const [showAccountSetupPassword, setShowAccountSetupPassword] = useState(false);
  const [showAccountSetupConfirmation, setShowAccountSetupConfirmation] = useState(false);
  const [accountSetupError, setAccountSetupError] = useState('');
  const [childAccountSubmitting, setChildAccountSubmitting] = useState(false);
  const childAccountSubmissionInFlight = useRef(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resetChildId, setResetChildId] = useState<string | null>(null);
  const [resetChildPassword, setResetChildPassword] = useState('');
  const [resetChildPasswordConfirmation, setResetChildPasswordConfirmation] = useState('');
  const [showResetChildPassword, setShowResetChildPassword] = useState(false);
  const [showResetChildPasswordConfirmation, setShowResetChildPasswordConfirmation] = useState(false);
  const [resetChildError, setResetChildError] = useState('');
  const [resetChildPasswordSubmitting, setResetChildPasswordSubmitting] = useState(false);
  const resetChildPasswordSubmissionInFlight = useRef(false);
  const [newParentPin, setNewParentPin] = useState('');
  const [oldParentPin, setOldParentPin] = useState('');
  const [showParentPasswordForm, setShowParentPasswordForm] = useState(false);

  useEffect(() => {
    setParentBackgroundMusicEnabled(getParentBackgroundMusicPreference(familyId ?? ''));
  }, [familyId]);

  const handleParentBackgroundMusicChange = (enabled: boolean) => {
    if (!familyId) return;
    setParentBackgroundMusicEnabled(enabled);
    setParentBackgroundMusicPreference(familyId, enabled);
  };

  // Wishlist Pricing
  const [wishlistPricing, setWishlistPricing] = useState<Record<string, number>>({});

  // Confirm Modals
  const [taskToDelete, setTaskToDelete] = useState<GroupedTask | null>(null);
  const [rewardToDelete, setRewardToDelete] = useState<GroupedReward | null>(null);
  const [childToDelete, setChildToDelete] = useState<string | null>(null);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);
  const [deleteChildPin, setDeleteChildPin] = useState('');
  const [deleteChildPinError, setDeleteChildPinError] = useState('');
  const [childNameDrafts, setChildNameDrafts] = useState<Record<string, string>>({});

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => {
      setToastMessage(null);
      toastTimer.current = null;
    }, 2600);
  };

  const handleDeleteChild = async (targetChildId: string) => {
    if (deletingChildId !== null) return;
    setDeletingChildId(targetChildId);
    try {
      await verifyCurrentParentPassword(deleteChildPin);
    } catch (error) {
      setDeleteChildPinError(toAuthErrorMessage(error));
      setDeletingChildId(null);
      return;
    }

    // Close the confirmation immediately. deleteChild applies the optimistic
    // card/state update before its RPC resolves, so the parent sees instant feedback.
    setChildToDelete(null);
    setDeleteChildPin('');
    setDeleteChildPinError('');
    showToast('小孩已移除，正在同步…');

    try {
      const deletion = deleteChild(targetChildId);
      await deletion;
      showToast('小孩已刪除');
    } catch {
      showToast('小孩刪除失敗，已恢復資料。');
    } finally {
      setDeletingChildId(null);
    }
  };

  const notificationSettings = useNotificationSettings({
    familyId,
    childProfileId: null,
    onForegroundNotification: (title, body) => showToast(`${title}：${body}`),
  });

  useEffect(() => {
    if (!mutationKind) return;
    if (loading) {
      observedLoading.current = true;
      return;
    }
    if (error) {
      setMutationKind(null);
      return;
    }
    if (!observedLoading.current) return;
    if (mutationKind === 'task') dismissWithAnimation(() => setShowTaskForm(false));
    if (mutationKind === 'template') dismissWithAnimation(() => setShowTemplateForm(false));
    if (mutationKind === 'reward') dismissWithAnimation(() => setShowRewardForm(false));
    observedLoading.current = false;
    setMutationKind(null);
  }, [error, loading, mutationKind]);

  const openTaskForm = (group?: GroupedTask & { isDaily?: boolean }, allowWithoutChild = false) => {
    if (state.children.length === 0 && !allowWithoutChild) return;
    if (group) {
      setEditingTask(group);
      setNewTaskName(group.name);
      setNewTaskPoints(group.points);
      setNewTaskDuration(group.duration || '');
      setNewTaskDueTime(group.dueTime?.slice(0, 5) ?? '');
      setNewTaskEndTime(group.endTime?.slice(0, 5) ?? '');
      setNewTaskIsDaily(group.isDaily ?? false);
      setNewTaskCategory(group.category ?? DEFAULT_TASK_CATEGORY);
      setNewTaskTargetChildIds(group.children.map(c => c.childId));
    } else {
      setEditingTask(null);
      setNewTaskName('');
      setNewTaskPoints(5);
      setNewTaskDuration('');
      setNewTaskDueTime('');
      setNewTaskEndTime('');
      setNewTaskIsDaily(false);
      setNewTaskCategory(DEFAULT_TASK_CATEGORY);
      setNewTaskTargetChildIds(state.children.map(c => c.id));
    }
    setShowTaskForm(true);
  };

  const handleSaveTask = async () => {
    if (state.children.length === 0) return;
    if (!newTaskName || newTaskPoints < 1 || newTaskTargetChildIds.length === 0) return;
    const duration = newTaskDuration ? Number(newTaskDuration) : undefined;
    const dueTime = newTaskDueTime || null;
    const endTime = newTaskEndTime || null;
    if (dueTime && endTime && endTime <= dueTime) return;
    observedLoading.current = false;
    setMutationKind('task');

    try {
    if (editingTask) {
      // Handle updates/deletes/adds for grouped task
      const existingChildIds = editingTask.children.map(c => c.childId);
      
      // Update or add
      for (const childId of newTaskTargetChildIds) {
        const existingChild = editingTask.children.find(c => c.childId === childId);
        if (existingChild) {
          for (const taskId of existingChild.taskIds) {
            await updateTask(childId, taskId, { name: newTaskName, points: newTaskPoints, duration, dueTime, endTime, isDaily: newTaskIsDaily, category: newTaskCategory, requiresReviewBeforeNextTask: false } as never);
          }
        } else {
          await addTask(childId, { name: newTaskName, points: newTaskPoints, icon: 'Star', duration, dueTime, endTime, isDaily: newTaskIsDaily, category: newTaskCategory, origin: 'parent_assigned', requiresReviewBeforeNextTask: false } as never);
        }
      }

      // Delete removed
      for (const childId of existingChildIds.filter(childId => !newTaskTargetChildIds.includes(childId))) {
        if (!newTaskTargetChildIds.includes(childId)) {
          const existingChild = editingTask.children.find(c => c.childId === childId);
          if (existingChild) {
            for (const taskId of existingChild.taskIds) await deleteTask(childId, taskId);
          }
        }
      }
    } else {
      for (const childId of newTaskTargetChildIds) await addTask(childId, { name: newTaskName, points: newTaskPoints, icon: 'Star', duration, dueTime, endTime, isDaily: newTaskIsDaily, category: newTaskCategory, origin: 'parent_assigned', requiresReviewBeforeNextTask: false } as never);
    }
    setHeroFormReturnGroup(null);
    dismissWithAnimation(() => setShowTaskForm(false));
    dismissWithAnimation(() => setAssigningTemplate(null));
    setMutationKind(null);
    } catch { /* provider error is rendered above the tabs; keep form values intact */ }
  };

  const handleAssignTemplate = async () => {
    if (state.children.length === 0) return;
    if (!assigningTemplate || newTaskTargetChildIds.length === 0) return;
    try {
      const dueTime = newTaskDueTime || null;
      const endTime = newTaskEndTime || null;
      if (dueTime && endTime && endTime <= dueTime) return;
      for (const childId of newTaskTargetChildIds) await addTask(childId, { name: assigningTemplate.name, points: assigningTemplate.points, icon: assigningTemplate.icon || 'Star', duration: assigningTemplate.duration, dueTime, endTime, isDaily: newTaskIsDaily, category: assigningTemplate.category ?? DEFAULT_TASK_CATEGORY, origin: 'system_template', requiresReviewBeforeNextTask: false } as never);
      dismissWithAnimation(() => setAssigningTemplate(null));
    } catch { /* provider error is rendered above the tabs; keep assignment open */ }
  };

  const handleSaveTemplate = async () => {
    if (!newTaskName || newTaskPoints < 1) return;
    const duration = newTaskDuration ? Number(newTaskDuration) : undefined;
    const dueTime = newTaskDueTime || null;
    const endTime = newTaskEndTime || null;
    if (dueTime && endTime && endTime <= dueTime) return;
    observedLoading.current = false;
    setMutationKind('template');
    try {
    if (editingTemplate) {
      await updateTaskTemplate(editingTemplate.id, { name: newTaskName, points: newTaskPoints, duration, dueTime, endTime, category: newTaskCategory, requiresReviewBeforeNextTask: false } as never);
    } else {
      await addTaskTemplate({ name: newTaskName, points: newTaskPoints, icon: 'Star', duration, dueTime, endTime, category: newTaskCategory, suggestedEvidence: 'reflection', requiresReviewBeforeNextTask: false } as never);
    }
    setHeroFormReturnGroup(null);
    dismissWithAnimation(() => setShowTemplateForm(false));
    setMutationKind(null);
    } catch { /* provider error is rendered above the tabs; keep form values intact */ }
  };

  const openTemplateForm = (template?: GrowthTaskTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setNewTaskName(template.name);
      setNewTaskPoints(template.points);
      setNewTaskDuration(template.duration || '');
      setNewTaskDueTime(template.dueTime?.slice(0, 5) ?? '');
      setNewTaskEndTime(template.endTime?.slice(0, 5) ?? '');
      setNewTaskCategory(template.category ?? DEFAULT_TASK_CATEGORY);
    } else {
      setEditingTemplate(null);
      setNewTaskName('');
      setNewTaskPoints(5);
      setNewTaskDuration('');
      setNewTaskDueTime('');
      setNewTaskEndTime('');
      setNewTaskCategory(DEFAULT_TASK_CATEGORY);
    }
    setShowTemplateForm(true);
  };

  const openAssignTemplate = (template: GrowthTaskTemplate) => {
    if (state.children.length === 0) return;
    setAssigningTemplate(template);
    setNewTaskIsDaily(false);
    setNewTaskDueTime(template.dueTime?.slice(0, 5) ?? '');
    setNewTaskEndTime(template.endTime?.slice(0, 5) ?? '');
    setNewTaskTargetChildIds(state.children.map(c => c.id));
  };

  const handleGuideStepChange = (nextStep: number) => {
    if (nextStep <= 0) {
      setShowSettings(false);
      setShowTaskForm(false);
      setActiveTab('review');
      return;
    }
    if (nextStep === 1) {
      setShowSettings(true);
      setShowTaskForm(false);
      return;
    }
    if (nextStep === 2) {
      setShowSettings(true);
      setShowNewChildForm(true);
      setShowTaskForm(false);
      return;
    }
    if (nextStep === 3) {
      setShowSettings(false);
      setShowNewChildForm(false);
      setShowTaskForm(false);
      setHeroMenuGroup(null);
      setHeroMenuVisible(true);
      return;
    }
    if (nextStep === 4) {
      setHeroMenuGroup('tasks');
      setHeroMenuVisible(true);
      setShowTaskForm(false);
      return;
    }
    if (nextStep === 5) {
      openHeroFeature('tasks');
      setAdventureFormRequest({ type: 'daily', requestId: Date.now() });
      return;
    }
    if (nextStep === 6) {
      setShowTaskForm(false);
      setHeroFeature(null);
      setHeroMenuGroup(null);
      setHeroMenuVisible(true);
      return;
    }
    if (nextStep === 7) {
      setShowTaskForm(false);
      setHeroFeature(null);
      setHeroMenuGroup(null);
      setHeroMenuVisible(true);
      return;
    }
    if (nextStep === 8) {
      setShowTaskForm(false);
      setHeroFeature(null);
      setHeroMenuGroup(null);
      setHeroMenuVisible(true);
      return;
    }
    setShowTaskForm(false);
    setHeroFeature(null);
    setHeroMenuGroup(null);
    setHeroMenuVisible(true);
  };

  const handleConfirmGoal = async (childId: string, taskId: string, input: GoalConfirmationInput) => {
    if (appStore.confirmGoal) {
      await appStore.confirmGoal(childId, taskId, input);
      return;
    }
    if (appStore.confirmChildGoal) {
      await appStore.confirmChildGoal(taskId, input);
      return;
    }
    await updateTask(childId, taskId, { name: input.name, points: input.points, category: input.category, confirmedAt: new Date().toISOString() } as never);
    await updateTaskStatus(childId, taskId, 'todo');
  };

  const handleReturnGoal = async (childId: string, taskId: string, revisionNote: string) => {
    if (appStore.returnGoal) {
      await appStore.returnGoal(childId, taskId, revisionNote);
      return;
    }
    if (appStore.returnChildGoal) {
      await appStore.returnChildGoal(taskId, revisionNote);
      return;
    }
    await updateTask(childId, taskId, { revisionNote } as never);
    await updateTaskStatus(childId, taskId, 'revision_requested' as unknown as TaskStatus);
  };

  const handleReviewCompletion = async (childId: string, taskId: string, input: GoalReviewInput) => {
    if (appStore.reviewTaskCompletion) {
      await appStore.reviewTaskCompletion(taskId, {
        approved: input.approved,
        approvedPoints: input.approvedPoints,
        feedback: input.feedback || null,
        correction: input.correction || null,
        tone: input.tone,
        revisionNote: input.revisionNote || null,
      });
      return;
    }
    await updateTask(childId, taskId, {
      approvedPoints: input.approvedPoints,
      parentFeedback: input.feedback,
      parentCorrection: input.correction,
      feedbackTone: input.tone,
      revisionNote: input.revisionNote,
    } as never);
    await updateTaskStatus(childId, taskId, input.approved ? 'completed' : 'revision_requested' as unknown as TaskStatus);
  };

  const handleRevokeTaskApproval = async (task: GrowthTaskWithChild) => {
    if (!revokeTaskApproval) return;
    if (typeof window !== 'undefined' && !window.confirm(`確定要撤銷「${task.name}」的核准嗎？系統會依孩子目前餘額追回仍可追回的獎勵。`)) return;
    await revokeTaskApproval(task.id);
  };

  const handleDeleteTaskGroup = (group: GroupedTask) => {
    group.children.forEach(c => c.taskIds.forEach(taskId => deleteTask(c.childId, taskId)));
  };

  const openRewardForm = (group?: GroupedReward) => {
    setRewardFormError('');
    if (group) {
      setEditingReward(group);
      setNewRewardName(group.name);
      setNewRewardPoints(group.points);
      setNewRewardTargetChildIds(group.children.map(c => c.childId));
    } else {
      setEditingReward(null);
      setNewRewardName('');
      setNewRewardPoints(50);
      setNewRewardTargetChildIds(state.children.map(c => c.id));
    }
    setShowRewardForm(true);
  };

  const handleSaveReward = async () => {
    if (!newRewardName.trim() || newRewardTargetChildIds.length === 0) return;
    const rewardPoints = newRewardPoints;
    const pointsValidation = typeof rewardPoints === 'number'
      ? validateRewardPoints(rewardPoints)
      : { ok: false as const, message: '獎勵點數必須是大於 0 的整數。' };
    if (pointsValidation.ok === false) {
      setRewardFormError(pointsValidation.message);
      return;
    }
    setRewardFormError('');
    observedLoading.current = false;
    setMutationKind('reward');
    try {
      if (editingReward) {
        const existingChildIds = editingReward.children.map(c => c.childId);
        await Promise.all(newRewardTargetChildIds.map(async childId => {
          const existingChild = editingReward.children.find(c => c.childId === childId);
          if (existingChild) await updateReward(childId, existingChild.rewardId, { name: newRewardName, points: rewardPoints });
          else await addReward(childId, { name: newRewardName, points: rewardPoints, icon: 'Gift' });
        }));
        await Promise.all(existingChildIds.filter(childId => !newRewardTargetChildIds.includes(childId)).map(async childId => {
          const existingChild = editingReward.children.find(c => c.childId === childId);
          if (existingChild) await deleteReward(childId, existingChild.rewardId);
        }));
      } else {
        await Promise.all(newRewardTargetChildIds.map(childId => addReward(childId, { name: newRewardName, points: rewardPoints, icon: 'Gift' })));
      }
      setHeroFormReturnGroup(null);
      dismissWithAnimation(() => setShowRewardForm(false));
      setMutationKind(null);
    } catch { /* provider error is rendered above the tabs; keep form values intact */ }
  };

  const openPointAdjustment = (childId: string, mode: 'grant' | 'deduct') => {
    setPointAdjustment({ childId, mode });
    setPointAmount(mode === 'grant' ? 10 : 5);
    setPointReason('');
    setPointAdjustmentError('');
  };

  const closePointAdjustment = () => {
    if (mutationPending) return;
    setPointAdjustment(null);
    setPointReason('');
    setPointAdjustmentError('');
  };

  const handleAdjustPoints = async () => {
    if (!pointAdjustment) return;
    const amount = pointAmount;
    if (typeof amount !== 'number') {
      setPointAdjustmentError('請輸入點數。');
      return;
    }
    const child = state.children.find((candidate) => candidate.id === pointAdjustment.childId);
    if (!child) {
      setPointAdjustmentError('找不到這位小孩，請重新整理後再試。');
      return;
    }
    if (pointAdjustment.mode === 'deduct' && amount > child.points) {
      setPointAdjustmentError(`目前最多只能扣除 ${child.points} 點。`);
      return;
    }
    const delta = pointAdjustment.mode === 'grant' ? amount : -amount;
    const validation = validatePointLedgerAdjustment(delta, pointReason);
    if (validation.ok === false) {
      setPointAdjustmentError(validation.message);
      return;
    }
    try {
      await adjustChildPoints(child.id, delta, validation.note);
      setPointAdjustment(null);
      setPointReason('');
      setPointAdjustmentError('');
    } catch (adjustmentError) {
      setPointAdjustmentError(adjustmentError instanceof Error ? adjustmentError.message : '點數調整失敗，請重試。');
    }
  };

  const handleDeleteRewardGroup = (group: GroupedReward) => {
    group.children.forEach(c => deleteReward(c.childId, c.rewardId));
  };

  const handleApproveWishlist = (childId: string, wishlistId: string) => {
    const points = wishlistPricing[wishlistId];
    if (points > 0) {
      approveWishlist(childId, wishlistId, points);
      setWishlistPricing(prev => {
        const next = { ...prev };
        delete next[wishlistId];
        return next;
      });
    } else {
      alert("請輸入定價點數");
    }
  };
  
  const handleAddChild = async (profile?: NewChildProfile, e?: React.FormEvent): Promise<boolean> => {
    if (e) e.preventDefault();
    if (childAccountSubmissionInFlight.current) return false;
    setNewChildError('');
    if (!newChildName.trim()) {
      setNewChildError('請輸入小孩名字。');
      return false;
    }
    const selectedGender = profile?.gender ?? newChildGender;
    const selectedCharacterId = profile?.characterId ?? (newChildCharacterId || CURRENT_WORLD_CHARACTER_ID);
    if (!selectedGender || !selectedCharacterId) {
      setNewChildError('請選擇性別與人物。');
      return false;
    }
    const usernameValidation = validateChildUsername(newChildUsername);
    if ('message' in usernameValidation) {
      setNewChildError(usernameValidation.message);
      return false;
    }
    const passwordValidation = validateChildPassword(newChildPassword);
    if ('message' in passwordValidation) {
      setNewChildError(passwordValidation.message);
      return false;
    }
    const confirmationValidation = validatePasswordConfirmation(newChildPassword, newChildPasswordConfirmation);
    if ('message' in confirmationValidation) {
      setNewChildError(confirmationValidation.message);
      return false;
    }
    if (!isCurrentParentConsent(state.parentConsentVersion) && !allowPendingChildAction.current) {
      setPendingChildAction('new');
      setShowConsentModal(true);
      return false;
    }
    allowPendingChildAction.current = false;
    childAccountSubmissionInFlight.current = true;
    setChildAccountSubmitting(true);
    try {
      await addChild(newChildName.trim(), newChildUsername.trim().toLowerCase(), newChildPassword, undefined, { gender: selectedGender, characterId: selectedCharacterId });
      setNewChildName('');
      setNewChildUsername('');
      setNewChildPassword('');
      setNewChildPasswordConfirmation('');
      setNewChildGender('');
      setNewChildCharacterId(WORLD_CHARACTER_CATALOG[0]?.id ?? CURRENT_WORLD_CHARACTER_ID);
      return true;
    } catch (error) {
      setNewChildError(toChildAccountErrorMessage(error));
      return false;
    } finally {
      childAccountSubmissionInFlight.current = false;
      setChildAccountSubmitting(false);
    }
  };

  const handleCreateExistingChildAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (childAccountSubmissionInFlight.current) return;
    const child = state.children.find((item) => item.id === accountSetupChildId);
    if (!child) return;
    setAccountSetupError('');
    const usernameValidation = validateChildUsername(accountSetupUsername);
    if ('message' in usernameValidation) { setAccountSetupError(usernameValidation.message); return; }
    const passwordValidation = validateChildPassword(accountSetupPassword);
    if ('message' in passwordValidation) { setAccountSetupError(passwordValidation.message); return; }
    const confirmationValidation = validatePasswordConfirmation(accountSetupPassword, accountSetupConfirmation);
    if ('message' in confirmationValidation) { setAccountSetupError(confirmationValidation.message); return; }
    if (!isCurrentParentConsent(state.parentConsentVersion) && !allowPendingChildAction.current) {
      setPendingChildAction('existing');
      setShowConsentModal(true);
      return;
    }
    allowPendingChildAction.current = false;
    childAccountSubmissionInFlight.current = true;
    setChildAccountSubmitting(true);
    try {
      await addChild(child.name, accountSetupUsername, accountSetupPassword, child.id);
      setAccountSetupChildId(null);
      setAccountSetupUsername('');
      setAccountSetupPassword('');
      setAccountSetupConfirmation('');
    } catch (error) {
      setAccountSetupError(toAuthErrorMessage(error));
    } finally {
      childAccountSubmissionInFlight.current = false;
      setChildAccountSubmitting(false);
    }
  };

  const handleResetChildPassword = async () => {
    if (!resetChildId || resetChildPasswordSubmissionInFlight.current) return;

    const valid = validateChildPassword(resetChildPassword);
    if ('message' in valid) { setResetChildError(valid.message); return; }
    const confirmed = validatePasswordConfirmation(resetChildPassword, resetChildPasswordConfirmation);
    if ('message' in confirmed) { setResetChildError(confirmed.message); return; }

    resetChildPasswordSubmissionInFlight.current = true;
    setResetChildPasswordSubmitting(true);
    try {
      await updateChildPassword(resetChildId, resetChildPassword);
      dismissWithAnimation(() => { setResetChildId(null); setResetChildPassword(''); setResetChildPasswordConfirmation(''); }, '.hh-parent-confirm-panel');
    } catch { /* provider error is shown above the tabs; keep the form open */
    } finally {
      resetChildPasswordSubmissionInFlight.current = false;
      setResetChildPasswordSubmitting(false);
    }
  };

  const openHeroFeature = (tab: ParentTab) => {
    setActiveTab(tab);
    setHeroFeature(tab);
    setHeroMenuGroup(null);
    setHeroMenuVisible(false);
  };

  const openAdventureForm = (type: 'daily' | 'general') => {
    openHeroFeature('tasks');
    setAdventureFormRequest({ type, requestId: Date.now() });
  };

  const closeHeroFeature = () => {
    dismissWithAnimation(() => setHeroFeature(null), '.hh-parent-content-modal', 260);
    setHeroMenuGroup(null);
    setHeroMenuVisible(false);
  };

  const openHeroForm = (tab: ParentTab, action: () => void) => {
    setHeroFormReturnGroup(heroMenuGroup ?? tab);
    openHeroFeature(tab);
    window.setTimeout(action, 0);
  };

  const closeHeroForm = (closeForm: () => void, selector?: string) => {
    dismissWithAnimation(() => {
      closeForm();
      if (heroFormReturnGroup) {
        setHeroFeature(null);
        setHeroMenuGroup(heroFormReturnGroup);
        setHeroMenuVisible(true);
      }
      setHeroFormReturnGroup(null);
    }, selector);
  };

  const toggleHeroMenuGroup = (tab: ParentTab) => {
    setHeroMenuGroup((current) => current === tab ? null : tab);
  };

  const heroRootMenuActions: CharacterMenuAction[] = [
    { id: 'review', title: '審核', tone: 'attention', tour: 'review-menu', icon: <Eye size={17} />, hasNotification: parentMenuNotifications.review, onSelect: () => openHeroFeature('review') },
    { id: 'tasks', title: '任務', tone: 'action', tour: 'tasks-menu', icon: <Circle size={17} />, closeOnSelect: false, onSelect: () => toggleHeroMenuGroup('tasks') },
    { id: 'growth', title: '成長', tone: 'growth', tour: 'growth-menu', icon: <Star size={17} />, onSelect: () => openHeroFeature('growth') },
    { id: 'rewards', title: '獎勵', tone: 'reward', tour: 'rewards-menu', icon: <Gift size={17} />, hasNotification: parentMenuNotifications.rewards || parentMenuNotifications.wishlist, onSelect: () => openHeroFeature('rewards') },
    { id: 'world-shop', title: '商店', tone: 'explore', tour: 'world-shop-menu', icon: <ShoppingBag size={17} />, onSelect: () => openHeroFeature('world-shop') },
  ];

  const heroSubMenuActions: Record<ParentTab, CharacterMenuAction[]> = {
    review: [],
    tasks: [
      { id: 'task-form', title: '冒險管理', tour: 'add-task-menu', icon: <CalendarDays size={17} />, onSelect: () => openHeroFeature('tasks') },
      { id: 'add-daily-adventure', title: '每日冒險', icon: <Plus size={17} />, onSelect: () => openAdventureForm('daily') },
      { id: 'add-general-adventure', title: '一般冒險', icon: <Plus size={17} />, onSelect: () => openAdventureForm('general') },
    ],
    growth: [],
    rewards: [],
    wishlist: [],
    'world-shop': [],
  };

  const heroMenuActions = heroMenuGroup ? heroSubMenuActions[heroMenuGroup] : heroRootMenuActions;

  return (
    <div
      className="hh-dashboard-screen hh-app-interaction-surface flex flex-col min-h-[100dvh] bg-gray-50"
      onContextMenu={preventNativeAppContextMenu}
      onDragStart={preventNativeAppDragStart}
    >
      <ParentDashboardBackgroundMusic enabled={parentBackgroundMusicEnabled} />
      <DashboardCharacterHero
        sceneImage="/images/habithero-parent-living-room.png"
        sceneImageDesktop="/images/habithero-parent-living-room-desktop.png"
        theme={state.familyTheme}
        firstStatLabel="家庭總點數"
        firstStatValue={totalPoints}
        firstStatIcon={<Star className="hh-character-stat-points" size={17} strokeWidth={2.5} />}
        secondStatLabel="待審核項目"
        secondStatValue={reviewCount}
        secondStatSuffix="待審核"
        menuActions={heroMenuActions}
        rootMenuActions={heroRootMenuActions}
        activeMenuId={heroMenuGroup}
        menuVariant="parent"
        onMenuClose={() => setHeroMenuGroup(null)}
        menuOpen={heroMenuVisible}
        onMenuOpenChange={setHeroMenuVisible}
        actions={(
          <button data-tour="settings" onClick={() => setShowSettings(true)} aria-label="設定" title="設定" className="hh-character-icon-button">
            <Settings size={19} />
          </button>
        )}
      />

      <ParentDashboardContent
        contentRef={featureContentRef}
        heroFeature={heroFeature}
        onCloseFeature={closeHeroFeature}
        onBackFeature={() => openHeroFeature('rewards')}
        isOffline={isOffline}
        error={error}
        loading={loading}
        onRetry={() => void retry({ recoverWorldMutations: true })}
      >
        {activeTab === 'review' && (
          <GoalReviewPanel
            proposedTasks={proposedTasks}
            pendingTasks={pendingTasks}
            loading={loading || mutationPending}
            onConfirmGoal={handleConfirmGoal}
            onReturnGoal={handleReturnGoal}
            onReviewCompletion={handleReviewCompletion}
          />
        )}

        {activeTab === 'tasks' && (
          <ParentAdventureWorkspace
            children={state.children.map(child => ({ id: child.id, name: child.name }))}
            tasks={calendarTasks}
            schedules={state.taskSchedules ?? []}
            generalTitle={generalAdventureTitle}
            activeFrom={todayDateKey}
            loading={loading || mutationPending}
            onOpenReview={() => openHeroFeature('review')}
            onCreateSchedule={appStore.createAdventureSchedule}
            onCreateGeneral={appStore.createGeneralAdventure}
            onUpdateGeneralTitle={appStore.updateGeneralAdventureTitle}
            onBatchReviewDaily={appStore.batchReviewDailyAdventures}
            onUpdateSchedule={appStore.updateAdventureSchedule}
            onDisableSchedule={appStore.disableAdventureSchedule}
            onEditTask={task => openTaskForm(toParentCalendarTaskGroup(task, DEFAULT_TASK_CATEGORY))}
            onDeleteTask={task => setTaskToDelete(toParentCalendarTaskGroup(task, DEFAULT_TASK_CATEGORY))}
            requestedForm={adventureFormRequest}
            legacyTaskList={(
              <>
            {/* Todo Tasks */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-900">今日任務清單</h2>
                <button data-tour="task-add" onClick={() => openTaskForm()} disabled={state.children.length === 0} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus size={16} /> 新增
                </button>
              </div>
              {state.children.length === 0 && (
                <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800">
                  目前尚未建立小孩，請先到設定新增小孩，才能建立任務。
                </p>
              )}
              <div className="space-y-3">
                {groupedTodoTasks.map((group, index) => (
                  <div key={group.id} data-tour={index === 0 ? 'task-card' : undefined} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Circle size={20} className="text-gray-300 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {group.children.map(c => (
                            <span key={c.childId} className="bg-blue-100 text-blue-700 text-base px-2.5 py-1 rounded-lg font-black shrink-0">{c.childName}</span>
                          ))}
                        </div>
                <h3 className="whitespace-pre-wrap break-words font-bold text-gray-900 text-base leading-snug">{group.name}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <CategoryBadge category={group.category} compact />
                          {group.isDaily && (
                            <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold border border-green-100 shrink-0">每日</span>
                          )}
                          {group.duration && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                              <PlayCircle size={12}/> {group.duration}m
                            </span>
                          )}
                          {group.dueTime && (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                              <Clock size={12}/> {group.dueTime.slice(0, 5)}{group.endTime ? `–${group.endTime.slice(0, 5)}` : ' 起'}
                            </span>
                          )}
                          <PointValue value={group.points} className="ml-auto text-blue-500 text-sm font-black whitespace-nowrap" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openTaskForm(group)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => setTaskToDelete(group)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {todoTasks.length === 0 && pendingTasks.length === 0 && completedTasks.length === 0 && (
                  <EmptyState>目前沒有任務，趕快新增吧！</EmptyState>
                )}
              </div>
            </section>

            {completedTasks.length > 0 && <RecentApprovedTasks tasks={completedTasks} disabled={loading || mutationPending || !revokeTaskApproval} onRevoke={task => void handleRevokeTaskApproval(task)} />}

            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-900">常用模板</h2>
                <button onClick={() => openTemplateForm()} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg">
                  <Plus size={16} /> 新增
                </button>
              </div>
              <div className="space-y-3">
                {(state.taskTemplates as GrowthTaskTemplate[]).map(template => (
                  <div key={template.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 shrink-0">
                        <Star size={20} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="whitespace-pre-wrap break-words font-bold text-gray-900 text-base leading-snug">{template.name}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <CategoryBadge category={template.category} compact />
                          {template.duration && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                              <PlayCircle size={12}/> {template.duration}m
                            </span>
                          )}
                        </div>
                        <PointValue value={template.points} className="text-blue-500 text-sm font-bold" />
                      </div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => openAssignTemplate(template)} disabled={state.children.length === 0} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                        派發
                      </button>
                      <button onClick={() => openTemplateForm(template)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => void deleteTaskTemplate(template.id)} disabled={loading} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:cursor-wait disabled:opacity-50">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {state.taskTemplates.length === 0 && (
                  <EmptyState>目前沒有模板，點擊右上角新增。</EmptyState>
                )}
              </div>
            </section>
              </>
            )}
          />
        )}

        {activeTab === 'growth' && (
          <GrowthSummaryPanel summaries={growthSummaries} title="家庭成長紀錄" tasks={allTasks} />
        )}

        {activeTab === 'rewards' && (
          <div className="space-y-6">
            <section className="hh-child-points-section space-y-3" aria-labelledby="parent-child-points-title">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 id="parent-child-points-title" className="flex items-center gap-2 text-lg font-black text-gray-900">
                    <Star size={20} className="text-amber-500" aria-hidden="true" />
                    孩子點數
                  </h2>
                </div>
              </div>
              {state.children.length === 0 ? (
                <EmptyState className="rounded-2xl bg-white">請先到設定新增小孩，才能管理點數。</EmptyState>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {state.children.map((child) => (
                    <article key={child.id} className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black text-gray-900">{child.name}</h3>
                        </div>
                        <PointValue value={child.points} className="shrink-0 text-lg font-black text-amber-700" />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openPointAdjustment(child.id, 'grant')}
                          disabled={mutationPending}
                          className="hh-point-management-action hh-adventure-secondary-action flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-black transition-colors disabled:cursor-wait disabled:opacity-50"
                        >
                          <PlusCircle size={17} aria-hidden="true" /> 贈點
                        </button>
                        <button
                          type="button"
                          onClick={() => openPointAdjustment(child.id, 'deduct')}
                          disabled={mutationPending || child.points === 0}
                          className="hh-point-management-action hh-adventure-secondary-action flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <MinusCircle size={17} aria-hidden="true" /> 扣點
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPointHistoryChildId(child.id)}
                        className="hh-point-ledger-action hh-adventure-secondary-action mt-2 flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-black transition-colors"
                      >
                        查看點數明細
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => openHeroFeature('wishlist')}
                className="min-h-11 rounded-xl bg-yellow-100 px-4 text-sm font-bold text-yellow-800 transition-colors hover:bg-yellow-200"
              >
                <Star size={16} className="mr-1 inline-block" />
                許願
              </button>
            </div>

            {/* Rewards */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-900">獎勵</h2>
                <button onClick={() => openRewardForm()} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg">
                  <Plus size={16} /> 新增
                </button>
              </div>
              <div className="space-y-3">
                {groupedRewards.map(group => (
                  <div key={group.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group-item relative">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                        <Gift size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          {group.children.map(c => (
                            <span key={c.childId} className="text-sm font-bold text-gray-800">{c.childName}</span>
                          ))}
                        </div>
                        <div className="whitespace-pre-wrap break-words font-medium text-gray-900">{group.name}</div>
                        <PointValue value={group.points} className="text-blue-500 font-bold text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" aria-label="編輯獎勵" onClick={() => openRewardForm(group)} className="hh-reward-management-action p-2 text-gray-400 hover:text-blue-500">
                        <Edit2 size={18} />
                      </button>
                      <button type="button" aria-label="刪除獎勵" onClick={() => setRewardToDelete(group)} className="hh-reward-management-action p-2 text-gray-400 hover:text-red-500">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Redemption History */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Gift size={20} className="text-purple-500" />
                兌換紀錄 ({allTickets.length})
              </h2>
              {allTickets.length === 0 ? (
                <EmptyState className="rounded-2xl bg-white">目前還沒有兌換紀錄</EmptyState>
              ) : (
                <div className="space-y-3">
                  {allTickets.map(ticket => {
                    const isPending = ticket.status === 'pending';
                    const createdDate = new Date(ticket.createdAt).toLocaleDateString('zh-TW');
                    return (
                      <div key={ticket.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm ${isPending ? 'border-purple-100 bg-purple-50' : 'border-gray-100 bg-white'}`}>
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">{ticket.childName}</span>
                            <span className={`text-xs font-bold ${isPending ? 'text-purple-700' : 'text-green-700'}`}>{isPending ? '待兌現' : '已兌現'}</span>
                          </div>
                          <div className="break-words font-medium text-gray-900">{ticket.rewardName}</div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <PointValue value={ticket.pointsCost} iconSize={13} /> · {createdDate}
                          </div>
                        </div>
                        {isPending && (
                          <button onClick={() => void fulfillTicket(ticket.childId, ticket.id)} disabled={loading} className="shrink-0 rounded-xl bg-purple-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-purple-600 disabled:cursor-wait disabled:opacity-50">
                            已兌現
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Star size={20} className="text-yellow-500" />
              小孩許願
            </h2>
            {allWishlist.length === 0 ? (
              <EmptyState className="bg-white rounded-2xl">許願空空的</EmptyState>
            ) : (
              <div className="space-y-3">
                {allWishlist.map(item => (
                  <div key={item.id} className="bg-yellow-50 p-5 rounded-2xl shadow-sm border border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-0.5 rounded font-bold">{item.childName}</span>
                    </div>
                    <div className="font-medium text-gray-900 mb-4">{item.name}</div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="1"
                        placeholder="定價（點數）"
                        className="flex-1 p-3 rounded-xl border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        value={wishlistPricing[item.id] || ''}
                        onChange={(e) => setWishlistPricing(p => ({...p, [item.id]: Number(e.target.value)}))}
                      />
                      <button 
                        onClick={() => void handleApproveWishlist(item.childId, item.id)} 
                        disabled={loading}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-4 rounded-xl text-sm font-bold shadow-sm disabled:cursor-wait disabled:opacity-50"
                      >
                        上架
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'world-shop' && (
          state.children[0] ? (
            <ParentGamePricePanel
              catalog={priceGameData?.catalog ?? []}
              prices={priceGameData?.prices ?? {}}
              loading={loading || mutationPending}
              onRetry={() => void retry({ recoverWorldMutations: true })}
              onSave={async (catalogItemId, scrollPrice) => {
                await setFamilyGameItemPrice(catalogItemId, scrollPrice);
              }}
              onReset={async (catalogItemId) => {
                await resetFamilyGameItemPrice(catalogItemId);
              }}
            />
          ) : <EmptyState>先到設定新增小孩，才能管理商店。</EmptyState>
        )}
      </ParentDashboardContent>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
          <div className="hh-settings-drawer bg-white w-full sm:max-w-sm h-full p-6 shadow-xl overflow-y-auto animate-slide-left">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2"><Settings size={24} className="text-gray-500" /> 設定</h3>
              <button onClick={() => dismissWithAnimation(() => setShowSettings(false), '.hh-settings-drawer')} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={24} /></button>
            </div>
            
            <div className="space-y-8">
              <ParentSettingsChildrenSection
                children={state.children}
                childNameDrafts={childNameDrafts}
                onChildNameDraftChange={(childId, name) => setChildNameDrafts(drafts => ({ ...drafts, [childId]: name }))}
                onChildNameBlur={(childId, value) => { const name = value.trim(); const child = state.children.find(item => item.id === childId); if (name && child && name !== child.name) void updateChildName(childId, name); }}
                onDeleteChild={setChildToDelete}
                onResetPassword={childId => { setResetChildId(childId); setResetChildError(''); }}
                onSetupAccount={childId => { setAccountSetupChildId(childId); setAccountSetupError(''); }}
                newChildName={newChildName}
                newChildUsername={newChildUsername}
                newChildPassword={newChildPassword}
                newChildPasswordConfirmation={newChildPasswordConfirmation}
                showNewChildPassword={showNewChildPassword}
                showNewChildPasswordConfirmation={showNewChildPasswordConfirmation}
                newChildError={newChildError}
                loading={loading}
                childAccountSubmitting={childAccountSubmitting}
                onNewChildNameChange={setNewChildName}
                onNewChildUsernameChange={value => { setNewChildUsername(value); setNewChildError(''); }}
                onNewChildPasswordChange={value => { setNewChildPassword(value); setNewChildError(''); }}
                onNewChildPasswordConfirmationChange={value => { setNewChildPasswordConfirmation(value); setNewChildError(''); }}
                onToggleNewChildPassword={() => setShowNewChildPassword(visible => !visible)}
                onToggleNewChildPasswordConfirmation={() => setShowNewChildPasswordConfirmation(visible => !visible)}
                newChildGender={newChildGender}
                newChildCharacterId={newChildCharacterId}
                onNewChildGenderChange={setNewChildGender}
                onNewChildCharacterChange={setNewChildCharacterId}
                onAddChild={handleAddChild}
                showNewChildForm={showNewChildForm}
                onNewChildFormChange={setShowNewChildForm}
              />

              {/* System */}
              <section className="space-y-3 border-t border-gray-100 pt-6">
                <h4 className="text-md font-bold text-gray-800">帳號與家庭安全</h4>
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                  <button
                    type="button"
                    onClick={() => setShowParentPasswordForm((expanded) => !expanded)}
                    aria-expanded={showParentPasswordForm}
                    className="hh-settings-document-row"
                  >
                    <span><strong>修改家長密碼</strong><small>更新管理家庭資料的家長登入密碼。</small></span>
                    <span aria-hidden="true">{showParentPasswordForm ? '⌃' : '›'}</span>
                  </button>
                  {showParentPasswordForm && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="old-parent-password" className="sr-only">舊家長密碼</label>
                        <input id="old-parent-password" type="password" autoComplete="current-password" value={oldParentPin} onChange={e => setOldParentPin(e.target.value)} placeholder="輸入舊密碼" className="w-full rounded-xl border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" />
                        <div className="flex gap-2">
                          <label htmlFor="new-parent-password" className="sr-only">新家長密碼</label>
                          <input id="new-parent-password" type="password" autoComplete="new-password" value={newParentPin} onChange={e => setNewParentPin(e.target.value)} placeholder="輸入新密碼" className="w-full rounded-xl border border-gray-300 p-2.5 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" />
                          <button type="button" onClick={() => {
                            void (async () => {
                              try {
                                await verifyCurrentParentPassword(oldParentPin);
                                if (newParentPin.length < 8) { alert("新密碼至少 8 碼"); return; }
                                await updateCurrentParentPassword(newParentPin);
                                alert("密碼更新成功");
                                setOldParentPin('');
                                setNewParentPin('');
                                setShowParentPasswordForm(false);
                              } catch { alert("舊密碼錯誤或密碼更新失敗"); }
                            })();
                          }} className="min-h-11 shrink-0 rounded-xl bg-gray-200 px-4 py-2 font-bold text-gray-700 transition-colors hover:bg-gray-300">更新</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {([
                    ['privacy', '隱私政策', '了解習慣冒險島如何處理家庭與兒童資料。'],
                    ['support', '支援中心', '登入、同步、點數與資料刪除的協助。'],
                    ['consent', '兒童與家長同意', '查看家長責任與記錄本版本同意。'],
                    ['delete-account', '刪除帳號與資料', '永久刪除家庭資料與所有帳號。'],
                  ] as const).map(([documentId, title, description]) => (
                    <button key={documentId} type="button" onClick={() => setSettingsDocument(documentId)} className="hh-settings-document-row">
                      <span><strong>{title}</strong><small>{description}</small></span>
                      <span aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* System */}
              <section className="pt-4 pb-8">
                <button
                  type="button"
                  onClick={() => dismissWithAnimation(() => {
                    setShowSettings(false);
                    if (state.children.length > 1) setShowChildPicker(true);
                    else onSwitchToChild();
                  }, '.hh-settings-drawer')}
                  disabled={state.children.length === 0}
                  aria-label="切換小孩視角"
                  title="切換小孩視角"
                  className="hh-parent-child-switch-action mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Users size={20} aria-hidden="true" className="hh-parent-child-switch-icon shrink-0 text-gray-900" /> 切換小孩視角
                </button>
                <section className="hh-notification-settings" aria-labelledby="parent-background-music-title">
                  <div className="hh-notification-settings-heading">
                    <h4 id="parent-background-music-title">背景音樂</h4>
                  </div>
                  <button
                    type="button"
                    className={`hh-notification-toggle${parentBackgroundMusicEnabled ? ' is-on' : ''}`}
                    role="switch"
                    aria-checked={parentBackgroundMusicEnabled}
                    aria-label="背景音樂"
                    onClick={() => handleParentBackgroundMusicChange(!parentBackgroundMusicEnabled)}
                  >
                    <span className="hh-notification-toggle-track" aria-hidden="true">
                      <span className="hh-notification-toggle-thumb" />
                    </span>
                  </button>
                </section>
                <PushNotificationSettings settings={notificationSettings} />
                <button type="button" onClick={() => { setShowSettings(false); setShowFirstUseGuide(true); }} className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-3 font-bold text-blue-700 transition-colors hover:bg-blue-100">
                  重新觀看新手指引
                </button>
                <button onClick={() => dismissWithAnimation(() => { setShowSettings(false); onLogout(); }, '.hh-settings-drawer')} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 font-bold text-gray-700 transition-colors hover:bg-gray-200">
                  <LogOut size={20} /> 登出家長端
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      {settingsDocument && (
        <ParentSettingsDocuments
          document={settingsDocument}
          consentRecorded={isCurrentParentConsent(state.parentConsentVersion)}
          onClose={() => setSettingsDocument(null)}
          onConsent={async () => { await recordParentConsent(PARENT_CONSENT_VERSION); }}
          onDeleteAccount={async () => { await deleteCurrentAccount(); setSettingsDocument(null); setShowSettings(false); onLogout(); }}
        />
      )}

      {showConsentModal && (
        <ParentConsentModal
          onClose={() => { setShowConsentModal(false); setPendingChildAction(null); }}
          onOpenPrivacyPolicy={() => setShowPrivacyPolicy(true)}
          onAgree={async () => {
            await recordParentConsent(PARENT_CONSENT_VERSION);
            const action = pendingChildAction;
            setShowConsentModal(false);
            setPendingChildAction(null);
            allowPendingChildAction.current = true;
            if (action === 'new') void handleAddChild();
            if (action === 'existing') void handleCreateExistingChildAccount();
          }}
        />
      )}

      {showPrivacyPolicy && <ParentPrivacyPolicyPage onClose={() => setShowPrivacyPolicy(false)} />}

      {showFirstUseGuide && <FirstUseGuide onClose={() => setShowFirstUseGuide(false)} onStepChange={handleGuideStepChange} />}

      {/* Task Overlays */}
      {showTaskForm && (
        <ParentDashboardFormModal title={editingTask ? '編輯任務' : '新增任務'} closeLabel="關閉新增任務" onClose={() => closeHeroForm(() => setShowTaskForm(false))}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任務名稱</label>
                <textarea data-tour="task-name" rows={2} value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="例如：刷牙洗臉" className="w-full resize-y rounded-xl border border-gray-200 p-3 leading-6 focus:ring-2 focus:ring-blue-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">固定分類</label>
                <select
                  value={newTaskCategory}
                  onChange={e => setNewTaskCategory(e.target.value as TaskCategory)}
                  className="min-h-12 w-full rounded-xl border border-gray-200 bg-white p-3 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {TASK_CATEGORIES.map(category => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </div>
              {state.children.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">指定小孩</label>
                  <div className="flex flex-wrap gap-2">
                    {state.children.map(c => {
                      const isSelected = newTaskTargetChildIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors border ${
                            isSelected
                              ? 'bg-teal-50/90 border-teal-500/60 text-teal-900 font-bold shadow-xs'
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hh-child-checkbox rounded focus:ring-teal-400"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) setNewTaskTargetChildIds(p => [...p, c.id]);
                              else setNewTaskTargetChildIds(p => p.filter(id => id !== c.id));
                            }}
                          />
                          <span className="text-sm font-medium">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">獲得點數</label>
                  <input type="number" min="1" value={newTaskPoints} onChange={e => setNewTaskPoints(Number(e.target.value))} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
              </div>
              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1 truncate">開始時間</label>
                <TaipeiTimeInput value={newTaskDueTime} onChange={setNewTaskDueTime} />
                <p className="mt-1 text-xs font-medium text-gray-400">不設定就是全天都可以執行。</p>
              </div>
              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1 truncate">結束時間</label>
                <TaipeiTimeInput value={newTaskEndTime} onChange={setNewTaskEndTime} />
                <p className="mt-1 text-xs font-medium text-gray-400">超過後本次任務會截止，下一次時間再開放。</p>
              </div>
              <button onClick={() => void handleSaveTask()} disabled={loading || newTaskPoints < 1} className="w-full bg-blue-500 text-white p-4 rounded-xl font-medium mt-2 mb-4 disabled:cursor-wait disabled:opacity-50">{loading ? '儲存中…' : editingTask ? '儲存變更' : '新增'}</button>
            </div>
        </ParentDashboardFormModal>
      )}

      {showTemplateForm && (
        <ModalShell
          title={editingTemplate ? '編輯模板' : '新增模板'}
          closeLabel="關閉新增模板"
          onClose={() => closeHeroForm(() => setShowTemplateForm(false))}
        >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任務名稱</label>
                <textarea rows={2} value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="例如：洗碗" className="w-full resize-y rounded-xl border border-gray-200 p-3 leading-6 focus:ring-2 focus:ring-blue-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">固定分類</label>
                <select
                  value={newTaskCategory}
                  onChange={e => setNewTaskCategory(e.target.value as TaskCategory)}
                  className="min-h-12 w-full rounded-xl border border-gray-200 bg-white p-3 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {TASK_CATEGORIES.map(category => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">預設點數</label>
                  <input type="number" min="1" value={newTaskPoints} onChange={e => setNewTaskPoints(Number(e.target.value))} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
              </div>
              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1 truncate">開始時間</label>
                <TaipeiTimeInput value={newTaskDueTime} onChange={setNewTaskDueTime} />
              </div>
              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1 truncate">結束時間</label>
                <TaipeiTimeInput value={newTaskEndTime} onChange={setNewTaskEndTime} />
                <p className="mt-1 text-xs font-medium text-gray-400">派發後會套用這段執行時間。</p>
              </div>
              <button onClick={() => void handleSaveTemplate()} disabled={loading || newTaskPoints < 1} className="w-full bg-blue-500 text-white p-4 rounded-xl font-medium mt-2 mb-4 disabled:cursor-wait disabled:opacity-50">{loading ? '儲存中…' : '儲存模板'}</button>
            </div>
        </ModalShell>
      )}

      {assigningTemplate && (
        <ModalShell
          title={`派發任務：${assigningTemplate.name}`}
          closeLabel="關閉派發模板"
          onClose={() => closeHeroForm(() => setAssigningTemplate(null))}
        >
            <div className="space-y-4">
              {state.children.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">選擇小孩</label>
                  <div className="flex flex-wrap gap-2">
                    {state.children.map(c => {
                      const isSelected = newTaskTargetChildIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors border ${
                            isSelected
                              ? 'bg-teal-50/90 border-teal-500/60 text-teal-900 font-bold shadow-xs'
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hh-child-checkbox rounded focus:ring-teal-400"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) setNewTaskTargetChildIds(p => [...p, c.id]);
                              else setNewTaskTargetChildIds(p => p.filter(id => id !== c.id));
                            }}
                          />
                          <span className="text-sm font-medium">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1 truncate">開始時間</label>
                <TaipeiTimeInput value={newTaskDueTime} onChange={setNewTaskDueTime} />
                <p className="mt-1 text-xs font-medium text-gray-400">不設定就是全天都可以執行。</p>
              </div>
              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1 truncate">結束時間</label>
                <TaipeiTimeInput value={newTaskEndTime} onChange={setNewTaskEndTime} />
                <p className="mt-1 text-xs font-medium text-gray-400">超過後本次任務會截止，下一次時間再開放。</p>
              </div>
              <button onClick={() => void handleAssignTemplate()} disabled={loading} className="w-full bg-blue-500 text-white p-4 rounded-xl font-medium mt-2 mb-4 disabled:cursor-wait disabled:opacity-50">{loading ? '派發中…' : '確認派發'}</button>
            </div>
        </ModalShell>
      )}

      {pointHistoryChildId && (() => {
        const historyChild = state.children.find((child) => child.id === pointHistoryChildId);
        if (!historyChild) return null;
        return (
          <ModalShell
            title={`${historyChild.name}的點數明細`}
            closeLabel="關閉點數明細"
            onClose={() => setPointHistoryChildId(null)}
            panelClassName="hh-point-ledger-modal-panel max-h-[calc(100dvh-32px)] max-w-lg overflow-y-auto"
          >
            <PointLedgerHistory
              childProfileId={historyChild.id}
              childName={historyChild.name}
              loadPage={loadPointLedgerPage}
              getTaskName={(taskId) => historyChild.tasks.find((task) => task.id === taskId)?.name ?? null}
            />
          </ModalShell>
        );
      })()}

      {pointAdjustment && (() => {
        const adjustmentChild = state.children.find((child) => child.id === pointAdjustment.childId);
        if (!adjustmentChild) return null;
        const isGrant = pointAdjustment.mode === 'grant';
        return (
          <ModalShell
            title={`${isGrant ? '贈點給' : '扣除'}${adjustmentChild.name}`}
            closeLabel="關閉點數調整"
            onClose={closePointAdjustment}
            panelClassName="max-w-sm"
          >
            <div className="space-y-4">
              <div className="rounded-2xl p-4">
                <p className="text-sm font-bold text-gray-600">目前餘額</p>
                <PointValue value={adjustmentChild.points} className="mt-1 text-2xl font-black text-gray-900" />
              </div>
              <div>
                <label htmlFor="point-adjustment-amount" className="mb-1 block text-sm font-bold text-gray-700">點數</label>
                <input
                  id="point-adjustment-amount"
                  type="number"
                  min="1"
                  max={isGrant ? 10000 : adjustmentChild.points}
                  step="1"
                  inputMode="numeric"
                  value={pointAmount}
                  onChange={(event) => {
                    setPointAmount(event.target.value === '' ? '' : Number(event.target.value));
                    setPointAdjustmentError('');
                  }}
                  className="min-h-12 w-full rounded-xl border border-gray-200 p-3 text-lg font-black outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label htmlFor="point-adjustment-reason" className="mb-1 block text-sm font-bold text-gray-700">原因</label>
                <textarea
                  id="point-adjustment-reason"
                  rows={3}
                  maxLength={200}
                  value={pointReason}
                  onChange={(event) => {
                    setPointReason(event.target.value);
                    setPointAdjustmentError('');
                  }}
                  placeholder={isGrant ? '例如：主動整理餐桌' : '例如：未完成今天的約定'}
                  className="w-full resize-y rounded-xl border border-gray-200 p-3 leading-6 outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              {pointAdjustmentError && <p className="text-sm font-bold text-red-600" role="alert">{pointAdjustmentError}</p>}
              <button
                type="button"
                onClick={() => void handleAdjustPoints()}
                disabled={mutationPending}
                className="hh-point-adjustment-submit hh-adventure-primary-action min-h-12 w-full rounded-xl px-4 text-base font-black transition-colors disabled:cursor-wait disabled:opacity-50"
              >
                {mutationPending ? '儲存中…' : isGrant ? '確認贈點' : '確認扣點'}
              </button>
            </div>
          </ModalShell>
        );
      })()}

      {showRewardForm && (
        <ModalShell
          title={editingReward ? '編輯獎勵' : '新增獎勵'}
          closeLabel="關閉新增獎勵"
          onClose={() => closeHeroForm(() => setShowRewardForm(false))}
        >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">獎勵名稱</label>
                <textarea rows={2} value={newRewardName} onChange={e => setNewRewardName(e.target.value)} placeholder="例如：看卡通 30 分鐘" className="w-full resize-y rounded-xl border border-gray-200 p-3 leading-6 focus:ring-2 focus:ring-blue-400 outline-none" />
              </div>
              {state.children.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">指定小孩</label>
                  <div className="flex flex-wrap gap-2">
                    {state.children.map(c => {
                      const isSelected = newRewardTargetChildIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors border ${
                            isSelected
                              ? 'bg-teal-50/90 border-teal-500/60 text-teal-900 font-bold shadow-xs'
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hh-child-checkbox rounded focus:ring-teal-400"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) setNewRewardTargetChildIds(p => [...p, c.id]);
                              else setNewRewardTargetChildIds(p => p.filter(id => id !== c.id));
                            }}
                          />
                          <span className="text-sm font-medium">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所需點數</label>
                <input type="number" min="1" step="1" value={newRewardPoints} onChange={e => {
                  setNewRewardPoints(e.target.value === '' ? '' : Number(e.target.value));
                  setRewardFormError('');
                }} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                {rewardFormError && <p className="mt-1 text-sm font-medium text-red-600" role="alert">{rewardFormError}</p>}
              </div>
              <button onClick={() => void handleSaveReward()} disabled={loading} className="w-full bg-blue-500 text-white p-4 rounded-xl font-medium mt-2 disabled:cursor-wait disabled:opacity-50">{loading ? '儲存中…' : editingReward ? '儲存變更' : '上架獎勵'}</button>
            </div>
        </ModalShell>
      )}

      {/* Delete Confirm Modals */}
      {taskToDelete && (
        <ModalShell variant="center">
            <h3 className="text-xl font-bold mb-2">刪除任務</h3>
            <p className="text-gray-500 mb-6">確定要刪除「{taskToDelete.name}」嗎？這個動作無法復原。</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => dismissWithAnimation(() => setTaskToDelete(null), '.hh-parent-confirm-panel')} className="flex-1 p-4 rounded-xl font-bold bg-gray-100 text-gray-600">取消</button>
              <button onClick={() => {
                handleDeleteTaskGroup(taskToDelete);
                dismissWithAnimation(() => setTaskToDelete(null), '.hh-parent-confirm-panel');
              }} className="flex-1 p-4 rounded-xl font-bold bg-red-500 text-white">確定刪除</button>
            </div>
        </ModalShell>
      )}

      {rewardToDelete && (
        <ModalShell variant="center">
            <h3 className="text-xl font-bold mb-2">刪除獎勵</h3>
            <p className="text-gray-500 mb-6">確定要刪除「{rewardToDelete.name}」嗎？這個動作無法復原。</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => dismissWithAnimation(() => setRewardToDelete(null), '.hh-parent-confirm-panel')} className="flex-1 p-4 rounded-xl font-bold bg-gray-100 text-gray-600">取消</button>
              <button onClick={() => {
                handleDeleteRewardGroup(rewardToDelete);
                dismissWithAnimation(() => setRewardToDelete(null), '.hh-parent-confirm-panel');
              }} className="flex-1 p-4 rounded-xl font-bold bg-red-500 text-white">確定刪除</button>
            </div>
        </ModalShell>
      )}

      {childToDelete && (
        <ModalShell variant="center">
            <h3 className="text-xl font-bold mb-2 text-red-600">刪除小孩帳號</h3>
            <p className="text-gray-500 mb-4">這將會清除該小孩的所有任務與點數紀錄，並且無法復原。請輸入家長密碼以確認。</p>
            <input
              type="password"
              value={deleteChildPin}
              onChange={e => { setDeleteChildPin(e.target.value); setDeleteChildPinError(''); }}
              className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none text-lg mb-2"
              placeholder="輸入家長密碼"
            />
            {deleteChildPinError && <p className="text-red-500 text-sm mb-4">{deleteChildPinError}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => {
                dismissWithAnimation(() => {
                  setChildToDelete(null);
                  setDeleteChildPin('');
                  setDeleteChildPinError('');
                }, '.hh-parent-confirm-panel');
              }} className="flex-1 p-4 rounded-xl font-bold bg-gray-100 text-gray-600">取消</button>
              <button onClick={() => {
                void handleDeleteChild(childToDelete);
              }} disabled={deletingChildId === childToDelete} className="flex-1 p-4 rounded-xl font-bold bg-red-500 text-white disabled:cursor-wait disabled:opacity-60">{deletingChildId === childToDelete ? '刪除中…' : '確認刪除'}</button>
            </div>
        </ModalShell>
      )}

      {resetChildId && (
        <ModalShell variant="center">
            <h3 className="mb-2 text-xl font-bold text-blue-900">重設小孩密碼</h3>
            <p className="mb-4 text-sm text-gray-500">重設後請把新密碼告訴小孩；舊密碼會立即失效。</p>
            <div className="space-y-3">
              <div className="relative">
                <input type={showResetChildPassword ? 'text' : 'password'} autoComplete="new-password" value={resetChildPassword} onChange={e => { setResetChildPassword(e.target.value); setResetChildError(''); }} placeholder="新密碼（至少 6 碼英數）" className="w-full rounded-xl border border-gray-200 p-4 pr-12 outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="button" onClick={() => setShowResetChildPassword((visible) => !visible)} aria-label={showResetChildPassword ? '隱藏小孩密碼' : '顯示小孩密碼'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500 hover:text-gray-700">
                  {showResetChildPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="relative">
                <input type={showResetChildPasswordConfirmation ? 'text' : 'password'} autoComplete="new-password" value={resetChildPasswordConfirmation} onChange={e => { setResetChildPasswordConfirmation(e.target.value); setResetChildError(''); }} placeholder="再次輸入新密碼" className="w-full rounded-xl border border-gray-200 p-4 pr-12 outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="button" onClick={() => setShowResetChildPasswordConfirmation((visible) => !visible)} aria-label={showResetChildPasswordConfirmation ? '隱藏確認密碼' : '顯示確認密碼'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500 hover:text-gray-700">
                  {showResetChildPasswordConfirmation ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {resetChildError && <p role="alert" className="text-sm text-red-500">{resetChildError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => dismissWithAnimation(() => { setResetChildId(null); setResetChildPassword(''); setResetChildPasswordConfirmation(''); setResetChildError(''); }, '.hh-parent-confirm-panel')} className="flex-1 rounded-xl bg-gray-100 p-4 font-bold text-gray-600">取消</button>
                <button onClick={() => void handleResetChildPassword()} disabled={resetChildPasswordSubmitting} aria-busy={resetChildPasswordSubmitting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-500 p-4 font-bold text-white disabled:cursor-wait disabled:opacity-50">
                  {resetChildPasswordSubmitting && <LoaderCircle size={20} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                  {resetChildPasswordSubmitting ? '儲存中…' : '儲存'}
                </button>
              </div>
            </div>
        </ModalShell>
      )}

      {accountSetupChildId && (
        <ModalShell variant="center">
            <h3 className="mb-2 text-xl font-bold text-blue-900">建立小孩登入帳號</h3>
            <p className="mb-4 text-sm text-gray-500">建立後小孩可在任何裝置使用帳號登入。</p>
            <div className="space-y-3">
              <input type="text" autoComplete="username" value={accountSetupUsername} onChange={e => { setAccountSetupUsername(e.target.value); setAccountSetupError(''); }} placeholder="帳號名稱，例如 leo123" className="w-full rounded-xl border border-gray-200 p-4 outline-none focus:ring-2 focus:ring-blue-400" />
              <div className="relative">
                <input type={showAccountSetupPassword ? 'text' : 'password'} autoComplete="new-password" value={accountSetupPassword} onChange={e => { setAccountSetupPassword(e.target.value); setAccountSetupError(''); }} placeholder="新密碼（至少 6 碼英數）" className="w-full rounded-xl border border-gray-200 p-4 pr-12 outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="button" onClick={() => setShowAccountSetupPassword((visible) => !visible)} aria-label={showAccountSetupPassword ? '隱藏小孩密碼' : '顯示小孩密碼'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500 hover:text-gray-700">
                  {showAccountSetupPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="relative">
                <input type={showAccountSetupConfirmation ? 'text' : 'password'} autoComplete="new-password" value={accountSetupConfirmation} onChange={e => { setAccountSetupConfirmation(e.target.value); setAccountSetupError(''); }} placeholder="再次輸入新密碼" className="w-full rounded-xl border border-gray-200 p-4 pr-12 outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="button" onClick={() => setShowAccountSetupConfirmation((visible) => !visible)} aria-label={showAccountSetupConfirmation ? '隱藏確認密碼' : '顯示確認密碼'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500 hover:text-gray-700">
                  {showAccountSetupConfirmation ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {accountSetupError && <p role="alert" className="text-sm text-red-500">{accountSetupError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => dismissWithAnimation(() => { setAccountSetupChildId(null); setAccountSetupError(''); }, '.hh-parent-confirm-panel')} className="flex-1 rounded-xl bg-gray-100 p-4 font-bold text-gray-600">取消</button>
                <button onClick={() => void handleCreateExistingChildAccount()} disabled={childAccountSubmitting} aria-busy={childAccountSubmitting} className="flex-1 rounded-xl bg-blue-500 p-4 font-bold text-white disabled:cursor-wait disabled:opacity-50">{childAccountSubmitting ? '建立中…' : '建立'}</button>
              </div>
            </div>
        </ModalShell>
      )}

      {showChildPicker && (
        <FamilyChildPicker
          children={state.children}
          onSelect={(childId) => { setShowChildPicker(false); onSwitchToChild(childId); }}
          onParentMode={() => setShowChildPicker(false)}
        />
      )}

      {toastMessage && (
        <div role="status" className="hh-toast fixed top-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-gray-800 px-6 py-3 text-white shadow-lg">
          <Check size={18} aria-hidden="true" />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
