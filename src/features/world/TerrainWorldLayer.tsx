import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Object3D } from 'three';
import { Check, Minus, Plus, RotateCw, X } from 'lucide-react';
import type { ChildGameData, GameCatalogItem, PetBehaviorMode } from './contracts';
import {
  CENTRAL_TREE_KEEP_OUT,
  circlesOverlap,
  WORLD_BOUNDARY,
  type CollisionCircle,
} from './world-collision';
import { PointerInputController } from './input/pointer-input-controller';
import type { WorldInputState } from './input/world-input-types';
import { DynamicJoystick } from './components/DynamicJoystick';
import { mountPrototypeWorld, type PrototypeWorldRuntime } from './prototype-world-runtime';
import { getWorldQuality, type WorldQuality } from './world-quality';
import { getWorldCharacterByAssetKey } from '../characters/world-character-catalog';
import { createWorldSceneGameDataSnapshot } from './world-scene-data';
import {
  getPlacementRotationDelta,
  toDecorationPlacementTransform,
  type DecorationPlacementControl,
  type DecorationPlacementDraft,
  type DecorationPlacementGestureDelta,
} from './world-placement';

export {
  WORLD_QUALITY_SETTINGS,
  getWorldQuality,
} from './world-quality';
export type { WorldQuality } from './world-quality';

interface TerrainWorldLayerProps {
  childId: string;
  gameData: ChildGameData;
  showPetNames?: boolean;
  paused?: boolean;
  placement?: {
    inventoryItemId: string;
    catalogItemId: string;
    entityId?: string;
    draft: DecorationPlacementDraft;
  };
  placementValid?: boolean;
  placementPending?: boolean;
  onPlacementPositionChange?: (position: { x: number; z: number }) => void;
  onPlacementControl?: (control: DecorationPlacementControl) => void;
  onPlacementGestureChange?: (gesture: DecorationPlacementGestureDelta) => void;
  onCompletePlacement?: () => void;
  onCancelPlacement?: () => void;
  onStartDecorationPlacement?: (entityId: string) => void;
}

type ThreeNamespace = typeof import('three');
type CharacterRenderMode = 'anime-maiden' | 'world-glb' | 'procedural';

const DEFAULT_WORLD_CHARACTER: GameCatalogItem = {
  id: 'character.arthur',
  itemType: 'character',
  name: '亞瑟',
  description: '帶著溫暖笑容、勇敢踏上冒險的旅人。',
  scrollPrice: 9,
  assetKey: 'character.arthur',
  thumbnailUrl: '/assets/characters/arthur-thumbnail.webp',
  isActive: true,
  isStarter: true,
  isStackable: false,
  collisionRadius: 0.28,
  minScale: 0.9,
  maxScale: 1.1,
  sortOrder: 10,
  metadata: { model: '/assets/characters/arthur.glb', animation: 'Walk_InPlace' },
};

export function getAnimationClipName(clipNames: readonly string[], state: 'idle' | 'walk'): string | undefined {
  const statePattern = state === 'walk' ? /walk|run/i : /idle|iddle|stand|rest/i;
  return clipNames.find((name) => statePattern.test(name)) ?? clipNames[0];
}

export type PetActorState = 'following' | 'wandering' | 'idle';

export function getPetActorState(behaviorMode: 'static' | 'idle' | 'wander', following: boolean): PetActorState {
  if (following) return 'following';
  return behaviorMode === 'wander' ? 'wandering' : 'idle';
}

export function chooseWanderTarget(
  current: { x: number; z: number },
  radius: number,
  obstacles: readonly CollisionCircle[],
  random: () => number = Math.random,
): { x: number; z: number } | undefined {
  const limit = WORLD_BOUNDARY - radius - 0.08;
  const minimumDistance = Math.max(0.45, radius * 1.75);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = { x: (random() * 2 - 1) * limit, z: (random() * 2 - 1) * limit };
    if (Math.hypot(candidate.x - current.x, candidate.z - current.z) < minimumDistance) continue;
    if (obstacles.some((obstacle) => circlesOverlap({ ...candidate, radius }, obstacle))) continue;
    return candidate;
  }
  return undefined;
}

export function getCharacterRenderMode(item: GameCatalogItem | undefined): CharacterRenderMode {
  if (item?.itemType !== 'character') return 'procedural';
  if (item.assetKey === 'character.anime-maiden') return 'anime-maiden';
  return getWorldCharacterByAssetKey(item.assetKey) ? 'world-glb' : 'procedural';
}

