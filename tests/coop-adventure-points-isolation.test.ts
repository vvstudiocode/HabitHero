import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  buildCoopCompletionSummary,
  createInitialCoopAdventureState,
  mergeCoopAdventureState,
} from '../src/features/co-op-adventures/coop-adventure-state';
import { createCoopAdventureRepository } from '../src/lib/social-data/coop-adventure-repository';
import type {
  CoopAdventureCompletion,
  CoopAdventureParticipant,
  CoopAdventureState,
} from '../src/features/co-op-adventures/contracts';

const root = new URL('../', import.meta.url);
const migrationName = readdirSync(new URL('supabase/migrations/', root)).find((entry) => /_coop_adventures\.sql$/.test(entry));
const migration = migrationName
  ? readFileSync(new URL(`supabase/migrations/${migrationName}`, root), 'utf8')
  : '';

const participant = (overrides: Partial<CoopAdventureParticipant> = {}): CoopAdventureParticipant => ({
  id: 'participant-a',
  coopAdventureId: 'coop-a',
  childProfileId: 'child-a',
  displayName: '小安',
  role: 'creator',
  joinedAt: '2026-08-23T01:00:00.000Z',
  ...overrides,
});

const completion = (overrides: Partial<CoopAdventureCompletion> = {}): CoopAdventureCompletion => ({
  id: 'completion-a',
  coopAdventureId: 'coop-a',
  participantId: 'participant-a',
  status: 'pending',
  submittedAt: '2026-08-23T01:10:00.000Z',
  ...overrides,
});

describe('co-op adventure points and family isolation', () => {
  it('only includes participants and completions from the selected relation', () => {
    const state: CoopAdventureState = {
      ...createInitialCoopAdventureState(),
      adventures: [
        { id: 'coop-a', worldOwnerChildProfileId: 'owner-a', title: '一起冒險', status: 'active', participantCount: 1, createdAt: '2026-08-23T01:00:00.000Z' },
        { id: 'coop-b', worldOwnerChildProfileId: 'owner-b', title: '另一個世界', status: 'active', participantCount: 1, createdAt: '2026-08-23T01:00:00.000Z' },
      ],
      participants: [participant(), participant({ id: 'participant-b', coopAdventureId: 'coop-b', childProfileId: 'child-b', displayName: '小美' })],
      completions: [completion(), completion({ id: 'completion-b', coopAdventureId: 'coop-b', participantId: 'participant-b' })],
    };

    const summary = buildCoopCompletionSummary(state, 'coop-a');
    assert.equal(summary?.adventureId, 'coop-a');
    assert.deepEqual(summary?.participants.map(({ id }) => id), ['participant-a']);
    assert.deepEqual(summary?.completions.map(({ id }) => id), ['completion-a']);
    assert.doesNotMatch(JSON.stringify(summary), /coop-b|participant-b|completion-b/);
  });

  it('reload replaces stale broadcast state without joining unrelated relations', () => {
    const first = createInitialCoopAdventureState();
    const broadcastState: CoopAdventureState = {
      ...first,
      adventures: [{ id: 'coop-a', worldOwnerChildProfileId: 'owner-a', title: '舊通知', status: 'active', participantCount: 1, createdAt: '2026-08-23T01:00:00.000Z' }],
    };
    const reloadedState: CoopAdventureState = {
      ...first,
      adventures: [{ id: 'coop-a', worldOwnerChildProfileId: 'owner-a', title: '資料庫真實狀態', status: 'completed', participantCount: 2, createdAt: '2026-08-23T01:00:00.000Z' }],
    };

    const merged = mergeCoopAdventureState(broadcastState, reloadedState);
    assert.equal(merged.adventures[0]?.title, '資料庫真實狀態');
    assert.equal(merged.adventures[0]?.status, 'completed');
    assert.equal(merged.adventures[0]?.participantCount, 2);
  });

  it('keeps point approval in the existing family-scoped review and ledger path', () => {
    assert.ok(migrationName, 'coop adventure migration must exist');
    assert.match(migration, /private\.is_family_parent\(participant_row\.family_id\)/i);
    assert.match(migration, /public\.review_adventure_completion\(\s*participant_row\.task_id/i);
    assert.doesNotMatch(migration, /approved_points\s*=>|points_delta\s*=>|target_family_id\s*=>/i);
    assert.doesNotMatch(migration, /insert into public\.point_ledger[\s\S]*coop_adventure/i);
    assert.match(migration, /family_id\s*,\s*child_profile_id\s*,\s*task_id/i);
    assert.match(migration, /participant_row\.family_id[\s\S]*participant_row\.child_profile_id/i);
  });

  it('does not expose task or point-ledger writes through the social repository', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: { id: 'participant-a', status: 'pending' }, error: null };
      },
      channel: () => ({
        on: () => ({ subscribe: () => undefined }),
      }),
      removeChannel: () => undefined,
    };
    const repository = createCoopAdventureRepository(client as never);

    await repository.submitCompletion('participant-a', {
      idempotencyKey: 'idempotency-a',
      quickReport: 'smooth',
    });

    assert.deepEqual(calls, [{
      name: 'submit_coop_adventure_completion',
      args: {
        target_participant_id: 'participant-a',
        idempotency_key: 'idempotency-a',
        quick_report: 'smooth',
        reflection: null,
        mood: null,
        difficulty: null,
      },
    }]);
    assert.doesNotMatch(JSON.stringify(calls), /family_id|child_profile_id|points|task_id|ledger/i);
  });
});
