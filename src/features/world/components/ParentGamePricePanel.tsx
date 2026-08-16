import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { GameCatalogItem, GameItemType } from '../contracts';
import { isLocalGameItem3DPreviewEnabled, isLocalGameItemShopSupported } from '../game-content-assets';
import { GameItemLightbox, GameItemPreview } from './GameItemImagePreview';
import { GameCatalogLayoutControls, GameItemCard, type GameCatalogLayoutColumns } from './GameItemCard';

interface ParentGamePricePanelProps {
  catalog: GameCatalogItem[];
  prices: Record<string, number>;
  loading: boolean;
  onRetry?: () => void;
  onSave: (catalogItemId: string, scrollPrice: number) => Promise<void>;
  onReset: (catalogItemId: string) => Promise<void>;
}

const typeLabels: Record<GameItemType, string> = {
  character: '角色',
  pet: '寵物',
  decoration: '裝飾',
};

interface PriceChange {
  item: GameCatalogItem;
  value: string;
}

function isValidPrice(value: string) {
  return /^\d+$/.test(value) && Number(value) >= 1;
}

export function ParentGamePricePanel({ catalog, prices, loading, onRetry, onSave, onReset }: ParentGamePricePanelProps) {
  const items = useMemo(
    () => catalog.filter((item) => item.isActive && !item.isStarter && isLocalGameItemShopSupported(item)).sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeType, setActiveType] = useState<GameItemType>('character');
  const [previewItem, setPreviewItem] = useState<GameCatalogItem | null>(null);
  const [layoutColumns, setLayoutColumns] = useState<GameCatalogLayoutColumns>(4);
  const [editingPrices, setEditingPrices] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [layoutNotice, setLayoutNotice] = useState<{ id: number; message: string } | null>(null);
  const syncedPricesRef = useRef<Record<string, string>>({});
  const acknowledgedPricesRef = useRef<Record<string, string>>({});
  const editedDraftIdsRef = useRef(new Set<string>());

  const visibleItems = useMemo(
    () => items.filter((item) => item.itemType === activeType),
    [activeType, items],
  );

  useEffect(() => {
    const nextPrices = Object.fromEntries(items.map((item) => [item.id, String(prices[item.id] ?? item.scrollPrice)]));
    const previousPrices = syncedPricesRef.current;
    setDrafts((current) => {
      const next = { ...current };
      items.forEach((item) => {
        const serverValue = nextPrices[item.id];
        const hasLocalEdit = editedDraftIdsRef.current.has(item.id);
        if (current[item.id] === undefined || (!hasLocalEdit && current[item.id] === previousPrices[item.id])) next[item.id] = serverValue;
        if (current[item.id] === serverValue) {
          editedDraftIdsRef.current.delete(item.id);
          if (acknowledgedPricesRef.current[item.id] === serverValue) delete acknowledgedPricesRef.current[item.id];
        }
      });
      return next;
    });
    syncedPricesRef.current = nextPrices;
  }, [items, prices]);

  useEffect(() => {
    if (!layoutNotice) return undefined;
    const timeout = window.setTimeout(() => setLayoutNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [layoutNotice]);

  const persistedPrice = (item: GameCatalogItem) => prices[item.id] ?? item.scrollPrice;
  const draftValue = (item: GameCatalogItem) => drafts[item.id] ?? String(persistedPrice(item));
  const priceChanges = useMemo<PriceChange[]>(
    () => items.flatMap((item) => {
      const value = draftValue(item);
      const persisted = String(persistedPrice(item));
      if (value === persisted || acknowledgedPricesRef.current[item.id] === value) return [];
      return [{ item, value }];
    }),
    // The ref only acknowledges a completed save; savingDrafts causes the next render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, items, prices, savingDrafts],
  );
  const hasUnsavedDrafts = priceChanges.length > 0;
  const hasInvalidDrafts = priceChanges.some(({ value }) => !isValidPrice(value));

  const showNotice = (message: string) => setLayoutNotice({ id: Date.now(), message });

  const handleLayoutChange = (nextColumns: GameCatalogLayoutColumns) => {
    if (nextColumns === layoutColumns) return;
    setLayoutColumns(nextColumns);
    if (hasUnsavedDrafts) showNotice('版面已切換，尚未儲存的價格草稿仍保留。');
  };

  const handleSaveDrafts = async () => {
    if (!hasUnsavedDrafts || hasInvalidDrafts || savingDrafts) return;
    setSavingDrafts(true);
    try {
      await Promise.all(priceChanges.map(({ item, value }) => onSave(item.id, Number(value))));
      priceChanges.forEach(({ item, value }) => { acknowledgedPricesRef.current[item.id] = value; });
      showNotice('價格已儲存，正在同步家庭商店。');
    } catch {
      showNotice('部分價格尚未儲存，草稿已保留，請稍後再試。');
    } finally {
      setSavingDrafts(false);
    }
  };

  const handleReset = async (item: GameCatalogItem) => {
    if (savingDrafts) return;
    setSavingDrafts(true);
    try {
      await onReset(item.id);
      acknowledgedPricesRef.current[item.id] = String(item.scrollPrice);
      editedDraftIdsRef.current.add(item.id);
      setDrafts((current) => ({ ...current, [item.id]: String(item.scrollPrice) }));
    } catch {
      showNotice('還原價格失敗，原本的草稿仍保留。');
    } finally {
      setSavingDrafts(false);
    }
  };

  const handleDraftChange = (itemId: string, value: string) => {
    editedDraftIdsRef.current.add(itemId);
    setDrafts((current) => ({ ...current, [itemId]: value }));
  };

  const previewPrice = previewItem
    ? (() => {
      const value = draftValue(previewItem);
      return isValidPrice(value) ? Number(value) : persistedPrice(previewItem);
    })()
    : undefined;
  const use3DPreview = previewItem !== null && isLocalGameItem3DPreviewEnabled(previewItem);

  const toggleEditingPrices = () => {
    if (editingPrices && hasUnsavedDrafts) {
      showNotice('尚有未儲存的價格，請先儲存變更。');
      return;
    }
    setEditingPrices((current) => !current);
  };

  return (
    <section className="hh-world-price-panel space-y-3" aria-labelledby="game-price-heading">
      <div className="hh-game-store-heading">
        <h2 id="game-price-heading" className="text-xl font-black text-gray-900">商店</h2>
        {catalog.length > 0 && <div className="hh-game-store-heading-actions">
          <GameCatalogLayoutControls columns={layoutColumns} onChange={handleLayoutChange} />
          <button type="button" className="hh-game-action-button hh-game-action-button--primary hh-game-price-edit-button" aria-pressed={editingPrices} onClick={toggleEditingPrices}>
            {editingPrices ? '完成編輯' : '編輯價格'}
          </button>
        </div>}
      </div>
      {catalog.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-700" role="status">
          <p>商店資料目前還沒同步完成，商品頁仍可稍後重試。</p>
          {onRetry && <button type="button" onClick={onRetry} disabled={loading} className="mt-4 min-h-11 rounded-xl bg-gray-900 px-5 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-50">{loading ? '同步中…' : '重試'}</button>}
        </div>
      ) : (
        <>
          {layoutNotice && <div key={layoutNotice.id} className="hh-game-layout-notice" role="status">{layoutNotice.message}</div>}
          <div className="hh-game-tabs" role="tablist" aria-label="商店分類">
            {(['character', 'pet', 'decoration'] as const).map((type) => (
              <button key={type} type="button" role="tab" aria-selected={activeType === type} className={activeType === type ? 'is-selected' : ''} onClick={() => setActiveType(type)}>
                {typeLabels[type]}
              </button>
            ))}
          </div>
          {editingPrices ? (
            <div className="hh-game-price-editor-list" aria-label="商品價格編輯">
              {visibleItems.map((item) => {
                const isCustomized = prices[item.id] !== undefined;
                return (
                  <article className="hh-game-price-editor-row" key={item.id}>
                    <div className="hh-game-price-editor-thumbnail">
                      <GameItemPreview item={item} onOpen={setPreviewItem} />
                    </div>
                    <div className="hh-game-price-editor-identity">
                      <strong>{item.name}</strong>
                      <span>{typeLabels[item.itemType]}</span>
                    </div>
                    <label className="hh-game-price-editor-field">
                      <span>任務捲價格</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        aria-label={`${item.name} 任務捲價格`}
                        value={draftValue(item)}
                        onChange={(event) => handleDraftChange(item.id, event.target.value)}
                        disabled={loading || savingDrafts}
                      />
                    </label>
                    {isCustomized && (
                      <button type="button" className="hh-game-price-editor-reset" onClick={() => void handleReset(item)} disabled={loading || savingDrafts}>
                        <RotateCcw size={16} aria-hidden="true" />
                        <span>還原</span>
                      </button>
                    )}
                  </article>
                );
              })}
              {visibleItems.length === 0 && <p className="hh-game-empty">這個分類目前沒有可調整的商品。</p>}
            </div>
          ) : (
            <div className={`hh-game-catalog-grid hh-game-catalog-grid--${layoutColumns}`}>
              {visibleItems.map((item) => (
                <GameItemCard
                  key={item.id}
                  item={item}
                  price={persistedPrice(item)}
                  mode="parent"
                  showMeta={false}
                  onOpenPreview={setPreviewItem}
                />
              ))}
              {visibleItems.length === 0 && <p className="hh-game-empty">這個分類目前沒有可調整的商品。</p>}
            </div>
          )}
          {editingPrices && (
            <div className="hh-game-price-save-bar">
              <span>{hasUnsavedDrafts ? `有 ${priceChanges.length} 項價格尚未儲存` : '目前沒有未儲存的價格'}</span>
              <button type="button" className="hh-game-action-button hh-game-action-button--primary" disabled={loading || savingDrafts || !hasUnsavedDrafts || hasInvalidDrafts} onClick={() => void handleSaveDrafts()}>
                {savingDrafts ? '儲存中…' : '儲存變更'}
              </button>
            </div>
          )}
        </>
      )}
      <GameItemLightbox item={previewItem} use3DPreview={use3DPreview} price={previewPrice} onClose={() => setPreviewItem(null)} />
    </section>
  );
}
