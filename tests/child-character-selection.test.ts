import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('legacy room character catalog and assets are removed', async () => {
  const root = new URL('..', import.meta.url);
  assert.equal(existsSync(new URL('../src/features/characters/catalog.ts', import.meta.url)), false);

  const legacyAssets = [
    'public/images/habithero-dashboard-room.png',
    'public/images/parent-character.png',
    'public/images/parent-room-background.png',
    'public/images/habithero-catgirl-room.png',
    'public/images/habithero-catgirl-room-desktop.png',
    'public/images/habithero-black-catboy-room.png',
    'public/images/habithero-black-catboy-room-desktop.png',
    'public/images/habithero-blue-catboy-room.png',
    'public/images/habithero-blue-catboy-room-desktop.png',
    'public/images/habithero-white-catgirl-room.png',
    'public/images/habithero-white-catgirl-room-desktop.png',
    'public/videos/habithero-black-catboy.mp4',
    'public/videos/habithero-blue-catboy.mp4',
    'public/videos/habithero-white-catgirl.mp4',
    'ios/App/App/public/images/habithero-catgirl-room.png',
    'ios/App/App/public/images/habithero-catgirl-room-desktop.png',
    'ios/App/App/public/images/habithero-black-catboy-room.png',
    'ios/App/App/public/images/habithero-black-catboy-room-desktop.png',
    'ios/App/App/public/images/habithero-blue-catboy-room.png',
    'ios/App/App/public/images/habithero-blue-catboy-room-desktop.png',
    'ios/App/App/public/images/habithero-white-catgirl-room.png',
    'ios/App/App/public/images/habithero-white-catgirl-room-desktop.png',
    'ios/App/App/public/videos/habithero-black-catboy.mp4',
    'ios/App/App/public/videos/habithero-blue-catboy.mp4',
    'ios/App/App/public/videos/habithero-white-catgirl.mp4',
  ];

  for (const asset of legacyAssets) assert.equal(existsSync(new URL(asset, root)), false, asset);
});

test('dashboard hero supports a muted mobile video while keeping the image fallback', () => {
  const source = read('../src/components/DashboardCharacterHero.tsx');

  assert.match(source, /sceneImage: string/);
  assert.match(source, /sceneImageDesktop\?: string/);
  assert.match(source, /mobileSceneVideo\?: string/);
  assert.match(source, /media="\(min-width: 760px\)"/);
  assert.match(source, /<img/);
  assert.match(source, /<video/);
  assert.match(source, /autoPlay[\s\S]*muted[\s\S]*playsInline/);
  assert.match(source, /loop/);
});

test('parent dashboard keeps its scene image while child dashboard owns the terrain world', () => {
  const parentSource = read('../src/components/ParentDashboard.tsx');
  const childSource = read('../src/components/ChildDashboard.tsx');

  assert.match(parentSource, /sceneImage="\/images\/habithero-parent-living-room\.png"/);
  assert.match(parentSource, /sceneImageDesktop="\/images\/habithero-parent-living-room-desktop\.png"/);
  assert.match(childSource, /sceneImage=""/);
  assert.doesNotMatch(childSource, /mobileSceneVideo=/);
  assert.match(childSource, /TerrainWorldLayer/);
});

test('dashboard hero no longer resolves legacy character images', () => {
  const source = read('../src/components/DashboardCharacterHero.tsx');

  assert.doesNotMatch(source, /features\/characters\/catalog/);
  assert.doesNotMatch(source, /getCharacterByImageUrl/);
  assert.match(source, /data-theme-color=\{menuVariant\}/);
});

test('family child picker uses neutral child icons during a world transition', () => {
  const source = read('../src/components/FamilyChildPicker.tsx');

  assert.match(source, /<User size=\{20\}/);
  assert.doesNotMatch(source, /getCharacterById|character\.imageUrl|<img/);
});

test('new child flow exposes the ten supplied walkable GLB characters', () => {
  const source = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');
  const catalogSource = read('../src/features/characters/world-character-catalog.ts');

  assert.match(source, /newChildGender/);
  assert.match(source, /newChildCharacterId/);
  assert.match(source, /WORLD_CHARACTER_CATALOG/);
  assert.match(source, /onNewChildCharacterChange/);
  assert.match(source, /role="radiogroup" aria-label="冒險人物"/);
  assert.doesNotMatch(source, /固定使用 3D 人物/);
  assert.doesNotMatch(source, /getCharactersForCategory|CHARACTER_CATEGORIES/);
  assert.match(source, /GameItemLightbox/);
  assert.match(catalogSource, /character\.arthur/);
  assert.match(catalogSource, /character\.elina/);
  assert.match(catalogSource, /character\.sia/);
  assert.match(catalogSource, /character\.elio/);
  assert.match(catalogSource, /character\.moss/);
  assert.match(catalogSource, /character\.noah/);
  assert.match(catalogSource, /character\.collette/);
  assert.match(catalogSource, /character\.violette/);
  assert.match(catalogSource, /character\.gilt/);
  assert.match(catalogSource, /character\.lunalia/);
  assert.match(source, /aria-required="true"/);
  assert.match(source, /disabled=\{[^}]*!selectedGender/);
});

test('new child drawer closes only after the creation request succeeds', () => {
  const source = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');

  assert.doesNotMatch(source, /previousNewChildName/);
  assert.doesNotMatch(source, /wasFilled && !newChildName/);
  assert.match(source, /const created = await onAddChild/);
  assert.match(source, /if \(created\) closeNewChildForm\(\)/);
});

test('gender controls are keyboard and touch accessible', () => {
  const source = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');

  assert.match(source, /role="radiogroup"/);
  assert.match(source, /role="radio"/);
  assert.match(source, /aria-checked=\{selectedGender === gender/);
  assert.match(source, /type="button"/);
  assert.match(source, /hh-gender-option/);
  assert.match(source, /hh-world-character-option/);
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /aria-expanded=\{previewCharacterId === character\.id\}/);
});

test('character cards open the shared store-style portrait lightbox with selected details', () => {
  const source = read('../src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');
  const styles = read('../src/styles/modals.css');

  assert.match(source, /previewCharacterId/);
  assert.match(source, /setPreviewCharacterId\(characterId\)/);
  assert.match(source, /<GameItemLightbox item=\{previewCharacter\}/);
  assert.match(source, /onClose=\{\(\) => setPreviewCharacterId\(null\)\}/);
  assert.match(styles, /\.hh-game-item-lightbox-backdrop\s*\{[\s\S]*?background:\s*rgb\(0 0 0 \/ 68%\)/);
  assert.match(styles, /\.hh-game-item-lightbox-content img\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.match(styles, /\.hh-game-item-lightbox-copy\s*\{/);
  assert.doesNotMatch(source, /expandedCharacterId|is-expanded|hh-character-preview-/);
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
