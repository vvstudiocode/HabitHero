import { useEffect, useRef, useState } from 'react';
import { Check, Coins, Compass, Crown, Flower2, PawPrint, Settings, ShoppingBag, Sparkles, X } from 'lucide-react';
import type { ChildGameData, GameCatalogItem, WorldMutationPayload, WorldMutationResult, WorldTransformMutationPayload } from '../contracts';
import { getActiveDecorationEntities, getWorldRevisionAfterMutation, toDecorationDraft, type DecorationDraft } from './decoration-editing';
import { getNextRoamingPets, getRoamablePetInventoryIds, getRoamingPetSnapshot } from './roaming-pet-state';
import { getFollowingPetInventoryIds, selectFollowingPet } from '../following-pet-state';
import { GameItemLightbox, GameItemPreview } from './GameItemImagePreview';
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
  onPurchase: (catalogItemId: string, quantity: number, idempotencyKey: string) => Promise<void>;
  onEquipCharacter: (inventoryItemId: string) => Promise<void>;
  onRenamePet: (inventoryItemId: string, displayName: string | null) => Promise<void>;
  onSetFollowingPets: (inventoryItemIds: string[]) => Promise<WorldMutationResult>;
  onSetRoamingPets: (inventoryItemIds: string[]) => Promise<WorldMutationResult>;
  onPlaceDecoration: (payload: WorldMutationPayload) => Promise<WorldMutationResult>;
  onUpdateDecoration: (payload: WorldTransformMutationPayload) => Promise<WorldMutationResult>;
  onRemoveDecoration: (entityId: string, inventoryItemId: string, expectedRevision: number) => Promise<WorldMutationResult>;
  onCollectAllDecorations: (expectedRevision: number) => Promise<WorldMutationResult>;
  onSwitchChild: () => void;
  onLogout: () => void;
  showPetNames: boolean;
  onShowPetNamesChange: (visible: boolean) => void;
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const itemTypeLabels: Record<GameCatalogItem['itemType'], string> = {
  character: '角色',
  pet: '寵物',
  decoration: '裝飾',
};

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
  onPlaceDecoration,
  onUpdateDecoration,
  onRemoveDecoration,
  onCollectAllDecorations,
  onSwitchChild,
  onLogout,
  showPetNames,
  onShowPetNamesChange,
}: ChildGamePanelProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const initialRoamingPetSnapshot = getRoamingPetSnapshot(gameData);
  const initialFollowingPetSnapshot = getFollowingPetInventoryIds(gameData);
  const [roamingPets, setRoamingPets] = useState<string[]>(initialRoamingPetSnapshot);
  const [followingPets, setFollowingPets] = useState<string[]>(initialFollowingPetSnapshot);
  const [inventorySection, setInventorySection] = useState<'character' | 'pet' | 'decoration'>('character');
  const [shopSection, setShopSection] = useState<'character' | 'pet' | 'decoration'>('character');
  const [previewItem, setPreviewItem] = useState<GameCatalogItem | null>(null);
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

  const run = async (action: () => Promise<void>, success: string) => {
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
      } catch {
        if (entityId && failureKind) setDecorationMutationError(entityId, failureKind);
        setFeedback(lifecycle?.onFailure?.() ?? (entityId ? '裝飾變更失敗，請按重試。' : '這個動作沒有完成，請稍後再試。'));
      }
    });
    worldMutationQueueRef.current = queued.then(() => undefined, () => undefined);
    return queued;
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

  return (
    <section className="hh-game-panel" aria-labelledby="hh-game-panel-title">
      <div className="hh-game-panel-header">
        <div>
          <p className="hh-game-panel-eyebrow"><Compass size={15} /> 冒險世界</p>
          <h2 id="hh-game-panel-title">{title}</h2>
        </div>
      </div>

      {kind !== 'settings' && (
        <div className="hh-game-wallet" aria-label={`目前有 ${gameData.walletBalance} 張卷軸`}>
          <Coins size={20} aria-hidden="true" />
          <span>卷軸</span>
          <strong>{gameData.walletBalance}</strong>
        </div>
      )}

      {kind === 'inventory' && (
        <div className={`hh-game-panel-section${kind === 'inventory' ? ' hh-game-panel-section--inventory' : ''}`}>
          <div className="hh-game-tabs" role="tablist" aria-label="背包分類">
            {([['character', '角色'], ['pet', '寵物'], ['decoration', '裝飾']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={inventorySection === value} className={inventorySection === value ? 'is-selected' : ''} onClick={() => setInventorySection(value)}>
                {value === 'character' ? <Crown size={16} /> : value === 'pet' ? <PawPrint size={16} /> : <Flower2 size={16} />}
                {label}
              </button>
            ))}
          </div>
          <div className="hh-game-inventory-heading">
            <h3>{inventorySection === 'decoration' ? <Flower2 size={18} /> : <ShoppingBag size={18} />} {inventorySection === 'character' ? '角色' : inventorySection === 'pet' ? '寵物' : '世界裝飾'}</h3>
            {inventorySection === 'decoration' && (
              <div className="hh-game-item-actions">
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
          </div>
          <div className="hh-game-card-grid">
            {gameData.inventory.filter((inventory) => {
              const item = gameData.catalog.find((catalog) => catalog.id === inventory.catalogItemId);
              return item?.itemType === inventorySection && (inventorySection !== 'pet' || item.isActive);
            }).map((inventory, index) => {
              const item = gameData.catalog.find((catalog) => catalog.id === inventory.catalogItemId);
              if (!item) return null;
              const isCharacter = item.itemType === 'character';
              if (inventorySection === 'decoration') {
                const entities = getActiveDecorationEntities(gameData.worldEntities, inventory.id);
                const newDraftKey = `${inventory.id}:new`;
                const newDraft = decorationDrafts[newDraftKey] ?? { x: 1.8 + (index * 0.7), z: -1.5, rotationY: 0, scale: 1 };
                const hasRoom = item.isStackable ? entities.length < inventory.quantity : entities.length === 0;
                return (
                  <article className="hh-game-item-card hh-game-decoration-card" key={inventory.id}>
                    <div className="hh-game-item-icon hh-game-item-icon--thumbnail"><GameItemPreview item={item} onOpen={setPreviewItem} /></div>
                    <div className="hh-game-item-copy"><strong>{item.name}</strong><span>{entities.length}/{item.isStackable ? inventory.quantity : 1} 件已放置</span></div>
                    {entities.map((entity, entityIndex) => {
                      const draft = decorationDrafts[entity.id] ?? toDecorationDraft(entity);
                      const setDraft = (field: keyof DecorationDraft, value: number) => setDecorationDrafts((current) => ({
                        ...current,
                        [entity.id]: { ...(current[entity.id] ?? toDecorationDraft(entity)), [field]: value },
                      }));
                      const commitEntity = () => commitWorldMutation(
                        (expectedRevision) => onUpdateDecoration({
                          inventoryItemId: inventory.id,
                          entityId: entity.id,
                          expectedRevision,
                          transform: { x: draft.x, y: entity.y, z: draft.z, rotationX: entity.rotationX, rotationY: draft.rotationY, rotationZ: entity.rotationZ, scale: draft.scale },
                        }),
                        '位置已更新。',
                        entity.id,
                        'update',
                      );
                      const cancelEntity = () => {
                        setDecorationDrafts((current) => ({ ...current, [entity.id]: toDecorationDraft(entity) }));
                        setDecorationMutationError(entity.id, null);
                        setFeedback('已取消變更。');
                      };
                      const removeEntity = () => commitWorldMutation(
                        (expectedRevision) => onRemoveDecoration(entity.id, inventory.id, expectedRevision),
                        '裝飾已收回背包。',
                        entity.id,
                        'remove',
                      );
                      const retryEntity = () => decorationMutationErrors[entity.id] === 'remove'
                        ? removeEntity()
                        : commitEntity();
                      return (
                        <div className="hh-game-item-actions" key={entity.id} data-entity-id={entity.id}>
                          <span className="hh-game-field-hint">#{entityIndex + 1}</span>
                          <label className="hh-game-field">X<input type="number" step="0.1" value={draft.x} onChange={(event) => setDraft('x', Number(event.target.value))} /></label>
                          <label className="hh-game-field">Z<input type="number" step="0.1" value={draft.z} onChange={(event) => setDraft('z', Number(event.target.value))} /></label>
                          <label className="hh-game-field">旋轉Y<input type="number" step="0.1" value={draft.rotationY} onChange={(event) => setDraft('rotationY', Number(event.target.value))} /></label>
                          <label className="hh-game-field">大小<input type="number" min="0.25" max="3" step="0.1" value={draft.scale} onChange={(event) => setDraft('scale', Number(event.target.value))} /></label>
                          <button type="button" className="hh-game-action-button hh-game-action-button--primary" disabled={mutationPending} onClick={() => void commitEntity()}>套用</button>
                          <button type="button" className="hh-game-action-button" disabled={mutationPending} onClick={cancelEntity}>取消</button>
                          <button type="button" className="hh-game-action-button hh-game-action-button--danger" disabled={mutationPending} onClick={() => void removeEntity()}>收回</button>
                          {decorationMutationErrors[entity.id] && (
                            <>
                              <span className="hh-game-field-hint" role="status">變更失敗</span>
                              <button type="button" className="hh-game-action-button" disabled={mutationPending} onClick={() => void retryEntity()}>重試</button>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {hasRoom && (
                      <div className="hh-game-item-actions">
                        <button type="button" className="hh-game-action-button hh-game-action-button--primary" disabled={mutationPending} onClick={() => void commitWorldMutation((expectedRevision) => onPlaceDecoration({ inventoryItemId: inventory.id, expectedRevision, transform: { x: newDraft.x, y: 0, z: newDraft.z, rotationX: 0, rotationY: newDraft.rotationY, rotationZ: 0, scale: newDraft.scale }, behaviorMode: 'static' }), '裝飾已放入世界。')}>放置{entities.length > 0 ? '一份' : ''}</button>
                      </div>
                    )}
                  </article>
                );
              }
              const isEquipped = gameData.loadout?.equippedCharacterInventoryId === inventory.id;
              const followingIndex = followingPets.indexOf(inventory.id);
              const isFollowing = followingIndex >= 0;
              const isRoaming = roamingPets.includes(inventory.id);
              const canRoam = getRoamablePetInventoryIds(gameData).includes(inventory.id);
              const petDisplayName = inventory.displayName?.trim() || item.name;
              return (
                <article className="hh-game-item-card" key={inventory.id}>
                  <div className="hh-game-item-icon hh-game-item-icon--thumbnail"><GameItemPreview item={item} onOpen={setPreviewItem} /></div>
                  <div className="hh-game-item-copy">
                    <strong>{isCharacter ? item.name : petDisplayName}</strong>
                    <span>{item.description}</span>
                  </div>
                  {isCharacter ? (
                    <button type="button" className="hh-game-action-button" disabled={mutationPending || isEquipped} onClick={() => void run(() => onEquipCharacter(inventory.id), '角色已換裝。')}>
                      {isEquipped ? <><Check size={16} /> 使用中</> : '換裝'}
                    </button>
                  ) : (
                    <div className="hh-game-item-actions">
                      {editingPetId === inventory.id ? (
                        <div className="hh-game-pet-name-editor">
                          <input
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
                          <button type="button" className="hh-game-action-button hh-game-action-button--primary" aria-label="儲存寵物名字" disabled={renamePendingId === inventory.id} onClick={() => void savePetRename(inventory.id)}><Check size={16} /></button>
                          <button type="button" className="hh-game-action-button" aria-label="取消改名" disabled={renamePendingId === inventory.id} onClick={cancelPetRename}><X size={16} /></button>
                        </div>
                      ) : (
                        <button type="button" className="hh-game-action-button" disabled={mutationPending || renamePendingId !== null} onClick={() => startPetRename(inventory.id, inventory.displayName)}>
                          改名
                        </button>
                      )}
                      <button type="button" className={`hh-game-action-button${isFollowing ? ' hh-game-action-button--danger' : ''}`} disabled={mutationPending || followingMutationPending || roamingMutationPending} onClick={() => toggleFollowingPet(inventory.id)}>
                        {isFollowing ? <><X size={16} /> 取消跟隨 #{followingIndex + 1}</> : '加入跟隨'}
                      </button>
                      <button type="button" className={`hh-game-action-button${isRoaming ? ' is-selected' : ''}`} disabled={mutationPending || isFollowing || roamingMutationPending || followingMutationPending || !canRoam} onClick={() => toggleRoamingPet(inventory.id)}>
                        <Sparkles size={16} /> {isFollowing ? `跟隨中 #${followingIndex + 1}` : isRoaming ? '巡遊中' : '巡遊'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {gameData.inventory.filter((inventory) => {
            const item = gameData.catalog.find((catalog) => catalog.id === inventory.catalogItemId);
            return item?.itemType === inventorySection && (inventorySection !== 'pet' || item.isActive);
          }).length === 0 && (
            <p className="hh-game-empty">這個分類目前還沒有物品，完成冒險後來商店看看吧。</p>
          )}
        </div>
      )}

      {kind === 'shop' && (
        <div className="hh-game-panel-section">
          <div className="hh-game-tabs" role="tablist" aria-label="商店分類">
            {([['character', '角色'], ['pet', '寵物'], ['decoration', '裝飾']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={shopSection === value} className={shopSection === value ? 'is-selected' : ''} onClick={() => setShopSection(value)}>
                {value === 'character' ? <Crown size={16} /> : value === 'pet' ? <PawPrint size={16} /> : <Flower2 size={16} />}
                {label}
              </button>
            ))}
          </div>
          <h3><ShoppingBag size={18} /> {itemTypeLabels[shopSection]} · 用卷軸交換</h3>
          <div className="hh-game-card-grid">
            {gameData.catalog.filter((item) => item.isActive && !item.isStarter && item.itemType === shopSection).map((item) => {
              const price = gameData.prices[item.id] ?? item.scrollPrice;
              const owned = ownedCatalogIds.has(item.id) && item.itemType !== 'pet' && !item.isStackable;
              return (
                <article className="hh-game-item-card" key={item.id}>
                  <div className="hh-game-item-icon hh-game-item-icon--thumbnail"><GameItemPreview item={item} onOpen={setPreviewItem} /></div>
                  <div className="hh-game-item-copy"><strong>{item.name}</strong><span>{itemTypeLabels[item.itemType]} · {item.description}</span></div>
                  <div className="hh-game-price"><Coins size={15} /> {price}</div>
                  <button type="button" className="hh-game-action-button hh-game-action-button--primary" disabled={mutationPending || owned || gameData.walletBalance < price} onClick={() => void run(() => onPurchase(item.id, 1, createIdempotencyKey()), '已加入背包。')}>
                    {owned ? '已擁有' : gameData.walletBalance < price ? '卷軸不足' : '兌換'}
                  </button>
                </article>
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
              <strong>顯示寵物名字</strong>
              <span>在世界中顯示寵物的白色小字名稱。</span>
            </div>
            <label className="hh-game-setting-toggle">
              <span className="sr-only">顯示寵物名字</span>
              <input type="checkbox" checked={showPetNames} onChange={(event) => onShowPetNamesChange(event.target.checked)} />
              <span aria-hidden="true" />
            </label>
          </div>
          <div className="hh-game-settings-card"><PushNotificationSettings settings={notificationSettings} /></div>
          <div className="hh-game-settings-actions">
            <button type="button" className="hh-game-action-button" onClick={onSwitchChild}>切換孩子</button>
            <button type="button" className="hh-game-action-button hh-game-action-button--danger" onClick={onLogout}>登出</button>
          </div>
        </div>
      )}

      {feedback && <p className="hh-game-feedback" role="status">{feedback}</p>}
      <GameItemLightbox item={previewItem} onClose={() => setPreviewItem(null)} />
    </section>
  );
}
