import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDataRepository } from '../src/lib/data-access';

describe('task repository write payloads', () => {
  it('builds template create payloads with existing defaults and nullable schedule fields', async () => {
    const calls = createRepositoryWriteRecorder();
    const repository = createDataRepository(calls.client as never);

    await repository.insertTemplate('family-1', {
      name: 'Pack school bag',
      points: 3,
      icon: 'Backpack',
    });
    await repository.insertTemplate('family-1', {
      name: 'Practice piano',
      points: 4,
      icon: 'Music',
      duration: 15,
      category: 'creativity',
      suggestedEvidence: 'reflection',
      dueTime: '18:00',
      endTime: '19:00',
      requiresReviewBeforeNextTask: true,
    });

    assert.deepEqual(calls.writes, [
      {
        table: 'task_templates',
        method: 'insert',
        payload: {
          family_id: 'family-1',
          name: 'Pack school bag',
          points: 3,
          icon: 'Backpack',
          duration_minutes: null,
          category: 'life_habit',
          suggested_evidence: 'reflection',
          due_time: null,
          end_time: null,
          requires_review_before_next_task: false,
        },
      },
      {
        table: 'task_templates',
        method: 'insert',
        payload: {
          family_id: 'family-1',
          name: 'Practice piano',
          points: 4,
          icon: 'Music',
          duration_minutes: 15,
          category: 'creativity',
          suggested_evidence: 'reflection',
          due_time: '18:00',
          end_time: '19:00',
          requires_review_before_next_task: true,
        },
      },
    ]);
  });

  it('builds template update payloads by removing undefined while keeping null, false, zero, and empty strings', async () => {
    const calls = createRepositoryWriteRecorder();
    const repository = createDataRepository(calls.client as never);

    await repository.updateTemplate('template-1', {
      name: '',
      points: 0,
      duration: null,
      category: undefined,
      suggestedEvidence: '',
      dueTime: null,
      endTime: undefined,
      requiresReviewBeforeNextTask: false,
    });

    assert.deepEqual(calls.writes, [
      {
        table: 'task_templates',
        method: 'update',
        payload: {
          name: '',
          points: 0,
          duration_minutes: null,
          suggested_evidence: '',
          due_time: null,
          requires_review_before_next_task: false,
        },
        filters: [['eq', 'id', 'template-1']],
      },
    ]);
  });

  it('builds task create payloads with existing defaults and nullable timing fields', async () => {
    const calls = createRepositoryWriteRecorder({ insertResult: { id: 'task-created' } });
    const repository = createDataRepository(calls.client as never);

    const taskId = await repository.insertTask('family-1', 'child-1', {
      name: 'Read',
      points: 5,
      icon: 'BookOpen',
    });
    await repository.insertTask('family-1', 'child-1', {
      templateId: 'template-1',
      name: 'Draw a dragon',
      points: 8,
      icon: 'Palette',
      duration: 30,
      isDaily: true,
      dueOn: '2026-08-20',
      dueTime: '17:00',
      endTime: '18:00',
      requiresReviewBeforeNextTask: true,
      category: 'creativity',
      origin: 'system_template',
    });

    assert.equal(taskId, 'task-created');
    assert.deepEqual(calls.writes, [
      {
        table: 'tasks',
        method: 'insert',
        payload: {
          family_id: 'family-1',
          child_profile_id: 'child-1',
          template_id: null,
          name: 'Read',
          points: 5,
          icon: 'BookOpen',
          duration_minutes: null,
          is_daily: false,
          due_on: null,
          due_time: null,
          end_time: null,
          requires_review_before_next_task: false,
          category: 'life_habit',
          origin: 'parent_assigned',
        },
      },
      {
        table: 'tasks',
        method: 'insert',
        payload: {
          family_id: 'family-1',
          child_profile_id: 'child-1',
          template_id: 'template-1',
          name: 'Draw a dragon',
          points: 8,
          icon: 'Palette',
          duration_minutes: 30,
          is_daily: true,
          due_on: '2026-08-20',
          due_time: '17:00',
          end_time: '18:00',
          requires_review_before_next_task: true,
          category: 'creativity',
          origin: 'system_template',
        },
      },
    ]);
  });

  it('builds task update payloads including all completion and review fields without dropping nullish intent', async () => {
    const calls = createRepositoryWriteRecorder();
    const repository = createDataRepository(calls.client as never);

    await repository.updateTask('task-1', {
      name: 'Revised task',
      points: 0,
      status: 'revision_requested',
      icon: '',
      duration: null,
      isDaily: false,
      dueOn: null,
      dueTime: '17:00',
      endTime: undefined,
      requiresReviewBeforeNextTask: false,
      category: undefined,
      origin: 'child_proposed',
      approvedPoints: null,
      reflection: '',
      mood: null,
      difficulty: 0,
      parentFeedback: null,
      parentCorrection: '',
      feedbackTone: null,
      revisionNote: 'Try again.',
    });

    assert.deepEqual(calls.writes, [
      {
        table: 'tasks',
        method: 'update',
        payload: {
          name: 'Revised task',
          points: 0,
          status: 'revision_requested',
          icon: '',
          duration_minutes: null,
          is_daily: false,
          due_on: null,
          due_time: '17:00',
          requires_review_before_next_task: false,
          origin: 'child_proposed',
          approved_points: null,
          child_reflection_text: '',
          child_mood: null,
          child_difficulty: 0,
          parent_feedback_text: null,
          parent_correction_text: '',
          feedback_tone: null,
          revision_note: 'Try again.',
        },
        filters: [['eq', 'id', 'task-1']],
      },
    ]);
  });
});

function createRepositoryWriteRecorder(options: { insertResult?: unknown } = {}) {
  const writes: Array<{
    table: string;
    method: 'insert' | 'update';
    payload: unknown;
    filters?: unknown[][];
  }> = [];

  const createQuery = (write: (typeof writes)[number]) => {
    const query = {
      eq: (column: string, value: unknown) => {
        write.filters = [...(write.filters ?? []), ['eq', column, value]];
        return Promise.resolve({ data: null, error: null });
      },
      select: () => query,
      single: () => Promise.resolve({ data: options.insertResult ?? { id: 'task-1' }, error: null }),
    };
    return query;
  };

  return {
    writes,
    client: {
      from: (table: string) => ({
        insert: (payload: unknown) => {
          const write = { table, method: 'insert' as const, payload };
          writes.push(write);
          return createQuery(write);
        },
        update: (payload: unknown) => {
          const write = { table, method: 'update' as const, payload };
          writes.push(write);
          return createQuery(write);
        },
      }),
      rpc: () => Promise.reject(new Error('rpc should not be called')),
      functions: { invoke: () => Promise.reject(new Error('functions should not be called')) },
    },
  };
}
