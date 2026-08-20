import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { GrowthTaskWithChild } from '../../features/growth/types';
import { PointValue } from '../shared/PointValue';

const PAGE_SIZE = 20;

interface RecentApprovedTasksProps {
  tasks: GrowthTaskWithChild[];
  disabled: boolean;
  onRevoke: (task: GrowthTaskWithChild) => void;
}

export function RecentApprovedTasks({ tasks, disabled, onRevoke }: RecentApprovedTasksProps) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleTasks = tasks.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <section>
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-1 text-left"
        aria-expanded={expanded}
        aria-controls="recent-approved-tasks"
        onClick={() => setExpanded(current => !current)}
      >
        <span>
          <span className="block text-lg font-bold text-gray-900">最近已核准</span>
          <span className="text-xs font-bold text-gray-500">可撤銷一次・共 {tasks.length} 筆</span>
        </span>
        {expanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
      </button>

      {expanded && (
        <div id="recent-approved-tasks" className="mt-3 space-y-3">
          {visibleTasks.map(task => (
            <div key={task.id} className="flex items-center justify-between gap-3 rounded-2xl border border-green-100 bg-green-50 p-4">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-green-800">{task.childName}</span>
                  <span className="text-xs font-bold text-green-700">已核准</span>
                </div>
                <div className="break-words font-bold text-gray-900">{task.name}</div>
                <PointValue value={task.approvedPoints ?? task.points} className="text-sm font-black text-green-700" />
              </div>
              <button type="button" onClick={() => onRevoke(task)} disabled={disabled} className="min-h-11 shrink-0 rounded-xl border border-red-200 bg-white px-3 text-xs font-black text-red-700 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-50">
                撤銷核准
              </button>
            </div>
          ))}

          {pageCount > 1 && (
            <nav className="flex flex-wrap items-center justify-center gap-2 pt-1" aria-label="最近已核准頁數">
              <span className="w-full text-center text-xs font-bold text-gray-500">第 {safePage} / {pageCount} 頁</span>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => (
                <button
                  key={pageNumber}
                  type="button"
                  aria-label={`第 ${pageNumber} 頁`}
                  aria-current={pageNumber === safePage ? 'page' : undefined}
                  onClick={() => setPage(pageNumber)}
                  className={`min-h-11 min-w-11 rounded-xl border px-3 text-sm font-black ${pageNumber === safePage ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'}`}
                >
                  {pageNumber}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
