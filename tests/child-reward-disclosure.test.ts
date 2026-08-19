import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const childDashboardSource = read('src/components/ChildDashboard.tsx');
const pointLedgerSource = read('src/components/PointLedgerHistory.tsx');

describe('child reward page disclosures', () => {
  it('labels parent-configured rewards as available rewards', () => {
    assert.match(childDashboardSource, /可兌換獎勵/);
    assert.match(childDashboardSource, /visibleRewards\.map\(reward =>/);
    assert.match(childDashboardSource, /onClick=\{\(\) => setRewardToConfirm\(reward\)\}/);
  });

  it('keeps point details collapsed until the child opens them', () => {
    assert.match(childDashboardSource, /<PointLedgerHistory[\s\S]*?collapsible\s+defaultOpen=\{false\}/);
    assert.match(pointLedgerSource, /collapsible\?: boolean/);
    assert.match(pointLedgerSource, /<details[\s\S]*?defaultOpen=\{defaultOpen\}/);
  });

  it('keeps redemption history collapsed until the child opens it', () => {
    assert.match(childDashboardSource, /<details[\s\S]*?defaultOpen=\{false\}[\s\S]*?我的兌換紀錄/);
  });

  it('shows rewards as three compact columns with eighteen items per page', () => {
    assert.match(childDashboardSource, /const REWARDS_PER_PAGE = 18/);
    assert.match(childDashboardSource, /const \[rewardPage, setRewardPage\] = useState\(1\)/);
    assert.match(childDashboardSource, /rewards\.slice\(\(rewardPage - 1\) \* REWARDS_PER_PAGE/);
    assert.match(childDashboardSource, /grid-cols-3/);
    assert.match(childDashboardSource, /rewardPage === 1/);
    assert.match(childDashboardSource, /rewardPage === rewardTotalPages/);
  });
});
