import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  getPetActionPlan,
  shouldPausePetForMenu,
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
const tokensSource = readFileSync(
  new URL('../src/styles/tokens.css', import.meta.url),
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

  it('pauses only roaming pets while their action menu is open', () => {
    assert.equal(shouldPausePetForMenu({ behaviorMode: 'wander', following: false }), true);
    assert.equal(shouldPausePetForMenu({ behaviorMode: 'idle', following: false }), false);
    assert.equal(shouldPausePetForMenu({ behaviorMode: 'wander', following: true }), false);
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

  it('pauses a roaming pet for the menu and resumes it when the menu is dismissed', () => {
    assert.match(terrainSource, /shouldPausePetForMenu\(selection\)/);
    assert.match(terrainSource, /optimisticallySetPetIdle\(selection\)/);
    assert.match(terrainSource, /const clearPetMenuPause = \(\) =>/);
    assert.match(terrainSource, /clearPetMenuPause\(\);[\s\S]*?setSelectedPet\(null\)/);
    assert.match(terrainSource, /const commitPetAction = \(action: PetAction\) => \{[\s\S]*?clearPetMenuPause\(\);/);
    assert.match(terrainSource, /const commitPetAnimation = \(action: PetAnimationAction\) => \{[\s\S]*?clearPetMenuPause\(\);/);
  });

  it('uses vertical icon-only pet controls on compact touch screens while preserving accessible labels', () => {
    assert.match(terrainSource, /className="hh-world-pet-action-label">待機<\/span>/);
    assert.match(terrainSource, /className="hh-world-pet-action-label">巡遊<\/span>/);
    assert.match(terrainSource, /className="hh-world-pet-action-label">\s*\{selectedPet\.following \? '跟隨中' : '跟隨'\}\s*<\/span>/);
    assert.match(controlsSource, /@media \(max-width: 760px\) \{[\s\S]*?\.hh-world-pet-actions \{[\s\S]*?flex-direction:\s*column;/);
    assert.match(controlsSource, /\.hh-world-pet-selection\s*\{[\s\S]*?transform:\s*translate\(\s*calc\(-50% \+ var\(--hh-world-pet-action-mobile-horizontal-offset\)\),\s*calc\(-50% \+ var\(--hh-world-pet-action-mobile-offset\)\)\s*\);/);
    assert.match(controlsSource, /\.hh-world-pet-action-label\s*\{[\s\S]*?display:\s*none;/);
    assert.match(controlsSource, /\.hh-world-pet-action\s*\{[\s\S]*?width:\s*var\(--hh-world-pet-action-mobile-size\);[\s\S]*?min-width:\s*var\(--hh-world-pet-action-mobile-size\);/);
    assert.match(controlsSource, /\.hh-world-pet-action::before\s*\{[\s\S]*?background:\s*var\(--hh-world-pet-action-mobile-surface\);/);
    assert.match(controlsSource, /\.hh-world-pet-action\.is-selected::before\s*\{[\s\S]*?background:\s*var\(--hh-world-pet-action-mobile-selected-surface\);/);
    assert.match(tokensSource, /--hh-world-pet-action-mobile-size:\s*44px;/);
    assert.match(tokensSource, /--hh-world-pet-action-mobile-visual-size:\s*32px;/);
    assert.match(tokensSource, /--hh-world-pet-action-mobile-gap:\s*2px;/);
    assert.match(tokensSource, /--hh-world-pet-action-mobile-horizontal-offset:\s*12px;/);
    assert.match(tokensSource, /--hh-world-pet-action-mobile-offset:\s*16px;/);
    assert.match(tokensSource, /--hh-world-pet-action-mobile-surface:\s*rgb\(255 253 248 \/ 82%\);/);
    assert.match(tokensSource, /--hh-world-pet-action-mobile-selected-surface:\s*rgb\(91 156 105 \/ 84%\);/);
  });

  it('registers a pet that finishes loading after a purchase in the live actor list', () => {
    const dynamicPetLoadBlock = runtimeSource.match(
      /const actor = createRuntimePetActor\([\s\S]*?if \(!latestFollowingIds\.includes\(inventoryItemId\)\)/,
    )?.[0] ?? '';
    assert.match(dynamicPetLoadBlock, /petActors\.push\(actor\)/);
  });
});
