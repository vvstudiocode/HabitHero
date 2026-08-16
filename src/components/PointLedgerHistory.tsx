import { ChevronLeft, ChevronRight, History, MinusCircle, PlusCircle, Star } from 'lucide-react';
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
  pageSize?: number;
  title?: string;
  className?: string;
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
  pageSize = DEFAULT_POINT_LEDGER_PAGE_SIZE,
  title = '點數明細',
  className = '',
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

  return (
    <section className={`space-y-3 ${className}`.trim()} aria-labelledby={`point-ledger-title-${childProfileId}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`point-ledger-title-${childProfileId}`} className="flex min-w-0 items-center gap-2 text-lg font-black text-gray-900">
          <History size={19} className="shrink-0 text-amber-500" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </h3>
        {result && result.total > 0 && <span className="shrink-0 text-xs font-bold text-gray-500">共 {result.total} 筆</span>}
      </div>
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
              return (
                <article key={entry.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
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
                </article>
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
    </section>
  );
}
