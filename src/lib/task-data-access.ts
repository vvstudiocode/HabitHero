import type { Task, TaskTemplate } from '../types';

export function buildCreateTaskTemplatePayload(familyId: string, template: Omit<TaskTemplate, 'id'>) {
  return {
    family_id: familyId,
    name: template.name,
    points: template.points,
    icon: template.icon,
    duration_minutes: template.duration ?? null,
    category: template.category ?? 'life_habit',
    suggested_evidence: template.suggestedEvidence ?? 'reflection',
    due_time: template.dueTime ?? null,
    end_time: template.endTime ?? null,
    requires_review_before_next_task: template.requiresReviewBeforeNextTask ?? false,
  };
}

export function buildUpdateTaskTemplatePayload(updates: Partial<TaskTemplate>) {
  return removeUndefined({
    name: updates.name,
    points: updates.points,
    icon: updates.icon,
    duration_minutes: updates.duration,
    category: updates.category,
    suggested_evidence: updates.suggestedEvidence,
    due_time: updates.dueTime,
    end_time: updates.endTime,
    requires_review_before_next_task: updates.requiresReviewBeforeNextTask,
  });
}

export function buildCreateTaskPayload(familyId: string, childId: string, task: Omit<Task, 'id' | 'status'>) {
  return {
    family_id: familyId,
    child_profile_id: childId,
    template_id: task.templateId ?? null,
    name: task.name,
    points: task.points,
    icon: task.icon,
    duration_minutes: task.duration ?? null,
    is_daily: task.isDaily ?? false,
    due_on: task.dueOn ?? null,
    due_time: task.dueTime ?? null,
    end_time: task.endTime ?? null,
    requires_review_before_next_task: task.requiresReviewBeforeNextTask ?? false,
    category: task.category ?? 'life_habit',
    origin: task.origin ?? 'parent_assigned',
  };
}

export function buildUpdateTaskPayload(updates: Partial<Task>) {
  return removeUndefined({
    name: updates.name,
    points: updates.points,
    status: updates.status,
    icon: updates.icon,
    duration_minutes: updates.duration,
    is_daily: updates.isDaily,
    due_on: updates.dueOn,
    due_time: updates.dueTime,
    end_time: updates.endTime,
    requires_review_before_next_task: updates.requiresReviewBeforeNextTask,
    category: updates.category,
    origin: updates.origin,
    approved_points: updates.approvedPoints,
    child_reflection_text: updates.reflection,
    child_mood: updates.mood,
    child_difficulty: updates.difficulty,
    parent_feedback_text: updates.parentFeedback,
    parent_correction_text: updates.parentCorrection,
    feedback_tone: updates.feedbackTone,
    revision_note: updates.revisionNote,
  });
}

function removeUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as Partial<T>;
}
