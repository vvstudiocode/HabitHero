import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Flower2, PawPrint, ScrollText, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GameCatalogItem } from '../contracts';
import { GameItem3DPreview } from './GameItem3DPreview';

interface GameItemPreviewProps {
  item: GameCatalogItem;
  onOpen?: (item: GameCatalogItem) => void;
}

export function GameItemPreview({ item, onOpen }: GameItemPreviewProps) {
  if (item.thumbnailUrl && onOpen) {
    return (
      <button
        type="button"
        className="hh-game-item-thumbnail-button"
        aria-label={`${item.name} 放大預覽`}
        onClick={() => onOpen(item)}
      >
        <img src={item.thumbnailUrl} alt={`${item.name} 預覽`} className="hh-game-item-preview" />
      </button>
    );
  }
  if (item.thumbnailUrl) return <img src={item.thumbnailUrl} alt={`${item.name} 預覽`} className="hh-game-item-preview" />;
  return item.itemType === 'character'
    ? <Crown size={24} aria-hidden="true" />
    : item.itemType === 'pet'
      ? <PawPrint size={24} aria-hidden="true" />
      : <Flower2 size={24} aria-hidden="true" />;
}

type GameItemLightboxItem = Pick<GameCatalogItem, 'name' | 'description' | 'thumbnailUrl'>
  & Partial<Pick<GameCatalogItem, 'itemType' | 'assetKey'>>;

interface GameItemLightboxProps {
  item: GameItemLightboxItem | null;
  onClose: () => void;
  use3DPreview?: boolean;
  price?: number;
  sourceLabel?: string;
  sourceLabelTitle?: string;
  purchaseDisabled?: boolean;
  purchaseLabel?: string;
  onPurchase?: () => void;
  actionContent?: ReactNode;
}

export function GameItemLightbox({
  item,
  onClose,
  use3DPreview = false,
  price,
  sourceLabel,
  sourceLabelTitle = '取得來源',
  purchaseDisabled = false,
  purchaseLabel = '兌換',
  onPurchase,
  actionContent,
}: GameItemLightboxProps) {
  useEffect(() => {
    if (!item) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [item, onClose]);

  if (!item || typeof document === 'undefined') return null;
  const modelPreviewItem = item.itemType && item.assetKey
    ? { name: item.name, itemType: item.itemType, assetKey: item.assetKey, thumbnailUrl: item.thumbnailUrl }
    : null;
  return createPortal(
    <div className="hh-game-item-lightbox" role="dialog" aria-modal="true" aria-label={`${item.name} 商品詳情`}>
      <button type="button" className="hh-game-item-lightbox-backdrop" aria-label="關閉商品詳情" onClick={onClose} />
      <div className="hh-game-item-lightbox-content">
        <button type="button" className="hh-game-item-lightbox-close" aria-label="關閉商品詳情" onClick={onClose}><X size={24} /></button>
        {use3DPreview && modelPreviewItem ? (
          <GameItem3DPreview item={modelPreviewItem} />
        ) : item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt={`${item.name} 放大預覽`} />
        ) : null}
        <div className="hh-game-item-lightbox-copy">
          <strong>{item.name}</strong>
          <p>{item.description}</p>
          {sourceLabel && <p>{sourceLabelTitle}：{sourceLabel}</p>}
          {price !== undefined && <span className="hh-game-item-lightbox-price"><ScrollText size={17} strokeWidth={2.5} aria-hidden="true" />價格 {price} 張</span>}
          {(actionContent || onPurchase) && (
            <div className="hh-game-item-lightbox-actions">
              {actionContent}
              {onPurchase && (
                <button
                  type="button"
                  className="hh-game-action-button hh-game-action-button--primary hh-game-item-lightbox-purchase"
                  disabled={purchaseDisabled}
                  onClick={onPurchase}
                >
                  {purchaseLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
