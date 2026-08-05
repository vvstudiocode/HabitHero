import type { TaskSchedule } from '../../types';

export interface AdventureScheduleDisplayEntry {
  schedule: TaskSchedule;
  childName: string;
}

export interface AdventureScheduleDisplayGroup {
  name: string;
  entries: AdventureScheduleDisplayEntry[];
}

const weekdayLabels: Record<number, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '日',
};

export const groupActiveAdventureSchedules = (
  schedules: readonly TaskSchedule[],
  children: readonly { id: string; name: string }[],
): AdventureScheduleDisplayGroup[] => {
  const childNames = new Map(children.map(child => [child.id, child.name]));
  const groups = new Map<string, AdventureScheduleDisplayGroup>();

  schedules.forEach(schedule => {
    if (!schedule.isActive) return;

    const name = schedule.name.trim();
    const group = groups.get(name) ?? { name, entries: [] };
    group.entries.push({
      schedule,
      childName: childNames.get(schedule.childProfileId) ?? '未指定孩子',
    });
    groups.set(name, group);
  });

  return [...groups.values()];
};

export const formatScheduleWeekdays = (weekdays: readonly number[]): string => {
  const uniqueWeekdays = [...new Set(weekdays)]
    .filter(day => weekdayLabels[day] !== undefined)
    .sort((a, b) => a - b);

  if (uniqueWeekdays.length === 7) return '每天';
  if (uniqueWeekdays.length === 0) return '尚未設定日期';
  return `每週${uniqueWeekdays.map(day => weekdayLabels[day]).join('、')}`;
};

const formatShortDate = (date: string): string => {
  const [, month, day] = date.split('-');
  if (!month || !day) return date;
  return `${Number(month)}/${Number(day)}`;
};

const formatScheduleTimeWindow = (startTime: string | null, endTime: string | null): string => {
  const start = startTime?.slice(0, 5);
  const end = endTime?.slice(0, 5);
  if (start && end) return `${start}–${end}`;
  if (start) return `${start} 起`;
  if (end) return `最晚 ${end}`;
  return '全天';
};

type ScheduleDetailFields = Pick<TaskSchedule, 'weekdays' | 'points' | 'startTime' | 'endTime' | 'requiresTimer' | 'durationMinutes' | 'activeUntil' | 'activeFrom'>;

export const formatScheduleCardDetails = (schedule: ScheduleDetailFields): string[] => {
  const details = [
    `時間 ${formatScheduleTimeWindow(schedule.startTime, schedule.endTime)}`,
    `點數 ${schedule.points} 點`,
  ];

  if (schedule.requiresTimer) {
    details.push(schedule.durationMinutes ? `計時 ${schedule.durationMinutes} 分鐘` : '需要計時');
  } else {
    details.push('不計時');
  }
  if (schedule.activeUntil) {
    details.push(`有效期 ${formatShortDate(schedule.activeFrom)}–${formatShortDate(schedule.activeUntil)}`);
  }

  return details;
};

export const getSharedScheduleDetails = (schedules: readonly ScheduleDetailFields[]): string[] | null => {
  if (schedules.length === 0) return [];
  const firstDetails = formatScheduleCardDetails(schedules[0]);
  const firstDetailsKey = firstDetails.join('\u0000');
  return schedules.every(schedule => formatScheduleCardDetails(schedule).join('\u0000') === firstDetailsKey)
    ? firstDetails
    : null;
};

export const formatScheduleDetails = (schedule: ScheduleDetailFields): string[] => [
  formatScheduleWeekdays(schedule.weekdays),
  ...formatScheduleCardDetails(schedule),
];
