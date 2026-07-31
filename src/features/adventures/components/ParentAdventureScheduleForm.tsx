import { useMemo, useState, type FormEvent } from 'react';
import { TaipeiTimeInput } from '../../../components/TaipeiTimeInput';

export interface AdventureChildOption {
  id: string;
  name: string;
}

export interface ParentAdventureScheduleInput {
  name: string;
  description: string;
  childIds: string[];
  weekdays: number[];
  startTime: string;
  endTime: string;
  requiresTimer: boolean;
  durationMinutes: number | null;
  requiresReview: boolean;
  points: number;
  editScope?: ScheduleEditScope;
}

export type ScheduleEditScope = 'today_unfinished' | 'from_tomorrow' | 'today_and_future';

interface ParentAdventureScheduleFormProps {
  children: AdventureChildOption[];
  initialValue?: ParentAdventureScheduleInput;
  mode?: 'create' | 'edit';
  submitting?: boolean;
  onCancel?: () => void;
  onSubmit: (input: ParentAdventureScheduleInput) => Promise<void> | void;
}

const WEEKDAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 7, label: '日' },
] as const;

const fieldClass = 'min-h-12 w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900 outline-none focus:ring-2 focus:ring-blue-400';

export function validateAdventureSchedule(input: ParentAdventureScheduleInput): string | null {
  if (!input.name.trim()) return '請輸入冒險名稱。';
  if (input.childIds.length === 0) return '請至少選擇一位小孩。';
  if (input.weekdays.length === 0) return '請至少選擇一個重複日期。';
  if (input.startTime && input.endTime && input.endTime <= input.startTime) return '結束時間必須晚於開始時間。';
  if (input.requiresTimer && (!Number.isInteger(input.durationMinutes) || Number(input.durationMinutes) < 1)) return '請輸入至少 1 分鐘的計時分鐘。';
  if (!Number.isInteger(input.points) || input.points < 0) return '完成點數必須是 0 以上的整數。';
  return null;
}

