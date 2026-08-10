import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Flower2, PawPrint, X } from 'lucide-react';
import type { GameCatalogItem } from '../contracts';

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

interface GameItemLightboxProps {
  item: GameCatalogItem | null;
  onClose: () => void;
}

export function GameItemLightbox({ item, onClose }: GameItemLightboxProps) {
  useEffect(() => {
    if (!item) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [item, onClose]);

  if (!item?.thumbnailUrl || typeof document === 'undefined') return null;
  return createPortal(
    <div className="hh-game-item-lightbox" role="dialog" aria-modal="true" aria-label={`${item.name} 圖片預覽`}>
      <button type="button" className="hh-game-item-lightbox-backdrop" aria-label="關閉圖片預覽" onClick={onClose} />
      <div className="hh-game-item-lightbox-content">
        <button type="button" className="hh-game-item-lightbox-close" aria-label="關閉圖片預覽" onClick={onClose}><X size={24} /></button>
        <img src={item.thumbnailUrl} alt={`${item.name} 放大預覽`} />
        <strong>{item.name}</strong>
      </div>
    </div>,
    document.body,
  );
}
