import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import {
  advancePetIdleCycle,
  getPetAnimationClipName,
  PET_ANIMATION_CROSSFADE_SECONDS,
  PET_IDLE_PAUSE_DURATION_RANGE,
  PET_WALK_ONLY_PAUSE_DURATION_RANGE,
  queuePetMoveAfterIdleCycle,
} from '../src/features/world/pet-animation';
import {
  createWanderState,
  getWanderStep,
  hashWanderSeed,
} from '../src/features/world/world-roaming';

describe('pet idle animation behavior', () => {
  it('selects an authored idle clip without mistaking a walk clip for idle', () => {
    assert.equal(getPetAnimationClipName(['Walk', 'Sad Idle'], 'idle'), 'Sad Idle');
    assert.equal(getPetAnimationClipName(['Walk'], 'idle'), undefined);
    assert.equal(getPetAnimationClipName(['Walk'], 'walk'), 'Walk');
  });

  it('pauses pets with authored idle poses for a randomized three-to-five seconds', () => {
    const state = createWanderState(hashWanderSeed('pet:nibus'), { x: 0, z: 1 });
    state.nextPauseAt = 0;
    const step = getWanderStep(
      { x: 0, z: 0 },
      0.1,
      0.34,
      0.5,
      [],
      state,
      1,
      PET_IDLE_PAUSE_DURATION_RANGE,
    );

    assert.equal(step.walking, false);
    assert.equal(PET_IDLE_PAUSE_DURATION_RANGE.min, 3);
    assert.equal(PET_IDLE_PAUSE_DURATION_RANGE.max, 5);
    assert.ok(state.pauseUntil >= 4 && state.pauseUntil <= 6);

    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
    assert.match(runtime, /actor\.idleAction\s*\?\s*PET_IDLE_PAUSE_DURATION_RANGE\s*:\s*PET_WALK_ONLY_PAUSE_DURATION_RANGE/);

    const migrationName = readdirSync(new URL('../supabase/migrations/', import.meta.url))
      .find((name) => name.includes('set_authored_idle_pause_to_three_to_five_seconds'));
    assert.ok(migrationName);
    const migration = readFileSync(new URL(`../supabase/migrations/${migrationName}`, import.meta.url), 'utf8');
    assert.match(migration, /idlePauseSeconds/);
    assert.match(migration, /item_type\s*=\s*'pet'/);
    assert.match(migration, /is_active\s*=\s*true/);
    assert.match(migration, /'idlePauseMinSeconds', 3/);
    assert.match(migration, /'idlePauseMaxSeconds', 5/);
    assert.match(migration, /idleAnimation/);

    const walkOnlyMigrationName = readdirSync(new URL('../supabase/migrations/', import.meta.url))
      .find((name) => name.includes('set_walk_only_pet_pause_range'));
    assert.ok(walkOnlyMigrationName);
    const walkOnlyMigration = readFileSync(new URL(`../supabase/migrations/${walkOnlyMigrationName}`, import.meta.url), 'utf8');
    assert.match(walkOnlyMigration, /'walkOnlyPauseMinSeconds', 3/);
    assert.match(walkOnlyMigration, /'walkOnlyPauseMaxSeconds', 5/);
    assert.match(walkOnlyMigration, /idleAnimation/);
  });

  it('gives walk-only pets a randomized three-to-five-second pause', () => {
    assert.equal(PET_WALK_ONLY_PAUSE_DURATION_RANGE.min, 3);
    assert.equal(PET_WALK_ONLY_PAUSE_DURATION_RANGE.max, 5);

    const first = createWanderState(hashWanderSeed('pet:walk-only:first'), { x: 0, z: 1 });
    const second = createWanderState(hashWanderSeed('pet:walk-only:second'), { x: 0, z: 1 });
    first.nextPauseAt = 0;
    second.nextPauseAt = 0;
    getWanderStep({ x: 0, z: 0 }, 0.1, 0.34, 0.5, [], first, 1, PET_WALK_ONLY_PAUSE_DURATION_RANGE);
    getWanderStep({ x: 0, z: 0 }, 0.1, 0.34, 0.5, [], second, 1, PET_WALK_ONLY_PAUSE_DURATION_RANGE);

    assert.ok(first.pauseUntil >= 4 && first.pauseUntil <= 6);
    assert.ok(second.pauseUntil >= 4 && second.pauseUntil <= 6);
    assert.notEqual(first.pauseUntil, second.pauseUntil);
  });

  it('queues movement until an authored idle animation completes one full cycle', () => {
    const queued = queuePetMoveAfterIdleCycle({ cycleElapsed: 0, movePending: false }, true);
    const beforeEnd = advancePetIdleCycle(queued, 0.9, 1);
    const atNaturalEnd = advancePetIdleCycle(beforeEnd.state, 0.1, 1);

    assert.equal(beforeEnd.shouldSwitchToWalk, false);
    assert.equal(atNaturalEnd.shouldSwitchToWalk, true);
    assert.equal(atNaturalEnd.state.movePending, false);
    assert.equal(atNaturalEnd.state.cycleElapsed, 0);
  });

  it('uses a short crossfade when changing between idle and walk actions', () => {
    assert.equal(PET_ANIMATION_CROSSFADE_SECONDS, 0.2);

    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
    assert.match(runtime, /movePending/);
    assert.match(runtime, /advancePetIdleCycle/);
    assert.match(runtime, /crossFadeFrom|crossFadeTo/);
    assert.doesNotMatch(runtime, /if \(idleAction && activeAction === idleAction\) pauseAnimationAtIdlePose/);
  });
});
