import { CloudUpload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAdventureProgress, getTaipeiDateKey, splitAdventureTasks } from '../adventure-progress';
import type { AdventureCompletionInput, AdventureTask, AdventureType } from '../types';
import { AdventureCard } from './AdventureCard';
import { AdventureTaskDetail } from './AdventureTaskDetail';

interface ChildAdventureBoardProps {
  tasks: AdventureTask[];
  generalGroupId?: string | null;
  generalTitle?: string | null;
  now: number;
  loading?: boolean;
  requestedTask?: { name: string; requestId: number } | null;
  isTaskExecutable: (task: AdventureTask) => { allowed: boolean; reason?: string | null };
  onCreateGeneral: () => void;
  onTimerToggle: (task: AdventureTask) => void;
  onComplete: (task: AdventureTask, input: AdventureCompletionInput) => Promise<void>;
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
}: ChildAdventureBoardProps) {
  const boardRef = useRef<HTMLElement>(null);
  const [openCard, setOpenCard] = useState<AdventureType | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const today = getTaipeiDateKey(new Date(now));
  const groups = useMemo(
    () => splitAdventureTasks(tasks, today, generalGroupId),
    [generalGroupId, tasks, today],
  );
  const selectedTask = selectedTaskId ? tasks.find(({ id }) => id === selectedTaskId) ?? null : null;

  useEffect(() => {
    if (selectedTaskId && !selectedTask) setSelectedTaskId(null);
  }, [selectedTask, selectedTaskId]);

  useEffect(() => {
    if (!requestedTask) return;
    const requestedAdventure = [...groups.general]
      .reverse()
      .find((task) => task.name.trim() === requestedTask.name);
    if (!requestedAdventure) return;
    setOpenCard('general');
    setSelectedTaskId(requestedAdventure.id);
  }, [groups.general, requestedTask]);

  useEffect(() => {
    if (!openCard) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || boardRef.current?.contains(target)) return;
      if (target.closest('button, a, input, select, textarea, [role="dialog"], [role="menu"]')) return;
      setOpenCard(null);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [openCard]);

  const toggle = (type: AdventureType) => {
    setOpenCard((current) => current === type ? null : type);
  };

  const selectedExecution = selectedTask
    ? isTaskExecutable(selectedTask)
    : { allowed: false, reason: null };
  const pendingSyncCount = tasks.filter(({ pendingSync }) => pendingSync).length;

  return (
    <>
      <aside ref={boardRef} className="hh-child-adventure-board" aria-label="我的冒險">
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
          progress={getAdventureProgress(groups.daily)}
          expanded={openCard === 'daily'}
          onToggle={() => toggle('daily')}
          onTaskSelect={(task) => setSelectedTaskId(task.id)}
        />
        <AdventureCard
          id="general-adventure"
          title={generalTitle?.trim() || '一般冒險'}
          emptyMessage="目前沒有一般冒險"
          tasks={groups.general}
          progress={getAdventureProgress(groups.general)}
          expanded={openCard === 'general'}
          allowCreate
          onToggle={() => toggle('general')}
          onTaskSelect={(task) => setSelectedTaskId(task.id)}
          onCreate={onCreateGeneral}
        />
      </aside>

      {selectedTask && (
        <AdventureTaskDetail
          task={selectedTask}
          now={now}
          canExecute={selectedExecution.allowed}
          blockedReason={selectedExecution.reason}
          loading={loading}
          onTimerToggle={onTimerToggle}
          onComplete={onComplete}
          onRequestClose={() => setSelectedTaskId(null)}
        />
      )}
    </>
  );
}
