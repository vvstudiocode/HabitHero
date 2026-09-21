import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { getEntryDescription } from '../src/components/PointLedgerHistory';
import type { PointLedgerViewModel } from '../src/types';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pointLedgerHistorySource = read('src/components/PointLedgerHistory.tsx');
const parentDashboardSource = read('src/components/ParentDashboard.tsx');
const neutralThemeStyles = read('src/styles/neutral-theme.css');

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

  it('makes each point ledger entry expandable so its task can be inspected', () => {
    assert.match(pointLedgerHistorySource, /getTaskDetails\?:/);
    assert.match(pointLedgerHistorySource, /<details key=\{entry\.id\}/);
    assert.match(pointLedgerHistorySource, /<summary[\s\S]*?aria-controls=\{entryDetailsId\}/);
    assert.match(pointLedgerHistorySource, /id=\{entryDetailsId\}/);
    assert.match(childDashboardSource, /getTaskDetails=\{\(taskId\) => activeChild\.tasks\.find/);
  });

  it('does not render the redundant point adjustment helper copy', () => {
    assert.doesNotMatch(parentDashboardSource, /這段原因會顯示在小孩的點數明細中。/);
  });

  it('keeps the point ledger drawer below the mobile safe-area edge', () => {
    assert.match(parentDashboardSource, /hh-point-ledger-modal-panel/);
    assert.match(read('src/styles/base.css'), /\.hh-form-modal-panel\.hh-point-ledger-modal-panel[\s\S]*?\n  height:\s*calc\(100dvh - 32px\)/);
  });

  it('keeps point management controls on one restrained semantic treatment', () => {
    assert.match(parentDashboardSource, /className="hh-child-points-section(?:\s|\")/);
    assert.match(parentDashboardSource, /className="hh-point-management-action hh-adventure-secondary-action /);
    assert.match(parentDashboardSource, /className="hh-point-ledger-action hh-adventure-secondary-action /);
    assert.match(parentDashboardSource, /className="hh-point-adjustment-submit hh-adventure-primary-action /);
    assert.match(neutralThemeStyles, /\.hh-adventure-secondary-action\s*\{[\s\S]*?color:\s*var\(--hh-neutral-ink\);[\s\S]*?background:\s*var\(--hh-neutral-soft\);[\s\S]*?border:\s*1px solid var\(--hh-neutral-line\);/);
    assert.match(neutralThemeStyles, /\.hh-adventure-primary-action\s*\{[\s\S]*?color:\s*var\(--hh-neutral-surface\);[\s\S]*?background:\s*var\(--hh-primary\);/);
    assert.doesNotMatch(parentDashboardSource, /bg-amber-400[^\n]*贈點|border-rose-300[^\n]*扣點/);
  });
});
