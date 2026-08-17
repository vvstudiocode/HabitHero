import type { GrowthTaskWithChild } from '../features/growth/types';
import type { TaskCategory } from '../types';

export type GroupedTask = {
  id: string;
  name: string;
  points: number;
  duration?: number;
  dueTime?: string | null;
  endTime?: string | null;
  requiresReviewBeforeNextTask?: boolean;
  category?: TaskCategory;
  isDaily?: boolean;
  children: {
    childId: string;
    childName: string;
    taskId: string;
    taskIds: string[];
  }[];
};

export function groupParentTodoTasks(
  tasks: readonly GrowthTaskWithChild[],
  defaultCategory: TaskCategory,
): GroupedTask[] {
  const groups = new Map<string, GroupedTask>();

  tasks.forEach(task => {
    const key = `${task.name}-${task.points}-${task.duration || ''}-${task.dueTime || ''}-${task.endTime || ''}-${task.category || defaultCategory}-${task.isDaily ? 'daily' : 'once'}-${task.requiresReviewBeforeNextTask ? 'review-gated' : 'free'}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        id: key,
        name: task.name,
        points: task.points,
        duration: task.duration,
        dueTime: task.dueTime,
        endTime: task.endTime,
        category: task.category,
        isDaily: task.isDaily,
        requiresReviewBeforeNextTask: task.requiresReviewBeforeNextTask,
        children: [{
          childId: task.childId,
          childName: task.childName,
          taskId: task.id,
          taskIds: [task.id],
        }],
      });
      return;
    }

    const existingChild = group.children.find(child => child.childId === task.childId);
    if (existingChild) {
      existingChild.taskIds.push(task.id);
      return;
    }

    group.children.push({
      childId: task.childId,
      childName: task.childName,
      taskId: task.id,
      taskIds: [task.id],
    });
  });

  return [...groups.values()];
}
