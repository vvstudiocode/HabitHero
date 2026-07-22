import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { taskRowToViewModel, taskTemplateRowToViewModel } from '../src/lib/data-contracts';
import {
  buildConfirmChildGoalPayload,
  buildReviewTaskCompletionPayload,
  buildSubmitTaskReflectionPayload,
  createDataRepository,
} from '../src/lib/data-access';
import type { TaskRow, TaskTemplateRow } from '../src/types';

const now = '2026-07-22T08:00:00.000Z';

describe('growth data contracts', () => {
  it('preserves child-led growth fields when converting task rows', () => {
    const row: TaskRow = {
      id: 'task-1',
      family_id: 'family-1',
      child_profile_id: 'child-1',
      template_id: 'template-1',
      name: 'Read for 20 minutes',
      points: 5,
      status: 'revision_requested',
      icon: 'BookOpen',
      duration_minutes: 20,
      is_daily: false,
      due_on: '2026-07-22',
      category: 'learning',
      origin: 'child_proposed',
      original_name: 'Read',
      original_points: 4,
      confirmed_at: now,
      confirmed_by: 'parent-1',
      submitted_at: now,
      reviewed_at: now,
      reviewed_by: 'parent-1',
      approved_points: 3,
      child_reflection_text: 'I finished two chapters.',
      child_mood: 'proud',
      child_difficulty: 2,
      parent_feedback_text: 'Good focus today.',
      parent_correction_text: 'Next time write the book title.',
      feedback_tone: 'encouraging',
      revision_note: 'Please add the title.',
      completed_at: null,
      created_at: now,
      updated_at: now,
    };

    assert.deepEqual(taskRowToViewModel(row), {
      id: 'task-1',
      familyId: 'family-1',
      childProfileId: 'child-1',
      templateId: 'template-1',
      name: 'Read for 20 minutes',
      points: 5,
      status: 'revision_requested',
      icon: 'BookOpen',
      duration: 20,
      timerEndTime: null,
      timerRemainingMs: null,
      timerIsRunning: false,
      isDaily: false,
      dueOn: '2026-07-22',
      category: 'learning',
      origin: 'child_proposed',
      originalName: 'Read',
      originalPoints: 4,
      confirmedAt: now,
      confirmedBy: 'parent-1',
      submittedAt: now,
      reviewedAt: now,
      reviewedBy: 'parent-1',
      approvedPoints: 3,
      reflection: 'I finished two chapters.',
      mood: 'proud',
      difficulty: 2,
      parentFeedback: 'Good focus today.',
      parentCorrection: 'Next time write the book title.',
      feedbackTone: 'encouraging',
      revisionNote: 'Please add the title.',
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });

  it('preserves template category and suggested evidence', () => {
    const row: TaskTemplateRow = {
      id: 'template-1',
      family_id: 'family-1',
      name: 'Pack school bag',
      points: 3,
      duration_minutes: null,
      icon: 'Backpack',
      sort_order: 1,
      category: 'life_habit',
      suggested_evidence: 'reflection',
      created_at: now,
      updated_at: now,
    };

    assert.deepEqual(taskTemplateRowToViewModel(row), {
      id: 'template-1',
      name: 'Pack school bag',
      points: 3,
      duration: null,
      icon: 'Backpack',
      category: 'life_habit',
      suggestedEvidence: 'reflection',
    });
  });
});

describe('growth repository payloads', () => {
  it('builds stable RPC payloads for goal review workflows', () => {
    assert.deepEqual(buildConfirmChildGoalPayload('task-1', {
      name: 'Read for 20 minutes',
      points: 5,
      category: 'learning',
    }), {
      target_task_id: 'task-1',
      confirmed_name: 'Read for 20 minutes',
      confirmed_points: 5,
      confirmed_category: 'learning',
    });

    assert.deepEqual(buildSubmitTaskReflectionPayload('task-1', {
      reflection: 'I stayed focused.',
      mood: 'proud',
      difficulty: 3,
    }), {
      target_task_id: 'task-1',
      reflection: 'I stayed focused.',
      mood: 'proud',
      difficulty: 3,
    });

    assert.deepEqual(buildReviewTaskCompletionPayload('task-1', {
      approved: true,
      approvedPoints: 4,
      feedback: 'Strong effort.',
      correction: null,
      tone: 'encouraging',
      revisionNote: null,
    }), {
      target_task_id: 'task-1',
      approved: true,
      approved_points: 4,
      feedback: 'Strong effort.',
      correction: null,
      tone: 'encouraging',
      revision_note: null,
    });

    assert.deepEqual(buildReviewTaskCompletionPayload('task-1', {
      approved: true,
      approvedPoints: 4,
      feedback: null,
      correction: null,
      tone: 'celebration',
      revisionNote: null,
    }).tone, 'celebratory');

    assert.deepEqual(buildReviewTaskCompletionPayload('task-1', {
      approved: false,
      approvedPoints: 0,
      feedback: null,
      correction: null,
      tone: 'correction',
      revisionNote: 'Try again.',
    }).tone, 'corrective');
  });

  it('calls the expected RPC methods for the child-led growth workflow', async () => {
    const calls: Array<{ name: string; payload: unknown }> = [];
    const client = {
      rpc: async (name: string, payload: unknown) => {
        calls.push({ name, payload });
        return { data: null, error: null };
      },
      from: () => {
        throw new Error('from() should not be called in this test');
      },
      functions: {
        invoke: () => {
          throw new Error('functions.invoke() should not be called in this test');
        },
      },
    };

    const repository = createDataRepository(client as never);
    await repository.proposeChildGoal('family-1', 'child-1', {
      name: 'Practice piano',
      points: 4,
      icon: 'Music',
      category: 'creativity',
      duration: 15,
      dueOn: '2026-07-22',
    });
    await repository.confirmChildGoal('task-1', {
      name: 'Practice piano for 15 minutes',
      points: 4,
      category: 'creativity',
    });
    await repository.returnChildGoal('task-1', 'Please make this more specific.');
    await repository.submitTaskReflection('task-1', {
      reflection: 'I practiced scales.',
      mood: 'calm',
      difficulty: 2,
    });
    await repository.reviewTaskCompletion('task-1', {
      approved: false,
      approvedPoints: 0,
      feedback: 'Add what song you practiced.',
      correction: 'Include the song name.',
      tone: 'coaching',
      revisionNote: 'Please add one more sentence.',
    });

    assert.deepEqual(calls, [
      {
        name: 'propose_child_goal',
        payload: {
          target_family_id: 'family-1',
          target_child_profile_id: 'child-1',
          goal_name: 'Practice piano',
          goal_points: 4,
          goal_icon: 'Music',
          goal_category: 'creativity',
          goal_duration_minutes: 15,
          goal_due_on: '2026-07-22',
        },
      },
      {
        name: 'confirm_child_goal',
        payload: {
          target_task_id: 'task-1',
          confirmed_name: 'Practice piano for 15 minutes',
          confirmed_points: 4,
          confirmed_category: 'creativity',
        },
      },
      {
        name: 'return_child_goal',
        payload: {
          target_task_id: 'task-1',
          target_revision_note: 'Please make this more specific.',
        },
      },
      {
        name: 'submit_task_reflection',
        payload: {
          target_task_id: 'task-1',
          reflection: 'I practiced scales.',
          mood: 'calm',
          difficulty: 2,
        },
      },
      {
        name: 'review_task_completion',
        payload: {
          target_task_id: 'task-1',
          approved: false,
          approved_points: 0,
          feedback: 'Add what song you practiced.',
          correction: 'Include the song name.',
          tone: 'coaching',
          revision_note: 'Please add one more sentence.',
        },
      },
    ]);
  });
});
