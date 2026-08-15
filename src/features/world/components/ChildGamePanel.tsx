import { useEffect, useRef, useState } from 'react';
import { Check, Compass, Crown, Flower2, PawPrint, ScrollText, Settings, Sparkles, X } from 'lucide-react';
import type { ChildGameData, ChildInventoryItem, ChildWorldEntity, GameCatalogItem, GamePurchaseResult, WorldMutationPayload, WorldMutationResult, WorldTransformMutationPayload } from '../contracts';
import { degreesToRadians, getActiveDecorationEntities, getWorldRevisionAfterMutation, radiansToDegrees, toDecorationDraft, type DecorationDraft } from './decoration-editing';
import { buildCollisionCircles } from '../world-collision';
import { toWorldMutationErrorMessage } from '../world-errors';
import { createDecorationPlacementDraft, isDecorationPlacementValid } from '../world-placement';
import { getNextRoamingPets, getRoamablePetInventoryIds, getRoamingPetSnapshot } from './roaming-pet-state';
import { getFollowingPetInventoryIds, selectFollowingPet } from '../following-pet-state';
import { GameItemLightbox } from './GameItemImagePreview';
import { GameCatalogLayoutControls, GameItemCard, type GameCatalogLayoutColumns } from './GameItemCard';
import { PushNotificationSettings } from '../../../components/PushNotificationSettings';
import type { useNotificationSettings } from '../../../hooks/useNotificationSettings';

export type ChildGamePanelKind = 'inventory' | 'shop' | 'settings';
type DecorationMutationKind = 'update' | 'remove';
interface WorldMutationLifecycle {
  onSuccess?: () => void;
  onFailure?: () => string | undefined;
}

