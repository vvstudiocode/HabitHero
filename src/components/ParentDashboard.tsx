import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { Circle, Clock, Gift, LogOut, Plus, Star, X, Trash2, Edit2, PlayCircle, Settings, Users, KeyRound, Baby, User } from 'lucide-react';
import { TaskStatus, Task, Reward } from '../types';
import { validateChildPassword, validateChildUsername, validatePasswordConfirmation } from '../lib/auth-validation';
import { CategoryBadge } from '../features/growth/components/CategoryBadge';
import { GoalReviewPanel } from '../features/growth/components/GoalReviewPanel';
import { GrowthSummaryPanel } from '../features/growth/components/GrowthSummaryPanel';
import { TASK_CATEGORIES, DEFAULT_TASK_CATEGORY } from '../features/growth/constants';
import { buildGrowthStats } from '../features/growth/growth-stats';
import type { GoalConfirmationInput, GoalReviewInput, GrowthTask, GrowthTaskTemplate, GrowthTaskWithChild, TaskCategory } from '../features/growth/types';

interface ParentDashboardProps {
  onSwitchToChild: () => void;
  onLogout: () => void;
}

type GroupedTask = {
  id: string;
  name: string;
  points: number;
  duration?: number;
  dueTime?: string | null;
  category?: TaskCategory;
  children: { childId: string; childName: string; taskId: string }[];
};

type GroupedReward = {
  id: string;
  name: string;
  points: number;
  children: { childId: string; childName: string; rewardId: string }[];
};

