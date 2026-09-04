import type { GameCatalogItem } from '../contracts';
import { GameItemPreview } from './GameItemImagePreview';

interface WorldNpcOfferingCardProps {
  key?: string;
  item: GameCatalogItem;
  price: number;
  purchaseLabel: string;
  purchaseDisabled: boolean;
  onOpen: (item: GameCatalogItem) => void;
}

export function WorldNpcOfferingCard({
  item,
  price,
  purchaseLabel,
  purchaseDisabled,
  onOpen,
}: WorldNpcOfferingCardProps) {
  return (
    <article className="hh-world-npc-offering-card">
      <div className="hh-world-npc-offering-media">
        <GameItemPreview item={item} onOpen={onOpen} />
      </div>
      <button
        type="button"
        className="hh-world-npc-offering-details"
        onClick={() => onOpen(item)}
      >
        <strong>{item.name}</strong>
        <span>{price} 張任務捲</span>
        <small>查看圖片與解鎖位置</small>
      </button>
      <button
        type="button"
        className="hh-game-action-button hh-game-action-button--primary hh-world-npc-offering-action"
        disabled={purchaseDisabled}
        onClick={() => onOpen(item)}
      >
        {purchaseLabel}
      </button>
    </article>
  );
}
