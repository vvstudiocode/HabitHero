import type { Child, PointLedgerViewModel } from '../../types';
import { TASK_CATEGORIES } from './constants';
import type { GrowthTask, TaskCategory } from './types';

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
  const growthTasks = tasks.filter((task) => ['proposed', 'proposal_revision_requested', 'todo', 'pending', 'revision_requested', 'completed'].includes(task.status));
  const completedGoals = growthTasks.filter((task) => task.status === 'completed').length;
  const reviewedTasks = growthTasks.filter((task) => task.status === 'completed' || task.status === 'revision_requested').length;

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
    completionRate: reviewedTasks === 0 ? 0 : Math.round((completedGoals / reviewedTasks) * 100),
    categoryCounts: getCategoryDistribution(growthTasks),
  };
};

export const buildGrowthStats = (children: Child[], ledger: PointLedgerViewModel[] = []) => {
  return children.map((child) => getChildGrowthSummary(child, ledger));
};