export function getWorldCharacterModelUrl(item: GameCatalogItem | undefined): string | undefined {
  return item?.itemType === 'character' ? getWorldCharacterByAssetKey(item.assetKey)?.modelUrl : undefined;
}

function decorationCatalogItemForEntity(gameData: ChildGameData, entityId: string) {
  const entity = gameData.worldEntities.find((candidate) => candidate.id === entityId);
  if (!entity) return undefined;
  const catalogItemId = entity.catalogItemId ?? gameData.inventory.find((item) => item.id === entity.inventoryItemId)?.catalogItemId;
  return catalogItemId
    ? gameData.catalog.find((item) => item.id === catalogItemId && item.itemType === 'decoration')
    : undefined;
}

function getProceduralCharacterColors(item: GameCatalogItem | undefined) {
  const preview = typeof item?.metadata.preview === 'string' ? item.metadata.preview : '';
  const isStarlight = item?.assetKey === 'character.starlight-adventurer' || preview === 'starlight';
  const metadataColor = typeof item?.metadata.color === 'string' && /^#[\da-f]{6}$/i.test(item.metadata.color)
    ? item.metadata.color
    : undefined;
  return {
    body: isStarlight ? 0x5169d8 : 0x4d8567,
    outfit: isStarlight ? 0x7f8cff : 0x6ca477,
    accent: metadataColor ?? (isStarlight ? 0xf7cf65 : 0xe8b96a),
    skin: 0xffd6bf,
    hair: isStarlight ? 0x3b2e73 : 0x34584d,
  };
}

export function createProceduralCharacter(THREE: ThreeNamespace, item?: GameCatalogItem): Object3D {
  const colors = getProceduralCharacterColors(item);
  const character = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.82, 12), new THREE.MeshStandardMaterial({ color: colors.outfit, roughness: 0.85 }));
  body.position.y = 0.58;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.9 }));
  head.position.y = 1.34;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 10), new THREE.MeshStandardMaterial({ color: colors.hair, roughness: 1 }));
  hair.position.set(0, 1.55, -0.06);
  hair.scale.set(1, 0.62, 0.9);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 5), new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.85 }));
  hat.position.y = 1.87;
  const badge = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: colors.accent, emissive: colors.accent, emissiveIntensity: 0.18 }));
  badge.position.set(0, 0.7, 0.39);
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0x263b45, roughness: 1 }));
  leftEye.position.set(-0.14, 1.38, 0.38);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.14;
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 8), new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.9 }));
  leftArm.position.set(-0.4, 0.62, 0);
  leftArm.rotation.z = -0.35;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.4;
  rightArm.rotation.z = 0.35;
  character.add(body, head, hair, hat, badge, leftEye, rightEye, leftArm, rightArm);
  character.traverse((object) => {
    const mesh = object as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return character;
}

function getEquippedCatalogItem(gameData: ChildGameData): GameCatalogItem | undefined {
  const equippedInventoryId = gameData.loadout?.equippedCharacterInventoryId;
  const equippedInventory = equippedInventoryId
    ? gameData.inventory.find((inventory) => inventory.id === equippedInventoryId)
    : undefined;
  const equippedItem = equippedInventory
    ? gameData.catalog.find((item) => item.id === equippedInventory.catalogItemId)
    : undefined;
  return equippedItem && equippedItem.isActive
    ? equippedItem
    : gameData.catalog.find((item) => item.itemType === 'character' && item.isActive && item.assetKey === DEFAULT_WORLD_CHARACTER.assetKey)
      ?? DEFAULT_WORLD_CHARACTER;
}

function getWorldEntitiesSceneSignature(gameData: ChildGameData) {
  return [...gameData.worldEntities]
    // Both pets and decorations are synchronized by the mounted runtime. Keep
    // transforms and entity add/remove operations out of the remount key so a
    // placement mutation never flashes the whole terrain scene.
    .filter((entity) => entity.entityKind !== 'pet' && entity.entityKind !== 'decoration')
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entity) => [
      entity.id,
      entity.inventoryItemId,
      entity.entityKind,
      entity.worldLayoutVersion,
      entity.behaviorMode,
      entity.roamingSlot,
      entity.isActive,
      entity.collisionRadius,
      entity.assetKey,
      entity.displayName,
    ].join(':'))
    .join('|');
}

export function getTerrainWorldSceneKey(gameData: ChildGameData, quality: WorldQuality, showPetNames = true): string {
  return [
    getWorldEntitiesSceneSignature(gameData),
    quality,
    showPetNames ? 'pet-names-on' : 'pet-names-off',
  ].join('||');
}