interface ChildGamePanelProps {
  kind: ChildGamePanelKind;
  gameData: ChildGameData;
  mutationPending: boolean;
  notificationSettings: ReturnType<typeof useNotificationSettings>;
  onPurchase: (catalogItemId: string, quantity: number, idempotencyKey: string) => Promise<GamePurchaseResult>;
  onEquipCharacter: (inventoryItemId: string) => Promise<void>;
  onRenamePet: (inventoryItemId: string, displayName: string | null) => Promise<void>;
  onSetFollowingPets: (inventoryItemIds: string[]) => Promise<WorldMutationResult>;
  onSetRoamingPets: (inventoryItemIds: string[]) => Promise<WorldMutationResult>;
  onStartDecorationPlacement: (inventoryItemId: string, catalogItemId: string) => void;
  onStartExistingDecorationPlacement: (entityId: string) => void;
  onPlaceDecoration: (payload: WorldMutationPayload) => Promise<WorldMutationResult>;
  onUpdateDecoration: (payload: WorldTransformMutationPayload) => Promise<WorldMutationResult>;
  onRemoveDecoration: (entityId: string, inventoryItemId: string, expectedRevision: number) => Promise<WorldMutationResult>;
  onCollectAllDecorations: (expectedRevision: number) => Promise<WorldMutationResult>;
  onSwitchChild: () => void;
  onLogout: () => void;
  showPetNames: boolean;
  onShowPetNamesChange: (visible: boolean) => void;
  backgroundMusicEnabled: boolean;
  onBackgroundMusicChange: (enabled: boolean) => void;
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getInventoryDisplayItem(inventory: ChildInventoryItem, item: GameCatalogItem) {
  if (item.itemType !== 'pet') return item;
  const displayName = inventory.displayName?.trim();
  return displayName && displayName !== item.name ? { ...item, name: displayName } : item;
}

export function ChildGamePanel({
  kind,
  gameData,
  mutationPending,
  notificationSettings,
  onPurchase,
  onEquipCharacter,
  onRenamePet,
  onSetFollowingPets,
  onSetRoamingPets,
  onStartDecorationPlacement,
  onStartExistingDecorationPlacement,
  onPlaceDecoration,
  onUpdateDecoration,
  onRemoveDecoration,
  onCollectAllDecorations,
  onSwitchChild,
  onLogout,
  showPetNames,
  onShowPetNamesChange,
  backgroundMusicEnabled,
  onBackgroundMusicChange,
}: ChildGamePanelProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const initialRoamingPetSnapshot = getRoamingPetSnapshot(gameData);
  const initialFollowingPetSnapshot = getFollowingPetInventoryIds(gameData);
  const [roamingPets, setRoamingPets] = useState<string[]>(initialRoamingPetSnapshot);
  const [followingPets, setFollowingPets] = useState<string[]>(initialFollowingPetSnapshot);
  const [inventorySection, setInventorySection] = useState<'character' | 'pet' | 'decoration'>('character');
  const [shopSection, setShopSection] = useState<'character' | 'pet' | 'decoration'>('character');
  const [inventoryColumns, setInventoryColumns] = useState<GameCatalogLayoutColumns>(2);
  const [shopColumns, setShopColumns] = useState<GameCatalogLayoutColumns>(2);
  const [previewItem, setPreviewItem] = useState<GameCatalogItem | null>(null);
  const [previewInventory, setPreviewInventory] = useState<ChildInventoryItem | null>(null);
  const [decorationDrafts, setDecorationDrafts] = useState<Record<string, DecorationDraft>>({});
  const [decorationMutationErrors, setDecorationMutationErrors] = useState<Record<string, DecorationMutationKind>>({});
  const [roamingMutationPending, setRoamingMutationPending] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [petNameDraft, setPetNameDraft] = useState('');
  const [renamePendingId, setRenamePendingId] = useState<string | null>(null);
  const worldRevisionRef = useRef(gameData.worldRevision);
  const worldMutationQueueRef = useRef(Promise.resolve());
  const roamingPetsRef = useRef(initialRoamingPetSnapshot);
  const roamingPetsServerSnapshotRef = useRef(initialRoamingPetSnapshot);
  const roamingMutationPendingRef = useRef(false);
  const followingPetsRef = useRef(initialFollowingPetSnapshot);
  const followingPetsServerSnapshotRef = useRef(initialFollowingPetSnapshot);
  const followingMutationPendingRef = useRef(false);
  const [followingMutationPending, setFollowingMutationPending] = useState(false);
  const ownedCatalogIds = new Set(gameData.inventory.map((item) => item.catalogItemId));
  const activeDecorationCount = gameData.worldEntities.filter((entity) => entity.entityKind === 'decoration' && entity.isActive).length;
  const title = kind === 'inventory' ? '我的背包' : kind === 'shop' ? '冒險商店' : '世界設定';
  const previewPrice = kind === 'shop' && previewItem ? gameData.prices[previewItem.id] ?? previewItem.scrollPrice : undefined;
  const previewOwned = previewItem !== null
    && ownedCatalogIds.has(previewItem.id)
    && previewItem.itemType !== 'pet'
    && !previewItem.isStackable;
  const previewPurchaseDisabled = previewItem === null
    || mutationPending
    || previewOwned
    || (previewPrice !== undefined && gameData.walletBalance < previewPrice);
  const previewPurchaseLabel = previewOwned
    ? '已擁有'
    : previewPrice !== undefined && gameData.walletBalance < previewPrice
      ? '卷軸不足'
      : '兌換';
  const handlePreviewPurchase = () => {
    if (kind !== 'shop' || !previewItem) return;
    const catalogItemId = previewItem.id;
    setPreviewInventory(null);
    setPreviewItem(null);
    void run(() => onPurchase(catalogItemId, 1, createIdempotencyKey()), '已加入背包。');
  };

  const openInventoryPreview = (inventory: ChildInventoryItem, item: GameCatalogItem) => {
    setPreviewInventory(inventory);
    setPreviewItem(getInventoryDisplayItem(inventory, item));
  };

  const openShopPreview = (item: GameCatalogItem) => {
    setPreviewInventory(null);
    setPreviewItem(item);
  };

  const closePreview = () => {
    setPreviewInventory(null);
    setPreviewItem(null);
  };

  useEffect(() => {
    // The provider now mirrors roaming/following into gameData optimistically.
    // Do not treat that transient snapshot as the server rollback baseline.
    if (roamingMutationPendingRef.current || followingMutationPendingRef.current) return;
    const serverSnapshot = getRoamingPetSnapshot(gameData);
    roamingPetsServerSnapshotRef.current = serverSnapshot;
    roamingPetsRef.current = serverSnapshot;
    setRoamingPets(serverSnapshot);
    const followingSnapshot = getFollowingPetInventoryIds(gameData);
    followingPetsServerSnapshotRef.current = followingSnapshot;
    followingPetsRef.current = followingSnapshot;
    setFollowingPets(followingSnapshot);
  }, [gameData]);

  useEffect(() => {
    setDecorationDrafts(Object.fromEntries(gameData.worldEntities.filter((entity) => entity.entityKind === 'decoration').map((entity) => [entity.id, toDecorationDraft(entity)])));
  }, [gameData.worldRevision, gameData.worldEntities]);

  useEffect(() => {
    worldRevisionRef.current = Math.max(worldRevisionRef.current, gameData.worldRevision);
  }, [gameData.worldRevision]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setFeedback(null);
    try {
      await action();
      setFeedback(success);
    } catch {
      // The store exposes the server message globally; the panel keeps a
      // concise local hint so a failed action is still visible near its cause.
      setFeedback('這個動作沒有完成，請稍後再試。');
    }
  };

  const setDecorationMutationError = (entityId: string, mutation: DecorationMutationKind | null) => {
    setDecorationMutationErrors((current) => {
      if (mutation === null) {
        const next = { ...current };
        delete next[entityId];
        return next;
      }
      return { ...current, [entityId]: mutation };
    });
  };

  const commitWorldMutation = (
    action: (expectedRevision: number) => Promise<WorldMutationResult>,
    success: string,
    entityId?: string,
    failureKind?: DecorationMutationKind,
    lifecycle?: WorldMutationLifecycle,
  ) => {
    const queued = worldMutationQueueRef.current.then(async () => {
      setFeedback(null);
      try {
        const result = await action(worldRevisionRef.current);
        worldRevisionRef.current = getWorldRevisionAfterMutation(worldRevisionRef.current, result.revision);
        lifecycle?.onSuccess?.();
        if (entityId) setDecorationMutationError(entityId, null);
        setFeedback(success);
      } catch (error) {
        if (entityId && failureKind) setDecorationMutationError(entityId, failureKind);
        const fallback = lifecycle?.onFailure?.() ?? (entityId ? '裝飾變更失敗，請按重試。' : '這個動作沒有完成，請稍後再試。');
        setFeedback(toWorldMutationErrorMessage(error, fallback));
      }
    });
    worldMutationQueueRef.current = queued.then(() => undefined, () => undefined);
    return queued;
  };

  const setDecorationDraft = (entity: ChildWorldEntity, field: keyof DecorationDraft, value: number) => {
    setDecorationDrafts((current) => ({
      ...current,
      [entity.id]: { ...(current[entity.id] ?? toDecorationDraft(entity)), [field]: value },
    }));
  };

  const getDecorationCatalogItem = (inventoryItemId: string) => {
    const inventory = gameData.inventory.find((candidate) => candidate.id === inventoryItemId);
    return inventory
      ? gameData.catalog.find((candidate) => candidate.id === inventory.catalogItemId && candidate.itemType === 'decoration')
      : undefined;
  };

  const getDecorationCollisionCircles = (excludedEntityId?: string) => buildCollisionCircles(
    gameData.worldEntities
      .filter((candidate) => candidate.entityKind === 'decoration' && candidate.isActive && candidate.id !== excludedEntityId)
      .map((candidate) => ({
        positionX: candidate.x,
        positionZ: candidate.z,
        collisionRadius: candidate.collisionRadius ?? getDecorationCatalogItem(candidate.inventoryItemId)?.collisionRadius ?? 0.3,
        scale: candidate.scale,
      })),
  );

  const isDecorationDraftValid = (inventoryId: string, draft: DecorationDraft, excludedEntityId?: string) => {
    const item = getDecorationCatalogItem(inventoryId);
    return Boolean(item && isDecorationPlacementValid(draft, item, getDecorationCollisionCircles(excludedEntityId)));
  };

  const commitDecorationEntity = (inventoryId: string, entity: ChildWorldEntity, draft: DecorationDraft) => {
    if (!isDecorationDraftValid(inventoryId, draft, entity.id)) {
      setFeedback('這裡不能放置，請把裝飾移回可遊玩草地。');
      return;
    }
    return commitWorldMutation(
      (expectedRevision) => onUpdateDecoration({
        inventoryItemId: inventoryId,
        entityId: entity.id,
        expectedRevision,
        transform: { x: draft.x, y: entity.y, z: draft.z, rotationX: entity.rotationX, rotationY: draft.rotationY, rotationZ: entity.rotationZ, scale: draft.scale },
      }),
      '位置已更新。',
      entity.id,
      'update',
    );
  };

  const cancelDecorationEntity = (entity: ChildWorldEntity) => {
    setDecorationDrafts((current) => ({ ...current, [entity.id]: toDecorationDraft(entity) }));
    setDecorationMutationError(entity.id, null);
    setFeedback('已取消變更。');
  };

  const removeDecorationEntity = (inventoryId: string, entity: ChildWorldEntity) => commitWorldMutation(
    (expectedRevision) => onRemoveDecoration(entity.id, inventoryId, expectedRevision),
    '裝飾已收回背包。',
    entity.id,
    'remove',
  );

  const retryDecorationEntity = (inventoryId: string, entity: ChildWorldEntity, draft: DecorationDraft) => (
    decorationMutationErrors[entity.id] === 'remove'
      ? removeDecorationEntity(inventoryId, entity)
      : commitDecorationEntity(inventoryId, entity, draft)
  );

  const placeDecoration = (inventoryId: string, draft: DecorationDraft) => {
    if (!isDecorationDraftValid(inventoryId, draft)) {
      setFeedback('這裡不能放置，請把裝飾移回可遊玩草地。');
      return;
    }
    return commitWorldMutation(
      (expectedRevision) => onPlaceDecoration({
        inventoryItemId: inventoryId,
        expectedRevision,
        transform: { x: draft.x, y: 0, z: draft.z, rotationX: 0, rotationY: draft.rotationY, rotationZ: 0, scale: draft.scale },
        behaviorMode: 'static',
      }),
      '裝飾已放入世界。',
    );
  };

  const toggleRoamingPet = (inventoryItemId: string) => {
    if (roamingMutationPendingRef.current) return;
    const currentRoamingPets = roamingPetsRef.current;
    const next = getNextRoamingPets(currentRoamingPets, inventoryItemId, getRoamablePetInventoryIds(gameData));
    if (next === currentRoamingPets) {
      setFeedback('跟隨中的寵物不能巡遊。');
      return;
    }

    roamingPetsRef.current = next;
    setRoamingPets(next);
    roamingMutationPendingRef.current = true;
    setRoamingMutationPending(true);
    void commitWorldMutation(() => onSetRoamingPets(next),
      '巡遊夥伴已更新。',
      undefined,
      undefined,
      {
        onSuccess: () => {
          const committedSnapshot = [...next];
          roamingPetsServerSnapshotRef.current = committedSnapshot;
          roamingPetsRef.current = committedSnapshot;
          setRoamingPets(committedSnapshot);
          roamingMutationPendingRef.current = false;
          setRoamingMutationPending(false);
        },
        onFailure: () => {
          const rollbackSnapshot = [...roamingPetsServerSnapshotRef.current];
          roamingPetsServerSnapshotRef.current = rollbackSnapshot;
          roamingPetsRef.current = rollbackSnapshot;
          setRoamingPets(rollbackSnapshot);
          roamingMutationPendingRef.current = false;
          setRoamingMutationPending(false);
          return '巡遊夥伴更新失敗，已恢復上次同步狀態。';
        },
      },
    );
  };

  const toggleFollowingPet = (inventoryItemId: string) => {
    if (followingMutationPendingRef.current) return;
    const next = selectFollowingPet(followingPetsRef.current, inventoryItemId);
    followingPetsRef.current = next;
    setFollowingPets(next);
    followingMutationPendingRef.current = true;
    setFollowingMutationPending(true);
    void commitWorldMutation(() => onSetFollowingPets(next),
      next.includes(inventoryItemId) ? '跟隨隊列已更新。' : '已取消跟隨夥伴。',
      undefined,
      undefined,
      {
        onSuccess: () => {
          const committedSnapshot = [...next];
          followingPetsServerSnapshotRef.current = committedSnapshot;
          followingPetsRef.current = committedSnapshot;
          setFollowingPets(committedSnapshot);
          followingMutationPendingRef.current = false;
          setFollowingMutationPending(false);
        },
        onFailure: () => {
          const rollbackSnapshot = [...followingPetsServerSnapshotRef.current];
          followingPetsRef.current = rollbackSnapshot;
          setFollowingPets(rollbackSnapshot);
          followingMutationPendingRef.current = false;
          setFollowingMutationPending(false);
          return '跟隨夥伴更新失敗，已恢復上次同步狀態。';
        },
      },
    );
  };

  const startPetRename = (inventoryItemId: string, currentName: string | null | undefined) => {
    setEditingPetId(inventoryItemId);
    setPetNameDraft(currentName?.trim() ?? '');
    setFeedback(null);
  };

  const cancelPetRename = () => {
    setEditingPetId(null);
    setPetNameDraft('');
  };

  const savePetRename = (inventoryItemId: string) => {
    if (renamePendingId !== null) return;
    const nextName = petNameDraft.trim();
    if (nextName.length > 12) {
      setFeedback('寵物名字最多 12 個字。');
      return;
    }
    setRenamePendingId(inventoryItemId);
    setEditingPetId(null);
    setPetNameDraft('');
    setFeedback(nextName ? '寵物名字已更新，正在背景同步。' : '已恢復預設名稱，正在背景同步。');
    void onRenamePet(inventoryItemId, nextName || null)
      .then(() => setFeedback('寵物名字已同步。'))
      .catch(() => setFeedback('同步失敗，名稱已恢復，請再試一次。'))
      .finally(() => setRenamePendingId(null));
  };

  const visibleInventory = gameData.inventory.flatMap((inventory) => {
    const item = gameData.catalog.find((catalog) => catalog.id === inventory.catalogItemId);
    if (!item || item.itemType !== inventorySection || (inventorySection === 'pet' && !item.isActive)) return [];
    return [{ inventory, item }];
  });

  const previewInventoryActions = previewInventory && previewItem ? (() => {
    const inventory = previewInventory;
    const item = previewItem;

    if (item.itemType === 'character') {
      const isEquipped = gameData.loadout?.equippedCharacterInventoryId === inventory.id;
      return (
        <button type="button" className="hh-game-action-button hh-game-action-button--primary" disabled={mutationPending || isEquipped} onClick={() => void run(() => onEquipCharacter(inventory.id), '角色已換裝。')}>
          {isEquipped ? <><Check size={16} aria-hidden="true" /> 使用中</> : '換裝'}
        </button>
      );
    }

    if (item.itemType === 'pet') {
      const followingIndex = followingPets.indexOf(inventory.id);
      const isFollowing = followingIndex >= 0;
      const isRoaming = roamingPets.includes(inventory.id);
      const canRoam = getRoamablePetInventoryIds(gameData).includes(inventory.id);
      return (
        <>
          {editingPetId === inventory.id ? (
            <div className="hh-game-lightbox-action-row hh-game-lightbox-pet-rename-row">
              <input
                className="hh-game-lightbox-pet-name-input"
                type="text"
                aria-label="寵物名字"
                value={petNameDraft}
                maxLength={12}
                placeholder={item.name}
                disabled={renamePendingId === inventory.id}
                onChange={(event) => setPetNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void savePetRename(inventory.id);
                  if (event.key === 'Escape') cancelPetRename();
                }}
              />
              <button type="button" className="hh-game-action-button hh-game-action-button--primary" aria-label="儲存寵物名字" disabled={renamePendingId === inventory.id} onClick={() => void savePetRename(inventory.id)}><Check size={16} aria-hidden="true" /></button>
              <button type="button" className="hh-game-action-button" aria-label="取消改名" disabled={renamePendingId === inventory.id} onClick={cancelPetRename}><X size={16} aria-hidden="true" /></button>
            </div>
          ) : (
            <button type="button" className="hh-game-action-button" disabled={mutationPending || renamePendingId !== null} onClick={() => startPetRename(inventory.id, inventory.displayName)}>
              改名
            </button>
          )}
          <button type="button" className={`hh-game-action-button${isFollowing ? ' hh-game-action-button--danger' : ''}`} disabled={mutationPending || followingMutationPending || roamingMutationPending} onClick={() => toggleFollowingPet(inventory.id)}>
            {isFollowing ? <><X size={16} aria-hidden="true" /> 取消跟隨 #{followingIndex + 1}</> : '加入跟隨'}
          </button>
          <button type="button" className={`hh-game-action-button${isRoaming ? ' is-selected' : ''}`} disabled={mutationPending || isFollowing || roamingMutationPending || followingMutationPending || !canRoam} onClick={() => toggleRoamingPet(inventory.id)}>
            <Sparkles size={16} aria-hidden="true" /> {isFollowing ? `跟隨中 #${followingIndex + 1}` : isRoaming ? '巡遊中' : '巡遊'}
          </button>
        </>
      );
    }

    const entities = getActiveDecorationEntities(gameData.worldEntities, inventory.id);
    const newDraftKey = `${inventory.id}:new`;
    const newDraft = decorationDrafts[newDraftKey] ?? createDecorationPlacementDraft(item);
    const newDraftValid = isDecorationDraftValid(inventory.id, newDraft);
    const hasRoom = item.isStackable ? entities.length < inventory.quantity : entities.length === 0;
    return (
      <>
        <span className="hh-game-lightbox-status">{entities.length}/{item.isStackable ? inventory.quantity : 1} 件已放置</span>
        {entities.map((entity) => {
          const draft = decorationDrafts[entity.id] ?? toDecorationDraft(entity);
          return (
            <div key={entity.id}>
              <div className="hh-game-lightbox-action-row">
                <button type="button" className="hh-game-action-button hh-game-action-button--primary" disabled={mutationPending} onClick={() => { closePreview(); onStartExistingDecorationPlacement(entity.id); }}>重新擺放</button>
                <button type="button" className="hh-game-action-button hh-game-action-button--danger" disabled={mutationPending} onClick={() => void removeDecorationEntity(inventory.id, entity)}>收回</button>
              </div>
              {decorationMutationErrors[entity.id] && (
                <>
                  <span className="hh-game-field-hint" role="status">變更失敗</span>
                  <button type="button" className="hh-game-action-button" disabled={mutationPending} onClick={() => void retryDecorationEntity(inventory.id, entity, draft)}>重試</button>
                </>
              )}
            </div>
          );
        })}
        {hasRoom && <button
          type="button"
          className="hh-game-action-button hh-game-action-button--primary"
          disabled={mutationPending || (entities.length > 0 && !newDraftValid)}
          onClick={() => {
            if (entities.length === 0) {
              closePreview();
              onStartDecorationPlacement(inventory.id, item.id);
              return;
            }
            void placeDecoration(inventory.id, newDraft);
          }}
        >放置{entities.length > 0 ? '一份' : ''}</button>}
      </>
    );
  })() : null;

  return (
    <section className="hh-game-panel" aria-labelledby="hh-game-panel-title">
      <div className="hh-game-panel-header">
        <div>
          <p className="hh-game-panel-eyebrow"><Compass size={15} /> 冒險世界</p>
          <h2 id="hh-game-panel-title">{title}</h2>
        </div>
      </div>

      {kind !== 'settings' && (
        <div className="hh-game-wallet-row">
          <div className="hh-game-wallet" aria-label={`目前有 ${gameData.walletBalance} 張卷軸`}>
            <ScrollText size={17} strokeWidth={2.5} aria-hidden="true" />
            <span>卷軸</span>
            <strong>{gameData.walletBalance}</strong>
          </div>
          {kind === 'inventory' && <GameCatalogLayoutControls columns={inventoryColumns} onChange={setInventoryColumns} />}
          {kind === 'shop' && <GameCatalogLayoutControls columns={shopColumns} onChange={setShopColumns} />}
        </div>
      )}

      {kind === 'inventory' && (
        <div className={`hh-game-panel-section${kind === 'inventory' ? ' hh-game-panel-section--inventory' : ''}`}>
          <div className="hh-game-tabs hh-game-tabs--icons" role="tablist" aria-label="背包分類">
            {([['character', '角色'], ['pet', '寵物'], ['decoration', '裝飾']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-label={label} title={label} aria-selected={inventorySection === value} className={inventorySection === value ? 'is-selected' : ''} onClick={() => setInventorySection(value)}>
                {value === 'character' ? <Crown size={16} /> : value === 'pet' ? <PawPrint size={16} /> : <Flower2 size={16} />}
              </button>
            ))}
          </div>
          {inventorySection === 'decoration' && (
            <div className="hh-game-store-toolbar">
              <button
                type="button"
                className="hh-game-action-button hh-game-action-button--danger"
                disabled={mutationPending || activeDecorationCount === 0}
                onClick={() => void commitWorldMutation((expectedRevision) => onCollectAllDecorations(expectedRevision), '全部裝飾已收回背包。')}
              >
                全部收回
              </button>
            </div>
          )}
          <div className={`hh-game-catalog-grid hh-game-catalog-grid--${inventoryColumns}`}>
            {visibleInventory.map(({ inventory, item }) => {
              const displayItem = getInventoryDisplayItem(inventory, item);
              return (
                <GameItemCard
                  key={inventory.id}
                  item={displayItem}
                  price={0}
                  mode="child"
                  showMeta={false}
                  onOpenPreview={() => openInventoryPreview(inventory, item)}
                />
              );
            })}
          </div>
          {visibleInventory.length === 0 && (
            <p className="hh-game-empty">這個分類目前還沒有物品，完成冒險後來商店看看吧。</p>
          )}
        </div>
      )}

      {kind === 'shop' && (
        <div className="hh-game-panel-section">
          <div className="hh-game-tabs hh-game-tabs--icons" role="tablist" aria-label="商店分類">
            {([['character', '角色'], ['pet', '寵物'], ['decoration', '裝飾']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-label={label} title={label} aria-selected={shopSection === value} className={shopSection === value ? 'is-selected' : ''} onClick={() => setShopSection(value)}>
                {value === 'character' ? <Crown size={16} /> : value === 'pet' ? <PawPrint size={16} /> : <Flower2 size={16} />}
              </button>
            ))}
          </div>
          <div className={`hh-game-catalog-grid hh-game-catalog-grid--${shopColumns}`}>
            {gameData.catalog.filter((item) => item.isActive && !item.isStarter && item.itemType === shopSection).map((item) => {
              const price = gameData.prices[item.id] ?? item.scrollPrice;
              return (
                <GameItemCard
                  key={item.id}
                  item={item}
                  price={price}
                  mode="child"
                  showMeta={false}
                  onOpenPreview={openShopPreview}
                />
              );
            })}
          </div>
        </div>
      )}

      {kind === 'settings' && (
        <div className="hh-game-panel-section">
          <h3><Settings size={18} /> 通知與帳號</h3>
          <div className="hh-game-settings-card hh-game-settings-card--toggle">
            <div>
              <strong>背景音樂</strong>
            </div>
            <label className="hh-game-setting-toggle">
              <span className="sr-only">背景音樂</span>
              <input type="checkbox" checked={backgroundMusicEnabled} onChange={(event) => onBackgroundMusicChange(event.target.checked)} />
              <span aria-hidden="true" />
            </label>
          </div>
          <div className="hh-game-settings-card hh-game-settings-card--toggle">
            <div>
              <strong>顯示寵物名字</strong>
            </div>
            <label className="hh-game-setting-toggle">
              <span className="sr-only">顯示寵物名字</span>
              <input type="checkbox" checked={showPetNames} onChange={(event) => onShowPetNamesChange(event.target.checked)} />
              <span aria-hidden="true" />
            </label>
          </div>
          <PushNotificationSettings settings={notificationSettings} className="hh-game-settings-card" />
          <div className="hh-game-settings-actions">
            <button type="button" className="hh-game-action-button" onClick={onSwitchChild}>切換孩子</button>
            <button type="button" className="hh-game-action-button hh-game-action-button--danger" onClick={onLogout}>登出</button>
          </div>
        </div>
      )}

      {feedback && <p className="hh-game-feedback" role="status">{feedback}</p>}
      <GameItemLightbox
        item={previewItem}
        price={previewPrice}
        purchaseDisabled={previewPurchaseDisabled}
        purchaseLabel={previewPurchaseLabel}
        onPurchase={kind === 'shop' ? handlePreviewPurchase : undefined}
        actionContent={previewInventoryActions}
        onClose={closePreview}
      />
    </section>
  );
}
