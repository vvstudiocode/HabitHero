import type { ChildWorldEntity, GameCatalogItem, WorldMutationResult } from '../contracts';

export interface SharedDecorationPanelProps {
  onShareDecoration?: (inventoryItemId: string, item: GameCatalogItem) => void;
  onCollectAllSharedDecorations?: (expectedRevision: number) => Promise<WorldMutationResult>;
}

interface SharedDecorationShareButtonProps {
  inventoryItemId: string;
  item: GameCatalogItem;
  mutationPending: boolean;
  onClose: () => void;
  onShare: (inventoryItemId: string, item: GameCatalogItem) => void;
}

export function SharedDecorationShareButton({
  inventoryItemId,
  item,
  mutationPending,
  onClose,
  onShare,
}: SharedDecorationShareButtonProps) {
  return (
    <button
      type="button"
      className="hh-game-action-button"
      disabled={mutationPending}
      onClick={() => {
        onClose();
        onShare(inventoryItemId, item);
      }}
    >
      分享到好友世界
    </button>
  );
}

type SharedDecorationMutationCommitter = (
  action: (expectedRevision: number) => Promise<WorldMutationResult>,
  success: string,
) => unknown;

interface SharedDecorationCollectionButtonProps {
  worldEntities: readonly ChildWorldEntity[];
  mutationPending: boolean;
  onCollect: (expectedRevision: number) => Promise<WorldMutationResult>;
  commitWorldMutation: SharedDecorationMutationCommitter;
}

export function SharedDecorationCollectionButton({
  worldEntities,
  mutationPending,
  onCollect,
  commitWorldMutation,
}: SharedDecorationCollectionButtonProps) {
  const activeSharedDecorationCount = worldEntities.filter(
    (entity) => entity.entityKind === 'decoration' && entity.placementScope === 'shared' && entity.isActive,
  ).length;

  return (
    <button
      type="button"
      className="hh-game-action-button"
      disabled={mutationPending || activeSharedDecorationCount === 0}
      onClick={() => void commitWorldMutation(onCollect, '全部好友裝飾已從我的世界收起。')}
    >
      收起全部好友裝飾
    </button>
  );
}