function getCurrentWorldQuality(): WorldQuality {
  const deviceNavigator = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number };
  const prefersReducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  return getWorldQuality({
    prefersReducedMotion,
    deviceMemory: deviceNavigator?.deviceMemory,
    hardwareConcurrency: deviceNavigator?.hardwareConcurrency,
  });
}

function useWorldQuality() {
  const [quality, setQuality] = useState<WorldQuality>(getCurrentWorldQuality);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateQuality = () => setQuality(getCurrentWorldQuality());
    if (typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', updateQuality);
    else mediaQuery.addListener(updateQuality);
    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') mediaQuery.removeEventListener('change', updateQuality);
      else mediaQuery.removeListener(updateQuality);
    };
  }, []);

  return quality;
}

export function TerrainWorldLayer({
  childId,
  gameData,
  showPetNames = true,
  paused = false,
  placement,
  placementValid = false,
  placementPending = false,
  onPlacementPositionChange,
  onPlacementControl,
  onPlacementGestureChange,
  onCompletePlacement,
  onCancelPlacement,
  onStartDecorationPlacement,
}: TerrainWorldLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<PointerInputController | null>(null);
  const pausedRef = useRef(paused);
  const [input, setInput] = useState<WorldInputState>(() => new PointerInputController().getSnapshot());
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadingProgress, setLoadingProgress] = useState(12);
  const [loadingDetail, setLoadingDetail] = useState('讀取草地與大樹模型…');
  const [showStaticFallback, setShowStaticFallback] = useState(false);
  const [runtimeAttempt, setRuntimeAttempt] = useState(0);
  const [selectedDecoration, setSelectedDecoration] = useState<{ entityId: string; x: number; y: number } | null>(null);
  const placementRotationDragRef = useRef<{ pointerId: number; startX: number; lastX: number; moved: boolean } | null>(null);
  const runtimeRef = useRef<PrototypeWorldRuntime | null>(null);
  const worldQuality = useWorldQuality();
  const sceneKey = getTerrainWorldSceneKey(gameData, worldQuality, showPetNames);
  const sceneGameData = useMemo(() => createWorldSceneGameDataSnapshot(gameData), [gameData]);
  const sceneInput = useMemo(() => {
    const equippedCatalogItem = getEquippedCatalogItem(gameData);
    const placementItem = placement
      ? gameData.catalog.find((item) => item.id === placement.catalogItemId && item.itemType === 'decoration')
      : undefined;
    return {
      gameData: sceneGameData,
      equippedCatalogItem,
      characterRenderMode: getCharacterRenderMode(equippedCatalogItem),
      characterModelUrl: getWorldCharacterModelUrl(equippedCatalogItem),
      showPetNames,
      placement: placement && placementItem ? {
        item: placementItem,
        entityId: placement.entityId,
        transform: toDecorationPlacementTransform(placement.draft),
        isValid: placementValid,
      } : undefined,
    };
  }, [gameData, placement, placementValid, sceneGameData, showPetNames]);
  pausedRef.current = paused;

  useEffect(() => {
    const controller = new PointerInputController();
    controllerRef.current = controller;
    setInput(controller.getSnapshot());
    return () => {
      controller.reset();
      controllerRef.current = null;
    };
  }, [childId]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    return controller.subscribe(setInput);
  }, [childId]);

  useEffect(() => {
    if (paused) controllerRef.current?.reset();
  }, [paused]);

  useEffect(() => {
    if (placement) setSelectedDecoration(null);
  }, [placement]);

  const stopPlacementRotationDrag = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = placementRotationDragRef.current;
    if (event && drag?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    placementRotationDragRef.current = null;
  };

  const startPlacementRotationDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    placementRotationDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      moved: false,
    };
  };

  const updatePlacementRotationDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = placementRotationDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const previousX = drag.lastX;
    const deltaX = event.clientX - previousX;
    drag.lastX = event.clientX;
    drag.moved = drag.moved || Math.abs(event.clientX - drag.startX) >= 5;
    if (deltaX !== 0) onPlacementGestureChange?.({ scaleFactor: 1, rotationDelta: getPlacementRotationDelta(previousX, event.clientX) });
  };

  const cancelPlacementRotationDrag = () => {
    placementRotationDragRef.current = null;
  };

  const finishPlacementRotationDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = placementRotationDragRef.current;
    if (drag?.pointerId === event.pointerId && !drag.moved) onPlacementControl?.('rotate-right');
    stopPlacementRotationDrag(event);
  };

  useEffect(() => {
    if (!placement) cancelPlacementRotationDrag();
    return cancelPlacementRotationDrag;
  }, [placement]);

  useEffect(() => {
    setShowStaticFallback(false);
  }, [childId]);

  useEffect(() => {
    setStatus('loading');
  }, [childId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const runtime = mountPrototypeWorld({
      canvas,
      gameData: sceneInput.gameData,
      equippedCatalogItem: sceneInput.equippedCatalogItem,
      characterRenderMode: sceneInput.characterRenderMode,
      characterModelUrl: sceneInput.characterModelUrl,
      showPetNames: sceneInput.showPetNames,
      placement: sceneInput.placement,
      onPlacementPositionChange,
      onPlacementGestureChange,
      onDecorationSelect: setSelectedDecoration,
      createProceduralCharacter,
      controller: controllerRef.current,
      pausedRef,
      onStatus: setStatus,
      onProgress: (value, detail) => {
        setLoadingProgress(value);
        setLoadingDetail(detail);
      },
      onReady: () => {
        setShowStaticFallback(false);
        setStatus('ready');
      },
      onError: () => setStatus('failed'),
    });
    runtimeRef.current = runtime;
    return () => {
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      runtime.dispose();
    };
  }, [childId, runtimeAttempt, sceneKey]);

  useEffect(() => {
    runtimeRef.current?.update(sceneInput);
  }, [sceneInput]);

  const equippedCatalogItem = getEquippedCatalogItem(gameData);
  const staticCharacterName = equippedCatalogItem?.name ?? '冒險旅人';
  const staticCharacterAccent = equippedCatalogItem?.assetKey === 'character.starlight-adventurer' ? '#7f8cff' : '#6ca477';
  const selectedEntity = selectedDecoration
    ? gameData.worldEntities.find((entity) => entity.id === selectedDecoration.entityId && entity.entityKind === 'decoration' && entity.isActive)
    : undefined;
  const selectedItem = selectedEntity ? decorationCatalogItemForEntity(gameData, selectedEntity.id) : undefined;
  const selectedDecorationCanvasRect = selectedDecoration ? canvasRef.current?.getBoundingClientRect() : undefined;

  return (
    <div className={`hh-terrain-world${placement ? ' is-placement-mode' : ''}`} data-world-status={status} data-child-id={childId} data-world-input-layout="portrait-control-band">
      <canvas
        ref={canvasRef}
        className="hh-terrain-world-canvas"
        tabIndex={0}
        aria-label={placement ? '裝飾放置模式。按住裝飾並拖曳來移動位置；雙指捏合可縮放與旋轉。' : '習慣冒險島立體冒險世界。下方四分之一拖曳移動，上方單指拖曳調整視角，雙指捏合縮放。聚焦後使用 WASD／方向鍵移動，I/K 調整上下視角，J/L 調整左右視角，加號／減號縮放。'}
        hidden={showStaticFallback}
        aria-hidden={showStaticFallback}
      />
      {selectedDecoration && selectedEntity && selectedItem && !placement && onStartDecorationPlacement && selectedDecorationCanvasRect && createPortal(
        <div
          className="hh-world-decoration-selection"
          data-world-decoration-action
          style={{ left: selectedDecorationCanvasRect.left + selectedDecoration.x, top: selectedDecorationCanvasRect.top + selectedDecoration.y }}
        >
          <button
            type="button"
            className="hh-world-decoration-action"
            aria-label={`重新擺放${selectedItem.name}`}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSelectedDecoration(null);
              onStartDecorationPlacement(selectedEntity.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              setSelectedDecoration(null);
              onStartDecorationPlacement(selectedEntity.id);
            }}
          >
            重新擺放
          </button>
        </div>,
        document.body,
      )}
      <DynamicJoystick input={input} />
      {placement && (
        <section
          className="hh-world-placement-controls"
          aria-label="裝飾放置工具"
          data-placement-valid={placementValid}
        >
          <button type="button" className="hh-world-placement-control hh-world-placement-scale-down" aria-label="縮小" title="縮小" disabled={placementPending} onClick={() => onPlacementControl?.('scale-down')}><Minus size={21} aria-hidden="true" /></button>
          <button type="button" className="hh-world-placement-control hh-world-placement-scale-up" aria-label="放大" title="放大" disabled={placementPending} onClick={() => onPlacementControl?.('scale-up')}><Plus size={21} aria-hidden="true" /></button>
          <button
            type="button"
            className="hh-world-placement-control hh-world-placement-rotate-bottom"
            aria-label="旋轉"
            title="旋轉（按住後左右拖曳）"
            disabled={placementPending}
            onPointerDown={startPlacementRotationDrag}
            onPointerMove={updatePlacementRotationDrag}
            onPointerUp={finishPlacementRotationDrag}
            onPointerCancel={cancelPlacementRotationDrag}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              if (!event.repeat) onPlacementControl?.('rotate-right');
            }}
            onBlur={cancelPlacementRotationDrag}
          >
            <RotateCw size={20} aria-hidden="true" />
          </button>
          <button type="button" className="hh-world-placement-confirm" aria-label="完成放置" title="完成放置" disabled={!placementValid || placementPending} onClick={onCompletePlacement}><Check size={19} aria-hidden="true" /></button>
          <button type="button" className="hh-world-placement-cancel" aria-label="取消" title="取消" disabled={placementPending} onClick={onCancelPlacement}><X size={19} aria-hidden="true" /></button>
          <span className="sr-only" role="status">{placementValid ? '目前位置可以放置' : '此位置不能放置，請換一個地方'}</span>
        </section>
      )}
      {status === 'loading' && (
        <div className="hh-terrain-world-loading-panel" role="status">
          <strong>正在準備冒險地圖</strong>
          <p>{loadingDetail}</p>
          <div className="hh-terrain-world-progress-track" aria-hidden="true">
            <span style={{ width: `${loadingProgress}%` }} />
          </div>
        </div>
      )}
      {status === 'failed' && !showStaticFallback && (
        <div className="hh-terrain-world-status hh-terrain-world-status--error" role="alert">
          <p>立體場景暫時無法載入。</p>
          <button type="button" onClick={() => setShowStaticFallback(true)}>繼續使用靜態場景</button>
        </div>
      )}
      {status === 'failed' && showStaticFallback && (
        <section className="hh-terrain-world-static-fallback" role="region" aria-label="靜態冒險場景" style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', gap: 12, padding: 16, color: '#35554d', background: '#f7f6e8' }}>
          <div className="hh-terrain-world-static-stage" aria-hidden="true" style={{ position: 'relative', minHeight: 240, overflow: 'hidden', borderRadius: 24, background: 'linear-gradient(180deg, #bfe8f0 0%, #e8f3d7 63%, #91c57d 63%, #75ab70 100%)', boxShadow: 'inset 0 -18px 0 rgb(70 119 75 / 12%), 0 12px 28px rgb(67 91 69 / 14%)' }}>
            <div className="hh-terrain-world-static-tree" style={{ position: 'absolute', left: '50%', bottom: '16%', width: 132, height: 186, transform: 'translateX(-50%)' }}>
              <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 28, height: 92, transform: 'translateX(-50%)', borderRadius: 18, background: '#96633f' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 88, height: 88, borderRadius: '50%', background: '#4e9963', boxShadow: '58px 18px 0 #5ba46b, 28px 48px 0 #438b5a' }} />
            </div>
            <div className="hh-terrain-world-static-character" style={{ position: 'absolute', left: 'calc(50% - 102px)', bottom: '14%', width: 72, height: 124 }}>
              <div style={{ position: 'absolute', left: 17, bottom: 0, width: 38, height: 56, borderRadius: '45% 45% 28% 28%', background: staticCharacterAccent, boxShadow: 'inset 0 -8px 0 rgb(24 51 73 / 12%)' }} />
              <div style={{ position: 'absolute', left: 13, top: 22, width: 46, height: 46, borderRadius: '50%', background: '#ffd6bf', boxShadow: `inset 0 8px 0 ${staticCharacterAccent}` }} />
              <div style={{ position: 'absolute', left: 18, top: 0, width: 36, height: 34, borderRadius: '50% 50% 38% 38%', background: '#3b2e73' }} />
              <div style={{ position: 'absolute', left: 22, top: 43, width: 6, height: 6, borderRadius: '50%', background: '#263b45', boxShadow: '18px 0 0 #263b45' }} />
            </div>
          </div>
          <div className="hh-terrain-world-static-copy" style={{ display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center' }}>
            <strong>{staticCharacterName}正在中央樹旁冒險</strong>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>操作提示：使用方向鍵／WASD 或下方四分之一拖曳移動；上方單指調整視角，雙指捏合縮放。</p>
            <button type="button" onClick={() => { setShowStaticFallback(false); setStatus('loading'); setRuntimeAttempt((attempt) => attempt + 1); }} style={{ minHeight: 44, padding: '0 18px', color: '#fffdf4', background: '#5b9c69', borderRadius: 999, fontWeight: 900 }}>
              重新嘗試 3D
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
