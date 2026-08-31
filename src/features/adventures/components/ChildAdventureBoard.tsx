import { CloudUpload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAdventureProgress, getInitialAdventureTask, getTaipeiDateKey, splitAdventureTasks } from '../adventure-progress';
import type { AdventureCompletionInput, AdventureTask, AdventureType } from '../types';
import { AdventureCard } from './AdventureCard';
import { AdventureTaskDetail } from './AdventureTaskDetail';

interface ChildAdventureBoardProps {
  tasks: AdventureTask[];
  generalGroupId?: string | null;
  generalTitle?: string | null;
  now: number;
  loading?: boolean;
  requestedTask?: { id: string; requestId: number } | null;
  isTaskExecutable: (task: AdventureTask) => { allowed: boolean; reason?: string | null };
  onCreateGeneral: () => void;
  onTimerToggle: (task: AdventureTask) => void;
  onComplete: (task: AdventureTask, input: AdventureCompletionInput) => Promise<void>;
  onAbandon?: (task: AdventureTask) => Promise<void>;
  open?: boolean;
  onRequestClose?: () => void;
}

export function ChildAdventureBoard({
  tasks,
  generalGroupId,
  generalTitle,
  now,
  loading = false,
  requestedTask,
  isTaskExecutable,
  onCreateGeneral,
  onTimerToggle,
  onComplete,
  onAbandon,
  open = false,
  onRequestClose,
}: ChildAdventureBoardProps) {
  const boardRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const requestCloseRef = useRef(onRequestClose);
  requestCloseRef.current = onRequestClose;
  const [openCard, setOpenCard] = useState<AdventureType | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const handledRequestId = useRef<number | null>(null);
  const today = getTaipeiDateKey(new Date(now));
  const groups = useMemo(
    () => splitAdventureTasks(tasks, today, generalGroupId),
    [generalGroupId, tasks, today],
  );
  const initialTask = useMemo(() => getInitialAdventureTask(groups), [groups]);
  const selectedTask = selectedTaskId ? tasks.find(({ id }) => id === selectedTaskId) ?? null : null;

  useEffect(() => {
    if (selectedTaskId && !selectedTask) setSelectedTaskId(null);
  }, [selectedTask, selectedTaskId]);

  useEffect(() => {
    if (!requestedTask || handledRequestId.current === requestedTask.requestId) return;
    const requestedType: AdventureType | null = groups.daily.some((task) => task.id === requestedTask.id)
      ? 'daily'
      : groups.general.some((task) => task.id === requestedTask.id)
        ? 'general'
        : null;
    if (!requestedType) return;
    handledRequestId.current = requestedTask.requestId;
    setOpenCard(requestedType);
    setSelectedTaskId(requestedTask.id);
  }, [groups.daily, groups.general, requestedTask]);

  useEffect(() => {
    if (!open) {
      setOpenCard(null);
      setSelectedTaskId(null);
      return;
    }
    const initialType: AdventureType = groups.daily.length > 0 ? 'daily' : 'general';
    setOpenCard((current) => current ?? initialType);
    setSelectedTaskId((current) => current ?? initialTask?.id ?? null);
  }, [groups.daily.length, initialTask, open]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusableNodes = boardRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      const focusable: HTMLElement[] = focusableNodes ? Array.from(focusableNodes) : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  const toggle = (type: AdventureType) => {
    setOpenCard((current) => current === type ? null : type);
  };

  const selectedExecution = selectedTask
    ? isTaskExecutable(selectedTask)
    : { allowed: false, reason: null };
  const pendingSyncCount = tasks.filter(({ pendingSync }) => pendingSync).length;
  const selectTask = (task: AdventureTask) => {
    setOpenCard(groups.daily.some(({ id }) => id === task.id) ? 'daily' : 'general');
    setSelectedTaskId(task.id);
  };

  if (!open) return null;

  return (
    <div className="hh-adventure-board-overlay">
      <button type="button" className="hh-adventure-button hh-adventure-board-backdrop" aria-label="關閉任務看板" onClick={() => requestCloseRef.current?.()} />
      <section
        ref={boardRef}
        className="hh-child-adventure-board hh-adventure-board-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hh-adventure-board-title"
      >
        <header className="hh-adventure-board-header">
          <div>
            <h2 id="hh-adventure-board-title">今天要完成哪個冒險？</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="hh-adventure-button hh-adventure-board-close" aria-label="關閉任務看板" onClick={() => requestCloseRef.current?.()}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="hh-adventure-board-layout">
          <div className="hh-adventure-board-categories">
            {pendingSyncCount > 0 && (
              <p className="hh-adventure-sync-status" role="status">
                <CloudUpload size={18} aria-hidden="true" />
                {pendingSyncCount} 個完成紀錄等待同步，點數尚未發放。
              </p>
            )}
            <AdventureCard
              id="daily-adventure"
              title="每日冒險"
              emptyMessage="今天沒有每日冒險"
              tasks={groups.daily}
              now={now}
              progress={getAdventureProgress(groups.daily)}
              expanded={openCard === 'daily'}
              onToggle={() => toggle('daily')}
              onTaskSelect={selectTask}
            />
            <AdventureCard
              id="general-adventure"
              title={generalTitle?.trim() || '一般冒險'}
              emptyMessage="目前沒有一般冒險"
              tasks={groups.general}
              now={now}
              progress={getAdventureProgress(groups.general)}
              expanded={openCard === 'general'}
              allowCreate
              onToggle={() => toggle('general')}
              onTaskSelect={selectTask}
              onCreate={onCreateGeneral}
            />
          </div>

          <div className="hh-adventure-board-detail">
            {selectedTask ? (
              <AdventureTaskDetail
                embedded
                task={selectedTask}
                now={now}
                canExecute={selectedExecution.allowed}
                blockedReason={selectedExecution.reason}
                loading={loading}
                onTimerToggle={onTimerToggle}
                onComplete={onComplete}
                onAbandon={onAbandon}
                onRequestClose={() => setSelectedTaskId(null)}
              />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
