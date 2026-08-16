import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getEntryDescription } from '../src/components/PointLedgerHistory';
import type { PointLedgerViewModel } from '../src/types';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pointLedgerHistorySource = read('src/components/PointLedgerHistory.tsx');
const parentDashboardSource = read('src/components/ParentDashboard.tsx');

describe('point ledger UI contracts', () => {
  it('prefers the linked Chinese task name and keeps manual reasons intact', () => {
    const approvedEntry: PointLedgerViewModel = {
      id: 'ledger-1',
      childProfileId: 'child-1',
      taskId: 'task-1',
      pointsDelta: 5,
      entryType: 'task_approved',
      note: 'task approved',
      createdAt: Date.now(),
    };
    const manualEntry: PointLedgerViewModel = {
      ...approvedEntry,
      id: 'ledger-2',
      taskId: null,
      entryType: 'manual_adjustment',
      note: '主動整理餐桌',
    };

    assert.equal(getEntryDescription(approvedEntry, () => '整理書桌'), '整理書桌');
    assert.equal(getEntryDescription(approvedEntry, () => null), '任務已完成');
    assert.equal(getEntryDescription(manualEntry), '主動整理餐桌');
  });

  it('uses the linked task name for approved task entries', () => {
    assert.match(pointLedgerHistorySource, /getTaskName/);
    assert.match(pointLedgerHistorySource, /entry\.taskId/);
    assert.match(pointLedgerHistorySource, /entry\.note/);
    assert.match(parentDashboardSource, /getTaskName=\{\(taskId\) =>/);
    assert.match(parentDashboardSource, /historyChild\.tasks\.find/);
  });

  it('does not render the redundant point adjustment helper copy', () => {
    assert.doesNotMatch(parentDashboardSource, /這段原因會顯示在小孩的點數明細中。/);
  });

  it('keeps the point ledger drawer below the mobile safe-area edge', () => {
    assert.match(parentDashboardSource, /hh-point-ledger-modal-panel/);
    assert.match(read('src/styles/base.css'), /\.hh-form-modal-panel\.hh-point-ledger-modal-panel[\s\S]*?\n  height:\s*calc\(100dvh - 32px\)/);
  });
});
