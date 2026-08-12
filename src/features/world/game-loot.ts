import type { GameLootDrop, GameLootDropKind } from './contracts';

export const GAME_LOOT_STAR_VISUAL_SCALE = 0.5;
export const GAME_LOOT_STAR_GLOW_RADIUS = 0.14;
export const GAME_LOOT_SCROLL_VISUAL_SCALE = 0.5;
export const GAME_LOOT_PICKUP_RADIUS = 0.24;

export function isLootDropInPickupRange(
  player: { x: number; z: number },
  drop: Pick<GameLootDrop, 'x' | 'z'>,
  playerRadius: number,
): boolean {
  return Math.hypot(player.x - drop.x, player.z - drop.z) <= playerRadius + GAME_LOOT_PICKUP_RADIUS;
}

export type LootPresentationPhase = 'animating' | 'arrived';

export interface PendingLootPresentation {
  drop: GameLootDrop;
  phase: LootPresentationPhase;
}

export interface LootAnimationPoint {
  x: number;
  y: number;
}

export interface LootAnimationEvent {
  id: string;
  dropId: string;
  kind: GameLootDropKind;
  amount: number;
  from: LootAnimationPoint;
  to: LootAnimationPoint;
  durationMs: number;
  delayMs?: number;
}

export function getLootTargetStat(kind: GameLootDropKind): 'points' | 'scroll' {
  return kind === 'star' ? 'points' : 'scroll';
}

/**
 * Keeps the HUD visually anchored to the pickup animation while the RPC and
 * realtime refresh complete in the background. A drop still present in the
 * server snapshot has not been claimed yet; a missing drop has already been
 * claimed and is therefore included in the server balance.
 */
export function getLootDisplayedBalance(
  serverBalance: number,
  serverDrops: GameLootDrop[],
  pendingLoot: PendingLootPresentation[],
  kind: GameLootDropKind,
  authoritativeBalance = false,
): number {
  const serverDropIds = new Set(
    serverDrops.filter((drop) => drop.kind === kind).map((drop) => drop.id),
  );
  let optimisticDelta = 0;
  for (const pending of pendingLoot) {
    if (pending.drop.kind !== kind) {
      continue;
    }
    if (authoritativeBalance) {
      // The batch RPC has already returned the authoritative wallet value.
      // Keep the number at its pre-pickup value until each flying item reaches
      // the HUD, regardless of whether the background refresh has removed the
      // corresponding drop row yet.
      if (pending.phase === 'animating') optimisticDelta -= pending.drop.amount;
    } else if (pending.phase === 'arrived') {
      // The pickup RPC has succeeded, but the next game-data refresh may
      // still contain the old available-drop snapshot. Once the animation
      // arrives, show the reward immediately and let the next refresh settle
      // it back to the authoritative balance.
      if (serverDropIds.has(pending.drop.id)) {
        optimisticDelta += pending.drop.amount;
      }
    } else if (!serverDropIds.has(pending.drop.id)) {
      // A refresh can win the race with the animation. Keep the counter at
      // its pre-pickup value until the flying item reaches the HUD.
      optimisticDelta -= pending.drop.amount;
    }
  }
  return Math.max(0, Math.round(serverBalance + optimisticDelta));
}

export function getLootAnimationDuration(reducedMotion: boolean): number {
  return reducedMotion ? 420 : 680;
}

export function getLootAnimationDelay(index: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.min(Math.max(0, Math.floor(index)) * 22, 220);
}
