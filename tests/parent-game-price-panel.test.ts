import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ParentGamePricePanel } from '../src/features/world/components/ParentGamePricePanel';
import type { GameCatalogItem } from '../src/features/world/contracts';

const parentPanelSource = readFileSync(new URL('../src/features/world/components/ParentGamePricePanel.tsx', import.meta.url), 'utf8');

describe('parent world price panel', () => {
  it('renders a recoverable empty state instead of returning a blank panel', () => {
    const html = renderToStaticMarkup(createElement(ParentGamePricePanel, {
      catalog: [],
      prices: {},
      loading: false,
      onRetry: () => undefined,
      onSave: async () => undefined,
      onReset: async () => undefined,
    }));

    assert.match(html, /商店資料目前還沒同步完成/);
    assert.match(html, />重試</);
    assert.match(html, /role="status"/);
  });

  it('renders catalog thumbnails in the store price cards', () => {
    const item: GameCatalogItem = {
      id: 'character.arthur',
      itemType: 'character',
      name: '亞瑟',
      description: '勇敢可靠的冒險夥伴。',
      scrollPrice: 6,
      assetKey: 'character.arthur',
      thumbnailUrl: '/assets/characters/arthur-thumbnail.webp',
      isActive: true,
      isStarter: false,
      isStackable: false,
      collisionRadius: 0.34,
      minScale: 0.75,
      maxScale: 1.35,
      sortOrder: 32,
      metadata: {},
    };
    const html = renderToStaticMarkup(createElement(ParentGamePricePanel, {
      catalog: [item],
      prices: {},
      loading: false,
      onSave: async () => undefined,
      onReset: async () => undefined,
    }));

    assert.match(html, />商店</);
    assert.match(html, /src="\/assets\/characters\/arthur-thumbnail\.webp"/);
    assert.match(html, /class="hh-game-price-card/);
    assert.match(html, /aria-label="商品版面欄數：目前 4 欄"/);
    assert.match(html, /編輯價格/);
    assert.doesNotMatch(html, /家庭自訂/);
  });

  it('keeps parent price editing in a separate list instead of covering catalog cards', () => {
    assert.match(parentPanelSource, /hh-game-price-editor-list/);
    assert.match(parentPanelSource, /editingPrices \? \(/);
    assert.match(parentPanelSource, /GameItemPreview/);
    assert.doesNotMatch(parentPanelSource, /editing=\{editingPrices\}/);
  });

  it('keeps parent catalog cards image-only in every layout', () => {
    assert.match(parentPanelSource, /showMeta=\{false\}/);
  });

  it('keeps parent layout controls beside the compact price editor trigger', () => {
    assert.match(parentPanelSource, /hh-game-price-edit-button/);
    assert.match(parentPanelSource, /useState<GameCatalogLayoutColumns>\(4\)/);
    const heading = parentPanelSource.match(/<div className="hh-game-store-heading">[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(heading, /<h2 id="game-price-heading"[\s\S]*?>商店<\/h2>/);
    assert.match(heading, /className="hh-game-store-heading-actions"[\s\S]*?GameCatalogLayoutControls columns=\{layoutColumns\}[\s\S]*?hh-game-price-edit-button/);
    assert.doesNotMatch(parentPanelSource, /hh-game-store-toolbar--parent/);
    assert.doesNotMatch(parentPanelSource, /調整這個家庭看到的任務捲價格/);
  });
});
