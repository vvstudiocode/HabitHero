import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CHILD_CREATION_CHARACTER_IDS,
  WORLD_CHARACTER_CATALOG,
  isChildCreationCharacterId,
} from '../src/features/characters/world-character-catalog';
import {
  WORLD_SCENE_CONTENT,
  getWorldSceneContent,
  getWorldSceneNpc,
  getWorldSceneNpcOfferings,
  getWorldScenePrimaryOfferings,
} from '../src/features/world/world-scene-content';
import {
  getWorldSceneProgress,
  getWorldSceneEntryState,
  getWorldSceneUnlockState,
  isWorldSceneUnlocked,
} from '../src/features/world/world-scene-unlocks';
import {
  getNpcDialogueState,
  getNpcOfferingsAfterDialogue,
  isNpcDialogueOfferingVisible,
} from '../src/features/world/world-npc-dialogue';
import {
  LEGACY_PET_ASSET_KEYS,
  getCatalogShopState,
  getCatalogShopSourceLabel,
  getInventorySourceLabel,
  getItemSourceLabel,
  toItemSourceSnapshot,
} from '../src/features/world/world-npc-shop';
import {
  createWorldNpcRuntimePlan,
  getCharacterNpcAnimation,
  isWorldNpcNearby,
  transitionRoamingNpcDialogue,
  WORLD_NPC_INTERACTION_ENTER_RADIUS,
  WORLD_NPC_INTERACTION_EXIT_RADIUS,
} from '../src/features/world/world-npc-runtime';
import {
  buildNpcPurchasePayload,
  buildUnlockWorldScenePayload,
} from '../src/features/world/world-scene-data-access';

test('world scene content keeps the five scenes, six vendors, nine roaming pets, and 33 primary offerings', () => {
  assert.deepEqual(
    WORLD_SCENE_CONTENT.map((scene) => scene.id),
    ['sunrise-village', 'forest-valley', 'cloud-workshop', 'tideglow-archipelago', 'star-sand-wasteland'],
  );
  assert.equal(WORLD_SCENE_CONTENT.flatMap((scene) => scene.npcs).filter((npc) => npc.type === 'character_vendor').length, 6);
  assert.equal(WORLD_SCENE_CONTENT.flatMap((scene) => scene.npcs).filter((npc) => npc.type === 'roaming_pet').length, 9);
  const primaryOfferings = getWorldScenePrimaryOfferings();
  assert.equal(primaryOfferings.length, 33);
  assert.equal(new Set(primaryOfferings.map((offering) => offering.assetKey)).size, 33);
  WORLD_SCENE_CONTENT.flatMap((scene) => scene.npcs)
    .filter((npc) => npc.type === 'character_vendor')
    .forEach((npc) => {
      assert.deepEqual(getWorldSceneNpcOfferings(npc.id).find((offering) => offering.assetKey === npc.assetKey), {
        npcId: npc.id,
        assetKey: npc.assetKey,
        sortOrder: 1,
        isPrimarySource: true,
      });
    });
  assert.equal(getWorldSceneContent('cloud-workshop')?.name, '雲工房');
  assert.equal(getWorldSceneNpc('npc.nibus')?.sceneId, 'cloud-workshop');
  const arcadia = getWorldSceneNpc('npc.arcadia');
  assert.deepEqual(arcadia?.position, { x: 4.1, y: 0, z: -1.7 });
  assert.deepEqual(arcadia?.roamBounds, { minX: 3.1, maxX: 5.8, minZ: -2.7, maxZ: 1.7 });
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
  assert.deepEqual(getWorldSceneUnlockState('cloud-workshop', progress), {
    unlocked: false,
    completedCount: 3,
    generalCompletedCount: 2,
    remainingCompletedCount: 9,
    remainingGeneralCompletedCount: 0,
  });
  assert.equal(getWorldSceneEntryState('cloud-workshop', progress, true).unlocked, true);
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
    WORLD_CHARACTER_CATALOG.filter((character) => isChildCreationCharacterId(character.id)).map((character) => character.id),
    CHILD_CREATION_CHARACTER_IDS,
  );
});

