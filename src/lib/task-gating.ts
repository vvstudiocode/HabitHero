type ReviewGatedTask = { id: string };

export function hasBlockingReviewTask(_tasks: ReviewGatedTask[]): boolean {
  return false;
}

export function canStartTask(_tasks: ReviewGatedTask[], _taskId: string): boolean {
  return true;
}
