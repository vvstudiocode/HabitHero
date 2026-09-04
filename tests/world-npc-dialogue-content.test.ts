import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORLD_RICH_DIALOGUE_NPC_IDS,
  getWorldNpcDialogueContent,
  getWorldNpcRepeatDialogueLines,
} from '../src/features/world/world-npc-dialogue-content';
import { WORLD_SCENE_CONTENT } from '../src/features/world/world-scene-content';

const ALL_WORLD_NPC_IDS = WORLD_SCENE_CONTENT.flatMap((scene) => scene.npcs.map((npc) => npc.id));
const SUNRISE_NPC_IDS = ['npc.gilt', 'npc.oum', 'npc.arcadia'] as const;

test('every scene NPC and roaming pet has lightweight dialogue content', () => {
  assert.deepEqual([...WORLD_RICH_DIALOGUE_NPC_IDS].sort(), [...ALL_WORLD_NPC_IDS].sort());
  for (const npcId of ALL_WORLD_NPC_IDS) {
    assert.ok(getWorldNpcDialogueContent(npcId), `missing dialogue content for ${npcId}`);
  }
});

test('sunrise village NPCs have lightweight first conversations and repeat dialogue', () => {
  for (const npcId of ALL_WORLD_NPC_IDS) {
    const content = getWorldNpcDialogueContent(npcId);
    assert.ok(content, `missing dialogue content for ${npcId}`);
    assert.equal(content.opening.length, 3);
    assert.ok(content.choicePrompt.trim().length > 0);
    assert.notEqual(content.opening[2], content.choicePrompt);
    assert.equal(content.choices.length, 3);
    assert.equal(content.closing.length, 2);
    assert.ok(content.repeat.length >= 4);
    assert.ok(content.opening.every((line) => line.trim().length > 0));
    assert.ok(content.closing.every((line) => line.trim().length > 0));
  }
});

test('first conversation choices keep a response attached to every choice', () => {
  for (const npcId of ALL_WORLD_NPC_IDS) {
    const choices = getWorldNpcDialogueContent(npcId)?.choices ?? [];
    assert.ok(choices.every((choice) => choice.id && choice.label && choice.response));
  }
});

test('repeat dialogue reflects lightweight player context without adding a quest', () => {
  const completedToday = getWorldNpcRepeatDialogueLines('npc.gilt', {
    hasCompletedAdventureToday: true,
    ownedCatalogItemIds: [],
  });
  assert.ok(completedToday.some((line) => line.text.includes('村口的鐘聲')));

  const ownsOum = getWorldNpcRepeatDialogueLines('npc.gilt', {
    hasCompletedAdventureToday: false,
    ownedCatalogItemIds: ['pet.oum'],
  });
  assert.ok(ownsOum.some((line) => line.text.includes('歐姆已經開始研究')));

  const defaultOum = getWorldNpcRepeatDialogueLines('npc.oum', {
    hasCompletedAdventureToday: false,
    ownedCatalogItemIds: [],
  });
  assert.ok(defaultOum.some((line) => line.text.includes('走一小步')));
  assert.ok(!defaultOum.some((line) => line.text.includes('真的要跟你一起回家')));

  const ownedArcadia = getWorldNpcRepeatDialogueLines('npc.arcadia', {
    ownedCatalogItemIds: ['pet.arcadia'],
  });
  assert.ok(ownedArcadia.some((line) => line.text.includes('一起看風景')));

  const ownedForestPet = getWorldNpcRepeatDialogueLines('npc.jasmine', {
    ownedCatalogItemIds: ['pet.jasmine'],
  });
  assert.ok(ownedForestPet.some((line) => line.text.includes('一起回家')));
});

test('unknown NPCs keep the existing generic dialogue fallback path', () => {
  assert.equal(getWorldNpcDialogueContent('npc.unknown'), undefined);
  assert.deepEqual(getWorldNpcRepeatDialogueLines('npc.unknown', {}), []);
});
