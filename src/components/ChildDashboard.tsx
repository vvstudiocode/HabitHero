import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { useAuthSession } from '../auth';
import { CheckCircle2, Gift, LogOut, Plus, Star, X, PlayCircle, Clock, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { Reward } from '../types';
import { GoalCard } from '../features/growth/components/GoalCard';
import { GoalProposalForm } from '../features/growth/components/GoalProposalForm';
import { GoalSubmissionForm } from '../features/growth/components/GoalSubmissionForm';
import { GrowthSummaryPanel } from '../features/growth/components/GrowthSummaryPanel';
import { goalCopy } from '../features/growth/goal-copy';
import { getChildGrowthSummary } from '../features/growth/growth-stats';
import type { GoalProposalInput, GoalReflectionInput, GrowthTask, GrowthTaskTemplate } from '../features/growth/types';

interface GrowthChildActions {
  proposeGoal?: (childId: string, input: GoalProposalInput) => Promise<void>;
  proposeChildGoal?: (childId: string, input: GoalProposalInput & { icon: string }) => Promise<void>;
  submitTaskReflection?: (taskId: string, input: { reflection: string; mood?: string | null; difficulty?: number | null }) => Promise<void>;
}

interface ChildDashboardProps {
  onLogout: () => void;
  onSwitchChild: () => void;
}

function formatTaskTime(dueTime?: string | null) {
  return dueTime ? dueTime.slice(0, 5) : '全天';
}

function isTaskExecutableNow(task: Pick<GrowthTask, 'dueTime'>) {
  if (!task.dueTime) return true;
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return current >= task.dueTime.slice(0, 5);
}

export function ChildDashboard({ onLogout, onSwitchChild }: ChildDashboardProps) {
  const appStore = useAppStore() as ReturnType<typeof useAppStore> & GrowthChildActions;
  const { state, updateTaskStatus, updateTask, addTask, redeemReward, addWishlist, startTaskTimer, pauseTaskTimer, loading, error, retry, role, hasSession, stale, isOffline, mutationPending } = appStore;
  const { session, loading: sessionLoading } = useAuthSession();
  const [activeTab, setActiveTab] = useState<'goals' | 'growth' | 'wishlist' | 'history'>('goals');
  
  // Multi-child support
  // The provider derives this id from the authenticated user's DB membership/profile.
  // Never fall back to another child or accept a child id from the client.
  const activeChild = state.childLoggedInId
    ? state.children.find(c => c.id === state.childLoggedInId)
    : undefined;

  const tasks = (activeChild?.tasks || []) as GrowthTask[];
  const rewards = activeChild?.rewards || [];
  const tickets = activeChild?.tickets || [];
  const childPoints = activeChild?.points || 0;
  const taskTemplates = state.taskTemplates as GrowthTaskTemplate[];

  // Wishlist Form
  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [wishName, setWishName] = useState('');
  
  // Toast Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const proposedTasks = tasks.filter(t => t.status === 'proposed' || t.status === 'proposal_revision_requested');
  const todoTasks = tasks
    .filter(t => t.status === 'todo')
    .sort((a, b) => (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'));
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const revisionTasks = tasks.filter(t => t.status === 'revision_requested');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const completedTasksWithChild = activeChild ? completedTasks.map((task) => ({ ...task, childId: activeChild.id, childName: activeChild.name })) : [];
  const growthSummary = activeChild ? getChildGrowthSummary({ ...activeChild, tasks } as typeof activeChild, state.ledger) : null;
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
      if (!isTaskExecutableNow(task)) {
        showToast(`還沒到可開始時間：${formatTaskTime(task.dueTime)}。`);
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
    const task = tasks.find((item) => item.id === taskId);
    if (task && !isTaskExecutableNow(task)) {
      showToast(`還沒到可開始時間：${formatTaskTime(task.dueTime)}。`);
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
        await addTask(activeChild.id, { name: input.name, points: input.points, icon: 'Star', category: input.category, dueTime: input.dueTime, origin: 'child_proposed' } as never);
      }
      showToast('目標已建立，可以先開始做。');
    } finally {
      setActionPending(false);
    }
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
      setSubmittingTask(null);
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
        setShowWishlistForm(false);
        setWishName('');
        showToast('願望已送出。');
      } finally {
        setActionPending(false);
      }
    }
  };

  const handleRedeem = async (reward: Reward) => {
    if (!activeChild) return;
    if (childPoints >= reward.points) {
      setActionPending(true);
      try {
        await redeemReward(activeChild.id, reward);
        showToast('兌換成功！已經通知爸媽囉～');
      } finally {
        setActionPending(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (sessionLoading || loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-blue-50 p-6 text-center text-blue-700">正在載入我的任務…</div>;
  }

  if (!hasSession || !session || role !== 'child') {
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
    <div className="hh-dashboard-screen flex flex-col min-h-[100dvh] bg-blue-50 pb-24">
      {/* Header */}
      <header className="bg-yellow-400 p-6 rounded-b-[2rem] shadow-sm relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300 rounded-full opacity-50"></div>
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-yellow-300 rounded-full opacity-50"></div>
        
        <div className="relative z-10 flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-yellow-900">{activeChild.name}的任務</h1>
          <div className="flex gap-2">
            <button onClick={onLogout} aria-label="登出" title="登出" className="flex min-h-11 min-w-11 items-center justify-center bg-white/40 hover:bg-white/60 p-2 rounded-xl text-yellow-900 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        <div className="relative z-10 bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 flex items-center justify-between">
          <div>
            <div className="text-gray-500 text-sm font-medium mb-1">我的點數</div>
            <div className="text-4xl font-black text-yellow-500 flex items-baseline gap-1">
              {childPoints} <span className="text-base font-bold text-yellow-400">pt</span>
            </div>
          </div>
          <Star size={48} className="text-yellow-300 fill-yellow-300" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {(isOffline || stale || mutationPending) && (
          <div role="status" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span>{isOffline ? '目前離線，變更尚未同步。' : mutationPending ? '正在等待伺服器確認變更…' : '資料可能不是最新狀態。'}</span>
            <button type="button" onClick={() => void retry()} disabled={loading || isOffline} className="shrink-0 font-bold underline disabled:opacity-50">重試</button>
          </div>
        )}
        {/* Tabs */}
        <div className="flex bg-white rounded-2xl shadow-sm mb-6 p-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('goals')}
            className={cn(
              "min-h-11 flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 px-3 rounded-xl text-sm sm:text-base font-bold transition-colors relative whitespace-nowrap",
              activeTab === 'goals' ? "bg-yellow-100 text-yellow-700" : "text-gray-400 hover:bg-gray-50"
            )}
          >
            目標
            {(proposedTasks.length + pendingTasks.length + revisionTasks.length) > 0 && <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-red-500" />}
          </button>
          <button
            onClick={() => setActiveTab('growth')}
            className={cn(
              "min-h-11 flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 px-3 rounded-xl text-sm sm:text-base font-bold transition-colors relative whitespace-nowrap",
              activeTab === 'growth' ? "bg-yellow-100 text-yellow-700" : "text-gray-400 hover:bg-gray-50"
            )}
          >
            成長
          </button>
          <button
            onClick={() => setActiveTab('wishlist')}
            className={cn(
              "min-h-11 flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 px-3 rounded-xl text-sm sm:text-base font-bold transition-colors relative whitespace-nowrap",
              activeTab === 'wishlist' ? "bg-yellow-100 text-yellow-700" : "text-gray-400 hover:bg-gray-50"
            )}
          >
            許願
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "min-h-11 flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 px-3 rounded-xl text-sm sm:text-base font-bold transition-colors relative whitespace-nowrap",
              activeTab === 'history' ? "bg-yellow-100 text-yellow-700" : "text-gray-400 hover:bg-gray-50"
            )}
          >
            兌換
          </button>
        </div>

        {activeTab === 'goals' && (
          <div className="space-y-6">
            <GoalProposalForm templates={taskTemplates} loading={actionPending || loading} onSubmit={handleProposeGoal} />

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
                        className="flex min-h-12 min-w-16 items-center justify-center rounded-2xl bg-orange-500 px-3 text-sm font-black text-white shadow-md"
                      >
                        補充
                      </button>
                    )}
                  />
                ))}
              </section>
            )}

            <section className="space-y-3">
              <div className="px-2">
                <h3 className="font-black text-gray-700">{goalCopy.child.title}</h3>
                <p className="text-sm text-gray-500">{goalCopy.child.subtitle}</p>
              </div>
            {todoTasks.map(task => {
              const hasTimer = typeof task.duration === 'number';
              const isRunning = task.timerIsRunning;
              const isExecutable = isTaskExecutableNow(task);
              
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
                        "flex h-20 w-20 max-[420px]:h-16 max-[420px]:w-16 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-black text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500",
                        isRunning ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                      )}
                    >
                      {isRunning ? <Clock size={28} /> : <PlayCircle size={28} />}
                      <span>{isExecutable ? (isRunning ? '暫停' : '開始') : '未到'}</span>
                      {hasTimer && <span className="text-xs opacity-90">{formatTime(timeLeft)}</span>}
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleFinishTask(task.id)}
                      disabled={actionPending || !isExecutable}
                      className="flex h-20 w-20 max-[420px]:h-16 max-[420px]:w-16 flex-col items-center justify-center gap-1 rounded-2xl bg-green-500 text-sm font-black text-white shadow-md transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      <CheckCircle2 size={28} />
                      <span>{isExecutable ? '完成' : '未到'}</span>
                    </button>
                  )}
                />
              );
            })}

            {todoTasks.length === 0 && (
              <div className="bg-green-50 p-8 rounded-3xl text-center border border-green-100">
                <CheckCircle2 size={64} className="mx-auto text-green-400 mb-4" />
                <h2 className="text-2xl font-bold text-green-700 mb-2">太棒了！</h2>
                <p className="text-green-600">今天的任務都做完囉～</p>
              </div>
            )}
            </section>

            {pendingTasks.length > 0 && (
              <section className="space-y-3">
              <h3 className="text-gray-500 font-bold px-2">{goalCopy.child.pendingTitle}</h3>
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
                      onClick={() => void handleRedeem(reward)}
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
      {submittingTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md animate-slide-up">
            <GoalSubmissionForm
              task={submittingTask}
              loading={actionPending}
              onCancel={() => setSubmittingTask(null)}
              onSubmit={(input) => handleSubmitReflection(submittingTask.id, input)}
            />
          </div>
        </div>
      )}

      {showWishlistForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
          <div className="bg-white w-full max-w-sm animate-slide-up rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">我要許願</h3>
              <button onClick={() => setShowWishlistForm(false)} className="p-2 text-gray-400 bg-gray-100 rounded-full"><X size={20} /></button>
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-[100] flex items-center gap-2 animate-slide-down whitespace-nowrap">
          <Star size={16} className="text-yellow-400 fill-yellow-400" />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
