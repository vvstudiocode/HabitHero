import type { FriendSummary } from '../friends/contracts';
import {
  applyDecorationPlacementControl,
  applyDecorationPlacementGesture,
  createDecorationPlacementDraft,
  toDecorationPlacementTransform,
} from '../world/world-placement';
import { toWorldMutationErrorMessage } from '../world/world-errors';
import {
  SharedDecorationRepositoryError,
} from '../../lib/social-data/shared-decoration-repository';
import type {
  ChildDecorationActionDependencies,
  ChildDecorationActions,
  DecorationPlacementControl,
  DecorationPlacementGestureDelta,
  DecorationPlacementSession,
  DecorationPurchasePrompt,
  SharedDecorationItem,
} from './child-decoration-contracts';
import type { WorldMutationResult } from '../world/contracts';

export type {
  ChildDecorationActionDependencies,
  ChildDecorationActions,
  DecorationPlacementSession,
  DecorationPurchasePrompt,
  SharedDecorationItem,
} from './child-decoration-contracts';

export function createChildDecorationActions(
  dependencies: ChildDecorationActionDependencies,
): ChildDecorationActions {
  const {
    activeChildId,
    gameData,
    worldGameData,
    socialSession,
    decorationPurchasePrompt,
    decorationPlacement,
    placementItem,
    placementValid,
    decorationPlacementPending,
    shareDecorationItem,
    closeChildFeature,
    showToast,
    setDecorationPurchasePrompt,
    setDecorationPlacement,
    setDecorationPlacementPending,
    setShareDecorationItem,
    setHeroFeature,
    setHeroMenuGroup,
    setHeroMenuVisible,
    removeWorldEntity,
    updateWorldEntityTransform,
    placeWorldEntity,
  } = dependencies;

  const startDecorationPlacement = () => {
    if (!decorationPurchasePrompt) return;
    const prompt = decorationPurchasePrompt;
    setDecorationPurchasePrompt(null);
    closeChildFeature(() => setDecorationPlacement({
      inventoryItemId: prompt.inventoryItemId,
      catalogItemId: prompt.item.id,
      draft: createDecorationPlacementDraft(prompt.item),
    }));
  };

  const startOwnedDecorationPlacement = (inventoryItemId: string, catalogItemId: string) => {
    const item = gameData.catalog.find((candidate) => candidate.id === catalogItemId && candidate.itemType === 'decoration');
    if (!item) return;
    closeChildFeature(() => setDecorationPlacement({
      inventoryItemId,
      catalogItemId,
      draft: createDecorationPlacementDraft(item),
      placementScope: 'owned',
    }));
  };

  const startExistingDecorationPlacement = (entityId: string) => {
    const entity = worldGameData.worldEntities.find((candidate) => candidate.id === entityId && candidate.entityKind === 'decoration' && candidate.isActive);
    if (!entity) return;
    const inventory = worldGameData.inventory.find((candidate) => candidate.id === entity.inventoryItemId);
    const catalogItemId = entity.catalogItemId ?? inventory?.catalogItemId;
    const item = catalogItemId
      ? worldGameData.catalog.find((candidate) => candidate.id === catalogItemId && candidate.itemType === 'decoration')
      : undefined;
    if (!item) return;
    setHeroFeature(null);
    setHeroMenuGroup(null);
    setHeroMenuVisible(false);
    setDecorationPlacement({
      inventoryItemId: entity.inventoryItemId,
      catalogItemId: item.id,
      entityId: entity.id,
      placementScope: entity.placementScope,
      draft: { x: entity.x, z: entity.z, rotationY: entity.rotationY, scale: entity.scale },
    });
  };

  const collectSelectedDecoration = async (entityId: string) => {
    if (!activeChildId) return;
    const entity = worldGameData.worldEntities.find((candidate) => candidate.id === entityId && candidate.entityKind === 'decoration' && candidate.isActive);
    if (!entity) return;
    try {
      if (entity.placementScope === 'shared') {
        if (!socialSession?.sharedDecorationRepository || !socialSession.worldOwnerChildProfileId) throw new Error('目前無法連線到好友世界。');
        await socialSession.sharedDecorationRepository.remove({ targetWorldOwnerChildProfileId: socialSession.worldOwnerChildProfileId, sharedEntityId: entity.id, expectedRevision: worldGameData.worldRevision });
        await socialSession.reloadSnapshot?.();
        showToast('共享裝飾已從這個世界移除。');
      } else {
        await removeWorldEntity(activeChildId, { entityId: entity.id, inventoryItemId: entity.inventoryItemId, expectedRevision: worldGameData.worldRevision });
        showToast('裝飾已收回背包。');
      }
    } catch (error) {
      if (error instanceof SharedDecorationRepositoryError && error.code === 'revision-conflict') {
        await socialSession?.reloadSnapshot?.().catch(() => undefined);
      }
      showToast(toWorldMutationErrorMessage(error, '收回裝飾失敗，請再試一次。'));
    }
  };

  const leaveDecorationInInventory = () => {
    setDecorationPurchasePrompt(null);
    closeChildFeature(() => showToast('裝飾已放進背包，之後想放再來找它。'));
  };

  const handleDecorationPlacementPositionChange = (position: { x: number; z: number }) => {
    setDecorationPlacement((current) => current ? { ...current, draft: { ...current.draft, ...position } } : current);
  };

  const handleDecorationPlacementControl = (control: DecorationPlacementControl) => {
    setDecorationPlacement((current) => {
      if (!current) return current;
      const item = worldGameData.catalog.find((candidate) => candidate.id === current.catalogItemId && candidate.itemType === 'decoration');
      return item
        ? { ...current, draft: applyDecorationPlacementControl(current.draft, control, item) }
        : current;
    });
  };

  const handleDecorationPlacementGesture = (gesture: DecorationPlacementGestureDelta) => {
    setDecorationPlacement((current) => {
      if (!current) return current;
      const item = worldGameData.catalog.find((candidate) => candidate.id === current.catalogItemId && candidate.itemType === 'decoration');
      return item
        ? { ...current, draft: applyDecorationPlacementGesture(current.draft, gesture, item) }
        : current;
    });
  };

  const completeDecorationPlacement = async () => {
    if (!activeChildId || !decorationPlacement || !placementItem || !placementValid || decorationPlacementPending) return;
    const placementSession = decorationPlacement;
    const expectedRevision = worldGameData.worldRevision;
    setDecorationPlacement(null);
    setDecorationPlacementPending(true);
    try {
      const transform = toDecorationPlacementTransform(placementSession.draft);
      if (placementSession.placementScope === 'shared') {
        if (!socialSession?.sharedDecorationRepository || !socialSession.worldOwnerChildProfileId) throw new Error('目前無法連線到好友世界。');
        await socialSession.sharedDecorationRepository.updateTransform({ targetWorldOwnerChildProfileId: socialSession.worldOwnerChildProfileId, sharedEntityId: placementSession.entityId ?? '', expectedRevision, transform });
        await socialSession.reloadSnapshot?.();
        showToast('共享裝飾位置已更新。');
      } else if (placementSession.entityId) {
        await updateWorldEntityTransform(activeChildId, {
          inventoryItemId: placementSession.inventoryItemId,
          entityId: placementSession.entityId,
          expectedRevision,
          transform,
        });
        showToast('家具位置已更新！');
      } else {
        await placeWorldEntity(activeChildId, {
          inventoryItemId: placementSession.inventoryItemId,
          expectedRevision,
          transform,
          behaviorMode: 'static',
        });
        showToast('裝飾已放到世界！');
      }
    } catch (error) {
      setDecorationPlacement(placementSession);
      if (error instanceof SharedDecorationRepositoryError && error.code === 'revision-conflict') {
        await socialSession?.reloadSnapshot?.().catch(() => undefined);
      }
      showToast(toWorldMutationErrorMessage(error, '這裡不能放置，換一個草地位置試試看。'));
    } finally {
      setDecorationPlacementPending(false);
    }
  };

  const shareDecorationWithFriend = async (friend: FriendSummary) => {
    if (!activeChildId || !shareDecorationItem || !socialSession?.friendWorldRepository || !socialSession.sharedDecorationRepository) throw new Error('目前無法連線到好友世界。');
    const snapshot = await socialSession.friendWorldRepository.getFriendWorldSnapshot(friend.childProfileId);
    if (snapshot.canShareDecorations !== true) throw new Error('請先請好友在好友列表開啟共享裝飾調整權限。');
    const placed = gameData.worldEntities.find((entity) => entity.inventoryItemId === shareDecorationItem.inventoryItemId && entity.entityKind === 'decoration' && entity.isActive);
    await socialSession.sharedDecorationRepository.place({
      targetWorldOwnerChildProfileId: friend.childProfileId,
      sourceInventoryItemId: shareDecorationItem.inventoryItemId,
      expectedRevision: snapshot.revision,
      transform: placed
        ? { x: placed.x, y: placed.y, z: placed.z, rotationX: placed.rotationX, rotationY: placed.rotationY, rotationZ: placed.rotationZ, scale: placed.scale }
        : { x: 1, y: 0, z: -1, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1 },
    });
    setShareDecorationItem(null);
    showToast(`已將${shareDecorationItem.item.name}分享給${friend.displayName}。`);
  };

  const collectAllSharedDecorations = async (expectedRevision: number): Promise<WorldMutationResult> => {
    if (!socialSession?.sharedDecorationRepository || socialSession.worldOwnerChildProfileId !== activeChildId || !socialSession.reloadSnapshot) {
      throw new Error('目前無法管理自己世界的共享裝飾。');
    }
    try {
      const result = await socialSession.sharedDecorationRepository.collect({
        targetWorldOwnerChildProfileId: activeChildId,
        expectedRevision,
      });
      await socialSession.reloadSnapshot();
      showToast('全部好友裝飾已從我的世界收起。');
      return { revision: result.revision };
    } catch (error) {
      if (error instanceof SharedDecorationRepositoryError && error.code === 'revision-conflict') {
        await socialSession.reloadSnapshot().catch(() => undefined);
      }
      throw error;
    }
  };

  const cancelDecorationPlacement = () => {
    if (decorationPlacementPending) return;
    setDecorationPlacement(null);
    showToast('裝飾先留在背包裡。');
  };

  return {
    startDecorationPlacement,
    startOwnedDecorationPlacement,
    startExistingDecorationPlacement,
    collectSelectedDecoration,
    leaveDecorationInInventory,
    handleDecorationPlacementPositionChange,
    handleDecorationPlacementControl,
    handleDecorationPlacementGesture,
    completeDecorationPlacement,
    shareDecorationWithFriend,
    collectAllSharedDecorations,
    cancelDecorationPlacement,
  };
}
