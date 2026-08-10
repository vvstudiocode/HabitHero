import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ParentGamePricePanel } from '../src/features/world/components/ParentGamePricePanel';

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

    assert.match(html, /世界商品資料目前還沒同步完成/);
    assert.match(html, />重試</);
    assert.match(html, /role="status"/);
  });
});
