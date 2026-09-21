import { ChevronDown, ChevronLeft, ChevronRight, History, MinusCircle, PlusCircle, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointLedgerEntryType, PointLedgerPage, PointLedgerViewModel } from '../types';
import {
  DEFAULT_POINT_LEDGER_PAGE_SIZE,
  getPointLedgerPageNumbers,
} from '../lib/point-ledger';
import { PointValue } from './shared/PointValue';

interface PointLedgerHistoryProps {
  childProfileId: string;
  childName: string;
  loadPage: (childId: string, page: number, pageSize?: number) => Promise<PointLedgerPage>;
  getTaskName?: (taskId: string) => string | null;
  getTaskDetails?: (taskId: string) => PointLedgerTaskDetails | null;
  pageSize?: number;
  title?: string;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

interface PointLedgerTaskDetails {
  name: string;
  description?: string | null;
  reflection?: string | null;
  parentFeedback?: string | null;
  parentCorrection?: string | null;
}

function getEntryLabel(entry: PointLedgerViewModel): string {
  if (entry.entryType === 'task_approved') return '完成任務';
  if (entry.entryType === 'reward_redemption') return '兌換獎勵';
  return entry.pointsDelta > 0 ? '家長贈點' : '家長扣點';
}

export function getEntryDescription(
  entry: PointLedgerViewModel,
  getTaskName?: (taskId: string) => string | null,
): string | null {
  if (entry.entryType !== 'task_approved') return entry.note;
  const taskName = entry.taskId ? getTaskName?.(entry.taskId)?.trim() : null;
  return taskName || '任務已完成';
}

function getEntryIcon(entryType: PointLedgerEntryType, pointsDelta: number) {
  if (entryType === 'task_approved') return <Star size={18} aria-hidden="true" />;
  return pointsDelta > 0
    ? <PlusCircle size={18} aria-hidden="true" />
    : <MinusCircle size={18} aria-hidden="true" />;
}

function formatEntryDate(createdAt: number): string {
  return new Date(createdAt).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PointLedgerHistory({
  childProfileId,
  childName,
  loadPage,
  getTaskName,
  getTaskDetails,
  pageSize = DEFAULT_POINT_LEDGER_PAGE_SIZE,
  title = '點數明細',
  className = '',
  collapsible = false,
  defaultOpen = true,
}: PointLedgerHistoryProps) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PointLedgerPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  useEffect(() => {
    setPage(1);
    setResult(null);
  }, [childProfileId, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadPageRef.current(childProfileId, page, pageSize)
      .then((nextResult) => {
        if (cancelled) return;
        setResult(nextResult);
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : '點數紀錄載入失敗，請重試。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [childProfileId, page, pageSize, reloadKey]);

  const pageNumbers = useMemo(() => getPointLedgerPageNumbers(page, result?.totalPages ?? 0), [page, result?.totalPages]);

  const titleId = `point-ledger-title-${childProfileId}`;
  const header = (
    <div className="flex w-full items-center justify-between gap-3">
      <h3 id={titleId} className="flex min-w-0 items-center gap-2 text-lg font-black text-gray-900">
        <History size={19} className="shrink-0 text-amber-500" aria-hidden="true" />
        <span className="truncate">{title}</span>
      </h3>
      <span className="flex shrink-0 items-center gap-2">
        {result && result.total > 0 && <span className="text-xs font-bold text-gray-500">共 {result.total} 筆</span>}
        {collapsible && <ChevronDown size={20} className="text-gray-500" aria-hidden="true" />}
      </span>
    </div>
  );

  const content = (
    <>
      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center text-sm font-bold text-gray-500" role="status">
          點數紀錄載入中…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700" role="alert">
          {error}
          <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="ml-3 underline">重試</button>
        </div>
      )}

      {!loading && !error && result && result.entries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-bold text-gray-500">
          目前還沒有點數變動紀錄。
        </div>
      )}

      {!loading && !error && result && result.entries.length > 0 && (
        <>
          <div className="space-y-2">
            {result.entries.map((entry) => {
              const positive = entry.pointsDelta > 0;
              const description = getEntryDescription(entry, getTaskName);
              const taskDetails = entry.taskId ? getTaskDetails?.(entry.taskId) : null;
              const entryDetailsId = `point-ledger-entry-${entry.id}`;
              return (
                <details key={entry.id} className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <summary
                    aria-controls={entryDetailsId}
                    className="flex min-h-20 cursor-pointer list-none items-center gap-3 p-3 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-400 [&::-webkit-details-marker]:hidden"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${positive ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`} aria-hidden="true">
                      {getEntryIcon(entry.entryType, entry.pointsDelta)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h4 className="font-black text-gray-900">{getEntryLabel(entry)}</h4>
                        <time className="text-xs font-bold text-gray-400" dateTime={new Date(entry.createdAt).toISOString()}>{formatEntryDate(entry.createdAt)}</time>
                      </div>
                      {description && <p className="mt-1 break-words text-sm font-bold text-gray-500">{description}</p>}
                    </div>
                    <div className={`shrink-0 text-right text-base font-black ${positive ? 'text-amber-700' : 'text-rose-700'}`}>
                      <span aria-hidden="true">{positive ? '+' : ''}</span>
                      <PointValue value={Math.abs(entry.pointsDelta)} iconSize={14} />
                      <span className="sr-only">{positive ? '增加' : '扣除'} {Math.abs(entry.pointsDelta)} 點</span>
                    </div>
                    <ChevronDown size={18} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div id={entryDetailsId} className="space-y-3 border-t border-gray-100 bg-gray-50/70 px-4 py-3 text-sm" aria-label={`${taskDetails?.name ?? description ?? getEntryLabel(entry)}詳細內容`}>
                    {entry.entryType === 'task_approved' ? (
                      <>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-gray-500">任務</p>
                          <p className="mt-1 break-words font-black text-gray-900">{taskDetails?.name ?? description ?? '任務已完成'}</p>
                        </div>
                        {taskDetails?.description && (
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-gray-500">任務說明</p>
                            <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-gray-700">{taskDetails.description}</p>
                          </div>
                        )}
                        {(taskDetails?.reflection || taskDetails?.parentFeedback || taskDetails?.parentCorrection) && (
                          <div className="space-y-1 rounded-xl bg-white p-3 leading-6 text-gray-700">
                            {taskDetails.reflection && <p><strong>完成心得：</strong>{taskDetails.reflection}</p>}
                            {taskDetails.parentFeedback && <p><strong>家長回饋：</strong>{taskDetails.parentFeedback}</p>}
                            {taskDetails.parentCorrection && <p><strong>補充提醒：</strong>{taskDetails.parentCorrection}</p>}
                          </div>
                        )}
                        {!taskDetails && <p className="text-gray-500">目前找不到這筆紀錄對應的任務內容。</p>}
                      </>
                    ) : (
                      <p className="break-words text-gray-700">{description ?? '這筆紀錄沒有補充內容。'}</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>

          {result.totalPages > 0 && (
            <nav className="flex flex-wrap items-center justify-between gap-2 pt-2" aria-label={`${childName}點數紀錄頁碼`}>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!result.hasPreviousPage || loading}
                className="flex min-h-11 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} aria-hidden="true" /> 上一頁
              </button>
              <div className="flex items-center gap-1" role="list" aria-label="頁碼">
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    role="listitem"
                    aria-current={pageNumber === page ? 'page' : undefined}
                    onClick={() => setPage(pageNumber)}
                    className={`min-h-11 min-w-11 rounded-xl px-2 text-sm font-black transition-colors ${pageNumber === page ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!result.hasNextPage || loading}
                className="flex min-h-11 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一頁 <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );

  if (collapsible) {
    return (
      <details className={`space-y-3 ${className}`.trim()} defaultOpen={defaultOpen}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-2xl px-2 [&::-webkit-details-marker]:hidden">
          {header}
        </summary>
        <div className="space-y-3" aria-labelledby={titleId}>
          {content}
        </div>
      </details>
    );
  }

  return (
    <section className={`space-y-3 ${className}`.trim()} aria-labelledby={titleId}>
      {header}
      {content}
    </section>
  );
}
