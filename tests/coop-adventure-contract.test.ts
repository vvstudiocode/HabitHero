import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  COOP_ADVENTURE_EVENT,
  COOP_ADVENTURE_KIND,
  getCoopWorldTopic,
  isGeneralAdventure,
  makeCoopAdventureNotification,
  type CoopAdventureNotification,
} from '../src/features/co-op-adventures/contracts';
import {
  COOP_ACTIVE_ADVENTURES_PER_WORLD,
  COOP_PARTICIPANTS_PER_ADVENTURE,
  canAcceptCoopParticipant,
} from '../src/features/co-op-adventures/limits';
import { createCoopAdventureService } from '../src/features/co-op-adventures/coop-adventure-service';

const root = new URL('../', import.meta.url);

function readMigration(): string {
  const name = readdirSync(new URL('supabase/migrations/', root)).find((entry) => /_coop_adventures\.sql$/.test(entry));
  assert.ok(name, 'coop adventure migration must exist');
  return readFileSync(new URL(`supabase/migrations/${name}`, root), 'utf8');
}

describe('co-op adventure database contract', () => {
  it('exposes the repository subscription through the service', () => {
    let subscribed = '';
    const repository = {
      list: async () => [],
      loadState: async () => ({ adventures: [], participants: [], completions: [], lastSyncedAt: '' }),
      createFromGeneralTask: async () => makeCoopAdventureNotification({
        coopAdventureId: 'coop-1',
        worldOwnerChildProfileId: 'owner-1',
        creatorChildProfileId: 'creator-1',
        title: '一起完成',
        createdAt: '',
      }),
      join: async () => ({ coopAdventureId: 'coop-1', status: 'joined' as const }),
      submitCompletion: async () => ({ coopAdventureId: 'coop-1', status: 'completed' as const }),
      reviewCompletion: async () => ({ coopAdventureId: 'coop-1', status: 'completed' as const }),
      subscribe: (owner: string) => {
        subscribed = owner;
        return () => undefined;
      },
    };

    const service = createCoopAdventureService(repository);
    const unsubscribe = service.subscribe('owner-1', () => undefined);

    assert.equal(subscribed, 'owner-1');
    assert.equal(typeof unsubscribe, 'function');
  });

  it('creates isolated cross-family relation tables without changing tasks', () => {
    const sql = readMigration();

    for (const table of ['coop_adventures', 'coop_adventure_participants', 'coop_adventure_completions']) {
      assert.match(sql, new RegExp(`create table public\\.${table}\\b`, 'i'));
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
    assert.doesNotMatch(sql, /alter table public\.tasks[\s\S]*coop_adventure/i);
    assert.match(sql, /foreign key \(family_id, task_id\)[\s\S]*references public\.tasks \(family_id, id\)/i);
    assert.match(sql, /foreign key \(participant_id\)[\s\S]*references public\.coop_adventure_participants/i);
    assert.match(sql, /unique \(coop_adventure_id, child_profile_id\)/i);
    assert.match(sql, /unique \(participant_id\)/i);
  });

  it('enforces general-only, five active adventures, and eight participants', () => {
    const sql = readMigration();

    assert.equal(COOP_ADVENTURE_KIND, 'general');
    assert.equal(COOP_ACTIVE_ADVENTURES_PER_WORLD, 5);
    assert.equal(COOP_PARTICIPANTS_PER_ADVENTURE, 8);
    assert.match(sql, /adventure_type\s*=\s*'general'/i);
    assert.match(sql, /is_daily\s*(?:=|is)\s*false/i);
    assert.match(sql, /count\(\*\)[\s\S]*<\s*5/i);
    assert.match(sql, /count\(\*\)[\s\S]*<\s*8/i);
    assert.equal(canAcceptCoopParticipant(7), true);
    assert.equal(canAcceptCoopParticipant(8), false);
  });

  it('derives every mutation actor from auth.uid and delegates review to existing task flow', () => {
    const sql = readMigration();

    for (const functionName of [
      'create_coop_adventure',
      'join_coop_adventure',
      'submit_coop_adventure_completion',
      'review_coop_adventure_completion',
    ]) {
      const functionBody = sql.slice(sql.indexOf(`function public.${functionName}`), sql.indexOf(`function public.${functionName}`) + 8_000);
      assert.match(functionBody, /security definer/i, `${functionName} must be server-authorized`);
      assert.match(functionBody, /auth\.uid\(\)/i, `${functionName} must derive actor from auth.uid()`);
      assert.match(functionBody, /set search_path\s*=\s*pg_catalog, public/i);
    }
    assert.match(sql, /task_row\.adventure_type\s*<>\s*'general'|task_row\.adventure_type\s+not\s+in\s*\('general'\)/i);
    assert.match(sql, /public\.review_adventure_completion\(/i);
    assert.doesNotMatch(sql, /insert into public\.point_ledger[\s\S]*coop/i);
    assert.match(sql, /revoke all on function public\.create_coop_adventure/i);
    assert.match(sql, /grant execute on function public\.join_coop_adventure/i);
  });

  it('provides a private notification contract and reload-safe read RPCs', () => {
    const sql = readMigration();
    const notification = makeCoopAdventureNotification({
      coopAdventureId: 'coop-1',
      worldOwnerChildProfileId: 'owner-1',
      creatorChildProfileId: 'creator-1',
      title: '一起整理房間',
      createdAt: '2026-08-23T01:02:03.000Z',
    });

    assert.equal(getCoopWorldTopic('owner-1'), 'friend-world:owner-1');
    assert.equal(notification.type, 'coop_adventure_created');
    assert.equal(COOP_ADVENTURE_EVENT, 'coop_changed_v1');
    assert.match(sql, /realtime\.send\(/i);
    assert.match(sql, /coop_changed_v1/i);
    assert.match(sql, /friend-world:/i);
    assert.match(sql, /create (?:or replace )?function public\.list_coop_adventures/i);
    assert.match(sql, /create (?:or replace )?function public\.get_coop_adventure_state/i);
    assert.match(sql, /private\.can_visit_friend_world/i);
    assert.ok((notification as CoopAdventureNotification).coopAdventureId);
  });

  it('keeps UI owners standalone and accessible', () => {
    const card = readFileSync(new URL('../src/features/co-op-adventures/components/CoopAdventureCard.tsx', import.meta.url), 'utf8');
    const summary = readFileSync(new URL('../src/features/co-op-adventures/components/CoopCompletionSummary.tsx', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../src/features/co-op-adventures/hooks/use-coop-adventures.ts', import.meta.url), 'utf8');

    assert.match(card, /aria-label|aria-labelledby/);
    assert.match(card, /loading|isLoading/i);
    assert.match(card, /error/i);
    assert.match(card, /empty|沒有|尚無/i);
    assert.match(summary, /aria-label|aria-labelledby/);
    assert.match(summary, /loading|isLoading/i);
    assert.match(summary, /error/i);
    assert.match(summary, /empty|沒有|尚無/i);
    assert.doesNotMatch(card, /ParentDashboard|ChildDashboard/);
    assert.doesNotMatch(summary, /ParentDashboard|ChildDashboard/);
    assert.match(hook, /reload|load/i);
  });

  it('recognizes only general adventures as eligible sources', () => {
    assert.equal(isGeneralAdventure({ adventureType: 'general', isDaily: false }), true);
    assert.equal(isGeneralAdventure({ adventureType: 'daily', isDaily: true }), false);
    assert.equal(isGeneralAdventure({ adventureType: 'general', isDaily: true }), false);
  });
});
