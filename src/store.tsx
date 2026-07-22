import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { AppState, FeedbackTone, Task, Reward, TaskCategory, TaskStatus, TaskTemplate } from './types';
import { useAuthSession } from './auth';
import { createDataRepository, DataRepository } from './lib/data-access';
import { getSupabaseClient, supabaseConfigError } from './lib/supabase';
import { subscribeToAppData } from './lib/realtime';

interface AppContextType {
  state: AppState;
  loading: boolean;
  initialLoading: boolean;
  dataReady: boolean;
  mutationPending: boolean;
  stale: boolean;
  isOffline: boolean;
  error: string | null;
  retry: () => Promise<void>;
  role: 'parent' | 'child' | null;
  hasSession: boolean;
  updateState: (newState: Partial<AppState>) => void;
  setParentPin: (pin: string) => void;
  addChild: (name: string, loginName: string, password: string, childProfileId?: string) => Promise<void>;
  updateChildPassword: (childId: string, password: string) => Promise<void>;
  updateChildCode: (childId: string, code: string) => Promise<void>;
  updateChildName: (childId: string, name: string) => Promise<void>;
  deleteChild: (childId: string) => Promise<void>;
  setParentActiveChild: (childId: string) => void;
  setChildLoggedIn: (childId: string | null) => void;
  clearProtectedState: () => void;
  addTaskTemplate: (template: Omit<TaskTemplate, 'id'>) => Promise<void>;
  updateTaskTemplate: (id: string, updates: Partial<TaskTemplate>) => Promise<void>;
  deleteTaskTemplate: (id: string) => Promise<void>;
  addTask: (childId: string, task: Omit<Task, 'id' | 'status'>) => Promise<void>;
  updateTask: (childId: string, taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (childId: string, taskId: string) => Promise<void>;
  updateTaskStatus: (childId: string, taskId: string, status: TaskStatus) => Promise<void>;
  proposeChildGoal: (childId: string, goal: {
    name: string;
    points: number;
    icon: string;
    category: TaskCategory;
    duration?: number | null;
    dueOn?: string | null;
  }) => Promise<void>;
  confirmChildGoal: (taskId: string, confirmation: {
    name: string;
    points: number;
    category: TaskCategory;
  }) => Promise<void>;
  returnChildGoal: (taskId: string, revisionNote: string) => Promise<void>;
  submitTaskReflection: (taskId: string, submission: {
    reflection: string;
    mood?: string | null;
    difficulty?: number | null;
  }) => Promise<void>;
  reviewTaskCompletion: (taskId: string, review: {
    approved: boolean;
    approvedPoints: number;
    feedback?: string | null;
    correction?: string | null;
    tone?: FeedbackTone | null;
    revisionNote?: string | null;
  }) => Promise<void>;
  startTaskTimer: (childId: string, taskId: string) => void;
  pauseTaskTimer: (childId: string, taskId: string) => void;
  addReward: (childId: string, reward: Omit<Reward, 'id'>) => Promise<void>;
  updateReward: (childId: string, rewardId: string, updates: Partial<Reward>) => Promise<void>;
  deleteReward: (childId: string, rewardId: string) => Promise<void>;
  addWishlist: (childId: string, name: string) => Promise<void>;
  approveWishlist: (childId: string, wishlistId: string, points: number) => Promise<void>;
  redeemReward: (childId: string, reward: Reward) => Promise<void>;
  fulfillTicket: (childId: string, ticketId: string) => Promise<void>;
  resetData: () => Promise<void>;
  recordParentConsent: (consentVersion: string) => Promise<void>;
}

interface AppLoadingGateInput {
  sessionLoading: boolean;
  dataLoading: boolean;
  hasSession: boolean;
  dataReady: boolean;
}

export function shouldBlockAppForDataLoad({ sessionLoading, dataLoading, hasSession, dataReady }: AppLoadingGateInput) {
  // Block UI only during initial load. Once data is ready, background
  // refreshes (realtime, reconnect) should NOT replace the dashboard
  // with a loading screen.
  if (sessionLoading) return true;
  if (hasSession && !dataReady) return true; // first load not finished
  if (dataLoading && !dataReady) return true; // still loading first time
  return false;
}

const emptyState: AppState = {
  parentPin: null,
  parentConsentVersion: null,
  children: [],
  parentActiveChildId: null,
  childLoggedInId: null,
  taskTemplates: [],
  ledger: [],
  lastResetDate: null,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading, error: sessionError } = useAuthSession();
  const repository = useMemo<DataRepository | null>(() => {
    return supabaseConfigError ? null : createDataRepository(getSupabaseClient());
  }, []);
  const [state, setState] = useState<AppState>(emptyState);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [role, setRole] = useState<'parent' | 'child' | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [mutationPending, setMutationPending] = useState(false);
  const [stale, setStale] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const loadInFlight = useRef<Promise<void> | null>(null);
  const activeMutationCount = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  const dataReadyRef = useRef(dataReady);
  const loadedUserIdRef = useRef(loadedUserId);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    dataReadyRef.current = dataReady;
    loadedUserIdRef.current = loadedUserId;
  }, [dataReady, loadedUserId]);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const retry = useCallback(async () => {
    if (!session || !repository) return;
    if (loadInFlight.current) return loadInFlight.current;
    // Only reset dataReady on the very first load (no existing data).
    // For subsequent refreshes (realtime, reconnect) keep the dashboard
    // visible to avoid the loading-screen flash.
    const isFirstLoad = !dataReadyRef.current || loadedUserIdRef.current !== session.user.id;
    if (isFirstLoad) {
      dataReadyRef.current = false;
      loadedUserIdRef.current = null;
      setDataReady(false);
      setLoadedUserId(null);
      setDataLoading(true);
    }
    setDataError(null);
    loadInFlight.current = (async () => {
      try {
        const loaded = await repository.load(session.user.id);
        if (JSON.stringify(stateRef.current) !== JSON.stringify(loaded.state)) {
          setState(loaded.state);
        }
        setFamilyId(loaded.familyId);
        setRole(loaded.role);
        dataReadyRef.current = true;
        loadedUserIdRef.current = session.user.id;
        setLoadedUserId(session.user.id);
        setDataReady(true);
        setStale(false);
      } catch (error) {
        setDataError(error instanceof Error ? error.message : '資料載入失敗，請稍後重試。');
        setStale(true);
      } finally {
        setDataLoading(false);
        loadInFlight.current = null;
      }
    })();
    return loadInFlight.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, session]);

  useEffect(() => { void retry(); }, [retry]);

  // Track first full load completion (session check + data load)
  useEffect(() => {
    if (initialLoadDone) return;
    if (sessionLoading) return; // still checking session
    if (!session) { setInitialLoadDone(true); return; } // no session → done
    if (dataReady || dataError) { setInitialLoadDone(true); return; } // data settled
  }, [initialLoadDone, sessionLoading, session, dataReady, dataError]);

  useEffect(() => {
    if (!session) {
      setState(emptyState);
      setFamilyId(null);
      setRole(null);
      setLoadedUserId(null);
      setDataReady(false);
      setDataError(null);
      setStale(false);
    }
  }, [session]);

  useEffect(() => {
    const goOffline = () => { setIsOffline(true); setStale(true); };
    const goOnline = () => { setIsOffline(false); void retry(); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [retry]);

  useEffect(() => {
    if (!familyId || !session || !role || !repository) return undefined;
    return subscribeToAppData(getSupabaseClient(), {
      familyId,
      role,
      childProfileId: state.childLoggedInId,
      userId: session.user.id,
      onChange: () => {
        if (activeMutationCount.current > 0) return;
        setStale(true);
        void retry();
      },
      // Only refresh on actual reconnection, not on initial SUBSCRIBED
      onReconnect: () => { setIsOffline(false); setStale(true); },
    });
  }, [familyId, repository, retry, role, session, state.childLoggedInId]);

  const scheduleBackgroundRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void retry();
    }, 800);
  }, [retry]);

  const mutate = useCallback(async (
    operation: (repository: DataRepository, familyId: string) => Promise<void>,
    optimisticUpdate?: (previous: AppState) => AppState,
  ) => {
    if (!familyId || !repository) {
      setDataError('尚未載入家庭資料，請先登入後重試。');
      throw new Error('尚未載入家庭資料，請先登入後重試。');
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setStale(true);
      const message = '目前離線，變更尚未同步；恢復網路後請按重試。';
      setDataError(message);
      throw new Error(message);
    }
    setDataError(null);
    activeMutationCount.current += 1;
    setMutationPending(true);
    const previousState = stateRef.current;
    if (optimisticUpdate) {
      setState((current) => {
        const next = optimisticUpdate(current);
        stateRef.current = next;
        return next;
      });
    }
    try {
      await operation(repository, familyId);
      // The local state already reflects the action. Reconcile quietly in the
      // background so the dashboard never flashes a loading screen.
      scheduleBackgroundRefresh();
    } catch (error) {
      if (optimisticUpdate) {
        setState((current) => {
          stateRef.current = previousState;
          return previousState;
        });
      }
      const message = error instanceof Error ? error.message : '資料更新失敗，請重試。';
      setDataError(message);
      setStale(true);
      throw new Error(message);
    } finally {
      activeMutationCount.current = Math.max(0, activeMutationCount.current - 1);
      if (activeMutationCount.current === 0) {
        setDataLoading(false);
        setMutationPending(false);
      }
    }
  }, [familyId, repository, scheduleBackgroundRefresh]);

  const createLocalId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const patchChild = (previous: AppState, childId: string, update: (child: AppState['children'][number]) => AppState['children'][number]) => ({
    ...previous,
    children: previous.children.map((child) => child.id === childId ? update(child) : child),
  });
  const patchTask = (previous: AppState, taskId: string, update: (task: Task) => Task) => ({
    ...previous,
    children: previous.children.map((child) => ({ ...child, tasks: child.tasks.map((task) => task.id === taskId ? update(task) : task) })),
  });

  const updateState = (updates: Partial<AppState>) => setState((previous) => ({ ...previous, ...updates }));
  const setParentPin = (parentPin: string) => updateState({ parentPin });
  const setParentActiveChild = (parentActiveChildId: string) => updateState({ parentActiveChildId });
  const setChildLoggedIn = (childLoggedInId: string | null) => updateState({ childLoggedInId });
  const clearProtectedState = () => {
    setState(emptyState);
    setFamilyId(null);
    setRole(null);
    setLoadedUserId(null);
    setDataReady(false);
    setDataError(null);
    setStale(false);
  };

  const actions = {
    recordParentConsent: (consentVersion: string) => mutate((repo, id) => repo.recordParentConsent(id, consentVersion), (previous) => ({ ...previous, parentConsentVersion: consentVersion })),
    addChild: (name: string, loginName: string, password: string, childProfileId?: string) => mutate((repo, id) => repo.insertChild(id, name, loginName, password, childProfileId)),
    updateChildPassword: (childId: string, password: string) => mutate((repo, id) => repo.updateChildPassword(id, childId, password)),
    updateChildCode: async () => { setDataError('孩子登入代碼需由尚未提供的 invite/join token 流程建立。'); },
    updateChildName: (childId: string, name: string) => mutate((repo, id) => repo.updateChild(id, childId, name), (previous) => patchChild(previous, childId, (child) => ({ ...child, name }))),
    deleteChild: (childId: string) => mutate((repo, id) => repo.deleteChild(id, childId), (previous) => ({ ...previous, children: previous.children.filter((child) => child.id !== childId) })),
    addTaskTemplate: (template: Omit<TaskTemplate, 'id'>) => {
      const localId = createLocalId();
      return mutate((repo, id) => repo.insertTemplate(id, template), (previous) => ({ ...previous, taskTemplates: [...previous.taskTemplates, { ...template, id: localId }] }));
    },
    updateTaskTemplate: (id: string, updates: Partial<TaskTemplate>) => mutate((repo) => repo.updateTemplate(id, updates), (previous) => ({ ...previous, taskTemplates: previous.taskTemplates.map((item) => item.id === id ? { ...item, ...updates } : item) })),
    deleteTaskTemplate: (id: string) => mutate((repo) => repo.deleteTemplate(id), (previous) => ({ ...previous, taskTemplates: previous.taskTemplates.filter((item) => item.id !== id) })),
    addTask: (childId: string, task: Omit<Task, 'id' | 'status'>) => {
      const localId = createLocalId();
      const now = new Date().toISOString();
      return mutate((repo, id) => repo.insertTask(id, childId, task), (previous) => patchChild(previous, childId, (child) => ({ ...child, tasks: [...child.tasks, { ...task, id: localId, status: 'todo', createdAt: now, updatedAt: now, completedAt: null } as Task] })));
    },
    updateTask: (_childId: string, taskId: string, updates: Partial<Task>) => mutate((repo) => repo.updateTask(taskId, updates), (previous) => patchTask(previous, taskId, (task) => ({ ...task, ...updates }))),
    deleteTask: (_childId: string, taskId: string) => mutate((repo) => repo.deleteTask(taskId), (previous) => ({ ...previous, children: previous.children.map((child) => ({ ...child, tasks: child.tasks.filter((task) => task.id !== taskId) })) })),
    updateTaskStatus: (_childId: string, taskId: string, status: TaskStatus) => mutate((repo) => repo.updateTaskStatus(taskId, status), (previous) => patchTask(previous, taskId, (task) => ({ ...task, status, completedAt: status === 'completed' ? new Date().toISOString() : task.completedAt }))),
    proposeChildGoal: (childId: string, goal: Parameters<AppContextType['proposeChildGoal']>[1]) => {
      const localId = createLocalId();
      const now = new Date().toISOString();
      return mutate((repo, id) => repo.proposeChildGoal(id, childId, goal), (previous) => patchChild(previous, childId, (child) => ({ ...child, tasks: [...child.tasks, { ...goal, id: localId, icon: goal.icon, status: 'todo', origin: 'child_proposed', duration: goal.duration ?? undefined, dueOn: goal.dueOn ?? null, createdAt: now, updatedAt: now, completedAt: null, confirmedAt: null } as Task] })));
    },
    confirmChildGoal: (taskId: string, confirmation: Parameters<AppContextType['confirmChildGoal']>[1]) => mutate((repo) => repo.confirmChildGoal(taskId, confirmation), (previous) => patchTask(previous, taskId, (task) => ({ ...task, ...confirmation, confirmedAt: new Date().toISOString() }))),
    returnChildGoal: (taskId: string, revisionNote: string) => mutate((repo) => repo.returnChildGoal(taskId, revisionNote), (previous) => patchTask(previous, taskId, (task) => ({ ...task, status: 'proposal_revision_requested', revisionNote }))),
    submitTaskReflection: (taskId: string, submission: Parameters<AppContextType['submitTaskReflection']>[1]) => mutate((repo) => repo.submitTaskReflection(taskId, submission), (previous) => patchTask(previous, taskId, (task) => ({ ...task, ...submission, status: 'pending', submittedAt: new Date().toISOString() }))),
    reviewTaskCompletion: (taskId: string, review: Parameters<AppContextType['reviewTaskCompletion']>[1]) => mutate((repo) => repo.reviewTaskCompletion(taskId, review), (previous) => {
      const reviewedAt = new Date().toISOString();
      return {
        ...previous,
        children: previous.children.map((child) => ({
          ...child,
          tasks: child.tasks.map((task) => task.id !== taskId ? task : {
            ...task,
            status: review.approved ? 'completed' : 'revision_requested',
            approvedPoints: review.approvedPoints,
            parentFeedback: review.feedback ?? null,
            parentCorrection: review.correction ?? null,
            revisionNote: review.revisionNote ?? null,
            reviewedAt,
            completedAt: review.approved ? reviewedAt : task.completedAt,
          }),
          points: review.approved && child.tasks.some((task) => task.id === taskId && task.status !== 'completed')
            ? child.points + review.approvedPoints
            : child.points,
        })),
      };
    }),
    addReward: (childId: string, reward: Omit<Reward, 'id'>) => {
      const localId = createLocalId();
      return mutate((repo, id) => repo.insertReward(id, childId, reward), (previous) => patchChild(previous, childId, (child) => ({ ...child, rewards: [...child.rewards, { ...reward, id: localId }] })));
    },
    updateReward: (_childId: string, rewardId: string, updates: Partial<Reward>) => mutate((repo) => repo.updateReward(rewardId, updates), (previous) => ({ ...previous, children: previous.children.map((child) => ({ ...child, rewards: child.rewards.map((reward) => reward.id === rewardId ? { ...reward, ...updates } : reward) })) })),
    deleteReward: (_childId: string, rewardId: string) => mutate((repo) => repo.deleteReward(rewardId), (previous) => ({ ...previous, children: previous.children.map((child) => ({ ...child, rewards: child.rewards.filter((reward) => reward.id !== rewardId) })) })),
    addWishlist: (childId: string, name: string) => {
      const localId = createLocalId();
      return mutate((repo, id) => repo.insertWishlist(id, childId, name), (previous) => patchChild(previous, childId, (child) => ({ ...child, wishlist: [...child.wishlist, { id: localId, name }] })));
    },
    approveWishlist: (childId: string, wishlistId: string, points: number) => mutate((repo, id) => repo.approveWishlist(id, childId, wishlistId, points), (previous) => patchChild(previous, childId, (child) => ({ ...child, wishlist: child.wishlist.filter((item) => item.id !== wishlistId) }))),
    redeemReward: (childId: string, reward: Reward) => {
      const localId = createLocalId();
      return mutate((repo) => repo.redeemReward(reward.id), (previous) => patchChild(previous, childId, (child) => ({ ...child, points: child.points - reward.points, tickets: [...child.tickets, { id: localId, rewardId: reward.id, rewardName: reward.name, rewardIcon: reward.icon, status: 'pending', createdAt: Date.now() }] })));
    },
    fulfillTicket: (_childId: string, ticketId: string) => mutate((repo) => repo.fulfillTicket(ticketId), (previous) => ({ ...previous, children: previous.children.map((child) => ({ ...child, tickets: child.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, status: 'fulfilled' } : ticket) })) })),
    resetData: async () => { setDataError('雲端資料不能由前端整批刪除。'); },
  };

  const hasSession = Boolean(session);
  const dataReadyForSession = hasSession && dataReady && loadedUserId === session.user.id;
  const loading = shouldBlockAppForDataLoad({
    sessionLoading,
    dataLoading,
    hasSession,
    dataReady: dataReadyForSession,
  });
  const initialLoading = !initialLoadDone;

  return <AppContext.Provider value={{
    state, loading, initialLoading, dataReady: dataReadyForSession, mutationPending, stale, isOffline, error: sessionError || dataError,
    retry, role, hasSession: Boolean(session), updateState, setParentPin,
    setParentActiveChild, setChildLoggedIn, clearProtectedState,
    startTaskTimer: (childId, taskId) => setState((previous) => ({
      ...previous,
      children: previous.children.map((child) => child.id !== childId ? child : {
        ...child,
        tasks: child.tasks.map((task) => {
          if (task.id === taskId) {
            const remaining = task.timerRemainingMs ?? (task.duration ?? 0) * 60 * 1000;
            return { ...task, timerIsRunning: true, timerEndTime: Date.now() + remaining, timerRemainingMs: null };
          }
          if (task.timerIsRunning) {
            const remaining = task.timerEndTime ? Math.max(0, task.timerEndTime - Date.now()) : 0;
            return { ...task, timerIsRunning: false, timerEndTime: null, timerRemainingMs: remaining };
          }
          return task;
        }),
      }),
    })),
    pauseTaskTimer: (childId, taskId) => setState((previous) => ({
      ...previous,
      children: previous.children.map((child) => child.id !== childId ? child : {
        ...child,
        tasks: child.tasks.map((task) => task.id !== taskId || !task.timerIsRunning ? task : {
          ...task,
          timerIsRunning: false,
          timerEndTime: null,
          timerRemainingMs: task.timerEndTime ? Math.max(0, task.timerEndTime - Date.now()) : 0,
        }),
      }),
    })),
    ...actions,
  }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within an AppProvider');
  return context;
}
