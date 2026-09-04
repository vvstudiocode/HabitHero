import { MessageCircle, ScrollText, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import type { ChildGameData, GameCatalogItem, WorldNpcOffering, WorldNpcSummary } from '../contracts';
import { isLocalGameItem3DPreviewEnabled, isLocalGameItemShopVisible } from '../game-content-assets';
import { isNpcDialogueOfferingVisible } from '../world-npc-dialogue';
import { GameItem3DPreview } from './GameItem3DPreview';
import { GameItemLightbox } from './GameItemImagePreview';
import { WorldNpcOfferingCard } from './WorldNpcOfferingCard';

interface WorldNpcDialoguePanelProps {
  npc: WorldNpcSummary;
  gameData: ChildGameData;
  busy: boolean;
  onTalk: () => Promise<void>;
  onPurchase: (catalogItemId: string, sourceNpcId: string) => Promise<void>;
  onClose: () => void;
}

function getNpcOfferings(gameData: ChildGameData, npc: WorldNpcSummary): WorldNpcOffering[] {
  return (gameData.worldNpcOfferings ?? [])
    .filter((offering) => offering.npcId === npc.id && offering.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function WorldNpcDialoguePanel({
  npc,
  gameData,
  busy,
  onTalk,
  onPurchase,
  onClose,
}: WorldNpcDialoguePanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<GameCatalogItem | null>(null);
  const progress = gameData.npcDialogueProgress?.find((item) => item.npcId === npc.id);
  const talked = Boolean(progress);
  const itemById = new Map(gameData.catalog.map((item) => [item.id, item]));
  const offerings = talked
    ? getNpcOfferings(gameData, npc).flatMap((offering) => {
      const item = itemById.get(offering.catalogItemId);
      return item
        && item.isNewlyObtainable !== false
        && isLocalGameItemShopVisible(item)
        && isNpcDialogueOfferingVisible(npc.npcType, item.itemType)
        ? [{ offering, item }]
        : [];
    })
    : [];
  const isPetNpc = npc.npcType === 'roaming_pet';
  const petOffering = isPetNpc ? offerings[0] : undefined;
  const petPreviewItem = petOffering
    ? {
      name: petOffering.item.name,
      itemType: petOffering.item.itemType,
      assetKey: petOffering.item.assetKey,
      thumbnailUrl: petOffering.item.thumbnailUrl,
    }
    : null;
  const petPrice = petOffering
    ? gameData.prices[petOffering.item.id] ?? petOffering.item.scrollPrice
    : undefined;
  const petPurchaseDisabled = Boolean(
    busy || petPrice === undefined || gameData.walletBalance < petPrice,
  );
  const petPurchaseLabel = petPrice !== undefined && gameData.walletBalance < petPrice ? '卷軸不足' : '兌換';
  const previewPrice = previewItem ? gameData.prices[previewItem.id] ?? previewItem.scrollPrice : undefined;
  const previewOwned = Boolean(
    previewItem
      && previewItem.itemType !== 'pet'
      && gameData.inventory.some((inventory) => inventory.catalogItemId === previewItem.id),
  );
  const previewPurchaseDisabled = Boolean(
    busy
      || previewOwned
      || previewPrice === undefined
      || gameData.walletBalance < previewPrice,
  );
  const previewPurchaseLabel = previewOwned
    ? '已擁有'
    : previewPrice !== undefined && gameData.walletBalance < previewPrice
      ? '卷軸不足'
      : '兌換';

  const handleTalk = async () => {
    setError(null);
    try {
      await onTalk();
    } catch {
      setError('對話同步失敗，請稍後再試。');
    }
  };

  const handlePurchase = async (catalogItemId: string) => {
    setError(null);
    try {
      await onPurchase(catalogItemId, npc.id);
      return true;
    } catch {
      setError('購買沒有完成，請確認卷軸數量後再試。');
      return false;
    }
  };

  const handlePreviewPurchase = async () => {
    if (!previewItem || previewPurchaseDisabled) return;
    if (await handlePurchase(previewItem.id)) setPreviewItem(null);
  };

  const handlePetPurchase = async () => {
    if (!petOffering || petPurchaseDisabled) return;
    await handlePurchase(petOffering.item.id);
  };

  const sceneName = gameData.worldScenes?.find((scene) => scene.id === npc.sceneId)?.name ?? '目前場景';
  const previewUses3D = previewItem !== null && isLocalGameItem3DPreviewEnabled(previewItem);
  const hasPetPreview = isPetNpc && talked && petPreviewItem !== null;
  const dialogueDescription = isPetNpc
    ? talked ? '謝謝你的拜訪，現在可以解鎖我的冒險夥伴。' : '和我聊聊，就能解鎖我的冒險夥伴。'
    : talked ? '謝謝你的拜訪，這些裝飾與人物已經準備好了。' : '來和我聊聊，解鎖這裡的裝飾與人物商品。';

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="hh-game-item-lightbox" role="dialog" aria-modal="true" aria-label={`${npc.name} 對話`}>
      <button type="button" className="hh-game-item-lightbox-backdrop" aria-label="關閉 NPC 對話" onClick={onClose} />
      <div className={`hh-game-item-lightbox-content hh-world-npc-dialogue-panel${hasPetPreview ? ' hh-world-npc-dialogue-panel--pet' : ''}`}>
        <button type="button" className="hh-game-item-lightbox-close" aria-label="關閉 NPC 對話" onClick={onClose}><X size={24} aria-hidden="true" /></button>
        {hasPetPreview && <GameItem3DPreview item={petPreviewItem} />}
        <div className="hh-game-item-lightbox-copy">
          <div className="hh-world-npc-dialogue-header">
            <strong>{npc.name}</strong>
            <p className="hh-world-npc-dialogue-wallet"><ScrollText size={15} aria-hidden="true" /> 目前卷軸：{gameData.walletBalance}</p>
          </div>
          <p>{dialogueDescription}</p>
          {!talked ? (
            <button type="button" className="hh-game-action-button hh-game-action-button--primary" disabled={busy} onClick={() => void handleTalk()}>
              <MessageCircle size={17} aria-hidden="true" /> {busy ? '同步中…' : '開始對話'}
            </button>
          ) : (
            isPetNpc ? (
              <div className="hh-world-npc-pet-purchase">
                {petOffering ? (
                  <>
                    <strong>{petOffering.item.name}</strong>
                    <p>{petOffering.item.description}</p>
                    <p className="hh-world-npc-pet-source">解鎖位置：{sceneName}，找{npc.name}</p>
                    <span className="hh-game-item-lightbox-price"><ScrollText size={15} aria-hidden="true" /> 價格 {petPrice} 張</span>
                    <button
                      type="button"
                      className="hh-game-action-button hh-game-action-button--primary hh-game-item-lightbox-purchase"
                      disabled={petPurchaseDisabled}
                      onClick={() => void handlePetPurchase()}
                    >
                      {petPurchaseLabel}
                    </button>
                  </>
                ) : (
                  <p>這隻寵物目前尚未開放購買。</p>
                )}
              </div>
            ) : (
              <div className="hh-game-lightbox-action-group">
                {offerings.length === 0 && <p>目前沒有可購買的裝飾或人物。</p>}
                <div className="hh-world-npc-offering-list">
                  {offerings.map(({ offering, item }) => {
                    const owned = item.itemType !== 'pet'
                      && gameData.inventory.some((inventory) => inventory.catalogItemId === item.id);
                    const price = gameData.prices[item.id] ?? item.scrollPrice;
                    const purchaseDisabled = busy || owned || gameData.walletBalance < price;
                    const purchaseLabel = owned ? '已擁有' : gameData.walletBalance < price ? '卷軸不足' : '查看';
                    return (
                      <WorldNpcOfferingCard
                        key={`${offering.npcId}:${offering.catalogItemId}`}
                        item={item}
                        price={price}
                        purchaseLabel={purchaseLabel}
                        purchaseDisabled={purchaseDisabled}
                        onOpen={setPreviewItem}
                      />
                    );
                  })}
                </div>
              </div>
            )
          )}
          {error && <p className="hh-game-field-hint" role="alert">{error}</p>}
        </div>
      </div>
      <GameItemLightbox
        item={previewItem}
        use3DPreview={previewUses3D}
        price={previewPrice}
        sourceLabel={`${sceneName}，找${npc.name}`}
        sourceLabelTitle="解鎖位置"
        purchaseDisabled={previewPurchaseDisabled}
        purchaseLabel={previewPurchaseLabel}
        onPurchase={() => void handlePreviewPurchase()}
        onClose={() => setPreviewItem(null)}
      />
    </div>,
    document.body,
  );
}
