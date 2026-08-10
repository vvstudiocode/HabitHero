import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

describe('world dashboard navigation contract', () => {
  it('uses the current anime maiden GLB as the only new-child character', async () => {
    const catalog = await read('src/features/characters/catalog.ts');
    const settings = await read('src/components/parent-dashboard/ParentSettingsChildrenSection.tsx');
    const dashboard = await read('src/components/ParentDashboard.tsx');

    assert.match(catalog, /CURRENT_WORLD_CHARACTER_ID\s*=\s*'character\.anime-maiden'/);
    assert.match(settings, /CURRENT_WORLD_CHARACTER_ID/);
    assert.match(settings, /固定使用 3D 人物/);
    assert.doesNotMatch(settings, /CHARACTER_CATEGORIES|getCharactersForCategory|hh-character-preview-backdrop/);
    assert.match(dashboard, /useState\(CURRENT_WORLD_CHARACTER_ID\)/);
  });

  it('puts categorized world prices on the parent hero fifth action', async () => {
    const dashboard = await read('src/components/ParentDashboard.tsx');
    const content = await read('src/components/parent-dashboard/ParentDashboardContent.tsx');
    const panel = await read('src/features/world/components/ParentGamePricePanel.tsx');

    assert.match(dashboard, /id: 'world-shop', title: '世界商品'/);
    assert.match(dashboard, /activeTab === 'world-shop'/);
    assert.equal((dashboard.match(/<ParentGamePricePanel/g) ?? []).length, 1);
    assert.doesNotMatch(dashboard, /data-tour="child-view"/);
    assert.match(dashboard, /切換小孩視角/);
    assert.match(content, /ParentDashboardTab = [^\n]*world-shop/);
    assert.match(panel, /世界商品分類/);
    assert.match(panel, /role="tab"/);
  });

  it('keeps child transitions on the neutral map-preparation screen', async () => {
    const app = await read('src/App.tsx');
    const child = await read('src/components/ChildDashboard.tsx');
    const hero = await read('src/components/DashboardCharacterHero.tsx');
    const picker = await read('src/components/FamilyChildPicker.tsx');
    const world = await read('src/features/world/TerrainWorldLayer.tsx');

    assert.match(app, /WorldPreparingScreen/);
    assert.match(child, /WorldPreparingScreen/);
    assert.doesNotMatch(child, /mobileSceneVideo=/);
    assert.match(hero, /sceneImage: string/);
    assert.doesNotMatch(picker, /getCharacterById|hh-family-picker-character/);
    assert.match(world, /character\.anime-maiden/);
  });

  it('does not trap a child in a neutral loading state after the first load fails', async () => {
    const app = await read('src/App.tsx');
    assert.match(app, /role="alert"/);
    assert.match(app, /地圖資料載入失敗/);
    assert.match(app, /onClick=\{\(\) => void retry\(\)\}/);
    assert.match(app, /登出並返回登入/);
    assert.match(app, /onClick=\{handleLogout\}/);
    assert.doesNotMatch(app, /WorldPreparingScreen detail="地圖資料同步失敗，正在等待重試…"/);
  });

  it('uses the parent selected child for world pricing and renders recovery UI when catalog is empty', async () => {
    const dashboard = await read('src/components/ParentDashboard.tsx');
    const panel = await read('src/features/world/components/ParentGamePricePanel.tsx');
    assert.match(dashboard, /parentActiveChildId/);
    assert.match(dashboard, /priceChildId/);
    assert.match(dashboard, /gameDataByChildId\[priceChildId\]/);
    assert.match(panel, /catalog\.length === 0/);
    assert.match(panel, /onRetry/);
    assert.match(panel, /重試/);
    assert.doesNotMatch(panel, /if \(items\.length === 0\) return null/);
  });
});
