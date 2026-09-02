import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CHILD_CREATION_CHARACTER_IDS,
  WORLD_CHARACTER_CATALOG,
} from '../src/features/characters/world-character-catalog';
import {
  WORLD_SCENE_CONTENT,
  getWorldSceneContent,
  getWorldSceneNpc,
  getWorldScenePrimaryOfferings,
} from '../src/features/world/world-scene-content';
import {
  getWorldSceneProgress,
  getWorldSceneUnlockState,
  isWorldSceneUnlocked,
} from '../src/features/world/world-scene-unlocks';
import {
  getNpcDialogueState,
  getNpcOfferingsAfterDialogue,
} from '../src/features/world/world-npc-dialogue';
import {
  LEGACY_PET_ASSET_KEYS,
  getCatalogShopState,
  getItemSourceLabel,
  toItemSourceSnapshot,
} from '../src/features/world/world-npc-shop';
import {
  createWorldNpcRuntimePlan,
  getCharacterNpcAnimation,
  transitionRoamingNpcDialogue,
} from '../src/features/world/world-npc-runtime';

test('world scene content keeps the five scenes, six vendors, nine roaming pets, and 27 primary offerings', () => {
  assert.deepEqual(
    WORLD_SCENE_CONTENT.map((scene) => scene.id),
    ['sunrise-village', 'forest-valley', 'cloud-workshop', 'tideglow-archipelago', 'star-sand-wasteland'],
  );
  assert.equal(WORLD_SCENE_CONTENT.flatMap((scene) => scene.npcs).filter((npc) => npc.type === 'character_vendor').length, 6);
  assert.equal(WORLD_SCENE_CONTENT.flatMap((scene) => scene.npcs).filter((npc) => npc.type === 'roaming_pet').length, 9);
  const primaryOfferings = getWorldScenePrimaryOfferings();
  assert.equal(primaryOfferings.length, 27);
  assert.equal(new Set(primaryOfferings.map((offering) => offering.assetKey)).size, 27);
  assert.equal(getWorldSceneContent('cloud-workshop')?.name, '雲工房');
  assert.equal(getWorldSceneNpc('npc.nibus')?.sceneId, 'cloud-workshop');
});

test('scene unlock progress counts only completed tasks and only general adventure types', () => {
  const progress = getWorldSceneProgress([
    { status: 'completed', adventureType: 'daily' },
    { status: 'completed', adventureType: 'general' },
    { status: 'completed', adventureType: 'general' },
    { status: 'pending', adventureType: 'general' },
    { status: 'todo', adventureType: 'general' },
    { status: 'revision_requested', adventureType: 'general' },
  ]);
  assert.deepEqual(progress, { completedCount: 3, generalCompletedCount: 2 });
  assert.equal(isWorldSceneUnlocked('sunrise-village', progress), true);
  assert.equal(isWorldSceneUnlocked('forest-valley', progress), false);
  assert.equal(getWorldSceneUnlockState('cloud-workshop', progress), {
    unlocked: false,
    completedCount: 3,
    generalCompletedCount: 2,
    remainingCompletedCount: 9,
    remainingGeneralCompletedCount: 0,
  });
});

test('character creation selector narrows the UI without shrinking the complete legacy catalog', () => {
  assert.deepEqual(CHILD_CREATION_CHARACTER_IDS, [
    'character.arthur',
    'character.elina',
    'character.sia',
    'character.elio',
  ]);
  assert.equal(WORLD_CHARACTER_CATALOG.length, 10);
  assert.deepEqual(
    WORLD_CHARACTER_CATALOG.filter((character) => CHILD_CREATION_CHARACTER_IDS.includes(character.id)).map((character) => character.id),
    CHILD_CREATION_CHARACTER_IDS,
  );
});

