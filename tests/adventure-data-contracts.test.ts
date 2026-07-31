import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adventureGroupRowToViewModel,
  applyServerTimerSession,
  taskScheduleRowToViewModel,
  taskTimerSessionRowToViewModel,
  taskRowToViewModel,
} from '../src/lib/data-contracts';
import {
  buildAdventureCompletionPayload,
  buildAdventureSchedulePayload,
  buildAdventureScheduleUpdatePayload,
  createDataRepository,
} from '../src/lib/data-access';
import type {
  AdventureGroupRow,
  TaskRow,
  TaskScheduleRow,
  TaskTimerSessionRow,
} from '../src/types';

const now = '2026-07-31T00:00:00.000Z';

describe('adventure data contracts', () => {
  it('maps adventure task fields without trusting legacy is_daily', () => {
    const row = {
      id: 'task-1',
      family_id: 'family-1',
      child_profile_id: 'child-1',
      template_id: null,
      name: '刷牙',
      points: 5,
      status: 'todo',
      icon: 'tooth',
      duration_minutes: 2,
      is_daily: true,
      due_on: '2026-07-31',
      due_time: '07:00',
      end_time: '08:00',
      category: 'life_habit',
      origin: 'parent_assigned',
      original_name: null,
      original_points: null,
      confirmed_at: null,
      confirmed_by: null,
      submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      approved_points: null,
      child_reflection_text: null,
      child_mood: null,
      child_difficulty: null,
      parent_feedback_text: null,
      parent_correction_text: null,
      feedback_tone: null,
      revision_note: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      adventure_type: 'daily',
      adventure_group_id: null,
      schedule_id: 'schedule-1',
      occurrence_date: '2026-07-31',
      completion_report_mode: 'none',
      quick_report: null,
      requires_timer: true,
    } satisfies TaskRow;

    const task = taskRowToViewModel(row);
    assert.equal(task.adventureType, 'daily');
    assert.equal(task.scheduleId, 'schedule-1');
    assert.equal(task.occurrenceDate, '2026-07-31');
    assert.equal(task.completionReportMode, 'none');
    assert.equal(task.requiresTimer, true);
  });

  it('maps groups, schedules and server timer sessions', () => {
    const group: AdventureGroupRow = {
      id: 'group-1', family_id: 'family-1', child_profile_id: 'child-1',
      type: 'general', title: '星球挑戰', status: 'active',
      created_at: now, updated_at: now, archived_at: null,
    };
    const schedule: TaskScheduleRow = {
      id: 'schedule-1', family_id: 'family-1', child_profile_id: 'child-1',
      name: '刷牙', description: '刷滿兩分鐘', points: 5, icon: 'tooth',
      category: 'life_habit', duration_minutes: 2, start_time: '07:00',
      end_time: '08:00', weekdays: [1, 2, 3, 4, 5], timezone: 'Asia/Taipei',
      requires_timer: true, requires_review_before_next_task: false,
      active_from: '2026-07-31', active_until: null, is_active: true,
      created_at: now, updated_at: now,
    };
    const timer: TaskTimerSessionRow = {
      id: 'timer-1', family_id: 'family-1', child_profile_id: 'child-1',
      task_id: 'task-1', status: 'running', accumulated_seconds: 30,
      started_at: now, last_resumed_at: now, paused_at: null,
      completed_at: null, created_at: now, updated_at: now,
    };

    assert.equal(adventureGroupRowToViewModel(group).title, '星球挑戰');
    assert.deepEqual(taskScheduleRowToViewModel(schedule).weekdays, [1, 2, 3, 4, 5]);
    assert.equal(taskTimerSessionRowToViewModel(timer).status, 'running');
  });

  it('restores authoritative timer progress across devices', () => {
    const task = {
      id: 'task-1',
      name: '刷牙',
      points: 5,
      status: 'todo',
      icon: 'tooth',
      isDaily: true,
      duration: 2,
    } as const;
    const restored = applyServerTimerSession(task, {
      id: 'timer-1',
      familyId: 'family-1',
      childProfileId: 'child-1',
      taskId: 'task-1',
      status: 'paused',
      accumulatedSeconds: 30,
      startedAt: now,
      lastResumedAt: null,
      pausedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }, Date.parse(now));

    assert.equal(restored.timerIsRunning, false);
    assert.equal(restored.timerRemainingMs, 90_000);
    assert.equal(restored.timerEndTime, null);
  });

  it('builds server-authoritative completion and schedule payloads', () => {
    assert.deepEqual(buildAdventureCompletionPayload('task-1', {
      idempotencyKey: 'submit-1',
      quickReport: 'smooth',
      reflection: null,
      mood: null,
      difficulty: null,
    }), {
      target_task_id: 'task-1',
      idempotency_key: 'submit-1',
      quick_report: 'smooth',
      reflection: null,
      mood: null,
      difficulty: null,
    });

    assert.deepEqual(buildAdventureSchedulePayload('family-1', {
      childProfileIds: ['child-1'],
      name: '刷牙',
      description: '刷滿兩分鐘',
      points: 5,
      icon: 'tooth',
      category: 'life_habit',
      durationMinutes: 2,
      startTime: '07:00',
      endTime: '08:00',
      weekdays: [1, 2, 3, 4, 5],
      timezone: 'Asia/Taipei',
      requiresTimer: true,
      requiresReviewBeforeNextTask: false,
      activeFrom: '2026-07-31',
      activeUntil: null,
    }, 'child-1'), {
      target_family_id: 'family-1',
      target_child_profile_id: 'child-1',
      schedule_name: '刷牙',
      schedule_description: '刷滿兩分鐘',
      schedule_points: 5,
      schedule_icon: 'tooth',
      schedule_category: 'life_habit',
      schedule_duration_minutes: 2,
      schedule_start_time: '07:00',
      schedule_end_time: '08:00',
      schedule_weekdays: [1, 2, 3, 4, 5],
      schedule_timezone: 'Asia/Taipei',
      schedule_requires_timer: true,
      schedule_requires_review_before_next_task: false,
      schedule_active_from: '2026-07-31',
      schedule_active_until: null,
    });
  });

  it('maps schedule update scope to the protected RPC contract', () => {
    const current = taskScheduleRowToViewModel({
      id: 'schedule-1', family_id: 'family-1', child_profile_id: 'child-1',
      name: '刷牙', description: null, points: 5, icon: 'tooth',
      category: 'life_habit', duration_minutes: 2, start_time: '07:00',
      end_time: '08:00', weekdays: [1, 2, 3, 4, 5], timezone: 'Asia/Taipei',
      requires_timer: true, requires_review_before_next_task: false,
      active_from: '2026-07-31', active_until: null, is_active: true,
      created_at: now, updated_at: now,
    });

    const payload = buildAdventureScheduleUpdatePayload('schedule-1', current, {
      name: '早上刷牙',
      applyMode: 'today_unfinished',
    });
    assert.equal(payload.update_scope, 'today_unfinished');
    assert.equal(payload.schedule_name, '早上刷牙');
    assert.equal(payload.schedule_points, 5);
  });

  it('uses adventure RPCs for completion and timer lifecycle', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: name.includes('timer') ? { id: 'timer-1' } : null, error: null };
      },
    };
    const repository = createDataRepository(client as never);

    await repository.submitAdventureCompletion('task-1', {
      idempotencyKey: 'submit-1', quickReport: 'hard',
    });
    await repository.startAdventureTimer('task-1');
    await repository.pauseAdventureTimer('task-1');
    await repository.resumeAdventureTimer('task-1');

    assert.deepEqual(calls.map((call) => call.name), [
      'submit_adventure_completion',
      'start_adventure_timer',
      'pause_adventure_timer',
      'resume_adventure_timer',
    ]);
  });
});
