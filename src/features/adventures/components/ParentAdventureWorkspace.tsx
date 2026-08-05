import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { ParentDashboardFormModal } from '../../../components/parent-dashboard/ParentDashboardFormModal';
import { ModalShell } from '../../../components/shared/ParentDashboardUI';
import type { AdventureScheduleUpdateInput } from '../../../lib/adventure-data-access';
import { dismissWithAnimation } from '../../../lib/utils';
import type { TaskSchedule } from '../../../types';
import type { TaskCategory } from '../../growth/types';
import { formatScheduleDetails, formatScheduleWeekdays, getSharedScheduleDetails, groupActiveAdventureSchedules } from '../adventure-schedule-display';
import { ParentAdventureCalendar, type ParentCalendarAdventureTask } from './ParentAdventureCalendar';
import { ParentAdventureScheduleForm, type ParentAdventureScheduleInput } from './ParentAdventureScheduleForm';
import { ParentGeneralAdventureForm, type ParentGeneralAdventureInput } from './ParentGeneralAdventureForm';

export interface CreateAdventureScheduleInput {
  childProfileIds: string[];
  name: string;
  description?: string;
  points: number;
  icon: string;
  category: TaskCategory;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  weekdays: number[];
  timezone?: string;
  requiresTimer?: boolean;
  requiresReviewBeforeNextTask?: boolean;
  activeFrom: string;
}

export interface CreateGeneralAdventureInput {
  childProfileIds: string[];
  name: string;
  description?: string;
  points: number;
  icon: string;
  category: TaskCategory;
  durationMinutes?: number;
  dueOn?: string;
  startTime?: string;
  endTime?: string;
  reportMode: 'quick' | 'reflection';
  requiresTimer?: boolean;
  requiresReviewBeforeNextTask?: boolean;
}

interface ParentAdventureWorkspaceProps {
  children: { id: string; name: string }[];
  tasks: ParentCalendarAdventureTask[];
  schedules: TaskSchedule[];
  generalTitle: string;
  activeFrom: string;
  loading?: boolean;
  legacyTaskList: ReactNode;
  onOpenReview: () => void;
  onCreateSchedule: (input: CreateAdventureScheduleInput) => Promise<void>;
  onCreateGeneral: (input: CreateGeneralAdventureInput) => Promise<void>;
  onUpdateGeneralTitle: (childId: string, title: string) => Promise<void>;
  onBatchReviewDaily: (taskIds: string[]) => Promise<{ failedTaskIds: string[] }>;
  onEditTask: (task: ParentCalendarAdventureTask) => void;
  onDeleteTask: (task: ParentCalendarAdventureTask) => void;
  onUpdateSchedule: (scheduleId: string, updates: AdventureScheduleUpdateInput) => Promise<void>;
  onDisableSchedule: (scheduleId: string) => Promise<void>;
  requestedForm?: { type: 'daily' | 'general'; requestId: number } | null;
}

const toErrorMessage = (caught: unknown, fallback: string) => caught instanceof Error ? caught.message : fallback;
const renderAdventureOverlay = (content: ReactNode) =>
  typeof document === 'undefined' ? content : createPortal(content, document.body);