test('dialogue completion gates offerings by child scene unlock and keeps the direct pet offering', () => {
  assert.deepEqual(getNpcDialogueState({ sceneUnlocked: false, talked: false }), {
    canTalk: false,
    canShop: false,
    reason: 'scene_locked',
  });
  assert.deepEqual(getNpcDialogueState({ sceneUnlocked: true, talked: false }), {
    canTalk: true,
    canShop: false,
    reason: 'talk_required',
  });
  assert.deepEqual(getNpcDialogueState({ sceneUnlocked: true, talked: true }), {
    canTalk: true,
    canShop: true,
    reason: null,
  });
  const offerings = getNpcOfferingsAfterDialogue('npc.nibus', {
    sceneUnlocked: true,
    talked: true,
  });
  assert.deepEqual(offerings.map((offering) => offering.assetKey), ['pet.nibus']);
});

test('shop hides retired pets for new acquisition but keeps legacy source compatibility', () => {
  assert.ok(LEGACY_PET_ASSET_KEYS.includes('pet.forest-guardian'));
  assert.ok(LEGACY_PET_ASSET_KEYS.includes('pet.starlight-sprout'));
  assert.deepEqual(getCatalogShopState({ itemType: 'pet', isActive: true, isStarter: false, isNewlyObtainable: false }), {
    visible: false,
    reason: 'legacy_pet',
  });
  assert.deepEqual(getCatalogShopState({ itemType: 'pet', isActive: true, isStarter: false, isNewlyObtainable: true }), {
    visible: true,
    reason: null,
  });
  assert.equal(getItemSourceLabel(null), '早期取得');
  assert.equal(getItemSourceLabel({ sceneId: 'cloud-workshop', npcName: '諾亞' }), '雲工房，找諾亞');
  assert.deepEqual(toItemSourceSnapshot('cloud-workshop', 'npc.noah', 2), {
    sourceSceneId: 'cloud-workshop',
    sourceNpcId: 'npc.noah',
    sourceDialogueVersion: 2,
  });
});

test('NPC runtime keeps character vendors dancing while pausing only roaming pets during dialogue', () => {
  const plan = createWorldNpcRuntimePlan('forest-valley');
  assert.deepEqual(plan.characterVendors.map((npc) => npc.id), ['npc.moss', 'npc.lunalia']);
  assert.equal(plan.characterVendors.every((npc) => npc.animationName === 'Dance'), true);
  assert.deepEqual(getCharacterNpcAnimation(['Idle']), { animationName: 'Idle', usedFallback: true });
  assert.deepEqual(getCharacterNpcAnimation(['Idle', 'Dance']), { animationName: 'Dance', usedFallback: false });
  assert.deepEqual(transitionRoamingNpcDialogue('roaming', 'open'), 'paused');
  assert.deepEqual(transitionRoamingNpcDialogue('paused', 'close'), 'roaming');
  assert.deepEqual(transitionRoamingNpcDialogue('paused', 'open'), 'paused');
});

test('scene NPC migration has additive schema, secure RPC boundaries, and no legacy cleanup', () => {
  const migrationName = readdirSync(new URL('../supabase/migrations/', import.meta.url))
    .find((name) => name.endsWith('_scene_npc_shop.sql'));
  assert.ok(migrationName, 'scene NPC migration should exist');
  const migration = readFileSync(new URL(`../supabase/migrations/${migrationName}`, import.meta.url), 'utf8');
  assert.match(migration, /create table public\.game_world_scenes/i);
  assert.match(migration, /create table public\.game_world_npcs/i);
  assert.match(migration, /create table public\.game_world_npc_offerings/i);
  assert.match(migration, /create table public\.child_world_scene_unlocks/i);
  assert.match(migration, /create table public\.child_world_npc_dialogue_progress/i);
  assert.match(migration, /is_child_creation_selectable boolean not null default false/i);
  assert.match(migration, /is_newly_obtainable boolean not null default true/i);
  assert.match(migration, /source_scene_id text/i);
  assert.match(migration, /create or replace function public\.unlock_world_scene_if_eligible/i);
  assert.match(migration, /create or replace function public\.complete_world_npc_dialogue/i);
  assert.match(migration, /target_source_npc_id text default null/i);
  assert.match(migration, /revoke all on function public\./i);
  assert.doesNotMatch(migration, /delete from public\.(game_catalog_items|child_inventory_items|game_item_purchases)/i);
  assert.doesNotMatch(migration, /is_active\s*=\s*false[\s\S]{0,100}item_type\s*=\s*'pet'/i);
});
