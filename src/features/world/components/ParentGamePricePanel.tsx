import { useEffect, useMemo, useState } from 'react';
import type { GameCatalogItem, GameItemType } from '../contracts';

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

export function ParentGamePricePanel({ catalog, prices, loading, onRetry, onSave, onReset }: ParentGamePricePanelProps) {
  const items = useMemo(
    () => catalog.filter((item) => item.isActive && !item.isStarter).sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeType, setActiveType] = useState<GameItemType>('character');

  const visibleItems = useMemo(
    () => items.filter((item) => item.itemType === activeType),
    [activeType, items],
  );

  useEffect(() => {
    setDrafts(Object.fromEntries(items.map((item) => [item.id, String(prices[item.id] ?? item.scrollPrice)])));
  }, [items, prices]);

  return (
    <section className="hh-world-price-panel space-y-3" aria-labelledby="game-price-heading">
      <div>
        <h2 id="game-price-heading" className="text-xl font-black text-gray-900">世界商品</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">調整這個家庭看到的任務捲價格；商品內容與初始角色由系統維護。</p>
      </div>
      {catalog.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-700" role="status">
          <p>世界商品資料目前還沒同步完成，商品頁仍可稍後重試。</p>
          {onRetry && <button type="button" onClick={onRetry} disabled={loading} className="mt-4 min-h-11 rounded-xl bg-gray-900 px-5 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-50">{loading ? '同步中…' : '重試'}</button>}
        </div>
      ) : (
        <>
          <div className="hh-game-tabs" role="tablist" aria-label="世界商品分類">
            {(['character', 'pet', 'decoration'] as const).map((type) => (
              <button key={type} type="button" role="tab" aria-selected={activeType === type} className={activeType === type ? 'is-selected' : ''} onClick={() => setActiveType(type)}>
                {typeLabels[type]}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {visibleItems.map((item) => {
              const defaultPrice = item.scrollPrice;
              const familyPrice = prices[item.id];
              const isCustomized = familyPrice !== undefined;
              const value = drafts[item.id] ?? String(familyPrice ?? defaultPrice);
              return (
                <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm text-gray-900">{item.name}</strong>
                      <span className="text-xs font-bold text-gray-500">{typeLabels[item.itemType]} · 預設 {defaultPrice} 張</span>
                    </div>
                    {isCustomized && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">家庭自訂</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`game-price-${item.id}`}>{item.name} 任務捲價格</label>
                    <input
                      id={`game-price-${item.id}`}
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={value}
                      onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      type="button"
                      disabled={loading || !/^\d+$/.test(value) || Number(value) < 1}
                      onClick={() => void onSave(item.id, Number(value))}
                      className="min-h-11 shrink-0 rounded-xl bg-blue-500 px-3 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      儲存
                    </button>
                    {isCustomized && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void onReset(item.id)}
                        className="min-h-11 shrink-0 rounded-xl bg-white px-3 text-sm font-bold text-gray-600 ring-1 ring-inset ring-gray-200 transition-colors hover:bg-gray-100 disabled:cursor-wait disabled:opacity-50"
                      >
                        還原
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {visibleItems.length === 0 && <p className="hh-game-empty">這個分類目前沒有可調整的商品。</p>}
          </div>
        </>
      )}
    </section>
  );
}