test('account provisioning repeats the new-child character gate at the edge boundary', () => {
  const source = readFileSync(new URL('../supabase/functions/manage-child-account/index.ts', import.meta.url), 'utf8');
  assert.match(source, /childCreationCharacterIds/);
  assert.match(source, /childCreationCharacterIds\.has\(characterId\)/);
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

test('dialogue presentation keeps pets with their own NPC and keeps decorations with vendors', () => {
  assert.equal(isNpcDialogueOfferingVisible('character_vendor', 'decoration'), true);
  assert.equal(isNpcDialogueOfferingVisible('character_vendor', 'character'), true);
  assert.equal(isNpcDialogueOfferingVisible('character_vendor', 'pet'), false);
  assert.equal(isNpcDialogueOfferingVisible('roaming_pet', 'pet'), true);
  assert.equal(isNpcDialogueOfferingVisible('roaming_pet', 'decoration'), false);
});

test('NPC dialogue prompt requires close contact and dismisses after a short walk away', () => {
  assert.ok(WORLD_NPC_INTERACTION_ENTER_RADIUS < 1.5);
  assert.equal(WORLD_NPC_INTERACTION_EXIT_RADIUS, WORLD_NPC_INTERACTION_ENTER_RADIUS);
  assert.equal(isWorldNpcNearby(WORLD_NPC_INTERACTION_ENTER_RADIUS, false), true);
  assert.equal(isWorldNpcNearby(WORLD_NPC_INTERACTION_ENTER_RADIUS + 0.01, false), false);
  assert.equal(isWorldNpcNearby(WORLD_NPC_INTERACTION_EXIT_RADIUS, true), true);
  assert.equal(isWorldNpcNearby(WORLD_NPC_INTERACTION_EXIT_RADIUS + 0.01, true), false);
});

test('shop hides retired pets for new acquisition but keeps legacy source compatibility', () => {
  assert.ok(LEGACY_PET_ASSET_KEYS.includes('pet.forest-guardian'));
  assert.ok(LEGACY_PET_ASSET_KEYS.includes('pet.starlight-sprout'));
  assert.deepEqual(getCatalogShopState({ itemType: 'pet', isActive: true, isStarter: false, isNewlyObtainable: false }), {
    visible: false,
    purchasable: false,
    reason: 'legacy_pet',
  });
  assert.deepEqual(getCatalogShopState({ id: 'pet-new', itemType: 'pet', isActive: true, isStarter: false, isNewlyObtainable: true }, {
    unlockedSceneIds: ['sunrise-village'],
    talkedNpcIds: ['npc.oum'],
    offerings: [{
      sceneId: 'sunrise-village',
      npcId: 'npc.gilt',
      npcName: '吉爾特',
      catalogItemId: 'pet-new',
      dialogueVersion: 1,
      isPrimarySource: true,
    }, {
      sceneId: 'sunrise-village',
      npcId: 'npc.oum',
      npcName: '歐姆',
      catalogItemId: 'pet-new',
      dialogueVersion: 1,
      isPrimarySource: false,
    }],
  }), {
    visible: true,
    purchasable: true,
    reason: null,
    source: {
      catalogItemId: 'pet-new',
      sceneId: 'sunrise-village',
      npcId: 'npc.oum',
      npcName: '歐姆',
      dialogueVersion: 1,
    },
  });
  assert.equal(getItemSourceLabel(null), '早期取得');
  assert.equal(getItemSourceLabel({ sceneId: 'cloud-workshop', npcName: '諾亞' }), '雲工房，找諾亞');
  assert.equal(getInventorySourceLabel('cloud-workshop', 'npc.noah'), '雲工房，找諾亞');
  assert.equal(getInventorySourceLabel(null, null), '早期取得');
  assert.deepEqual(toItemSourceSnapshot('cloud-workshop', 'npc.noah', 2), {
    sourceSceneId: 'cloud-workshop',
    sourceNpcId: 'npc.noah',
    sourceDialogueVersion: 2,
  });
  assert.deepEqual(getCatalogShopState(
    { id: 'decoration-bed', itemType: 'decoration', assetKey: 'decoration.bed', isActive: true, isStarter: false },
    {
      unlockedSceneIds: [],
      talkedNpcIds: [],
      offerings: [{ sceneId: 'sunrise-village', npcId: 'npc.gilt', npcName: '吉爾特', catalogItemId: 'decoration-bed', dialogueVersion: 1, isPrimarySource: true }],
    },
  ), {
    visible: true,
    purchasable: false,
    reason: 'scene_locked',
    source: {
      catalogItemId: 'decoration-bed',
      sceneId: 'sunrise-village',
      npcId: 'npc.gilt',
      npcName: '吉爾特',
      dialogueVersion: 1,
    },
  });
  assert.equal(getCatalogShopState(
    { id: 'decoration-bed', itemType: 'decoration', assetKey: 'decoration.bed', isActive: true, isStarter: false },
    {
      unlockedSceneIds: ['sunrise-village'],
      talkedNpcIds: [],
      offerings: [{ sceneId: 'sunrise-village', npcId: 'npc.gilt', npcName: '吉爾特', catalogItemId: 'decoration-bed', dialogueVersion: 1, isPrimarySource: true }],
    },
  ).reason, 'dialogue_required');
});

test('talking to a roaming pet unlocks its direct backpack shop source', () => {
  const pet = { id: 'pet-oum', itemType: 'pet' as const, isActive: true, isStarter: false, isNewlyObtainable: true };
  const gateContext = {
    unlockedSceneIds: ['sunrise-village'],
    talkedNpcIds: ['npc.oum'],
    offerings: [
      { catalogItemId: 'pet-oum', sceneId: 'sunrise-village', npcId: 'npc.gilt', npcName: '吉爾特', dialogueVersion: 1, isPrimarySource: true },
      { catalogItemId: 'pet-oum', sceneId: 'sunrise-village', npcId: 'npc.oum', npcName: '歐姆', dialogueVersion: 1, isPrimarySource: false },
    ],
  };

  assert.deepEqual(getCatalogShopState(pet, gateContext), {
    visible: true,
    purchasable: true,
    reason: null,
    source: {
      catalogItemId: 'pet-oum',
      sceneId: 'sunrise-village',
      npcId: 'npc.oum',
      npcName: '歐姆',
      dialogueVersion: 1,
    },
  });
  assert.equal(getCatalogShopSourceLabel(pet, gateContext), '晨光村，找歐姆');

  const beforeTalk = { ...gateContext, talkedNpcIds: [] };
  assert.equal(getCatalogShopState(pet, beforeTalk).reason, 'dialogue_required');
  assert.equal(getCatalogShopSourceLabel(pet, beforeTalk), '晨光村，找歐姆');
});

test('talking to a character vendor unlocks that NPC character in the backpack shop', () => {
  const character = { id: 'character-gilt', itemType: 'character' as const, isActive: true, isStarter: false, isNewlyObtainable: true };
  const gateContext = {
    unlockedSceneIds: ['sunrise-village'],
    talkedNpcIds: ['npc.gilt'],
    offerings: [{
      catalogItemId: 'character-gilt',
      sceneId: 'sunrise-village',
      npcId: 'npc.gilt',
      npcName: '吉爾特',
      dialogueVersion: 1,
      isPrimarySource: true,
    }],
  };

  assert.deepEqual(getCatalogShopState(character, gateContext), {
    visible: true,
    purchasable: true,
    reason: null,
    source: {
      catalogItemId: 'character-gilt',
      sceneId: 'sunrise-village',
      npcId: 'npc.gilt',
      npcName: '吉爾特',
      dialogueVersion: 1,
    },
  });
  assert.equal(getCatalogShopSourceLabel(character, gateContext), '晨光村，找吉爾特');
});

test('talking to a character vendor does not unlock a pet in the backpack shop', () => {
  const pet = { id: 'pet-arcadia', itemType: 'pet' as const, isActive: true, isStarter: false, isNewlyObtainable: true };
  const state = getCatalogShopState(pet, {
    unlockedSceneIds: ['sunrise-village'],
    talkedNpcIds: ['npc.gilt'],
    offerings: [
      { catalogItemId: 'pet-arcadia', sceneId: 'sunrise-village', npcId: 'npc.gilt', npcName: '吉爾特', dialogueVersion: 1, isPrimarySource: true },
      { catalogItemId: 'pet-arcadia', sceneId: 'sunrise-village', npcId: 'npc.arcadia', npcName: '阿卡迪亞', dialogueVersion: 1, isPrimarySource: false },
    ],
  });

  assert.deepEqual(state, {
    visible: true,
    purchasable: false,
    reason: 'dialogue_required',
    source: {
      catalogItemId: 'pet-arcadia',
      sceneId: 'sunrise-village',
      npcId: 'npc.arcadia',
      npcName: '阿卡迪亞',
      dialogueVersion: 1,
    },
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

test('frontend scene adapters keep child and NPC source identity explicit', () => {
  assert.deepEqual(buildUnlockWorldScenePayload('forest-valley', 'child-1'), {
    target_scene_id: 'forest-valley',
    target_child_profile_id: 'child-1',
  });
  assert.deepEqual(buildNpcPurchasePayload('catalog-1', 1, 'purchase-1', 'child-1', 'npc.moss'), {
    target_catalog_item_id: 'catalog-1',
    target_quantity: 1,
    purchase_idempotency_key: 'purchase-1',
    target_child_profile_id: 'child-1',
    target_source_npc_id: 'npc.moss',
  });
});

test('scene NPC migration has additive schema, secure RPC boundaries, and no legacy cleanup', () => {
  const migrationName = '20260902191718_scene_npc_shop.sql';
  assert.deepEqual(
    readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((name) => name.endsWith('_scene_npc_shop.sql')),
    [migrationName],
  );
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
