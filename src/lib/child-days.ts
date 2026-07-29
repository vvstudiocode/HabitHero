const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const taipeiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TAIPEI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type Timestamp = string | Date;

function toDate(value: Timestamp): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  // A date-only value represents midnight in Taipei, rather than UTC midnight.
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)
    ? `${trimmedValue}T00:00:00+08:00`
    : trimmedValue;
  const timestamp = new Date(normalizedValue);
  return Number.isFinite(timestamp.getTime()) ? timestamp : null;
}

function taipeiCalendarDay(value: Date): number | null {
  const parts = taipeiDateFormatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  if (![year, month, day].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day);
}

/**
 * Returns a child's elapsed Taipei calendar days, counting the creation day as 1.
 * Invalid or future timestamps return null so callers cannot display a fabricated day count.
 */
export function getChildDays(createdAt: Timestamp | null | undefined, now: Timestamp = new Date()): number | null {
  if (createdAt === null || createdAt === undefined) return null;

  const createdDate = toDate(createdAt);
  const currentDate = toDate(now);
  if (!createdDate || !currentDate || createdDate.getTime() > currentDate.getTime()) return null;

  const createdCalendarDay = taipeiCalendarDay(createdDate);
  const currentCalendarDay = taipeiCalendarDay(currentDate);
  if (createdCalendarDay === null || currentCalendarDay === null) return null;

  return Math.floor((currentCalendarDay - createdCalendarDay) / MILLISECONDS_PER_DAY) + 1;
}
