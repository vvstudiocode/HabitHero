import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Circle, Clock } from 'lucide-react';

export type ParentCalendarTaskStatus = 'proposed' | 'proposal_revision_requested' | 'todo' | 'pending' | 'revision_requested' | 'completed';

export interface ParentCalendarAdventureTask {
  id: string;
  childId: string;
  childName: string;
  name: string;
  occurrenceDate: string;
  adventureType: 'daily' | 'general';
  adventureGroupId?: string | null;
  status: ParentCalendarTaskStatus;
}

export interface AdventureCalendarDay {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

interface ParentAdventureCalendarProps {
  tasks: ParentCalendarAdventureTask[];
  initialDate?: string;
  reviewing?: boolean;
  onOpenTask?: (task: ParentCalendarAdventureTask) => void;
  onReviewTask?: (task: ParentCalendarAdventureTask) => Promise<void> | void;
  onBatchReviewDaily?: (taskIds: string[]) => Promise<{ failedTaskIds?: string[] } | void>;
}

const pad = (value: number) => String(value).padStart(2, '0');
const toDateKey = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export const getTodayInTaipei = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

export function buildAdventureMonth(year: number, monthIndex: number, today: string, selectedDate: string): AdventureCalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const mondayOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const dateKey = toDateKey(date);
    return {
      dateKey,
      dayNumber: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === monthIndex,
      isToday: dateKey === today,
      isSelected: dateKey === selectedDate,
    };
  });
}

export const getTasksForDate = (tasks: ParentCalendarAdventureTask[], dateKey: string) =>
  tasks.filter(task => task.occurrenceDate === dateKey);

export const getBatchReviewableIds = (tasks: ParentCalendarAdventureTask[]) =>
  tasks.filter(task => task.adventureType === 'daily' && task.status === 'pending').map(task => task.id);

const statusView = {
  proposed: { label: '等待家長確認', icon: Clock, className: 'text-amber-600' },
  proposal_revision_requested: { label: '需要孩子補充', icon: AlertCircle, className: 'text-orange-600' },
  todo: { label: '尚未完成', icon: Circle, className: 'text-gray-400' },
  pending: { label: '等待家長確認', icon: Clock, className: 'text-blue-600' },
  revision_requested: { label: '需要孩子補充', icon: AlertCircle, className: 'text-orange-600' },
  completed: { label: '已完成', icon: Check, className: 'text-green-600' },
} satisfies Record<ParentCalendarTaskStatus, { label: string; icon: typeof Check; className: string }>;

const monthTitle = (year: number, monthIndex: number) => `${year} 年 ${monthIndex + 1} 月`;

