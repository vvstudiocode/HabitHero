import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { AppState, Task, Reward, TaskStatus, TaskTemplate } from './types';
import { useAuthSession } from './auth';
import { createDataRepository, DataRepository } from './lib/data-access';
import { getSupabaseClient, supabaseConfigError } from './lib/supabase';
import { subscribeToAppData } from './lib/realtime';

interface AppContextType {
  state: AppState;
  loading: boolean;
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
}

interface AppLoadingGateInput {
  sessionLoading: boolean;
  dataLoading: boolean;
  hasSession: boolean;
  dataReady: boolean;
}

export function shouldBlockAppForDataLoad({ sessionLoading, dataLoading, hasSession, dataReady }: AppLoadingGateInput) {
  return sessionLoading || dataLoading || (hasSession && !dataReady);
}

const emptyState: AppState = {
  parentPin: null,
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
  const loadInFlight = useRef<Promise<void> | null>(null);
  const mutationInFlight = useRef<Promise<void> | null>(null);

  const retry = useCallback(async () => {
    if (!session || !repository) return;
    if (loadInFlight.current) return loadInFlight.current;
    setDataLoading(true);
    setDataReady(false);
    setLoadedUserId(null);
    setDataError(null);
    loadInFlight.current = (async () => {
      try {
        const loaded = await repository.load(session.user.id);
        setState(loaded.state);
        setFamilyId(loaded.familyId);
        setRole(loaded.role);
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
  }, [repository, session]);

  useEffect(() => { void retry(); }, [retry]);

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
      onChange: () => { setStale(true); void retry(); },
      onReconnect: () => { setIsOffline(false); setStale(true); void retry(); },
    });
  }, [familyId, repository, retry, role, session, state.childLoggedInId]);

  const mutate = useCallback(async (operation: (repository: DataRepository, familyId: string) => Promise<void>) => {
    if (mutationInFlight.current) return mutationInFlight.current;
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
    setMutationPending(true);
    setDataLoading(true);
    const request = (async () => {
      try {
        await operation(repository, familyId);
        await retry();
      } catch (error) {
        const message = error instanceof Error ? error.message : '資料更新失敗，請重試。';
        setDataError(message);
        setStale(true);
        throw new Error(message);
      } finally {
        setDataLoading(false);
        setMutationPending(false);
        mutationInFlight.current = null;
      }
    })();
    mutationInFlight.current = request;
    return request;
  }, [familyId, repository, retry]);

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
    addChild: (name: string, loginName: string, password: string, childProfileId?: string) => mutate((repo, id) => repo.insertChild(id, name, loginName, password, childProfileId)),
    updateChildPassword: (childId: string, password: string) => mutate((repo, id) => repo.updateChildPassword(id, childId, password)),
    updateChildCode: async () => { setDataError('孩子登入代碼需由尚未提供的 invite/join token 流程建立。'); },
    updateChildName: (childId: string, name: string) => mutate((repo, id) => repo.updateChild(id, childId, name)),
    deleteChild: (childId: string) => mutate((repo, id) => repo.deleteChild(id, childId)),
    addTaskTemplate: (template: Omit<TaskTemplate, 'id'>) => mutate((repo, id) => repo.insertTemplate(id, template)),
    updateTaskTemplate: (id: string, updates: Partial<TaskTemplate>) => mutate((repo) => repo.updateTemplate(id, updates)),
    deleteTaskTemplate: (id: string) => mutate((repo) => repo.deleteTemplate(id)),
    addTask: (childId: string, task: Omit<Task, 'id' | 'status'>) => mutate((repo, id) => repo.insertTask(id, childId, task)),
    updateTask: (_childId: string, taskId: string, updates: Partial<Task>) => mutate((repo) => repo.updateTask(taskId, updates)),
    deleteTask: (_childId: string, taskId: string) => mutate((repo) => repo.deleteTask(taskId)),
    updateTaskStatus: (_childId: string, taskId: string, status: TaskStatus) => mutate((repo) => repo.updateTaskStatus(taskId, status)),
    addReward: (childId: string, reward: Omit<Reward, 'id'>) => mutate((repo, id) => repo.insertReward(id, childId, reward)),
    updateReward: (_childId: string, rewardId: string, updates: Partial<Reward>) => mutate((repo) => repo.updateReward(rewardId, updates)),
    deleteReward: (_childId: string, rewardId: string) => mutate((repo) => repo.deleteReward(rewardId)),
    addWishlist: (childId: string, name: string) => mutate((repo, id) => repo.insertWishlist(id, childId, name)),
    approveWishlist: (childId: string, wishlistId: string, points: number) => mutate((repo, id) => repo.approveWishlist(id, childId, wishlistId, points)),
    redeemReward: (_childId: string, reward: Reward) => mutate((repo) => repo.redeemReward(reward.id)),
    fulfillTicket: (_childId: string, ticketId: string) => mutate((repo) => repo.fulfillTicket(ticketId)),
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

  return <AppContext.Provider value={{
    state, loading, dataReady: dataReadyForSession, mutationPending, stale, isOffline, error: sessionError || dataError,
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
