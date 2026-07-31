import { useEffect, useState, type ReactNode } from 'react';
import { ParentDashboardFormModal } from '../../../components/parent-dashboard/ParentDashboardFormModal';
import { ModalShell } from '../../../components/shared/ParentDashboardUI';
import type { AdventureScheduleUpdateInput } from '../../../lib/adventure-data-access';
import { dismissWithAnimation } from '../../../lib/utils';
import type { AdventureGroup, TaskSchedule } from '../../../types';
import type { TaskCategory } from '../../growth/types';
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
  groups: AdventureGroup[];
  generalTitle: string;
  activeFrom: string;
  loading?: boolean;
  legacyTaskList: ReactNode;
  onOpenReview: () => void;
  onCreateSchedule: (input: CreateAdventureScheduleInput) => Promise<void>;
  onCreateGeneral: (input: CreateGeneralAdventureInput) => Promise<void>;
  onUpdateGeneralTitle: (childId: string, title: string) => Promise<void>;
  onBatchReviewDaily: (taskIds: string[]) => Promise<{ failedTaskIds: string[] }>;
  onUpdateSchedule: (scheduleId: string, updates: AdventureScheduleUpdateInput) => Promise<void>;
  onDisableSchedule: (scheduleId: string) => Promise<void>;
  onArchiveGroup: (groupId: string) => Promise<void>;
  requestedForm?: { type: 'daily' | 'general'; requestId: number } | null;
}

const toErrorMessage = (caught: unknown, fallback: string) => caught instanceof Error ? caught.message : fallback;

