import { ChevronDown, Columns2, Columns3, Columns4, Coins, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import type { GameCatalogItem } from '../contracts';
import { GameItemPreview } from './GameItemImagePreview';

export type GameItemCardMode = 'child' | 'parent';
export type GameCatalogLayoutColumns = 2 | 3 | 4;

interface GameItemCardProps {
  key?: string;
  item: GameCatalogItem;
  price: number;
  mode: GameItemCardMode;
  onOpenPreview: (item: GameCatalogItem) => void;
  showMeta?: boolean;
  editing?: boolean;
  isCustomized?: boolean;
  draftPrice?: string;
  onDraftPriceChange?: (value: string) => void;
  onSave?: () => void;
  onReset?: () => void;
  disabled?: boolean;
}

export function GameItemCard({
  item,
  price,
  mode,
  onOpenPreview,
  showMeta = false,
  editing = false,
  isCustomized = false,
  draftPrice,
  onDraftPriceChange,
  onSave,
  onReset,
  disabled = false,
}: GameItemCardProps) {
  const handleDraftChange = (event: ChangeEvent<HTMLInputElement>) => {
    onDraftPriceChange?.(event.target.value);
  };

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, label, select, textarea, a')) return;
    onOpenPreview(item);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, label, select, textarea, a')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenPreview(item);
    }
  };

  return (
    <article
      className={`${mode === 'parent' ? 'hh-game-price-card hh-game-catalog-card' : 'hh-game-catalog-card'}${mode === 'parent' && editing ? ' hh-game-catalog-card--editing' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${item.name} 查看商品詳情`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="hh-game-catalog-card-media">
        <GameItemPreview item={item} onOpen={onOpenPreview} />
        {showMeta && (
          <div className="hh-game-catalog-card-overlay">
            <strong className="hh-game-catalog-card-title">{item.name}</strong>
            {!(mode === 'parent' && editing) && (
              <div className="hh-game-catalog-card-price"><Coins size={16} aria-hidden="true" /><span>{price} 張</span></div>
            )}
          </div>
        )}

        {mode === 'parent' && editing && (
          <div className="hh-game-catalog-card-editor">
            <label className="hh-game-catalog-card-price-field">
              <span>價格</span>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                aria-label={`${item.name} 任務捲價格`}
                value={draftPrice ?? String(price)}
                onChange={handleDraftChange}
                disabled={disabled}
              />
            </label>
            <div className="hh-game-catalog-card-editor-actions">
              {onSave && <button type="button" className="hh-game-action-button hh-game-action-button--primary" disabled={disabled} onClick={onSave}>儲存</button>}
              {isCustomized && onReset && (
                <button type="button" className="hh-game-action-button" disabled={disabled} onClick={onReset}>
                  <RotateCcw size={15} aria-hidden="true" />
                  還原
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

interface GameCatalogLayoutControlsProps {
  columns: GameCatalogLayoutColumns;
  onChange: (columns: GameCatalogLayoutColumns) => void;
}

export function GameCatalogLayoutControls({ columns, onChange }: GameCatalogLayoutControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const LayoutIcon = columns === 2 ? Columns2 : columns === 3 ? Columns3 : Columns4;

  useEffect(() => {
    if (!expanded) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [expanded]);

  return (
    <div ref={controlsRef} className={`hh-game-layout-controls${expanded ? ' is-expanded' : ''}`} role="group" aria-label="商品版面欄數">
      <button
        type="button"
        className="hh-game-layout-trigger"
        aria-label={`商品版面欄數：目前 ${columns} 欄`}
        aria-expanded={expanded}
        aria-haspopup="true"
        onClick={() => setExpanded((current) => !current)}
      >
        <LayoutIcon size={20} aria-hidden="true" />
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="hh-game-layout-menu" role="menu" aria-label="選擇商品欄數">
          {[2, 3, 4].map((value) => {
            const nextColumns = value as GameCatalogLayoutColumns;
            const OptionIcon = nextColumns === 2 ? Columns2 : nextColumns === 3 ? Columns3 : Columns4;
            return (
              <button
                key={nextColumns}
                type="button"
                role="menuitemradio"
                aria-label={`${nextColumns} 欄`}
                aria-checked={columns === nextColumns}
                className={columns === nextColumns ? 'is-selected' : ''}
                onClick={() => {
                  onChange(nextColumns);
                  setExpanded(false);
                }}
              >
                <OptionIcon size={20} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
