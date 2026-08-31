import { useMemo, useState, type FormEvent } from 'react';
import { TaipeiTimeInput } from '../../../components/TaipeiTimeInput';
import { DEFAULT_TASK_CATEGORY, TASK_CATEGORIES } from '../../growth/constants';
import type { TaskCategory } from '../../growth/types';
import type { AdventureChildOption } from './ParentAdventureScheduleForm';

export type GeneralAdventureReportMode = 'quick' | 'reflection';

export interface ParentGeneralAdventureInput {
  name: string;
  description: string;
  childIds: string[];
  category: TaskCategory;
  dueOn: string;
  startTime: string;
  endTime: string;
  reportMode: GeneralAdventureReportMode;
  requiresTimer: boolean;
  durationMinutes: number | null;
  points: number;
}

interface ParentGeneralAdventureFormProps {
  children: AdventureChildOption[];
  submitting?: boolean;
  onCancel?: () => void;
  onSubmit: (input: ParentGeneralAdventureInput) => Promise<void> | void;
}

const fieldClass = 'hh-adventure-field min-h-12 w-full rounded-xl border p-3 outline-none';

export function validateGeneralAdventure(input: ParentGeneralAdventureInput): string | null {
  if (!input.name.trim()) return '請輸入冒險名稱。';
  if (input.childIds.length === 0) return '請至少選擇一位小孩。';
  if (!input.dueOn) return '請選擇冒險日期。';
  if (!['quick', 'reflection'].includes(input.reportMode)) return '一般冒險至少需要一種完成回報。';
  if (input.startTime && input.endTime && input.endTime <= input.startTime) return '結束時間必須晚於開始時間。';
  if (input.requiresTimer && (!Number.isInteger(input.durationMinutes) || Number(input.durationMinutes) < 1)) return '請輸入至少 1 分鐘的計時分鐘。';
  if (!Number.isInteger(input.points) || input.points < 0) return '完成點數必須是 0 以上的整數。';
  return null;
}

const todayInTaipei = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

export function ParentGeneralAdventureForm({
  children,
  submitting = false,
  onCancel,
  onSubmit,
}: ParentGeneralAdventureFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [childIds, setChildIds] = useState(() => children.map(child => child.id));
  const [category, setCategory] = useState<TaskCategory>(DEFAULT_TASK_CATEGORY);
  const [dueOn, setDueOn] = useState(todayInTaipei);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reportMode, setReportMode] = useState<GeneralAdventureReportMode>('quick');
  const [requiresTimer, setRequiresTimer] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [points, setPoints] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const input = useMemo<ParentGeneralAdventureInput>(() => ({
    name,
    description,
    childIds,
    category,
    dueOn,
    startTime,
    endTime,
    reportMode,
    requiresTimer,
    durationMinutes,
    points,
  }), [category, childIds, description, dueOn, durationMinutes, endTime, name, points, reportMode, requiresTimer, startTime]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateGeneralAdventure(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    await onSubmit({ ...input, name: input.name.trim(), description: input.description.trim() });
  };

  return (
    <div className="space-y-6">
      <form className="space-y-5" onSubmit={event => void submit(event)} noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="general-adventure-name">冒險名稱</label>
          <input id="general-adventure-name" className={fieldClass} value={name} onChange={event => setName(event.target.value)} placeholder="例如：完成英文作業" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="general-adventure-description">任務說明</label>
          <textarea id="general-adventure-description" rows={3} className={`${fieldClass} resize-y`} value={description} onChange={event => setDescription(event.target.value)} placeholder="例如：完成第 18～20 頁" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="general-adventure-category">固定分類</label>
          <select id="general-adventure-category" className={fieldClass} value={category} onChange={event => setCategory(event.target.value as TaskCategory)}>
            {TASK_CATEGORIES.map(categoryOption => (
              <option key={categoryOption.id} value={categoryOption.id}>{categoryOption.label}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">安排給</legend>
          <div className="flex flex-wrap gap-2">
            {children.map(child => {
              const selected = childIds.includes(child.id);
              return (
                <label key={child.id} className={`hh-adventure-child-choice${selected ? ' is-selected' : ''} flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2`}>
                  <input className="hh-adventure-control" type="checkbox" checked={selected} onChange={event => setChildIds(current => event.target.checked ? [...current, child.id] : current.filter(id => id !== child.id))} />
                  <span className="font-medium">{child.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="general-adventure-date">日期</label>
          <input id="general-adventure-date" type="date" className={fieldClass} value={dueOn} onChange={event => setDueOn(event.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">開始時間</label>
            <TaipeiTimeInput value={startTime} onChange={setStartTime} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">最晚開始時間</label>
            <TaipeiTimeInput value={endTime} onChange={setEndTime} />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">完成回報</legend>
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-gray-200 p-3">
            <input className="hh-adventure-control mt-1" type="radio" name="general-report" value="quick" checked={reportMode === 'quick'} onChange={() => setReportMode('quick')} />
            <span><strong className="block">簡單回報</strong><span className="text-sm text-gray-500">孩子選擇很順利、有點難或需要幫忙。</span></span>
          </label>
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-gray-200 p-3">
            <input className="hh-adventure-control mt-1" type="radio" name="general-report" value="reflection" checked={reportMode === 'reflection'} onChange={() => setReportMode('reflection')} />
            <span><strong className="block">完整文字心得</strong><span className="text-sm text-gray-500">孩子需選擇感受並填寫非空白心得。</span></span>
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">計時</legend>
          <label className={`hh-adventure-timer-choice${!requiresTimer ? ' is-selected' : ''} flex min-h-14 items-center gap-3 rounded-xl px-3 py-2`}>
            <input className="hh-adventure-control" type="radio" name="general-timer" checked={!requiresTimer} onChange={() => setRequiresTimer(false)} />
            <span>不需要</span>
          </label>
          <label className={`hh-adventure-timer-choice${requiresTimer ? ' is-selected' : ''} flex min-h-14 flex-wrap items-center gap-3 rounded-xl px-3 py-2`}>
            <input className="hh-adventure-control" type="radio" name="general-timer" checked={requiresTimer} onChange={() => setRequiresTimer(true)} />
            <span>需要完成</span>
            <input aria-label="計時分鐘" type="number" min="1" className="hh-adventure-timer-minutes hh-adventure-field h-8 w-20 rounded-lg border px-2" disabled={!requiresTimer} value={durationMinutes ?? ''} onChange={event => setDurationMinutes(event.target.value ? Number(event.target.value) : null)} />
            <span>分鐘</span>
          </label>
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="general-adventure-points">完成點數</label>
          <input id="general-adventure-points" type="number" min="0" className={fieldClass} value={points} onChange={event => setPoints(Number(event.target.value))} />
          <p className="mt-1 text-xs text-gray-500">可以設定為 0 點；孩子仍能完成冒險，但不會新增點數紀錄。</p>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          {onCancel && <button type="button" className="min-h-12 flex-1 rounded-xl bg-gray-100 px-4 font-bold text-gray-700" onClick={onCancel}>取消</button>}
          <button type="submit" disabled={submitting || children.length === 0} className="hh-adventure-primary-action min-h-12 flex-1 rounded-xl px-4 font-bold disabled:cursor-wait disabled:opacity-50">
            {submitting ? '新增中…' : '新增冒險'}
          </button>
        </div>
      </form>
    </div>
  );
}
