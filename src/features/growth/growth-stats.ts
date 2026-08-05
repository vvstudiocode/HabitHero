import type { Child, PointLedgerViewModel } from '../../types';
import { TASK_CATEGORIES } from './constants';
import type { GrowthTask, TaskCategory } from './types';
import { getTaipeiDateKey } from '../adventures/adventure-progress';

export type GrowthPeriod = 'day' | 'week' | 'month';

export interface GrowthPeriodRange {
  period: GrowthPeriod;
  startDate: string;
  endDate: string;
  throughDate: string;
}

export type GrowthDayState = 'complete' | 'in_progress' | 'not_started' | 'none' | 'future';

export interface GrowthDayProgress {
  dateKey: string;
  dayOfMonth: number;
  weekdayIndex: number;
  isFuture: boolean;
  total: number;
  completed: number;
  pending: number;
  revisionRequested: number;
  todo: number;
  state: GrowthDayState;
  tasks: GrowthTask[];
}

export interface GrowthCategoryProgress {
  category: TaskCategory;
  planned: number;
  completed: number;
  pending: number;
  revisionRequested: number;
  todo: number;
}

export interface GrowthPeriodStats {
  range: GrowthPeriodRange;
  plannedCount: number;
  completedCount: number;
  pendingCount: number;
  revisionRequestCount: number;
  todoCount: number;
  completionRate: number;
  days: GrowthDayProgress[];
  categories: Record<TaskCategory, GrowthCategoryProgress>;
}

export interface ChildGrowthSummary {
  childId: string;
  childName: string;
  totalGoals: number;
  childProposedGoals: number;
  completedGoals: number;
  pendingReviews: number;
  revisionRequests: number;
  feedbackCount: number;
  correctionCount: number;
  earnedPoints: number;
  completionRate: number;
  categoryCounts: Record<TaskCategory, number>;
}

const emptyCategoryCounts = (): Record<TaskCategory, number> => {
  return TASK_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = 0;
    return acc;
  }, {} as Record<TaskCategory, number>);
};

const TRACKED_TASK_STATUSES: GrowthTask['status'][] = ['todo', 'pending', 'revision_requested', 'completed'];

function dateKeyToUtcDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? new Date(`${getTaipeiDateKey()}T00:00:00Z`) : date;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

function minDateKey(left: string, right: string) {
  return left < right ? left : right;
}

function getWeekdayIndex(dateKey: string) {
  const sundayBasedDay = dateKeyToUtcDate(dateKey).getUTCDay();
  return (sundayBasedDay + 6) % 7;
}

function getActivityDateKey(task: GrowthTask) {
  const timestamp = task.completedAt ?? task.submittedAt ?? task.reviewedAt ?? task.updatedAt ?? task.createdAt;
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? String(timestamp).slice(0, 10) : getTaipeiDateKey(date);
}

function getTaskDateKey(task: GrowthTask) {
  const scheduledDate = task.occurrenceDate ?? task.dueOn;
  if (scheduledDate) return scheduledDate.slice(0, 10);

  // A completed or submitted one-off task without a due date still belongs
  // to the day on which the child acted. An unfinished unscheduled task does
  // not create a fake denominator for a period.
  if (task.status === 'completed' || task.status === 'pending' || task.status === 'revision_requested') {
    return getActivityDateKey(task);
  }
  return null;
}

function getTaskCategory(task: GrowthTask): TaskCategory {
  return TASK_CATEGORIES.some((category) => category.id === task.category)
    ? task.category as TaskCategory
    : 'life_habit';
}

function createEmptyCategoryProgress(): Record<TaskCategory, GrowthCategoryProgress> {
  return TASK_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = {
      category: category.id,
      planned: 0,
      completed: 0,
      pending: 0,
      revisionRequested: 0,
      todo: 0,
    };
    return acc;
  }, {} as Record<TaskCategory, GrowthCategoryProgress>);
}

export const getGrowthPeriodRange = (period: GrowthPeriod, today = getTaipeiDateKey()): GrowthPeriodRange => {
  const todayDate = dateKeyToUtcDate(today);
  let startDate = today;
  let endDate = today;

  if (period === 'week') {
    const mondayOffset = (todayDate.getUTCDay() + 6) % 7;
    startDate = addDays(today, -mondayOffset);
    endDate = addDays(startDate, 6);
  } else if (period === 'month') {
    startDate = `${today.slice(0, 7)}-01`;
    const firstOfNextMonth = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    firstOfNextMonth.setUTCMonth(firstOfNextMonth.getUTCMonth() + 1);
    endDate = addDays(formatDateKey(firstOfNextMonth), -1);
  }

  return {
    period,
    startDate,
    endDate,
    throughDate: minDateKey(endDate, today),
  };
};

