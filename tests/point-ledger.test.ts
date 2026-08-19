import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getPointLedgerPageNumbers,
  normalizePointLedgerPagination,
  validatePointLedgerAdjustment,
} from '../src/lib/point-ledger';
import { buildAdjustChildPointsPayload, createDataRepository } from '../src/lib/data-access';
import { pointLedgerRowToViewModel } from '../src/lib/data-contracts';
import type { PointLedgerRow } from '../src/types';

const now = '2026-08-16T08:00:00.000Z';

const ledgerRow: PointLedgerRow = {
  id: 'ledger-1',
  family_id: 'family-1',
  child_profile_id: 'child-1',
  task_id: null,
  redemption_id: null,
  entry_type: 'manual_adjustment',
  points_delta: 20,
  note: '主動整理餐桌',
  created_at: now,
};

describe('point ledger pagination', () => {
  it('clamps page and page size and returns an inclusive database range', () => {
    assert.deepEqual(normalizePointLedgerPagination(0, 999), {
      page: 1,
      pageSize: 50,
      from: 0,
      to: 49,
    });
    assert.deepEqual(normalizePointLedgerPagination(3, 20), {
      page: 3,
      pageSize: 20,
      from: 40,
      to: 59,
    });
  });

  it('keeps page numbers compact while retaining first, last, and nearby pages', () => {
    assert.deepEqual(getPointLedgerPageNumbers(1, 1), [1]);
    assert.deepEqual(getPointLedgerPageNumbers(1, 10), [1, 2, 3, 4, 5, 10]);
    assert.deepEqual(getPointLedgerPageNumbers(6, 10), [1, 4, 5, 6, 7, 10]);
  });
});

describe('point ledger adjustment validation', () => {
  it('accepts a non-zero integer delta with a trimmed note', () => {
    assert.deepEqual(validatePointLedgerAdjustment(20, '  主動整理餐桌  '), {
      ok: true,
      note: '主動整理餐桌',
    });
    assert.deepEqual(validatePointLedgerAdjustment(-5, '未完成約定'), {
      ok: true,
      note: '未完成約定',
    });
  });

  it('rejects zero, fractional, oversized, blank, and overlong adjustments', () => {
    for (const [delta, note] of [
      [0, '原因'],
      [1.5, '原因'],
      [10001, '原因'],
      [-10001, '原因'],
      [10, '   '],
      [10, 'a'.repeat(201)],
    ] as const) {
      assert.equal(validatePointLedgerAdjustment(delta, note).ok, false);
    }
  });
});

describe('point ledger repository contract', () => {
  it('builds the parent-only manual adjustment RPC payload', () => {
    assert.deepEqual(buildAdjustChildPointsPayload('child-1', -10, '未完成約定'), {
      target_child_profile_id: 'child-1',
      points_delta: -10,
      adjustment_note: '未完成約定',
    });
    assert.deepEqual(buildAdjustChildPointsPayload('child-1', 0, '  尚未驗證  '), {
      target_child_profile_id: 'child-1',
      points_delta: 0,
      adjustment_note: '  尚未驗證  ',
    });
  });

  it('uses server-side count and range pagination for ledger history', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const queryResult = { data: [ledgerRow], error: null, count: 41 };
    const query = {
      select: (...args: unknown[]) => { calls.push({ method: 'select', args }); return query; },
      eq: (...args: unknown[]) => { calls.push({ method: 'eq', args }); return query; },
      order: (...args: unknown[]) => { calls.push({ method: 'order', args }); return query; },
      range: async (...args: unknown[]) => { calls.push({ method: 'range', args }); return queryResult; },
    };
    const client = {
      from: () => query,
      rpc: async () => ({ data: null, error: null }),
      functions: { invoke: async () => ({ data: null, error: null }) },
    };

    const repository = createDataRepository(client as never);
    const page = await repository.listPointLedger('family-1', 'child-1', 3, 20);

    assert.equal(page.total, 41);
    assert.equal(page.page, 3);
    assert.equal(page.pageSize, 20);
    assert.equal(page.totalPages, 3);
    assert.equal(page.hasNextPage, false);
    assert.deepEqual(page.entries[0], {
      id: 'ledger-1',
      childProfileId: 'child-1',
      taskId: null,
      pointsDelta: 20,
      entryType: 'manual_adjustment',
      note: '主動整理餐桌',
      createdAt: Date.parse(now),
    });
    assert.deepEqual(calls.at(-1), { method: 'range', args: [40, 59] });
    assert.deepEqual(calls.find((call) => call.method === 'select')?.args, ['*', { count: 'exact' }]);
  });

  it('keeps the approved task id available for the Chinese task name in the ledger UI', () => {
    assert.equal(pointLedgerRowToViewModel({
      ...ledgerRow,
      task_id: 'task-1',
      entry_type: 'task_approved',
      note: 'task approved',
    }).taskId, 'task-1');
  });

  it('calls the atomic manual adjustment RPC and maps its server result', async () => {
    const calls: Array<{ name: string; payload: unknown }> = [];
    const client = {
      rpc: async (name: string, payload: unknown) => {
        calls.push({ name, payload });
        return {
          data: { ledger_entry: ledgerRow, points_balance: 120 },
          error: null,
        };
      },
      from: () => queryThatShouldNotBeCalled(),
      functions: { invoke: async () => ({ data: null, error: null }) },
    };

    const repository = createDataRepository(client as never);
    const result = await repository.adjustChildPoints('family-1', 'child-1', 20, '主動整理餐桌');

    assert.deepEqual(calls, [{
      name: 'adjust_child_points',
      payload: {
        target_child_profile_id: 'child-1',
        points_delta: 20,
        adjustment_note: '主動整理餐桌',
      },
    }]);
    assert.equal(result.pointsBalance, 120);
    assert.equal(result.ledgerEntry.pointsDelta, 20);
  });
});

describe('manual point adjustment migration contract', () => {
  it('keeps the balance mutation parent-only, atomic, and append-only', () => {
    const migration = readFileSync(resolve('supabase/migrations/20260816043045_manual_point_adjustments.sql'), 'utf8');
    assert.match(migration, /security definer/);
    assert.match(migration, /private\.is_family_parent\(child_row\.family_id\)/);
    assert.match(migration, /for update/);
    assert.match(migration, /insert into public\.point_ledger/);
    assert.match(migration, /update public\.child_profiles/);
    assert.match(migration, /revoke all on function public\.adjust_child_points/);
    assert.match(migration, /grant execute on function public\.adjust_child_points.*authenticated/);
    assert.match(migration, /revoke update on table public\.child_profiles from authenticated/);
    assert.match(migration, /grant update \(display_name\) on table public\.child_profiles/);
  });
});

function queryThatShouldNotBeCalled(): never {
  throw new Error('from() should not be called in this test');
}
