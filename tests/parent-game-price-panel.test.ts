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
      id: 'character.preview',
      itemType: 'character',
      name: '棕熊玩偶',
      description: '柔軟可靠的棕熊玩偶夥伴。',
      scrollPrice: 6,
      assetKey: 'character.preview',
      thumbnailUrl: '/assets/animal-plushies/bear-thumbnail.png',
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
    assert.match(html, /src="\/assets\/animal-plushies\/bear-thumbnail\.png"/);
    assert.match(html, /class="hh-game-price-card/);
    assert.match(html, /aria-label="商品版面欄數：目前 2 欄"/);
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
    assert.match(parentPanelSource, /hh-game-store-toolbar--parent/);
    assert.match(parentPanelSource, /hh-game-price-edit-button/);
    assert.doesNotMatch(parentPanelSource, /調整這個家庭看到的任務捲價格/);
  });
});
