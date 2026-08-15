import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameCatalogLayoutControls, GameItemCard } from '../src/features/world/components/GameItemCard';
import type { GameCatalogItem } from '../src/features/world/contracts';

const item: GameCatalogItem = {
  id: 'character.forest-guardian',
  itemType: 'character',
  name: '森林守護者',
  description: '守護森林與冒險旅程的溫柔夥伴。',
  scrollPrice: 10,
  assetKey: 'character.forest-guardian',
  thumbnailUrl: '/assets/forest-guardian-thumbnail.png',
  isActive: true,
  isStarter: false,
  isStackable: false,
  collisionRadius: 0.34,
  minScale: 0.75,
  maxScale: 1.35,
  sortOrder: 1,
  metadata: {},
};

describe('shared game item card', () => {
  it('shows the child-facing name and price while keeping the description for the detail action', () => {
    const html = renderToStaticMarkup(createElement(GameItemCard, {
      item,
      price: 12,
      mode: 'child',
      showMeta: true,
      onOpenPreview: () => undefined,
    }));

    assert.match(html, /森林守護者/);
    assert.match(html, /12/);
    assert.match(html, /放大預覽/);
    assert.match(html, /role="button"/);
    assert.match(html, /class="hh-game-catalog-card"/);
    assert.match(html, /hh-game-catalog-card-overlay/);
    assert.match(html, /hh-game-catalog-card-title/);
    assert.match(html, /hh-game-catalog-card-price/);
    assert.doesNotMatch(html, /hh-game-catalog-card-purchase/);
    assert.doesNotMatch(html, /hh-game-catalog-card-category/);
    assert.doesNotMatch(html, /守護森林與冒險旅程的溫柔夥伴。/);
  });

  it('switches the shared card to parent price editing without removing the item identity', () => {
    const html = renderToStaticMarkup(createElement(GameItemCard, {
      item,
      price: 12,
      mode: 'parent',
      editing: true,
      draftPrice: '15',
      onOpenPreview: () => undefined,
      onDraftPriceChange: () => undefined,
      onSave: () => undefined,
    }));

    assert.match(html, /森林守護者/);
    assert.match(html, /value="15"/);
    assert.match(html, /儲存/);
  });

  it('collapses the layout selector into an icon-only trigger', () => {
    const html = renderToStaticMarkup(createElement(GameCatalogLayoutControls, {
      columns: 2,
      onChange: () => undefined,
    }));

    assert.match(html, /aria-label="商品版面欄數：目前 2 欄"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /aria-haspopup="true"/);
    assert.doesNotMatch(html, />2欄</);
    assert.doesNotMatch(html, />3欄</);
    assert.doesNotMatch(html, />4欄</);
  });

  it('hides card metadata by default so every catalog layout stays image-first', () => {
    const html = renderToStaticMarkup(createElement(GameItemCard, {
      item,
      price: 12,
      mode: 'child',
      onOpenPreview: () => undefined,
    }));

    assert.doesNotMatch(html, /hh-game-catalog-card-overlay/);
    assert.doesNotMatch(html, /hh-game-catalog-card-price/);
  });
});
