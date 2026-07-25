const taipeiTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Taipei',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function isTaskExecutableAt(dueTime: string | null | undefined, now = new Date()): boolean {
  if (!dueTime) return true;

  const parts = taipeiTimeFormatter.formatToParts(now);
  const currentMinutes = Number(parts.find((part) => part.type === 'hour')?.value) * 60
    + Number(parts.find((part) => part.type === 'minute')?.value);
  const [dueHour, dueMinute] = dueTime.slice(0, 5).split(':').map(Number);
  const dueMinutes = dueHour * 60 + dueMinute;

  return Number.isFinite(currentMinutes) && Number.isFinite(dueMinutes) && currentMinutes >= dueMinutes;
}
