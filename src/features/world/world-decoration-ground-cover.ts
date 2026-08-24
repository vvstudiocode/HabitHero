import type { ChildGameData, GameCatalogItem, WorldTransform } from './contracts';
import {
  getDecorationGroundCoverMaskForTransform,
  getDecorationGroundCoverMasks,
  type DecorationGroundCoverMask,
} from './world-runtime-assets';

interface GroundCoverField {
  updateGroundCoverMasks: (masks: DecorationGroundCoverMask[]) => void;
}

interface OptionalGroundCoverField {
  updateGroundCoverMasks?: (masks: DecorationGroundCoverMask[]) => void;
}

export interface DecorationGroundCoverPlacement {
  entityId?: string;
  item: Pick<GameCatalogItem, 'itemType' | 'metadata'>;
  transform: WorldTransform;
}

export function updateDecorationGroundCoverMasks(
  grass: GroundCoverField,
  flowers: OptionalGroundCoverField,
  gameData: ChildGameData,
  placement?: DecorationGroundCoverPlacement,
): void {
  const masks = getDecorationGroundCoverMasks(gameData, placement?.entityId);
  const placementMask = placement
    ? getDecorationGroundCoverMaskForTransform(placement.item, placement.transform)
    : undefined;
  if (placementMask) masks.push(placementMask);
  grass.updateGroundCoverMasks(masks);
  flowers.updateGroundCoverMasks?.(masks);
}
