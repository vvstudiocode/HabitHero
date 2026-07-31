import { useMemo, useState, type FormEvent } from 'react';
import { TaipeiTimeInput } from '../../../components/TaipeiTimeInput';
import type { AdventureChildOption } from './ParentAdventureScheduleForm';

export type GeneralAdventureReportMode = 'quick' | 'reflection';

export interface ParentGeneralAdventureInput {
  name: string;
  description: string;
  childIds: string[];
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
  generalTitle: string;
  submitting?: boolean;
  onCancel?: () => void;
  onUpdateTitle?: (title: string) => Promise<void> | void;
  onSubmit: (input: ParentGeneralAdventureInput) => Promise<void> | void;
}

const fieldClass = 'min-h-12 w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900 outline-none focus:ring-2 focus:ring-blue-400';

export function validateGeneralAdventureTitle(value: string): string | null {
  const title = value.trim();
  if (!title) return '請輸入一般冒險名稱。';
  if (title === '每日冒險') return '一般冒險不能命名為「每日冒險」。';
  if ([...title].length > 12) return '一般冒險名稱最多 12 個字。';
  if (!/[\p{L}\p{N}]/u.test(title)) return '一般冒險名稱必須包含文字或數字。';
  return null;
}

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
  generalTitle,
  submitting = false,
  onCancel,
  onUpdateTitle,
  onSubmit,
}: ParentGeneralAdventureFormProps) {
  const [titleDraft, setTitleDraft] = useState(generalTitle);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [childIds, setChildIds] = useState(() => children.map(child => child.id));
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
    dueOn,
    startTime,
    endTime,
    reportMode,
    requiresTimer,
    durationMinutes,
    points,
  }), [childIds, description, dueOn, durationMinutes, endTime, name, points, reportMode, requiresTimer, startTime]);

  const saveTitle = async () => {
    const validationError = validateGeneralAdventureTitle(titleDraft);
    if (validationError) {
      setTitleError(validationError);
      return;
    }
    setTitleError(null);
    await onUpdateTitle?.(titleDraft.trim());
  };

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
      <section aria-labelledby="general-adventure-title-heading" className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <h3 id="general-adventure-title-heading" className="font-bold text-gray-900">孩子看到的卡片名稱</h3>
        <p className="mt-1 text-sm leading-5 text-gray-500">改名只影響顯示，不會重設任務或歷史紀錄。</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input aria-label="一般冒險卡片名稱" className={fieldClass} value={titleDraft} maxLength={12} onChange={event => setTitleDraft(event.target.value)} />
          <button type="button" disabled={submitting} className="min-h-12 shrink-0 rounded-xl bg-gray-900 px-5 font-bold text-white disabled:cursor-wait disabled:opacity-50" onClick={() => void saveTitle()}>
            {submitting ? '儲存中…' : '儲存名稱'}
          </button>
        </div>
        {titleError && <p role="alert" className="mt-2 text-sm text-red-700">{titleError}</p>}
      </section>

      <form className="space-y-5" onSubmit={event => void submit(event)} noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="general-adventure-name">冒險名稱</label>
          <input id="general-adventure-name" className={fieldClass} value={name} onChange={event => setName(event.target.value)} placeholder="例如：完成英文作業" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="general-adventure-description">任務說明</label>
          <textarea id="general-adventure-description" rows={3} className={`${fieldClass} resize-y`} value={description} onChange={event => setDescription(event.target.value)} placeholder="例如：完成第 18～20 頁" />
        </div>

        <fieldset>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">結束時間</label>
            <TaipeiTimeInput value={endTime} onChange={setEndTime} />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">完成回報</legend>
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-gray-200 p-3">
            <input className="mt-1" type="radio" name="general-report" value="quick" checked={reportMode === 'quick'} onChange={() => setReportMode('quick')} />
            <span><strong className="block">簡單回報</strong><span className="text-sm text-gray-500">孩子選擇很順利、有點難或需要幫忙。</span></span>
          </label>
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-gray-200 p-3">
            <input className="mt-1" type="radio" name="general-report" value="reflection" checked={reportMode === 'reflection'} onChange={() => setReportMode('reflection')} />
            <span><strong className="block">完整文字心得</strong><span className="text-sm text-gray-500">孩子需選擇感受並填寫非空白心得。</span></span>
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">計時</legend>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 p-3">
            <input type="radio" name="general-timer" checked={!requiresTimer} onChange={() => setRequiresTimer(false)} />
            <span>不需要</span>
          </label>
          <label className="flex min-h-11 flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3">
            <input type="radio" name="general-timer" checked={requiresTimer} onChange={() => setRequiresTimer(true)} />
            <span>需要完成</span>
            <input aria-label="計時分鐘" type="number" min="1" className="w-24 rounded-lg border border-gray-200 p-2" disabled={!requiresTimer} value={durationMinutes ?? ''} onChange={event => setDurationMinutes(event.target.value ? Number(event.target.value) : null)} />
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
          <button type="submit" disabled={submitting || children.length === 0} className="min-h-12 flex-1 rounded-xl bg-blue-500 px-4 font-bold text-white disabled:cursor-wait disabled:opacity-50">
            {submitting ? '新增中…' : '新增冒險'}
          </button>
        </div>
      </form>
    </div>
  );
}