export function ParentAdventureCalendar({
  tasks,
  initialDate = getTodayInTaipei(),
  reviewing = false,
  onOpenTask,
  onReviewTask,
  onBatchReviewDaily,
}: ParentAdventureCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const [year, month] = initialDate.split('-').map(Number);
    return { year, monthIndex: month - 1 };
  });
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const today = getTodayInTaipei();
  const days = useMemo(
    () => buildAdventureMonth(visibleMonth.year, visibleMonth.monthIndex, today, selectedDate),
    [selectedDate, today, visibleMonth],
  );
  const selectedTasks = useMemo(() => getTasksForDate(tasks, selectedDate), [selectedDate, tasks]);
  const reviewableIds = useMemo(() => getBatchReviewableIds(selectedTasks), [selectedTasks]);

  const moveMonth = (amount: number) => {
    const date = new Date(Date.UTC(visibleMonth.year, visibleMonth.monthIndex + amount, 1));
    const next = { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
    setVisibleMonth(next);
    setSelectedDate(`${next.year}-${pad(next.monthIndex + 1)}-01`);
    setSelectedPendingIds([]);
  };

  const runBatchReview = async () => {
    const validIds = selectedPendingIds.filter(id => reviewableIds.includes(id));
    if (validIds.length === 0 || !onBatchReviewDaily) return;
    setBatchError(null);
    try {
      const result = await onBatchReviewDaily(validIds);
      const failedTaskIds = result && 'failedTaskIds' in result ? result.failedTaskIds ?? [] : [];
      setSelectedPendingIds(failedTaskIds);
      if (failedTaskIds.length > 0) setBatchError(`有 ${failedTaskIds.length} 筆核准失敗，請逐筆重試。`);
    } catch {
      setBatchError('批次核准失敗，沒有顯示為成功的項目不會發放點數。');
    }
  };

  return (
    <section aria-labelledby="parent-adventure-calendar-title" className="hh-adventure-calendar space-y-4">
      <div className="hh-adventure-calendar-header">
        <h2 id="parent-adventure-calendar-title" className="text-xl font-black text-gray-900">任務行事曆</h2>
        <div className="hh-adventure-month-navigation">
          <button type="button" aria-label="上一個月" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700" onClick={() => moveMonth(-1)}><ChevronLeft size={20} /></button>
          <strong className="hh-adventure-month-title text-center text-gray-900">{monthTitle(visibleMonth.year, visibleMonth.monthIndex)}</strong>
          <button type="button" aria-label="下一個月" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700" onClick={() => moveMonth(1)}><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="hh-adventure-calendar-grid overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-xs font-bold text-gray-500">
          {['一', '二', '三', '四', '五', '六', '日'].map(label => <div key={label} className="py-2">{label}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map(day => {
            const dayTasks = getTasksForDate(tasks, day.dateKey);
            const hasPending = dayTasks.some(task => task.status === 'pending');
            return (
              <button
                key={day.dateKey}
                type="button"
                aria-label={`${day.dateKey}${day.isToday ? '，今天' : ''}，${dayTasks.length} 個冒險${hasPending ? '，有待審核' : ''}`}
                aria-pressed={day.isSelected}
                className={`hh-adventure-calendar-day relative border-b border-r border-gray-100 text-left ${day.isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : 'bg-white'} ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-300'}`}
                onClick={() => {
                  setSelectedDate(day.dateKey);
                  setSelectedPendingIds([]);
                  setBatchError(null);
                }}
              >
                <span className="text-sm font-bold">{day.dayNumber}</span>
                {day.isToday && <span aria-hidden="true" className="hh-adventure-calendar-today">今</span>}
                {dayTasks.length > 0 && (
                  <span aria-hidden="true" className={`hh-adventure-calendar-count${hasPending ? ' is-pending' : ''}`}>
                    {hasPending ? `待${dayTasks.length}` : `${dayTasks.length}項`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="selected-adventure-date" className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="selected-adventure-date" className="font-black text-gray-900">當日冒險</h3>
            <p className="text-sm text-gray-500">{selectedDate}{selectedDate === today ? '（今天）' : ''}</p>
          </div>
          {reviewableIds.length > 0 && onBatchReviewDaily && (
            <button type="button" disabled={reviewing || selectedPendingIds.length === 0} className="min-h-11 rounded-xl bg-blue-500 px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-50" onClick={() => void runBatchReview()}>
              {reviewing ? '核准中…' : `批次核准每日冒險 (${selectedPendingIds.length})`}
            </button>
          )}
        </div>

        {batchError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{batchError}</p>}

        <div className="mt-4 space-y-5">
          {Array.from(new Set(selectedTasks.map(task => task.childId))).map(childId => {
            const childTasks = selectedTasks.filter(task => task.childId === childId);
            return (
              <div key={childId}>
                <h4 className="mb-2 text-sm font-black text-gray-900">{childTasks[0]?.childName}</h4>
                <div className="space-y-2">
                  {childTasks.map(task => {
                    const view = statusView[task.status];
                    const StatusIcon = view.icon;
                    const canBatch = task.adventureType === 'daily' && task.status === 'pending';
                    const selected = selectedPendingIds.includes(task.id);
                    return (
                      <div key={task.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-gray-50 p-3">
                        {canBatch && onBatchReviewDaily ? (
                          <input aria-label={`選取 ${task.name}`} type="checkbox" checked={selected} onChange={event => setSelectedPendingIds(current => event.target.checked ? [...current, task.id] : current.filter(id => id !== task.id))} />
                        ) : (
                          <StatusIcon aria-hidden="true" size={18} className={`shrink-0 ${view.className}`} />
                        )}
                        <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => onOpenTask?.(task)}>
                          <span className="block break-words font-bold text-gray-900">{task.name}</span>
                          <span className="text-xs text-gray-500">{task.adventureType === 'daily' ? '每日冒險' : '一般冒險'} · {view.label}</span>
                        </button>
                        {task.status === 'pending' && onReviewTask && (
                          <button type="button" disabled={reviewing} className="min-h-11 shrink-0 rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-700 disabled:opacity-50" onClick={() => void onReviewTask(task)}>查看審核</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {selectedTasks.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">這一天沒有安排冒險。</p>}
        </div>
      </section>
    </section>
  );
}
