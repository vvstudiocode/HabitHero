import type { FeedbackTone, TaskCategory } from '../types';

export interface ProposeChildGoalInput {
  name: string;
  points: number;
  icon: string;
  category: TaskCategory;
  duration?: number | null;
  dueOn?: string | null;
  dueTime?: string | null;
  endTime?: string | null;
}

export interface ConfirmChildGoalInput {
  name: string;
  points: number;
  category: TaskCategory;
}

export interface SubmitTaskReflectionInput {
  reflection: string;
  mood?: string | null;
  difficulty?: number | null;
}

export interface ReviewTaskCompletionInput {
  approved: boolean;
  approvedPoints: number;
  feedback?: string | null;
  correction?: string | null;
  tone?: FeedbackTone | null;
  revisionNote?: string | null;
}

export const buildProposeChildGoalPayload = (
  familyId: string,
  childId: string,
  goal: ProposeChildGoalInput,
) => ({
  target_family_id: familyId,
  target_child_profile_id: childId,
  goal_name: goal.name,
  goal_points: goal.points,
  goal_icon: goal.icon,
  goal_category: goal.category,
  goal_duration_minutes: goal.duration ?? null,
  goal_due_on: goal.dueOn ?? null,
  goal_due_time: goal.dueTime ?? null,
  goal_end_time: goal.endTime ?? null,
});

export const buildConfirmChildGoalPayload = (
  taskId: string,
  confirmation: ConfirmChildGoalInput,
) => ({
  target_task_id: taskId,
  confirmed_name: confirmation.name,
  confirmed_points: confirmation.points,
  confirmed_category: confirmation.category,
});

export const buildSubmitTaskReflectionPayload = (
  taskId: string,
  submission: SubmitTaskReflectionInput,
) => ({
  target_task_id: taskId,
  reflection: submission.reflection,
  mood: submission.mood ?? null,
  difficulty: submission.difficulty ?? null,
});

export function normalizeFeedbackTone(tone?: FeedbackTone | null): FeedbackTone | null {
  if (tone === 'celebration' || tone === 'celebrating') return 'celebratory';
  if (tone === 'correction') return 'corrective';
  return tone ?? null;
}

export const buildReviewTaskCompletionPayload = (
  taskId: string,
  review: ReviewTaskCompletionInput,
) => ({
  target_task_id: taskId,
  approved: review.approved,
  approved_points: review.approvedPoints,
  feedback: review.feedback ?? null,
  correction: review.correction ?? null,
  tone: normalizeFeedbackTone(review.tone),
  revision_note: review.revisionNote ?? null,
});
