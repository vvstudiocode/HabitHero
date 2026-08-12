import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GAME_LOOT_STAR_GLOW_RADIUS,
  GAME_LOOT_STAR_VISUAL_SCALE,
  GAME_LOOT_SCROLL_VISUAL_SCALE,
  getLootDisplayedBalance,
  getLootAnimationDuration,
  getLootTargetStat,
  isLootDropInPickupRange,
  type PendingLootPresentation,
} from '../src/features/world/game-loot';
import type { GameLootDrop } from '../src/features/world/contracts';

const starDrop: GameLootDrop = {
  id: 'drop-star-1',
  sourceTaskId: 'task-1',
  kind: 'star',
  amount: 5,
  x: -2,
  y: 0.35,
  z: 1,
  createdAt: '2026-08-12T09:00:00Z',
};

const scrollDrop: GameLootDrop = {
  id: 'drop-scroll-1',
  sourceTaskId: 'task-1',
  kind: 'scroll',
  amount: 1,
  x: -1,
  y: 0.2,
  z: 1,
  createdAt: '2026-08-12T09:00:00Z',
};

function pending(drop: GameLootDrop, phase: PendingLootPresentation['phase']): PendingLootPresentation {
  return { drop, phase };
}

describe('loot presentation contract', () => {
  it('keeps world stars compact with a soft glow budget', () => {
    assert.equal(GAME_LOOT_STAR_VISUAL_SCALE, 0.5);
    assert.equal(GAME_LOOT_STAR_GLOW_RADIUS, 0.14);
    assert.equal(GAME_LOOT_SCROLL_VISUAL_SCALE, 0.5);
  });

  it('lets the main character collect a drop by touching it', () => {
    assert.equal(isLootDropInPickupRange({ x: 0, z: 0 }, { x: 0.58, z: 0 }, 0.35), true);
    assert.equal(isLootDropInPickupRange({ x: 0, z: 0 }, { x: 0.61, z: 0 }, 0.35), false);
  });

  it('maps stars to points and scrolls to the scroll counter', () => {
    assert.equal(getLootTargetStat('star'), 'points');
    assert.equal(getLootTargetStat('scroll'), 'scroll');
  });

  it('holds the visible balance during animation even if background refresh arrives early', () => {
    assert.equal(getLootDisplayedBalance(20, [starDrop], [pending(starDrop, 'animating')], 'star'), 20);
    assert.equal(getLootDisplayedBalance(25, [], [pending(starDrop, 'animating')], 'star'), 20);
  });

  it('shows the optimistic reward after the animation arrives, then reconciles to server data', () => {
    assert.equal(getLootDisplayedBalance(20, [starDrop], [pending(starDrop, 'arrived')], 'star'), 25);
    assert.equal(getLootDisplayedBalance(25, [], [pending(starDrop, 'arrived')], 'star'), 25);
  });

  it('keeps star and scroll quantities independent', () => {
    const pendingLoot = [pending(starDrop, 'arrived'), pending(scrollDrop, 'animating')];
    assert.equal(getLootDisplayedBalance(10, [starDrop, scrollDrop], pendingLoot, 'star'), 15);
    assert.equal(getLootDisplayedBalance(2, [starDrop, scrollDrop], pendingLoot, 'scroll'), 2);
  });

  it('keeps the pickup animation stagger short enough for a large batch', () => {
    assert.equal(getLootAnimationDuration(false), 680);
    assert.equal(getLootAnimationDuration(true), 420);
  });

  it('holds a server-confirmed ten-point batch at zero until all ten animations arrive', () => {
    const tenDrops = Array.from({ length: 10 }, (_, index) => ({
      ...starDrop,
      id: `drop-star-${index}`,
      amount: 1,
    }));
    const animating = tenDrops.map((drop) => pending(drop, 'animating'));
    const arrived = tenDrops.map((drop) => pending(drop, 'arrived'));
    assert.equal(getLootDisplayedBalance(10, [], animating, 'star', true), 0);
    assert.equal(getLootDisplayedBalance(10, [], arrived, 'star', true), 10);
  });
});
