import type { TaskStatus } from '../types';

type ReviewGatedTask = {
  id: string;
  status: TaskStatus;
  requiresReviewBeforeNextTask?: boolean;
};

const blockingStatuses: TaskStatus[] = ['pending', 'revision_requested'];

export function hasBlockingReviewTask(tasks: ReviewGatedTask[]): boolean {
  return tasks.some((task) => task.requiresReviewBeforeNextTask === true && blockingStatuses.includes(task.status));
}

export function canStartTask(tasks: ReviewGatedTask[], taskId: string): boolean {
  return !hasBlockingReviewTask(tasks.filter((task) => task.id !== taskId));
}