function getDayState(day: Pick<GrowthDayProgress, 'total' | 'completed' | 'pending' | 'revisionRequested' | 'todo' | 'isFuture'>): GrowthDayState {
  if (day.isFuture && day.total > 0) return 'future';
  if (day.total === 0) return 'none';
  if (day.completed === day.total) return 'complete';
  if (day.completed === 0 && day.pending === 0 && day.revisionRequested === 0) return 'not_started';
  return 'in_progress';
}

export const getGrowthPeriodStats = (
  tasks: GrowthTask[],
  period: GrowthPeriod,
  today = getTaipeiDateKey(),
): GrowthPeriodStats => {
  const range = getGrowthPeriodRange(period, today);
  const dayMap = new Map<string, GrowthDayProgress>();
  const categories = createEmptyCategoryProgress();

  for (let dateKey = range.startDate; dateKey <= range.endDate; dateKey = addDays(dateKey, 1)) {
    const dayOfMonth = Number(dateKey.slice(8, 10));
    dayMap.set(dateKey, {
      dateKey,
      dayOfMonth,
      weekdayIndex: getWeekdayIndex(dateKey),
      isFuture: dateKey > range.throughDate,
      total: 0,
      completed: 0,
      pending: 0,
      revisionRequested: 0,
      todo: 0,
      state: 'none',
      tasks: [],
    });
  }

  for (const task of tasks) {
    if (!TRACKED_TASK_STATUSES.includes(task.status)) continue;
    const dateKey = getTaskDateKey(task);
    if (!dateKey || dateKey < range.startDate || dateKey > range.endDate) continue;

    const day = dayMap.get(dateKey);
    if (!day) continue;
    day.total += 1;
    day.tasks.push(task);
    const category = day.isFuture ? null : categories[getTaskCategory(task)];
    if (category) category.planned += 1;

    if (task.status === 'completed') {
      day.completed += 1;
      if (category) category.completed += 1;
    } else if (task.status === 'pending') {
      day.pending += 1;
      if (category) category.pending += 1;
    } else if (task.status === 'revision_requested') {
      day.revisionRequested += 1;
      if (category) category.revisionRequested += 1;
    } else {
      day.todo += 1;
      if (category) category.todo += 1;
    }
  }

  const days = [...dayMap.values()].map((day) => ({ ...day, state: getDayState(day) }));
  const completedDays = days.filter((day) => !day.isFuture);
  const plannedCount = completedDays.reduce((sum, day) => sum + day.total, 0);
  const completedCount = completedDays.reduce((sum, day) => sum + day.completed, 0);
  const pendingCount = completedDays.reduce((sum, day) => sum + day.pending, 0);
  const revisionRequestCount = completedDays.reduce((sum, day) => sum + day.revisionRequested, 0);
  const todoCount = completedDays.reduce((sum, day) => sum + day.todo, 0);

  return {
    range,
    plannedCount,
    completedCount,
    pendingCount,
    revisionRequestCount,
    todoCount,
    completionRate: plannedCount === 0 ? 0 : Math.round((completedCount / plannedCount) * 100),
    days,
    categories,
  };
};

export const getCategoryDistribution = (tasks: GrowthTask[]) => {
  const counts = emptyCategoryCounts();
  tasks.forEach((task) => {
    const category = TASK_CATEGORIES.some((item) => item.id === task.category) ? task.category as TaskCategory : 'life_habit';
    counts[category] += 1;
  });
  return counts;
};

export const getChildGrowthSummary = (child: Child, ledger: PointLedgerViewModel[] = []): ChildGrowthSummary => {
  const tasks = child.tasks as GrowthTask[];
  const growthTasks = tasks.filter((task) => TRACKED_TASK_STATUSES.includes(task.status));
  const completedGoals = growthTasks.filter((task) => task.status === 'completed').length;

  return {
    childId: child.id,
    childName: child.name,
    totalGoals: growthTasks.length,
    childProposedGoals: growthTasks.filter((task) => task.origin === 'child_proposed').length,
    completedGoals,
    pendingReviews: growthTasks.filter((task) => task.status === 'pending').length,
    revisionRequests: growthTasks.filter((task) => task.status === 'revision_requested').length,
    feedbackCount: growthTasks.filter((task) => Boolean(task.parentFeedback ?? task.parentFeedbackText)).length,
    correctionCount: growthTasks.filter((task) => Boolean(task.parentCorrection ?? task.parentCorrectionText ?? task.revisionNote)).length,
    earnedPoints: ledger
      .filter((entry) => entry.childProfileId === child.id && entry.entryType === 'task_approved')
      .reduce((sum, entry) => sum + Math.max(0, entry.pointsDelta), 0),
    completionRate: growthTasks.length === 0 ? 0 : Math.round((completedGoals / growthTasks.length) * 100),
    categoryCounts: getCategoryDistribution(growthTasks),
  };
};

export const buildGrowthStats = (children: Child[], ledger: PointLedgerViewModel[] = []) => {
  return children.map((child) => getChildGrowthSummary(child, ledger));
};