export function ParentAdventureWorkspace({
  children,
  tasks,
  schedules,
  generalTitle,
  activeFrom,
  loading = false,
  legacyTaskList,
  onOpenReview,
  onCreateSchedule,
  onCreateGeneral,
  onUpdateGeneralTitle,
  onBatchReviewDaily,
  onEditTask,
  onDeleteTask,
  onUpdateSchedule,
  onDisableSchedule,
  requestedForm,
}: ParentAdventureWorkspaceProps) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [expandedScheduleNames, setExpandedScheduleNames] = useState<string[]>([]);
  const [form, setForm] = useState<'daily' | 'general' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [scheduleToDisable, setScheduleToDisable] = useState<TaskSchedule | null>(null);
  const [scheduleToEdit, setScheduleToEdit] = useState<TaskSchedule | null>(null);
  const [managementBusyId, setManagementBusyId] = useState<string | null>(null);

  const openForm = (next: 'daily' | 'general') => {
    setFormError(null);
    setScheduleToEdit(null);
    setForm(next);
  };

  const closeForm = () => {
    dismissWithAnimation(() => {
      setScheduleToEdit(null);
      setForm(null);
    }, '.hh-adventure-form-dialog', 220);
  };

  useEffect(() => {
    if (requestedForm) openForm(requestedForm.type);
  }, [requestedForm]);

  const createSchedule = async (input: ParentAdventureScheduleInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await onCreateSchedule({
        childProfileIds: input.childIds,
        name: input.name,
        description: input.description || undefined,
        points: input.points,
        icon: 'Star',
        category: input.category,
        durationMinutes: input.requiresTimer ? input.durationMinutes ?? undefined : undefined,
        startTime: input.startTime || undefined,
        endTime: input.endTime || undefined,
        weekdays: input.weekdays,
        timezone: 'Asia/Taipei',
        requiresTimer: input.requiresTimer,
        requiresReviewBeforeNextTask: false,
        activeFrom,
      });
      closeForm();
    } catch (caught) {
      setFormError(toErrorMessage(caught, '建立每日冒險失敗，請稍後再試。'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateSchedule = async (input: ParentAdventureScheduleInput) => {
    if (!scheduleToEdit || !input.editScope) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await onUpdateSchedule(scheduleToEdit.id, {
        name: input.name,
        description: input.description || null,
        points: input.points,
        icon: scheduleToEdit.icon,
        category: input.category,
        durationMinutes: input.requiresTimer ? input.durationMinutes : null,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        weekdays: input.weekdays,
        timezone: 'Asia/Taipei',
        requiresTimer: input.requiresTimer,
        requiresReviewBeforeNextTask: false,
        activeFrom: scheduleToEdit.activeFrom,
        activeUntil: scheduleToEdit.activeUntil,
        applyMode: input.editScope,
      });
      closeForm();
    } catch (caught) {
      setFormError(toErrorMessage(caught, '修改排程失敗。請確認沒有受影響的冒險正在計時，再重試。'));
    } finally {
      setSubmitting(false);
    }
  };

  const createGeneral = async (input: ParentGeneralAdventureInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await onCreateGeneral({
        childProfileIds: input.childIds,
        name: input.name,
        description: input.description || undefined,
        points: input.points,
        icon: 'Star',
        category: input.category,
        durationMinutes: input.requiresTimer ? input.durationMinutes ?? undefined : undefined,
        dueOn: input.dueOn,
        startTime: input.startTime || undefined,
        endTime: input.endTime || undefined,
        reportMode: input.reportMode,
        requiresTimer: input.requiresTimer,
        requiresReviewBeforeNextTask: false,
      });
      closeForm();
    } catch (caught) {
      setFormError(toErrorMessage(caught, '新增一般冒險失敗，請稍後再試。'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateTitle = async (title: string) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await Promise.all(children.map(child => onUpdateGeneralTitle(child.id, title)));
    } catch (caught) {
      setFormError(toErrorMessage(caught, '儲存一般冒險名稱失敗。'));
    } finally {
      setSubmitting(false);
    }
  };

  const disableSchedule = async () => {
    if (!scheduleToDisable) return;
    setManagementBusyId(scheduleToDisable.id);
    try {
      await onDisableSchedule(scheduleToDisable.id);
      setScheduleToDisable(null);
    } catch (caught) {
      setFormError(toErrorMessage(caught, '停止每日冒險失敗，請稍後再試。'));
    } finally {
      setManagementBusyId(null);
    }
  };

  const activeSchedules = schedules.filter(schedule => schedule.isActive);
  const scheduleGroups = groupActiveAdventureSchedules(activeSchedules, children);
  const scheduleToDisableChildName = scheduleToDisable
    ? children.find(child => child.id === scheduleToDisable.childProfileId)?.name
    : null;
  const toolbarButtonClass = (pressed: boolean) =>
    [
      'hh-adventure-action min-h-11 rounded-xl border bg-white px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 aria-pressed:border-gray-900 aria-pressed:text-gray-900',
      pressed ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-700',
    ].join(' ');

  return (
    <>
      <div className="hh-adventure-workspace space-y-6">
        <div className="hh-adventure-toolbar">
          <div className="hh-adventure-view-switch flex gap-2" role="group" aria-label="冒險管理檢視">
            <button type="button" aria-pressed={view === 'calendar'} className={toolbarButtonClass(view === 'calendar')} onClick={() => setView('calendar')}>行事曆</button>
            <button type="button" aria-pressed={view === 'list'} className={toolbarButtonClass(view === 'list')} onClick={() => setView('list')}>任務清單</button>
          </div>
          <div className="hh-adventure-actions">
            <button data-tour="add-daily-adventure" type="button" disabled={children.length === 0} className={toolbarButtonClass(false)} onClick={() => openForm('daily')}>＋ 每日冒險</button>
            <button type="button" disabled={children.length === 0} className={toolbarButtonClass(false)} onClick={() => openForm('general')}>＋ 一般冒險</button>
          </div>
        </div>

        {view === 'calendar' ? (
          <>
            <ParentAdventureCalendar
              tasks={tasks}
              reviewing={loading}
              onOpenTask={task => { if (task.status === 'pending') onOpenReview(); }}
              onReviewTask={onOpenReview}
              onBatchReviewDaily={onBatchReviewDaily}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
            />

            <section aria-labelledby="daily-schedules-title" className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 id="daily-schedules-title" className="font-black text-gray-900">每日冒險卡片</h3>
              <div id="daily-schedules-content" className="mt-4 space-y-2">
                {scheduleGroups.map(({ name, entries: scheduleEntries }, index) => {
                  const isScheduleExpanded = expandedScheduleNames.includes(name);
                  const scheduleGroupContentId = `daily-schedule-card-${index}`;
                  const sharedScheduleDetails = getSharedScheduleDetails(scheduleEntries.map(entry => entry.schedule));
                  return (
                    <article key={name} className="rounded-xl bg-gray-50 p-3">
                      <h4 className="text-base font-black text-gray-900">
                        <button
                          type="button"
                          aria-expanded={isScheduleExpanded}
                          aria-controls={scheduleGroupContentId}
                          className="hh-adventure-schedule-trigger flex min-h-11 w-full items-center justify-between text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                          onClick={() => setExpandedScheduleNames(current => current.includes(name) ? current.filter(currentName => currentName !== name) : [...current, name])}
                        >
                          <span className="min-w-0">
                            <span className="block break-words">{name}</span>
                            {sharedScheduleDetails ? (
                              <span className="mt-1 block text-xs font-medium text-gray-500">{sharedScheduleDetails.join(' · ')}</span>
                            ) : (
                              <span className="mt-1 block text-xs font-medium text-gray-500">各孩子的設定不同，展開查看</span>
                            )}
                          </span>
                          <ChevronDown aria-hidden="true" size={18} className={`shrink-0 transition-transform duration-200 ${isScheduleExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </h4>
                      {isScheduleExpanded && (
                        <div id={scheduleGroupContentId} className="mt-2 space-y-2">
                          {scheduleEntries.map(({ schedule, childName }) => (
                            <div key={schedule.id} className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3">
                              <div className="min-w-0 flex-1">
                                <strong className="block text-sm font-bold text-gray-900">給 {childName}</strong>
                                <span className="mt-1 block text-xs text-gray-500">
                                  {sharedScheduleDetails ? formatScheduleWeekdays(schedule.weekdays) : formatScheduleDetails(schedule).join(' · ')}
                                </span>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  aria-label={`編輯${schedule.name}（${childName}）`}
                                  className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-700"
                                  onClick={() => { setFormError(null); setScheduleToEdit(schedule); setForm('daily'); }}
                                >編輯</button>
                                <button
                                  type="button"
                                  aria-label={`停止${schedule.name}（${childName}）`}
                                  className="min-h-11 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-red-700"
                                  onClick={() => setScheduleToDisable(schedule)}
                                >停止</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
                {activeSchedules.length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">目前沒有啟用中的每日排程。</p>}
              </div>
            </section>

          </>
        ) : legacyTaskList}
      </div>

      {form === 'daily' && renderAdventureOverlay(
        <ParentDashboardFormModal
          title={scheduleToEdit ? '編輯每日冒險排程' : '新增每日冒險'}
          closeLabel={scheduleToEdit ? '關閉編輯每日冒險排程' : '關閉新增每日冒險'}
          onClose={closeForm}
          variant="center"
          panelClassName="hh-adventure-form-dialog"
        >
          {formError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <ParentAdventureScheduleForm
            children={children}
            mode={scheduleToEdit ? 'edit' : 'create'}
            initialValue={scheduleToEdit ? {
              name: scheduleToEdit.name,
              description: scheduleToEdit.description ?? '',
              childIds: [scheduleToEdit.childProfileId],
              category: scheduleToEdit.category,
              weekdays: scheduleToEdit.weekdays,
              startTime: scheduleToEdit.startTime ?? '',
              endTime: scheduleToEdit.endTime ?? '',
              requiresTimer: scheduleToEdit.requiresTimer,
              durationMinutes: scheduleToEdit.durationMinutes,
              points: scheduleToEdit.points,
              editScope: 'from_tomorrow',
            } : undefined}
            submitting={submitting}
            onCancel={closeForm}
            onSubmit={scheduleToEdit ? updateSchedule : createSchedule}
          />
        </ParentDashboardFormModal>
      )}

      {form === 'general' && renderAdventureOverlay(
        <ParentDashboardFormModal
          title="新增一般冒險"
          closeLabel="關閉新增一般冒險"
          onClose={closeForm}
          variant="center"
          panelClassName="hh-adventure-form-dialog"
        >
          {formError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <ParentGeneralAdventureForm children={children} generalTitle={generalTitle} submitting={submitting} onCancel={closeForm} onUpdateTitle={updateTitle} onSubmit={createGeneral} />
        </ParentDashboardFormModal>
      )}

      {scheduleToDisable && renderAdventureOverlay(
        <ModalShell variant="center">
          <h3 className="text-xl font-black text-gray-900">停止每日冒險</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">確定停止「{scheduleToDisable.name}」{scheduleToDisableChildName ? `給 ${scheduleToDisableChildName} 的` : ''}每日冒險？停止後不會再產生新的冒險，過去紀錄、等待審核、已完成的任務與點數都會保留。</p>
          <div className="mt-6 flex gap-3">
            <button type="button" className="min-h-12 flex-1 rounded-xl bg-gray-100 px-4 font-bold text-gray-700" onClick={() => setScheduleToDisable(null)}>取消</button>
            <button type="button" disabled={managementBusyId === scheduleToDisable.id} className="min-h-12 flex-1 rounded-xl bg-red-500 px-4 font-bold text-white disabled:cursor-wait disabled:opacity-50" onClick={() => void disableSchedule()}>{managementBusyId === scheduleToDisable.id ? '停止中…' : '確認停止'}</button>
          </div>
        </ModalShell>
      )}
    </>
  );
}
