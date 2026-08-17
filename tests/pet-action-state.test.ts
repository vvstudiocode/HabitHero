import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  getPetActionPlan,
  type PetAction,
} from '../src/features/world/pet-action-state';

const runtimeSource = readFileSync(
  new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url),
  'utf8',
);
const terrainSource = readFileSync(
  new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url),
  'utf8',
);
const controlsSource = readFileSync(
  new URL('../src/styles/world-controls.css', import.meta.url),
  'utf8',
);
const dashboardSource = readFileSync(
  new URL('../src/components/ChildDashboard.tsx', import.meta.url),
  'utf8',
);
const followEntityMigrationSource = readFileSync(
  new URL('../supabase/migrations/20260817100000_fix_following_pet_world_entities.sql', import.meta.url),
  'utf8',
);
const roamingEntityMigrationSource = readFileSync(
  new URL('../supabase/migrations/20260817100100_preserve_roaming_pet_position.sql', import.meta.url),
  'utf8',
);

describe('pet action state', () => {
  const plan = (action: PetAction, followingIds: string[], roamingIds: string[], inventoryItemId = 'pet-1') => (
    getPetActionPlan({ action, followingIds, roamingIds, inventoryItemId })
  );

  it('turns a following pet into an idle world entity at its selected position', () => {
    assert.deepEqual(
      plan('idle', ['pet-1', 'pet-2'], ['pet-3']),
      {
        followingIds: ['pet-2'],
        roamingIds: ['pet-3'],
        shouldPlaceIdleEntity: true,
      },
    );
  });

  it('moves a following pet into the roaming queue when巡遊 is selected', () => {
    assert.deepEqual(
      plan('wander', ['pet-1', 'pet-2'], ['pet-3']),
      {
        followingIds: ['pet-2'],
        roamingIds: ['pet-3', 'pet-1'],
        shouldPlaceIdleEntity: false,
      },
    );
  });

  it('keeps an already roaming pet selected without duplicating it', () => {
    assert.deepEqual(
      plan('wander', [], ['pet-1', 'pet-3']),
      {
        followingIds: [],
        roamingIds: ['pet-1', 'pet-3'],
        shouldPlaceIdleEntity: false,
      },
    );
  });

  it('removes a roaming pet before placing it as an idle pet', () => {
    assert.deepEqual(
      plan('idle', [], ['pet-1', 'pet-3']),
      {
        followingIds: [],
        roamingIds: ['pet-3'],
        shouldPlaceIdleEntity: true,
      },
    );
  });

  it('keeps an already idle pet in place', () => {
    assert.deepEqual(
      plan('idle', [], []),
      {
        followingIds: [],
        roamingIds: [],
        shouldPlaceIdleEntity: false,
      },
    );
  });

  it('puts an idle or roaming pet at the front of the follow queue', () => {
    assert.deepEqual(
      plan('follow', [], ['pet-1', 'pet-3']),
      {
        followingIds: ['pet-1'],
        roamingIds: ['pet-3'],
        shouldPlaceIdleEntity: false,
      },
    );
  });

  it('does not duplicate a pet that is already following', () => {
    assert.deepEqual(
      plan('follow', ['pet-1', 'pet-2'], ['pet-3']),
      {
        followingIds: ['pet-1', 'pet-2'],
        roamingIds: ['pet-3'],
        shouldPlaceIdleEntity: false,
      },
    );
  });

  it('exposes a pet selection callback and hit test for both following and roaming actors', () => {
    assert.match(runtimeSource, /onPetSelect\?:/);
    assert.match(runtimeSource, /petRaycaster\.intersectObjects/);
    assert.match(runtimeSource, /onPetSelect\?\.\(petSelection\)/);
    assert.match(runtimeSource, /following: selected\.follow/);
    assert.match(runtimeSource, /optimisticPetIdles/);
    assert.match(runtimeSource, /optimisticallySetPetIdle/);
    assert.doesNotMatch(runtimeSource, /if \(activeIdleEntity\) \{[\s\S]*?optimisticPetIdles\.delete\(inventoryItemId\)/);
    assert.match(terrainSource, /onPetAction\?:/);
    assert.match(terrainSource, /runtimeRef\.current\?\.optimisticallySetPetIdle/);
    assert.match(terrainSource, /Promise\.resolve\(onPetAction\(selection, action\)\)\.then\(\(\) => \{[\s\S]*?clearOptimisticPetIdle/);
    assert.match(terrainSource, /待機/);
    assert.match(terrainSource, /巡遊/);
    assert.match(terrainSource, /跟隨/);
    assert.match(terrainSource, /commitPetAction\('follow'\)/);
    assert.match(dashboardSource, /onPetAction=\{handlePetAction\}/);
    assert.match(dashboardSource, /return true/);
    assert.match(dashboardSource, /action === 'idle' && selection\.following/);
    assert.match(dashboardSource, /removeWorldEntity\(activeChildId/);
    assert.match(dashboardSource, /positionOverrides/);
    assert.match(dashboardSource, /updateWorldEntityTransform\(activeChildId/);
    assert.match(dashboardSource, /placeWorldEntity\(activeChildId/);
    assert.match(dashboardSource, /behaviorMode: 'idle'/);
    assert.match(controlsSource, /\.hh-world-pet-selection/);
    assert.match(controlsSource, /min-height:\s*44px/);
    assert.match(followEntityMigrationSource, /behavior_mode = 'idle'/);
    assert.match(followEntityMigrationSource, /is_active = false/);
    assert.match(roamingEntityMigrationSource, /set behavior_mode = 'wander'/);
    assert.match(roamingEntityMigrationSource, /and behavior_mode = 'wander'/);
    assert.doesNotMatch(roamingEntityMigrationSource, /set behavior_mode = 'wander',[\s\S]*?position_x = -3\.5/);
    assert.match(roamingEntityMigrationSource, /insert into public\.child_world_entities/);
  });

  it('registers a pet that finishes loading after a purchase in the live actor list', () => {
    const dynamicPetLoadBlock = runtimeSource.match(
      /const actor = createRuntimePetActor\([\s\S]*?if \(!latestFollowingIds\.includes\(inventoryItemId\)\)/,
    )?.[0] ?? '';
    assert.match(dynamicPetLoadBlock, /petActors\.push\(actor\)/);
  });
});