export function ParentAdventureScheduleForm({
  children,
  initialValue,
  mode = 'create',
  submitting = false,
  onCancel,
  onSubmit,
}: ParentAdventureScheduleFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [childIds, setChildIds] = useState(() => initialValue?.childIds ?? children.map(child => child.id));
  const [weekdays, setWeekdays] = useState<number[]>(initialValue?.weekdays ?? [1, 2, 3, 4, 5, 6, 7]);
  const [startTime, setStartTime] = useState(initialValue?.startTime ?? '');
  const [endTime, setEndTime] = useState(initialValue?.endTime ?? '');
  const [requiresTimer, setRequiresTimer] = useState(initialValue?.requiresTimer ?? false);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(initialValue?.durationMinutes ?? null);
  const [requiresReview, setRequiresReview] = useState(initialValue?.requiresReview ?? true);
  const [points, setPoints] = useState(initialValue?.points ?? 5);
  const [editScope, setEditScope] = useState<ScheduleEditScope>(initialValue?.editScope ?? 'from_tomorrow');
  const [error, setError] = useState<string | null>(null);

  const input = useMemo<ParentAdventureScheduleInput>(() => ({
    name,
    description,
    childIds,
    weekdays,
    startTime,
    endTime,
    requiresTimer,
    durationMinutes,
    requiresReview,
    points,
    ...(mode === 'edit' ? { editScope } : {}),
  }), [childIds, description, durationMinutes, editScope, endTime, mode, name, points, requiresReview, requiresTimer, startTime, weekdays]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateAdventureSchedule(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    await onSubmit({ ...input, name: input.name.trim(), description: input.description.trim() });
  };

  return (
    <form className="space-y-5" onSubmit={event => void submit(event)} noValidate>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="daily-adventure-name">冒險名稱</label>
        <input data-tour="task-name" id="daily-adventure-name" className={fieldClass} value={name} onChange={event => setName(event.target.value)} placeholder="例如：刷牙" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="daily-adventure-description">任務說明</label>
        <textarea id="daily-adventure-description" rows={3} className={`${fieldClass} resize-y`} value={description} onChange={event => setDescription(event.target.value)} placeholder="例如：記得刷滿兩分鐘" />
      </div>

      <fieldset disabled={mode === 'edit'}>
        <legend className="mb-2 text-sm font-medium text-gray-700">安排給</legend>
        <div className="flex flex-wrap gap-2">
          {children.map(child => {
            const selected = childIds.includes(child.id);
            return (
              <label key={child.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${selected ? 'border-blue-400 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-700'}`}>
                <input type="checkbox" checked={selected} onChange={event => setChildIds(current => event.target.checked ? [...current, child.id] : current.filter(id => id !== child.id))} />
                <span className="font-medium">{child.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {mode === 'edit' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">套用範圍</legend>
          <p className="text-sm leading-6 text-gray-500">任何選項都不會修改過去紀錄、等待審核、已完成或要求補充的冒險。</p>
          {([
            ['today_unfinished', '只修改今天尚未完成的冒險', '只更新今天仍為 todo 的任務，不改之後的排程。'],
            ['from_tomorrow', '從明天開始修改', '保留今天，從明天建立新的排程版本。'],
            ['today_and_future', '修改今天與未來', '更新今天仍為 todo 的任務，並套用到後續排程。'],
          ] as const).map(([value, label, helper]) => (
            <label key={value} className="flex min-h-11 items-start gap-3 rounded-xl border border-gray-200 p-3">
              <input className="mt-1" type="radio" name="schedule-edit-scope" checked={editScope === value} onChange={() => setEditScope(value)} />
              <span><strong className="block text-gray-900">{label}</strong><span className="text-sm text-gray-500">{helper}</span></span>
            </label>
          ))}
          <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">若受影響的冒險正在計時或暫停中，系統會拒絕修改，請先結束計時。</p>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700">重複日期</legend>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map(day => {
            const selected = weekdays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={selected}
                className={`min-h-11 rounded-xl border font-bold ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                onClick={() => setWeekdays(current => selected ? current.filter(value => value !== day.value) : [...current, day.value])}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">開始時間</label>
          <TaipeiTimeInput value={startTime} onChange={setStartTime} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">結束時間</label>
          <TaipeiTimeInput value={endTime} onChange={setEndTime} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">計時</legend>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 p-3">
          <input type="radio" name="daily-timer" checked={!requiresTimer} onChange={() => setRequiresTimer(false)} />
          <span>不需要</span>
        </label>
        <label className="flex min-h-11 flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3">
          <input type="radio" name="daily-timer" checked={requiresTimer} onChange={() => setRequiresTimer(true)} />
          <span>需要完成</span>
          <input aria-label="計時分鐘" type="number" min="1" className="w-24 rounded-lg border border-gray-200 p-2" disabled={!requiresTimer} value={durationMinutes ?? ''} onChange={event => setDurationMinutes(event.target.value ? Number(event.target.value) : null)} />
          <span>分鐘</span>
        </label>
      </fieldset>

      <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-800">每日冒險不要求孩子填寫心得；孩子送出後是否發點，仍由家長審核設定決定。</p>

      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 p-3">
        <input type="checkbox" checked={requiresReview} onChange={event => setRequiresReview(event.target.checked)} />
        <span><strong className="block">等待這次家長確認前，先鎖住下一個冒險</strong><span className="text-sm text-gray-500">這只控制後續冒險是否暫時鎖定；每日冒險仍會進入家長確認流程。</span></span>
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="daily-adventure-points">完成點數</label>
        <input id="daily-adventure-points" type="number" min="0" className={fieldClass} value={points} onChange={event => setPoints(Number(event.target.value))} />
        <p className="mt-1 text-xs text-gray-500">可以設定為 0 點；孩子仍能完成冒險，但不會新增點數紀錄。</p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        {onCancel && <button type="button" className="min-h-12 flex-1 rounded-xl bg-gray-100 px-4 font-bold text-gray-700" onClick={onCancel}>取消</button>}
        <button type="submit" disabled={submitting || children.length === 0} className="min-h-12 flex-1 rounded-xl bg-blue-500 px-4 font-bold text-white disabled:cursor-wait disabled:opacity-50">
          {submitting ? (mode === 'edit' ? '儲存中…' : '建立中…') : (mode === 'edit' ? '儲存排程變更' : '建立排程')}
        </button>
      </div>
    </form>
  );
}
