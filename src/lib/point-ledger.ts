import type { PointLedgerPage } from '../types';

export const DEFAULT_POINT_LEDGER_PAGE_SIZE = 10;
export const MAX_POINT_LEDGER_PAGE_SIZE = 50;
export const MAX_POINT_LEDGER_ADJUSTMENT = 10_000;
export const MAX_POINT_LEDGER_NOTE_LENGTH = 200;

export interface PointLedgerPagination {
  page: number;
  pageSize: number;
  from: number;
  to: number;
}

export function normalizePointLedgerPagination(
  page = 1,
  pageSize = DEFAULT_POINT_LEDGER_PAGE_SIZE,
): PointLedgerPagination {
  const safePage = Number.isInteger(page) ? Math.max(1, page) : 1;
  const safePageSize = Number.isInteger(pageSize)
    ? Math.min(MAX_POINT_LEDGER_PAGE_SIZE, Math.max(1, pageSize))
    : DEFAULT_POINT_LEDGER_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;
  return {
    page: safePage,
    pageSize: safePageSize,
    from,
    to: from + safePageSize - 1,
  };
}

export function getPointLedgerPageCount(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.ceil(total / normalizePointLedgerPagination(1, pageSize).pageSize);
}

export function getPointLedgerPageNumbers(
  page: number,
  totalPages: number,
  maxVisible = 5,
): number[] {
  if (totalPages <= 0) return [];
  if (totalPages <= maxVisible) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const currentPage = Math.min(totalPages, Math.max(1, page));
  const nearby = new Set<number>([1, totalPages]);
  const windowSize = Math.max(3, maxVisible);
  const edgePageCount = Math.max(2, Math.floor(windowSize / 2));
  const windowStart = currentPage <= edgePageCount + 1
    ? 2
    : currentPage >= totalPages - edgePageCount
      ? totalPages - edgePageCount
      : currentPage - 2;
  const windowEnd = currentPage <= edgePageCount + 1
    ? edgePageCount + 3
    : currentPage >= totalPages - edgePageCount
      ? totalPages - 1
      : currentPage + 1;
  for (let value = windowStart; value <= windowEnd; value += 1) {
    if (value > 1 && value < totalPages) nearby.add(value);
  }
  return [...nearby].sort((left, right) => left - right);
}

export function createPointLedgerPage(
  entries: PointLedgerPage['entries'],
  total: number,
  pagination: PointLedgerPagination,
): PointLedgerPage {
  const totalPages = getPointLedgerPageCount(total, pagination.pageSize);
  return {
    entries,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages,
    hasPreviousPage: pagination.page > 1 && totalPages > 0,
    hasNextPage: totalPages > pagination.page,
  };
}

export type PointLedgerValidation =
  | { ok: true; note: string }
  | { ok: false; message: string };

export function validatePointLedgerAdjustment(delta: number, note: string): PointLedgerValidation {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_POINT_LEDGER_ADJUSTMENT) {
    return { ok: false, message: `點數必須是 1～${MAX_POINT_LEDGER_ADJUSTMENT} 的整數。` };
  }
  const normalizedNote = note.trim();
  if (normalizedNote.length === 0) {
    return { ok: false, message: '請填寫點數調整原因。' };
  }
  if (normalizedNote.length > MAX_POINT_LEDGER_NOTE_LENGTH) {
    return { ok: false, message: `原因最多 ${MAX_POINT_LEDGER_NOTE_LENGTH} 字。` };
  }
  return { ok: true, note: normalizedNote };
}
