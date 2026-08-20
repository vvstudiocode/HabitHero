import type { ParentCalendarAdventureTask } from '../../features/adventures/components/ParentAdventureCalendar';
import type { TaskCategory } from '../../features/growth/types';
import type { GroupedTask } from '../../lib/parent-task-grouping';

export function toParentCalendarTaskGroup(
  task: ParentCalendarAdventureTask,
  defaultCategory: TaskCategory,
): GroupedTask & { isDaily?: boolean } {
  return {
    id: task.id,
    name: task.name,
    points: task.points ?? 0,
    duration: task.duration ?? undefined,
    dueTime: task.dueTime,
    endTime: task.endTime,
    category: (task.category as TaskCategory | undefined) ?? defaultCategory,
    isDaily: task.isDaily ?? task.adventureType === 'daily',
    requiresReviewBeforeNextTask: task.requiresReviewBeforeNextTask,
    children: [{ childId: task.childId, childName: task.childName, taskId: task.id, taskIds: [task.id] }],
  };
}
