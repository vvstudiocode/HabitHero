import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const fileHash = (path: string | URL) => createHash('md5').update(readFileSync(path)).digest('hex');

test('character catalog provides category-based options independent of gender', async () => {
  const { CHARACTER_CATALOG, getCharacterById, getCharactersForCategory } = await import('../src/features/characters/catalog.ts');

  assert.equal(CHARACTER_CATALOG.length, 3);
  assert.equal(getCharactersForCategory('all').length, 3);
  assert.equal(CHARACTER_CATALOG[0].id, 'pink-catgirl-room');
  assert.equal(CHARACTER_CATALOG[0].imageUrl, '/images/habithero-catgirl-room.png');
  assert.equal(CHARACTER_CATALOG[0].desktopImageUrl, '/images/habithero-catgirl-room-desktop.png');
  assert.equal(getCharacterById('black-catboy-room')?.name, '黑貓男');
  assert.equal(getCharacterById('black-catboy-room')?.imageUrl, '/images/habithero-black-catboy-room.png');
  assert.equal(getCharacterById('black-catboy-room')?.desktopImageUrl, '/images/habithero-black-catboy-room-desktop.png');
  assert.equal(getCharacterById('black-catboy-room')?.accentColor, '#d9d9df');
  assert.equal(getCharacterById('blue-catboy-room')?.name, '藍貓男');
  assert.equal(getCharacterById('blue-catboy-room')?.imageUrl, '/images/habithero-blue-catboy-room.png');
  assert.equal(getCharacterById('blue-catboy-room')?.desktopImageUrl, '/images/habithero-blue-catboy-room-desktop.png');
  assert.equal(getCharacterById('blue-catboy-room')?.accentColor, '#a8dcff');
  assert.equal(fileHash(new URL('../public/images/habithero-blue-catboy-room.png', import.meta.url)), '7daef77c30b28ef2386f0a3ea48546a1');
  assert.equal(fileHash(new URL('../public/images/habithero-blue-catboy-room-desktop.png', import.meta.url)), 'a90ce4a5864829a12d0bb398162273fb');
  assert.equal(getCharacterById('pink-catgirl-room')?.imageUrl, '/images/habithero-catgirl-room.png');
  assert.equal(getCharacterById('missing-character'), undefined);
  assert.equal(new Set(CHARACTER_CATALOG.map(character => character.id)).size, CHARACTER_CATALOG.length);
  assert.ok(CHARACTER_CATALOG.every(character => ['adventure', 'nature', 'fantasy'].includes(character.category)));
});

test('dashboard hero uses a complete scene image instead of composing a background and character layer', () => {
  const source = read('../src/components/DashboardCharacterHero.tsx');

  assert.match(source, /sceneImage: string/);
  assert.match(source, /sceneImageDesktop\?: string/);
  assert.match(source, /media="\(min-width: 760px\)"/);
  assert.match(source, /<img/);
  assert.doesNotMatch(source, /<video/);
});

test('parent and child dashboards provide their own complete scene images', () => {
  const parentSource = read('../src/components/ParentDashboard.tsx');
  const childSource = read('../src/components/ChildDashboard.tsx');

  assert.match(parentSource, /sceneImage="\/images\/habithero-parent-living-room\.png"/);
  assert.match(parentSource, /sceneImageDesktop="\/images\/habithero-parent-living-room-desktop\.png"/);
  assert.match(childSource, /getCharacterById\(activeChild\?\.characterId\)/);
  assert.match(childSource, /sceneImage=\{activeCharacter\.imageUrl\}/);
  assert.match(childSource, /sceneImageDesktop=\{activeCharacter\.desktopImageUrl\}/);
});

test('family child picker uses each child character scene thumbnail', () => {
  const source = read('../src/components/FamilyChildPicker.tsx');

  assert.match(source, /getCharacterById\(child\.characterId\)/);
  assert.match(source, /character\.imageUrl/);
  assert.match(source, /<img/);
});

test('new child flow requires gender and character before creation', () => {
  const source = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');

  assert.match(source, /newChildGender/);
  assert.match(source, /newChildCharacterId/);
  assert.match(source, /getCharactersForCategory/);
  assert.match(source, /CHARACTER_CATEGORIES/);
  assert.match(source, /hh-character-preview-modal/);
  assert.match(source, /aria-required="true"/);
  assert.match(source, /disabled=\{[^}]*!selectedGender[^}]*!selectedCharacterId/);
});

test('new child drawer closes only after the creation request succeeds', () => {
  const source = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');

  assert.doesNotMatch(source, /previousNewChildName/);
  assert.doesNotMatch(source, /wasFilled && !newChildName/);
  assert.match(source, /const created = await onAddChild/);
  assert.match(source, /if \(created\) closeNewChildForm\(\)/);
});

test('gender and character controls are keyboard and touch accessible', () => {
  const source = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');

  assert.match(source, /role="radiogroup"/);
  assert.match(source, /role="radio"/);
  assert.match(source, /aria-checked=\{selectedGender === gender/);
  assert.match(source, /type="button"/);
  assert.match(source, /hh-gender-option/);
  assert.match(source, /hh-character-selection-trigger/);
  assert.match(source, /aria-haspopup="dialog"/);
});

test('child account provisioning sends the selected identity to the RPC', () => {
  const source = read('../supabase/functions/manage-child-account/index.ts');

  assert.match(source, /target_gender:\s*body\.gender/);
  assert.match(source, /target_character_id:\s*characterId/);
  assert.match(source, /SUPABASE_ANON_KEY.*SUPABASE_PUBLISHABLE_KEY/);
});

test('existing children expose no gender or character editing controls', () => {
  const source = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');
  const existingChildrenSection = source.slice(source.indexOf('return ('), source.indexOf('<section data-tour="add-child"'));

  assert.doesNotMatch(existingChildrenSection, /role="radiogroup"|getCharactersForCategory|newChildGender|newChildCharacterId/);
  assert.doesNotMatch(existingChildrenSection, /更換角色|性別選擇/);
});