export function ParentDashboard({ onSwitchToChild, onLogout }: ParentDashboardProps) {
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
  };
  const { state, loading, error, retry, stale, isOffline, mutationPending, updateTaskStatus, addTask, deleteTask, updateTask, addReward, deleteReward, updateReward, fulfillTicket, approveWishlist, addChild, updateChildPassword, updateChildName, deleteChild, setParentPin, addTaskTemplate, updateTaskTemplate, deleteTaskTemplate } = appStore;
  const [activeTab, setActiveTab] = useState<'review' | 'tasks' | 'growth' | 'rewards' | 'wishlist'>('review');
  const [mutationKind, setMutationKind] = useState<'task' | 'template' | 'reward' | null>(null);
  const observedLoading = useRef(false);

  const allTasks = state.children.flatMap(c => (c.tasks as GrowthTask[]).map(t => ({ ...t, childId: c.id, childName: c.name }))) as GrowthTaskWithChild[];
  const proposedTasks = allTasks.filter(t => t.status === 'proposed' || t.status === 'proposal_revision_requested' || (t.origin === 'child_proposed' && t.status === 'todo' && !t.confirmedAt));
  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const todoTasks = allTasks.filter(t => t.status === 'todo');
  const completedTasks = allTasks.filter(t => t.status === 'completed');
  const growthSummaries = buildGrowthStats(state.children, state.ledger);

  const groupedTodoTasks = Object.values(todoTasks.reduce((acc, task) => {
    const key = `${task.name}-${task.points}-${task.duration || ''}-${task.dueTime || ''}-${task.category || DEFAULT_TASK_CATEGORY}-${task.isDaily ? 'daily' : 'once'}`;
    if (!acc[key]) {
      acc[key] = { id: key, name: task.name, points: task.points, duration: task.duration, dueTime: task.dueTime, category: task.category, isDaily: task.isDaily, children: [{ childId: task.childId, childName: task.childName, taskId: task.id }] };
    } else {
      acc[key].children.push({ childId: task.childId, childName: task.childName, taskId: task.id });
    }
    return acc;
  }, {} as Record<string, GroupedTask & { isDaily?: boolean }>)) as (GroupedTask & { isDaily?: boolean })[];

  const allRewards = state.children.flatMap(c => c.rewards.map(r => ({ ...r, childId: c.id, childName: c.name })));
  const groupedRewards = Object.values(allRewards.reduce((acc, reward) => {
    const key = `${reward.name}-${reward.points}`;
    if (!acc[key]) {
      acc[key] = { id: key, name: reward.name, points: reward.points, children: [{ childId: reward.childId, childName: reward.childName, rewardId: reward.id }] };
    } else {
      acc[key].children.push({ childId: reward.childId, childName: reward.childName, rewardId: reward.id });
    }
    return acc;
  }, {} as Record<string, GroupedReward>)) as GroupedReward[];

  const allTickets = state.children.flatMap(c => c.tickets.map(t => ({ ...t, childId: c.id, childName: c.name })));
  const pendingTickets = allTickets.filter(t => t.status === 'pending');

  const allWishlist = state.children.flatMap(c => c.wishlist.map(w => ({ ...w, childId: c.id, childName: c.name })));
  const totalPoints = state.children.reduce((acc, c) => acc + c.points, 0);

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<(GroupedTask & { isDaily?: boolean }) | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState(5);
  const [newTaskDuration, setNewTaskDuration] = useState<number | ''>(''); // in minutes
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [newTaskIsDaily, setNewTaskIsDaily] = useState(true);
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>(DEFAULT_TASK_CATEGORY);
  const [newTaskTargetChildIds, setNewTaskTargetChildIds] = useState<string[]>([]);

  // Reward form
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingReward, setEditingReward] = useState<GroupedReward | null>(null);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardPoints, setNewRewardPoints] = useState(50);
  const [newRewardTargetChildIds, setNewRewardTargetChildIds] = useState<string[]>([]);

  // Templates
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GrowthTaskTemplate | null>(null);
  const [assigningTemplate, setAssigningTemplate] = useState<GrowthTaskTemplate | null>(null);

  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildUsername, setNewChildUsername] = useState('');
  const [newChildPassword, setNewChildPassword] = useState('');
  const [newChildPasswordConfirmation, setNewChildPasswordConfirmation] = useState('');
  const [newChildError, setNewChildError] = useState('');
  const [accountSetupChildId, setAccountSetupChildId] = useState<string | null>(null);
  const [accountSetupUsername, setAccountSetupUsername] = useState('');
  const [accountSetupPassword, setAccountSetupPassword] = useState('');
  const [accountSetupConfirmation, setAccountSetupConfirmation] = useState('');
  const [accountSetupError, setAccountSetupError] = useState('');
  const [resetChildId, setResetChildId] = useState<string | null>(null);
  const [resetChildPassword, setResetChildPassword] = useState('');
  const [resetChildPasswordConfirmation, setResetChildPasswordConfirmation] = useState('');
  const [resetChildError, setResetChildError] = useState('');
  const [newParentPin, setNewParentPin] = useState('');
  const [oldParentPin, setOldParentPin] = useState('');

  // Wishlist Pricing
  const [wishlistPricing, setWishlistPricing] = useState<Record<string, number>>({});

  // Confirm Modals
  const [taskToDelete, setTaskToDelete] = useState<GroupedTask | null>(null);
  const [rewardToDelete, setRewardToDelete] = useState<GroupedReward | null>(null);
  const [childToDelete, setChildToDelete] = useState<string | null>(null);
  const [deleteChildPin, setDeleteChildPin] = useState('');
  const [deleteChildPinError, setDeleteChildPinError] = useState('');
  const [childNameDrafts, setChildNameDrafts] = useState<Record<string, string>>({});

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
    if (mutationKind === 'task') setShowTaskForm(false);
    if (mutationKind === 'template') setShowTemplateForm(false);
    if (mutationKind === 'reward') setShowRewardForm(false);
    observedLoading.current = false;
    setMutationKind(null);
  }, [error, loading, mutationKind]);

  const openTaskForm = (group?: GroupedTask & { isDaily?: boolean }) => {
    if (group) {
      setEditingTask(group);
      setNewTaskName(group.name);
      setNewTaskPoints(group.points);
      setNewTaskDuration(group.duration || '');
      setNewTaskDueTime(group.dueTime?.slice(0, 5) ?? '');
      setNewTaskIsDaily(group.isDaily ?? false);
      setNewTaskCategory(group.category ?? DEFAULT_TASK_CATEGORY);
      setNewTaskTargetChildIds(group.children.map(c => c.childId));
    } else {
      setEditingTask(null);
      setNewTaskName('');
      setNewTaskPoints(5);
      setNewTaskDuration('');
      setNewTaskDueTime('');
      setNewTaskIsDaily(false);
      setNewTaskCategory(DEFAULT_TASK_CATEGORY);
      setNewTaskTargetChildIds(state.children.map(c => c.id));
    }
    setShowTaskForm(true);
  };

  const handleSaveTask = async () => {
    if (!newTaskName || newTaskPoints < 1 || newTaskTargetChildIds.length === 0) return;
    const duration = newTaskDuration ? Number(newTaskDuration) : undefined;
    const dueTime = newTaskDueTime || null;
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
          await updateTask(childId, existingChild.taskId, { name: newTaskName, points: newTaskPoints, duration, dueTime, isDaily: newTaskIsDaily, category: newTaskCategory } as never);
        } else {
          await addTask(childId, { name: newTaskName, points: newTaskPoints, icon: 'Star', duration, dueTime, isDaily: newTaskIsDaily, category: newTaskCategory, origin: 'parent_assigned' } as never);
        }
      }

      // Delete removed
      for (const childId of existingChildIds.filter(childId => !newTaskTargetChildIds.includes(childId))) {
        if (!newTaskTargetChildIds.includes(childId)) {
          const existingChild = editingTask.children.find(c => c.childId === childId);
          if (existingChild) await deleteTask(childId, existingChild.taskId);
        }
      }
    } else {
      for (const childId of newTaskTargetChildIds) await addTask(childId, { name: newTaskName, points: newTaskPoints, icon: 'Star', duration, dueTime, isDaily: newTaskIsDaily, category: newTaskCategory, origin: 'parent_assigned' } as never);
    }
    } catch { /* provider error is rendered above the tabs; keep form values intact */ }
  };

  const handleAssignTemplate = async () => {
    if (!assigningTemplate || newTaskTargetChildIds.length === 0) return;
    try {
      const dueTime = newTaskDueTime || null;
      for (const childId of newTaskTargetChildIds) await addTask(childId, { name: assigningTemplate.name, points: assigningTemplate.points, icon: assigningTemplate.icon || 'Star', duration: assigningTemplate.duration, dueTime, isDaily: newTaskIsDaily, category: assigningTemplate.category ?? DEFAULT_TASK_CATEGORY, origin: 'system_template' } as never);
    } catch { /* provider error is rendered above the tabs; keep assignment open */ }
  };

  const handleSaveTemplate = async () => {
    if (!newTaskName || newTaskPoints < 1) return;
    const duration = newTaskDuration ? Number(newTaskDuration) : undefined;
    observedLoading.current = false;
    setMutationKind('template');
    try {
    if (editingTemplate) {
      await updateTaskTemplate(editingTemplate.id, { name: newTaskName, points: newTaskPoints, duration, category: newTaskCategory } as never);
    } else {
      await addTaskTemplate({ name: newTaskName, points: newTaskPoints, icon: 'Star', duration, category: newTaskCategory, suggestedEvidence: 'reflection' } as never);
    }
    } catch { /* provider error is rendered above the tabs; keep form values intact */ }
  };

  const openTemplateForm = (template?: GrowthTaskTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setNewTaskName(template.name);
      setNewTaskPoints(template.points);
      setNewTaskDuration(template.duration || '');
      setNewTaskCategory(template.category ?? DEFAULT_TASK_CATEGORY);
    } else {
      setEditingTemplate(null);
      setNewTaskName('');
      setNewTaskPoints(5);
      setNewTaskDuration('');
      setNewTaskCategory(DEFAULT_TASK_CATEGORY);
    }
    setShowTemplateForm(true);
  };

  const openAssignTemplate = (template: GrowthTaskTemplate) => {
    setAssigningTemplate(template);
    setNewTaskIsDaily(false);
    setNewTaskDueTime('');
    setNewTaskTargetChildIds(state.children.map(c => c.id));
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

  const handleDeleteTaskGroup = (group: GroupedTask) => {
    group.children.forEach(c => deleteTask(c.childId, c.taskId));
  };

  const openRewardForm = (group?: GroupedReward) => {
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
    if (!newRewardName || newRewardTargetChildIds.length === 0) return;
    observedLoading.current = false;
    setMutationKind('reward');
    if (editingReward) {
      const existingChildIds = editingReward.children.map(c => c.childId);
      
      await Promise.all(newRewardTargetChildIds.map(async childId => {
        const existingChild = editingReward.children.find(c => c.childId === childId);
        if (existingChild) {
          await updateReward(childId, existingChild.rewardId, { name: newRewardName, points: newRewardPoints });
        } else {
          await addReward(childId, { name: newRewardName, points: newRewardPoints, icon: 'Gift' });
        }
      }));

      await Promise.all(existingChildIds.filter(childId => !newRewardTargetChildIds.includes(childId)).map(async childId => {
        if (!newRewardTargetChildIds.includes(childId)) {
          const existingChild = editingReward.children.find(c => c.childId === childId);
          if (existingChild) await deleteReward(childId, existingChild.rewardId);
        }
      }));
    } else {
      await Promise.all(newRewardTargetChildIds.map(childId => addReward(childId, { name: newRewardName, points: newRewardPoints, icon: 'Gift' })));
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
  
  const handleAddChild = async () => {
    setNewChildError('');
    if (!newChildName.trim()) {
      setNewChildError('請輸入小孩名字。');
      return;
    }
    const usernameValidation = validateChildUsername(newChildUsername);
    if ('message' in usernameValidation) {
      setNewChildError(usernameValidation.message);
      return;
    }
    const passwordValidation = validateChildPassword(newChildPassword);
    if ('message' in passwordValidation) {
      setNewChildError(passwordValidation.message);
      return;
    }
    const confirmationValidation = validatePasswordConfirmation(newChildPassword, newChildPasswordConfirmation);
    if ('message' in confirmationValidation) {
      setNewChildError(confirmationValidation.message);
      return;
    }
    try {
      await addChild(newChildName.trim(), newChildUsername.trim().toLowerCase(), newChildPassword);
      setNewChildName('');
      setNewChildUsername('');
      setNewChildPassword('');
      setNewChildPasswordConfirmation('');
    } catch {
      // Provider error is already shown above the tabs; keep the form values.
    }
  };

  const handleCreateExistingChildAccount = async () => {
    const child = state.children.find((item) => item.id === accountSetupChildId);
    if (!child) return;
    setAccountSetupError('');
    const usernameValidation = validateChildUsername(accountSetupUsername);
    if ('message' in usernameValidation) { setAccountSetupError(usernameValidation.message); return; }
    const passwordValidation = validateChildPassword(accountSetupPassword);
    if ('message' in passwordValidation) { setAccountSetupError(passwordValidation.message); return; }
    const confirmationValidation = validatePasswordConfirmation(accountSetupPassword, accountSetupConfirmation);
    if ('message' in confirmationValidation) { setAccountSetupError(confirmationValidation.message); return; }
    try {
      await addChild(child.name, accountSetupUsername, accountSetupPassword, child.id);
      setAccountSetupChildId(null);
      setAccountSetupUsername('');
      setAccountSetupPassword('');
      setAccountSetupConfirmation('');
    } catch (error) {
      setAccountSetupError(error instanceof Error ? error.message : '建立小孩帳號失敗，請重試。');
    }
  };

  return (
    <div className="hh-dashboard-screen flex flex-col min-h-[100dvh] bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-blue-600 text-white p-6 rounded-b-[2rem] shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <User size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">家長管理端</h1>
              <p className="text-blue-200 text-sm mt-1">{state.children.length} 位小孩</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onSwitchToChild} aria-label="切換到小孩視角" title="切換到小孩視角" className="flex min-h-11 min-w-11 items-center justify-center bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-colors">
              <Baby size={20} />
            </button>
            <button onClick={() => setShowSettings(true)} aria-label="設定" title="設定" className="flex min-h-11 min-w-11 items-center justify-center bg-white/10 hover:bg-white/20 p-2 rounded-xl text-white transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-blue-200 text-sm mb-1">家庭總點數</div>
            <div className="text-3xl font-bold">{totalPoints} <span className="text-sm font-normal">pt</span></div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-blue-200 text-sm mb-1">待審核項目</div>
            <div className="text-3xl font-bold">{proposedTasks.length + pendingTasks.length + pendingTickets.length}</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {(isOffline || stale || mutationPending) && (
          <div role="status" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span>{isOffline ? '目前離線，尚未同步的變更不會被視為成功。' : mutationPending ? '正在等待伺服器確認變更…' : '資料可能不是最新狀態。'}</span>
            <button type="button" onClick={() => void retry()} disabled={loading || isOffline} className="shrink-0 font-bold underline disabled:opacity-50">重試</button>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => void retry()} disabled={loading} className="shrink-0 font-bold underline disabled:opacity-50">重試</button>
          </div>
        )}
        {/* Tabs */}
        <div className="flex bg-white rounded-2xl shadow-sm mb-6 p-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('review')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap",
              activeTab === 'review' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            審核
            {(proposedTasks.length + pendingTasks.length) > 0 && (
              <span className="absolute top-1 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center transform scale-90 origin-center leading-none">
                {proposedTasks.length + pendingTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap",
              activeTab === 'tasks' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            任務
          </button>
          <button
            onClick={() => setActiveTab('growth')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap",
              activeTab === 'growth' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            成長
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap",
              activeTab === 'rewards' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            獎勵
            {pendingTickets.length > 0 && <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('wishlist')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 rounded-xl text-xs sm:text-sm font-medium transition-colors relative",
              activeTab === 'wishlist' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            許願
            {allWishlist.length > 0 && (
              <span className="absolute top-1 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center transform scale-90 origin-center leading-none">
                {allWishlist.length}
              </span>
            )}
          </button>
        </div>

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
          <div className="space-y-6">
            {/* Todo Tasks */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-900">今日任務清單</h2>
                <button onClick={() => openTaskForm()} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg">
                  <Plus size={16} /> 新增
                </button>
              </div>
              <div className="space-y-3">
                {groupedTodoTasks.map(group => (
                  <div key={group.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group-item relative">
                    <div className="flex items-center gap-3">
                      <Circle size={20} className="text-gray-300" />
                      <div>
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          {group.children.map(c => (
                            <span key={c.childId} className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold">{c.childName}</span>
                          ))}
                        </div>
                        <div className="font-medium text-gray-700 flex items-center gap-2">
                          {group.name}
                          <CategoryBadge category={group.category} compact />
                          {group.isDaily && (
                            <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold border border-green-100">每日</span>
                          )}
                          {group.duration && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <PlayCircle size={12}/> {group.duration}m
                            </span>
                          )}
                          {group.dueTime && (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Clock size={12}/> {group.dueTime.slice(0, 5)} 可開始
                            </span>
                          )}
                        </div>
                        <div className="text-blue-500 text-sm font-bold">+{group.points} pt</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
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
                  <div className="text-center py-8 text-gray-400 text-sm">目前沒有任務，趕快新增吧！</div>
                )}
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-900">常用模板</h2>
                <button onClick={() => openTemplateForm()} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg">
                  <Plus size={16} /> 新增
                </button>
              </div>
              <p className="text-gray-500 text-sm mb-4">常做的任務先存成模板，需要時直接派發。</p>
              <div className="space-y-3">
                {(state.taskTemplates as GrowthTaskTemplate[]).map(template => (
                  <div key={template.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group-item relative">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                        <Star size={20} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {template.name}
                          <CategoryBadge category={template.category} compact />
                          {template.duration && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <PlayCircle size={12}/> {template.duration}m
                            </span>
                          )}
                        </div>
                        <div className="text-blue-500 text-sm font-bold">+{template.points} pt</div>
                      </div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => openAssignTemplate(template)} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold transition-colors">
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
                  <div className="text-center py-8 text-gray-400 text-sm">目前沒有模板，點擊右上角新增。</div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'growth' && (
          <GrowthSummaryPanel summaries={growthSummaries} title="家庭成長紀錄" completedTasks={completedTasks} showChildFilter />
        )}

        {activeTab === 'rewards' && (
          <div className="space-y-6">
            {/* Pending Tickets */}
            {pendingTickets.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Gift size={20} className="text-purple-500" />
                  待兌現獎勵 ({pendingTickets.length})
                </h2>
                <div className="space-y-3">
                  {pendingTickets.map(ticket => (
                    <div key={ticket.id} className="bg-purple-50 p-4 rounded-2xl shadow-sm border border-purple-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-purple-200 text-purple-800 text-xs px-2 py-0.5 rounded font-bold">{ticket.childName}</span>
                        </div>
                        <div className="font-medium text-purple-900">{ticket.rewardName}</div>
                        <div className="text-purple-600 text-xs mt-1">等待家長實現</div>
                      </div>
                      <button onClick={() => void fulfillTicket(ticket.childId, ticket.id)} disabled={loading} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-50">
                        已兌現
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
                            <span key={c.childId} className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold">{c.childName}</span>
                          ))}
                        </div>
                        <div className="font-medium text-gray-900">{group.name}</div>
                        <div className="text-blue-500 font-bold text-sm">{group.points} pt</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openRewardForm(group)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => setRewardToDelete(group)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl">許願空空的</div>
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
                        placeholder="定價 (pt)"
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
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
          <div className="bg-white w-full sm:max-w-sm h-full p-6 shadow-xl overflow-y-auto animate-slide-left">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2"><Settings size={24} className="text-gray-500" /> 設定</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><X size={24} /></button>
            </div>
            
            <div className="space-y-8">
              {/* Children List */}
              <section>
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <Users size={18} /> 小孩帳號管理
                </h4>
                <div className="space-y-4">
                  {state.children.map(child => (
                    <div key={child.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={childNameDrafts[child.id] ?? child.name}
                          onChange={(e) => setChildNameDrafts((drafts) => ({ ...drafts, [child.id]: e.target.value }))}
                          onBlur={(e) => {
                            const name = e.target.value.trim();
                            if (name && name !== child.name) void updateChildName(child.id, name);
                          }}
                          className="font-bold text-lg bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none w-1/2 min-w-0"
                          placeholder="小孩名字"
                        />
                        {state.children.length > 1 && (
                          <button onClick={() => setChildToDelete(child.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-sm flex items-center gap-1 shrink-0">
                            <Trash2 size={16} /> 刪除
                          </button>
                        )}
                      </div>
                      <div className="flex items-start gap-2 text-xs text-amber-700">
                        <KeyRound size={16} className="mt-0.5 shrink-0" />
                        <span>{child.loginName ? `登入帳號：${child.loginName}。密碼不會顯示在這裡，忘記時請由家長重新設定。` : '此小孩尚未建立登入帳號。'}</span>
                      </div>
                      {child.loginName ? <button onClick={() => { setResetChildId(child.id); setResetChildError(''); }} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50">重設小孩密碼</button> : <button onClick={() => { setAccountSetupChildId(child.id); setAccountSetupError(''); }} className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-bold text-white hover:bg-blue-600">建立小孩帳號</button>}
                    </div>
                  ))}
                </div>
              </section>

              {/* Add Child */}
              <section className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <h4 className="text-md font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <Plus size={18} /> 新增小孩
                </h4>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="名字"
                    value={newChildName}
                    onChange={e => setNewChildName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
                  />
                </div>
                <input type="text" autoComplete="username" placeholder="小孩帳號名稱，例如 leo123" value={newChildUsername} onChange={e => { setNewChildUsername(e.target.value); setNewChildError(''); }} className="mb-2 w-full rounded-xl border border-blue-200 p-2.5 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" />
                <input type="password" autoComplete="new-password" placeholder="小孩密碼（至少 6 碼英數）" value={newChildPassword} onChange={e => { setNewChildPassword(e.target.value); setNewChildError(''); }} className="mb-2 w-full rounded-xl border border-blue-200 p-2.5 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" />
                <input type="password" autoComplete="new-password" placeholder="再次輸入小孩密碼" value={newChildPasswordConfirmation} onChange={e => { setNewChildPasswordConfirmation(e.target.value); setNewChildError(''); }} className="mb-2 w-full rounded-xl border border-blue-200 p-2.5 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" />
                {newChildError && <p role="alert" className="mb-3 text-xs leading-5 text-red-600">{newChildError}</p>}
                <p className="mb-3 text-xs leading-5 text-blue-800">帳號名稱需 3–32 碼英數或底線；小孩可在任何裝置用帳號與密碼登入。</p>
                <button onClick={() => void handleAddChild()} disabled={!newChildName.trim() || !newChildUsername || !newChildPassword || !newChildPasswordConfirmation || loading} className="w-full rounded-xl bg-blue-500 py-2 font-bold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
                  建立小孩
                </button>
              </section>

              <section className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mt-4">
                 <h4 className="text-md font-bold text-gray-800 mb-3">修改家長密碼</h4>
                 <div className="flex flex-col gap-2">
                   <input type="text" value={oldParentPin} onChange={e => setOldParentPin(e.target.value)} placeholder="輸入舊密碼" className="w-full p-2.5 rounded-xl border border-gray-300 outline-none min-w-0"/>
                   <div className="flex gap-2">
                     <input type="text" value={newParentPin} onChange={e => setNewParentPin(e.target.value)} placeholder="輸入新密碼" className="w-full p-2.5 rounded-xl border border-gray-300 outline-none min-w-0"/>
                     <button onClick={() => {
                       if (oldParentPin !== state.parentPin) { alert("舊密碼錯誤"); return; }
                       if (newParentPin.length < 4) { alert("新密碼至少4碼"); return; }
                       setParentPin(newParentPin);
                       alert("密碼更新成功");
                       setOldParentPin('');
                       setNewParentPin('');
                     }} className="shrink-0 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-xl font-bold transition-colors text-gray-700">更新</button>
                   </div>
                 </div>
              </section>

              {/* System */}
              <section className="pt-4 border-t border-gray-100 pb-8">
                <button onClick={() => { setShowSettings(false); onLogout(); }} className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-xl font-bold transition-colors">
                  <LogOut size={20} /> 登出家長端
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Task Overlays */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-[60]">
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingTask ? '編輯任務' : '新增任務'}</h3>
              <button onClick={() => setShowTaskForm(false)} className="p-2 text-gray-400 bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任務名稱</label>
                <input type="text" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="例如：刷牙洗臉" className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
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
                    {state.children.map(c => (
                      <label key={c.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-400"
                          checked={newTaskTargetChildIds.includes(c.id)}
                          onChange={e => {
                            if (e.target.checked) setNewTaskTargetChildIds(p => [...p, c.id]);
                            else setNewTaskTargetChildIds(p => p.filter(id => id !== c.id));
                          }}
                        />
                        <span className="text-sm font-medium text-gray-700">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">獲得點數</label>
                  <input type="number" min="1" value={newTaskPoints} onChange={e => setNewTaskPoints(Number(e.target.value))} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">限時 (分鐘, 選填)</label>
                  <input type="number" min="1" value={newTaskDuration} onChange={e => setNewTaskDuration(e.target.value ? Number(e.target.value) : '')} placeholder="無" className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">可開始時間 (選填)</label>
                <input type="time" value={newTaskDueTime} onChange={e => setNewTaskDueTime(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                <p className="mt-1 text-xs font-medium text-gray-400">不設定就是全天都可以執行。</p>
              </div>
              <button onClick={() => void handleSaveTask()} disabled={loading || newTaskPoints < 1} className="w-full bg-blue-500 text-white p-4 rounded-xl font-medium mt-2 mb-4 disabled:cursor-wait disabled:opacity-50">{loading ? '儲存中…' : editingTask ? '儲存變更' : '新增'}</button>
            </div>
          </div>
        </div>
      )}

      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-[60]">
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingTemplate ? '編輯模板' : '新增模板'}</h3>
              <button onClick={() => setShowTemplateForm(false)} className="p-2 text-gray-400 bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任務名稱</label>
                <input type="text" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="例如：洗碗" className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">預設點數</label>
                  <input type="number" min="1" value={newTaskPoints} onChange={e => setNewTaskPoints(Number(e.target.value))} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">限時 (分鐘, 選填)</label>
                  <input type="number" min="1" value={newTaskDuration} onChange={e => setNewTaskDuration(e.target.value ? Number(e.target.value) : '')} placeholder="無" className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
              </div>
              <button onClick={() => void handleSaveTemplate()} disabled={loading || newTaskPoints < 1} className="w-full bg-blue-500 text-white p-4 rounded-xl font-medium mt-2 mb-4 disabled:cursor-wait disabled:opacity-50">{loading ? '儲存中…' : '儲存模板'}</button>
            </div>
          </div>
        </div>
      )}

      {assigningTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-[60]">
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">派發任務：{assigningTemplate.name}</h3>
              <button onClick={() => setAssigningTemplate(null)} className="p-2 text-gray-400 bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {state.children.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">選擇小孩</label>
                  <div className="flex flex-wrap gap-2">
                    {state.children.map(c => (
                      <label key={c.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-400"
                          checked={newTaskTargetChildIds.includes(c.id)}
                          onChange={e => {
                            if (e.target.checked) setNewTaskTargetChildIds(p => [...p, c.id]);
                            else setNewTaskTargetChildIds(p => p.filter(id => id !== c.id));
                          }}
                        />
                        <span className="text-sm font-medium text-gray-700">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">可開始時間 (選填)</label>
                <input type="time" value={newTaskDueTime} onChange={e => setNewTaskDueTime(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
                <p className="mt-1 text-xs font-medium text-gray-400">不設定就是全天都可以執行。</p>
              </div>
              <button onClick={() => void handleAssignTemplate()} disabled={loading} className="w-full bg-blue-500 text-white p-4 rounded-xl font-medium mt-2 mb-4 disabled:cursor-wait disabled:opacity-50">{loading ? '派發中…' : '確認派發'}</button>
            </div>
          </div>
        </div>
      )}

      {showRewardForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-[60]">
          <div className="bg-white w-full max-w-sm rounded-t-3xl p-6 shadow-xl animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingReward ? '編輯獎勵' : '新增獎勵'}</h3>
              <button onClick={() => setShowRewardForm(false)} className="p-2 text-gray-400 bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">獎勵名稱</label>
                <input type="text" value={newRewardName} onChange={e => setNewRewardName(e.target.value)} placeholder="例如：看卡通 30 分鐘" className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
              </div>
              {state.children.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">指定小孩</label>
                  <div className="flex flex-wrap gap-2">
                    {state.children.map(c => (
                      <label key={c.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-400"
                          checked={newRewardTargetChildIds.includes(c.id)}
                          onChange={e => {
                            if (e.target.checked) setNewRewardTargetChildIds(p => [...p, c.id]);
                            else setNewRewardTargetChildIds(p => p.filter(id => id !== c.id));
                          }}
                        />
                        <span className="text-sm font-medium text-gray-700">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所需點數</label>
                <input type="number" min="1" value={newRewardPoints} onChange={e => setNewRewardPoints(Number(e.target.value))} className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none" />
              </div>
              <button onClick={() => void handleSaveReward()} disabled={loading} className="w-full bg-blue-500 text-white p-4 rounded-xl font-medium mt-2 disabled:cursor-wait disabled:opacity-50">{loading ? '儲存中…' : editingReward ? '儲存變更' : '上架獎勵'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modals */}
      {taskToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[60]">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up">
            <h3 className="text-xl font-bold mb-2">刪除任務</h3>
            <p className="text-gray-500 mb-6">確定要刪除「{taskToDelete.name}」嗎？這個動作無法復原。</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setTaskToDelete(null)} className="flex-1 p-4 rounded-xl font-bold bg-gray-100 text-gray-600">取消</button>
              <button onClick={() => {
                handleDeleteTaskGroup(taskToDelete);
                setTaskToDelete(null);
              }} className="flex-1 p-4 rounded-xl font-bold bg-red-500 text-white">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      {rewardToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[60]">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up">
            <h3 className="text-xl font-bold mb-2">刪除獎勵</h3>
            <p className="text-gray-500 mb-6">確定要刪除「{rewardToDelete.name}」嗎？這個動作無法復原。</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRewardToDelete(null)} className="flex-1 p-4 rounded-xl font-bold bg-gray-100 text-gray-600">取消</button>
              <button onClick={() => {
                handleDeleteRewardGroup(rewardToDelete);
                setRewardToDelete(null);
              }} className="flex-1 p-4 rounded-xl font-bold bg-red-500 text-white">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      {childToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[60]">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up">
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
                setChildToDelete(null);
                setDeleteChildPin('');
                setDeleteChildPinError('');
              }} className="flex-1 p-4 rounded-xl font-bold bg-gray-100 text-gray-600">取消</button>
              <button onClick={() => {
                if (deleteChildPin === state.parentPin) {
                  deleteChild(childToDelete);
                  setChildToDelete(null);
                  setDeleteChildPin('');
                  setDeleteChildPinError('');
                } else {
                  setDeleteChildPinError('密碼錯誤');
                }
              }} className="flex-1 p-4 rounded-xl font-bold bg-red-500 text-white">確認刪除</button>
            </div>
          </div>
        </div>
      )}

      {resetChildId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-xl font-bold text-blue-900">重設小孩密碼</h3>
            <p className="mb-4 text-sm text-gray-500">重設後請把新密碼告訴小孩；舊密碼會立即失效。</p>
            <div className="space-y-3">
              <input type="password" autoComplete="new-password" value={resetChildPassword} onChange={e => { setResetChildPassword(e.target.value); setResetChildError(''); }} placeholder="新密碼（至少 6 碼英數）" className="w-full rounded-xl border border-gray-200 p-4 outline-none focus:ring-2 focus:ring-blue-400" />
              <input type="password" autoComplete="new-password" value={resetChildPasswordConfirmation} onChange={e => { setResetChildPasswordConfirmation(e.target.value); setResetChildError(''); }} placeholder="再次輸入新密碼" className="w-full rounded-xl border border-gray-200 p-4 outline-none focus:ring-2 focus:ring-blue-400" />
              {resetChildError && <p role="alert" className="text-sm text-red-500">{resetChildError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setResetChildId(null); setResetChildPassword(''); setResetChildPasswordConfirmation(''); setResetChildError(''); }} className="flex-1 rounded-xl bg-gray-100 p-4 font-bold text-gray-600">取消</button>
                <button onClick={() => void (async () => {
                  const valid = validateChildPassword(resetChildPassword);
                  if ('message' in valid) { setResetChildError(valid.message); return; }
                  const confirmed = validatePasswordConfirmation(resetChildPassword, resetChildPasswordConfirmation);
                  if ('message' in confirmed) { setResetChildError(confirmed.message); return; }
                  try {
                    await updateChildPassword(resetChildId, resetChildPassword);
                    setResetChildId(null); setResetChildPassword(''); setResetChildPasswordConfirmation('');
                  } catch { /* provider error is shown above the tabs */ }
                })()} className="flex-1 rounded-xl bg-blue-500 p-4 font-bold text-white">儲存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {accountSetupChildId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-xl font-bold text-blue-900">建立小孩登入帳號</h3>
            <p className="mb-4 text-sm text-gray-500">建立後小孩可在任何裝置使用帳號登入。</p>
            <div className="space-y-3">
              <input type="text" autoComplete="username" value={accountSetupUsername} onChange={e => { setAccountSetupUsername(e.target.value); setAccountSetupError(''); }} placeholder="帳號名稱，例如 leo123" className="w-full rounded-xl border border-gray-200 p-4 outline-none focus:ring-2 focus:ring-blue-400" />
              <input type="password" autoComplete="new-password" value={accountSetupPassword} onChange={e => { setAccountSetupPassword(e.target.value); setAccountSetupError(''); }} placeholder="新密碼（至少 6 碼英數）" className="w-full rounded-xl border border-gray-200 p-4 outline-none focus:ring-2 focus:ring-blue-400" />
              <input type="password" autoComplete="new-password" value={accountSetupConfirmation} onChange={e => { setAccountSetupConfirmation(e.target.value); setAccountSetupError(''); }} placeholder="再次輸入新密碼" className="w-full rounded-xl border border-gray-200 p-4 outline-none focus:ring-2 focus:ring-blue-400" />
              {accountSetupError && <p role="alert" className="text-sm text-red-500">{accountSetupError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setAccountSetupChildId(null); setAccountSetupError(''); }} className="flex-1 rounded-xl bg-gray-100 p-4 font-bold text-gray-600">取消</button>
                <button onClick={() => void handleCreateExistingChildAccount()} className="flex-1 rounded-xl bg-blue-500 p-4 font-bold text-white">建立</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
