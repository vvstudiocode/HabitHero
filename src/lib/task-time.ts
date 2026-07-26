const taipeiTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Taipei',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export type TaskExecutionState = 'available' | 'not_started' | 'expired';

function timeInTaipeiMinutes(now: Date): number {
  const parts = taipeiTimeFormatter.formatToParts(now);
  return Number(parts.find((part) => part.type === 'hour')?.value) * 60
    + Number(parts.find((part) => part.type === 'minute')?.value);
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  const minutes = hour * 60 + minute;
  return Number.isFinite(minutes) ? minutes : null;
}

export function getTaskExecutionState(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  now = new Date(),
): TaskExecutionState {
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);
  if (startMinutes === null && endMinutes === null) return 'available';

  const currentMinutes = timeInTaipeiMinutes(now);
  if (!Number.isFinite(currentMinutes)) return 'not_started';
  if (startMinutes !== null && currentMinutes < startMinutes) return 'not_started';
  if (endMinutes !== null && currentMinutes >= endMinutes) return 'expired';
  return 'available';
}

export function isTaskExecutableAt(
  startTime: string | null | undefined,
  endTime: string | null | Date = null,
  now = new Date(),
): boolean {
  const normalizedEndTime: string | null | undefined = endTime instanceof Date ? null : endTime;
  if (endTime instanceof Date) {
    now = endTime;
  }
  return getTaskExecutionState(startTime, normalizedEndTime, now) === 'available';
}
