import type { AppState } from '../types';
import type { DataRepository } from './data-access';
import { patchGameData } from './app-state-patches';
import { emptyChildGameData, type GamePurchaseResult } from '../features/world/contracts';
import type { WorldSceneId } from '../features/world/world-scene-content';
import {
  patchPurchasedGameItem,
  reconcilePurchasedGameItem,
  rollbackPurchasedGameItem,
  type OptimisticPurchaseDraft,
} from '../features/world/game-loadout';
import { applyWorldNpcDialogueResult, applyWorldSceneUnlockResult } from '../features/world/world-scene-state';

type Mutation = <T>(
  operation: (repository: DataRepository, familyId: string) => Promise<T>,
  optimisticUpdate?: (previous: AppState) => AppState,
  optimisticRollback?: (current: AppState, previous: AppState) => AppState,
) => Promise<T>;

interface WorldStoreActionDependencies {
  mutate: Mutation;
  familyId: string | null;
  getState: () => AppState;
  setState: (updater: (current: AppState) => AppState) => void;
}

export function createWorldStoreActions({ mutate, familyId, getState, setState }: WorldStoreActionDependencies) {
  return {
    unlockWorldScene: async (childId: string, sceneId: WorldSceneId) => {
      const result = await mutate((repo) => repo.unlockWorldScene(childId, sceneId));
      if (result.unlocked) {
        setState((current) => patchGameData(current, childId, (gameData) => applyWorldSceneUnlockResult(
          gameData,
          childId,
          familyId ?? '',
          result,
        )));
      }
      return result;
    },
    completeWorldNpcDialogue: async (childId: string, npcId: string) => {
      const result = await mutate((repo) => repo.completeWorldNpcDialogue(childId, npcId));
      setState((current) => patchGameData(current, childId, (gameData) => applyWorldNpcDialogueResult(
        gameData,
        childId,
        familyId ?? '',
        result,
      )));
      return result;
    },
    purchaseGameItem: async (
      childId: string,
      catalogItemId: string,
      quantity: number,
      idempotencyKey: string,
      sourceNpcId?: string,
    ) => {
      const currentGameData = getState().gameDataByChildId[childId] ?? emptyChildGameData();
      const catalogItem = currentGameData.catalog.find((item) => item.id === catalogItemId);
      const existingInventoryItemId = catalogItem?.isStackable
        ? currentGameData.inventory.find((item) => item.catalogItemId === catalogItemId)?.id ?? null
        : null;
      const existingQuantityBefore = existingInventoryItemId
        ? currentGameData.inventory.find((item) => item.id === existingInventoryItemId)?.quantity
        : undefined;
      const sourceOffering = sourceNpcId
        ? currentGameData.worldNpcOfferings?.find((offering) => offering.npcId === sourceNpcId
          && offering.catalogItemId === catalogItemId && offering.isActive)
        : undefined;
      const localInventoryItemId = existingInventoryItemId ?? `local-purchase-${idempotencyKey}`;
      const purchaseDraft: OptimisticPurchaseDraft = {
        catalogItemId,
        quantity,
        localInventoryItemId,
        acquiredAt: new Date().toISOString(),
        existingInventoryItemId,
        existingQuantityBefore,
        totalPrice: catalogItem
          ? (currentGameData.prices[catalogItemId] ?? catalogItem.scrollPrice) * quantity
          : undefined,
        sourceSceneId: sourceOffering?.sceneId,
        sourceNpcId: sourceOffering ? sourceNpcId : undefined,
        sourceDialogueVersion: sourceOffering?.dialogueVersion,
      };
      const optimisticUpdate = catalogItem
        ? (previous: AppState) => patchGameData(previous, childId, (gameData) => patchPurchasedGameItem(gameData, purchaseDraft))
        : undefined;
      const optimisticRollback = optimisticUpdate
        ? (current: AppState, previous: AppState) => {
          const gameData = current.gameDataByChildId[childId] ?? emptyChildGameData();
          return {
            ...current,
            gameDataByChildId: {
              ...current.gameDataByChildId,
              [childId]: rollbackPurchasedGameItem(gameData, purchaseDraft),
            },
          };
        }
        : undefined;
      const result = await mutate(
        (repo) => repo.purchaseGameItem(childId, catalogItemId, quantity, idempotencyKey, sourceNpcId),
        optimisticUpdate,
        optimisticRollback,
      );
      const reconciledResult = result as GamePurchaseResult;
      setState((current) => patchGameData(current, childId, (gameData) => reconcilePurchasedGameItem(
        gameData,
        localInventoryItemId,
        reconciledResult,
        purchaseDraft,
      )));
      return result;
    },
  };
}