export function ParentAdventureWorkspace({
  children,
  tasks,
  schedules,
  groups,
  generalTitle,
  activeFrom,
  loading = false,
  legacyTaskList,
  onOpenReview,
  onCreateSchedule,
  onCreateGeneral,
  onUpdateGeneralTitle,
  onBatchReviewDaily,
  onUpdateSchedule,
  onDisableSchedule,
  onArchiveGroup,
  requestedForm,
}: ParentAdventureWorkspaceProps) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [form, setForm] = useState<'daily' | 'general' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [scheduleToDisable, setScheduleToDisable] = useState<TaskSchedule | null>(null);
  const [scheduleToEdit, setScheduleToEdit] = useState<TaskSchedule | null>(null);
  const [managementBusyId, setManagementBusyId] = useState<string | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);

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
        category: 'life_habit',
        durationMinutes: input.requiresTimer ? input.durationMinutes ?? undefined : undefined,
        startTime: input.startTime || undefined,
        endTime: input.endTime || undefined,
        weekdays: input.weekdays,
        timezone: 'Asia/Taipei',
        requiresTimer: input.requiresTimer,
        requiresReviewBeforeNextTask: input.requiresReview,
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
        category: scheduleToEdit.category,
        durationMinutes: input.requiresTimer ? input.durationMinutes : null,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        weekdays: input.weekdays,
        timezone: 'Asia/Taipei',
        requiresTimer: input.requiresTimer,
        requiresReviewBeforeNextTask: input.requiresReview,
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
        category: 'life_habit',
        durationMinutes: input.requiresTimer ? input.durationMinutes ?? undefined : undefined,
        dueOn: input.dueOn,
        startTime: input.startTime || undefined,
        endTime: input.endTime || undefined,
        reportMode: input.reportMode,
        requiresTimer: input.requiresTimer,
        requiresReviewBeforeNextTask: true,
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
    setManagementError(null);
    try {
      await onDisableSchedule(scheduleToDisable.id);
      setScheduleToDisable(null);
    } catch (caught) {
      setManagementError(toErrorMessage(caught, '停用排程失敗，請稍後再試。'));
    } finally {
      setManagementBusyId(null);
    }
  };

  const archiveGroup = async (group: AdventureGroup) => {
    const hasUnfinished = tasks.some(task => task.adventureGroupId === group.id && task.status !== 'completed');
    if (hasUnfinished) {
      setManagementError('尚有未完成冒險；請先完成、移動或取消，不能直接封存。');
      return;
    }
    setManagementBusyId(group.id);
    setManagementError(null);
    try {
      await onArchiveGroup(group.id);
    } catch (caught) {
      setManagementError(toErrorMessage(caught, '封存失敗；若仍有未完成冒險，請先處理後再試。'));
    } finally {
      setManagementBusyId(null);
    }
  };

  const weekdayLabels: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' };

  return (
    <>
      <div className="hh-adventure-workspace space-y-6">
        <div className="hh-adventure-toolbar">
          <div className="hh-adventure-view-switch flex rounded-xl bg-gray-100 p-1" role="group" aria-label="冒險管理檢視">
            <button type="button" aria-pressed={view === 'calendar'} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${view === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`} onClick={() => setView('calendar')}>行事曆</button>
            <button type="button" aria-pressed={view === 'list'} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`} onClick={() => setView('list')}>任務清單</button>
          </div>
          <div className="hh-adventure-actions">
            <button data-tour="add-daily-adventure" type="button" disabled={children.length === 0} className="hh-adventure-action min-h-11 rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-700 disabled:opacity-50" onClick={() => openForm('daily')}>＋ 每日冒險</button>
            <button type="button" disabled={children.length === 0} className="hh-adventure-action min-h-11 rounded-xl bg-blue-500 px-3 text-sm font-bold text-white disabled:opacity-50" onClick={() => openForm('general')}>＋ 一般冒險</button>
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
            />

            <section aria-labelledby="daily-schedules-title" className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 id="daily-schedules-title" className="font-black text-gray-900">每日冒險排程</h3>
              <p className="mt-1 text-sm text-gray-500">停用只影響尚未產生的未來冒險，過去紀錄與已送出的任務不會刪除。</p>
              <div className="mt-4 space-y-2">
                {schedules.filter(schedule => schedule.isActive).map(schedule => (
                  <div key={schedule.id} className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
                    <div className="min-w-0">
                      <strong className="block break-words text-gray-900">{schedule.name}</strong>
                      <span className="text-xs text-gray-500">
                        {children.find(child => child.id === schedule.childProfileId)?.name ?? '小孩'} · {schedule.weekdays.map(day => weekdayLabels[day] ?? day).join('、')} · {schedule.startTime?.slice(0, 5) || '全天'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" disabled={managementBusyId === schedule.id} className="min-h-11 rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-700 disabled:opacity-50" onClick={() => { setFormError(null); setScheduleToEdit(schedule); setForm('daily'); }}>編輯</button>
                      <button type="button" disabled={managementBusyId === schedule.id} className="min-h-11 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-red-700 disabled:opacity-50" onClick={() => setScheduleToDisable(schedule)}>停用排程</button>
                    </div>
                  </div>
                ))}
                {schedules.filter(schedule => schedule.isActive).length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">目前沒有啟用中的每日排程。</p>}
              </div>
            </section>

            {groups.some(group => group.status === 'active') && (
              <section aria-labelledby="general-groups-title" className="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 id="general-groups-title" className="font-black text-gray-900">一般冒險集合</h3>
                <p className="mt-1 text-sm text-gray-500">封存會保留完成歷史；尚有未完成冒險時系統會拒絕封存。</p>
                <div className="mt-4 space-y-2">
                  {groups.filter(group => group.status === 'active').map(group => {
                    const hasUnfinished = tasks.some(task => task.adventureGroupId === group.id && task.status !== 'completed');
                    return (
                      <div key={group.id} className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
                        <div>
                          <strong className="block text-gray-900">{group.title}</strong>
                          <span className="text-xs text-gray-500">{children.find(child => child.id === group.childProfileId)?.name ?? '小孩'}{hasUnfinished ? ' · 尚有未完成冒險' : ' · 可以安全封存'}</span>
                        </div>
                        <button type="button" disabled={hasUnfinished || managementBusyId === group.id} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void archiveGroup(group)}>封存集合</button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {managementError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{managementError}</p>}
          </>
        ) : legacyTaskList}
      </div>

      {form === 'daily' && (
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
              weekdays: scheduleToEdit.weekdays,
              startTime: scheduleToEdit.startTime ?? '',
              endTime: scheduleToEdit.endTime ?? '',
              requiresTimer: scheduleToEdit.requiresTimer,
              durationMinutes: scheduleToEdit.durationMinutes,
              requiresReview: scheduleToEdit.requiresReviewBeforeNextTask,
              points: scheduleToEdit.points,
              editScope: 'from_tomorrow',
            } : undefined}
            submitting={submitting}
            onCancel={closeForm}
            onSubmit={scheduleToEdit ? updateSchedule : createSchedule}
          />
        </ParentDashboardFormModal>
      )}

      {form === 'general' && (
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

      {scheduleToDisable && (
        <ModalShell variant="center">
          <h3 className="text-xl font-black text-gray-900">停用每日排程</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">確定停用「{scheduleToDisable.name}」？停用只影響尚未產生的未來冒險，不會刪除過去紀錄，也不會更改 pending 或 completed 任務。</p>
          <div className="mt-6 flex gap-3">
            <button type="button" className="min-h-12 flex-1 rounded-xl bg-gray-100 px-4 font-bold text-gray-700" onClick={() => setScheduleToDisable(null)}>取消</button>
            <button type="button" disabled={managementBusyId === scheduleToDisable.id} className="min-h-12 flex-1 rounded-xl bg-red-500 px-4 font-bold text-white disabled:cursor-wait disabled:opacity-50" onClick={() => void disableSchedule()}>{managementBusyId === scheduleToDisable.id ? '停用中…' : '確認停用'}</button>
          </div>
        </ModalShell>
      )}
    </>
  );
}
