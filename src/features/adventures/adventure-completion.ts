import type {
  AdventureCompletionInput,
  AdventureType,
  CompletionReportMode,
  QuickAdventureReport,
} from './types';

const QUICK_REPORTS: readonly QuickAdventureReport[] = ['smooth', 'hard', 'help'];

export function normalizeCompletionReportMode(
  adventureType: AdventureType,
  mode?: CompletionReportMode | null,
): CompletionReportMode {
  if (adventureType === 'daily') return 'none';
  return mode === 'reflection' ? 'reflection' : 'quick';
}

export function getCompletionValidationError(
  adventureType: AdventureType,
  mode: CompletionReportMode,
  input: Partial<AdventureCompletionInput>,
): string | null {
  const normalizedMode = normalizeCompletionReportMode(adventureType, mode);
  if (normalizedMode === 'none') return null;

  if (normalizedMode === 'quick') {
    return input.quickReport && QUICK_REPORTS.includes(input.quickReport)
      ? null
      : '請選擇這次冒險的感受。';
  }

  if (!input.mood) return '請選擇現在的心情。';
  if (!input.difficulty) return '請選擇這次冒險的難度。';
  return input.reflection?.trim() ? null : '請寫下想告訴爸媽的心得。';
}

export function createAdventureIdempotencyKey(_taskId: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export function getQuickReportLabel(report: QuickAdventureReport): string {
  switch (report) {
    case 'smooth':
      return '很順利';
    case 'hard':
      return '有點難';
    case 'help':
      return '我需要幫忙';
  }
}
