export function haveSameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function formatTaskTime(dueTime?: string | null) {
  return dueTime ? dueTime.slice(0, 5) : '全天';
}

export function formatTaskWindow(task: { dueTime?: string | null; endTime?: string | null }) {
  const start = task.dueTime?.slice(0, 5) ?? '隨時';
  return task.endTime ? `${start}–${task.endTime.slice(0, 5)}` : `${start}起`;
}
