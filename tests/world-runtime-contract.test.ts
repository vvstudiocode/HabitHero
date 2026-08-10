import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  WORLD_QUALITY_SETTINGS,
  getWorldQuality,
  scaleWorldBudget,
} from '../src/features/world/world-quality';
import { patchEquippedCharacter } from '../src/features/world/game-loadout';
import { emptyChildGameData } from '../src/features/world/contracts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const runtimeSource = read('../src/features/world/prototype-world-runtime.ts');
const heroSource = read('../src/components/DashboardCharacterHero.tsx');
const worldLayerSource = read('../src/features/world/TerrainWorldLayer.tsx');
const characterStyles = read('../src/styles/character.css');
const storeSource = read('../src/store.tsx');
const docsSource = read('../docs/game-assets.md');

describe('prototype world runtime contracts', () => {
  it('keeps high-quality prototype parity while reducing every expensive low-quality budget', () => {
    assert.equal(getWorldQuality({ prefersReducedMotion: false, deviceMemory: 8, hardwareConcurrency: 8 }), 'high');
    assert.equal(getWorldQuality({ prefersReducedMotion: true, deviceMemory: 8, hardwareConcurrency: 8 }), 'low');
    assert.equal(scaleWorldBudget(1000, 'high', 'grass'), 1000);
    assert.equal(scaleWorldBudget(1000, 'low', 'grass'), 327);
    assert.equal(scaleWorldBudget(1000, 'low', 'flower'), 357);
    assert.ok(WORLD_QUALITY_SETTINGS.low.outerDensityMultiplier < WORLD_QUALITY_SETTINGS.high.outerDensityMultiplier);
    assert.ok(WORLD_QUALITY_SETTINGS.low.forestLayers < WORLD_QUALITY_SETTINGS.high.forestLayers);
    assert.equal(WORLD_QUALITY_SETTINGS.low.shadows, false);
    assert.equal(WORLD_QUALITY_SETTINGS.high.shadows, true);
  });

  it('wires the selected quality settings into the 3D runtime', () => {
    assert.match(runtimeSource, /getWorldQuality\(/);
    assert.match(runtimeSource, /scaleWorldBudget\(/);
    assert.match(runtimeSource, /outerDensityMultiplier: qualitySettings\.outerDensityMultiplier/);
    assert.match(runtimeSource, /layers: qualitySettings\.forestLayers/);
    assert.match(runtimeSource, /shadowMap\.enabled = qualitySettings\.shadows/);
    assert.match(runtimeSource, /setPixelRatio\(Math\.min\([^\n]+qualitySettings\.maxPixelRatio/);
  });

  it('wires the portrait control band to independent movement, camera, and pinch input', () => {
    assert.match(runtimeSource, /getWorldInputZone\(point, rect\.height\)/);
    assert.match(runtimeSource, /zone: event\.pointerType === 'mouse' \? 'camera' : getWorldInputZone/);
    assert.match(worldLayerSource, /data-world-input-layout="portrait-control-band"/);
    assert.match(worldLayerSource, /下方四分之一拖曳移動，上方單指拖曳調整視角，雙指捏合縮放/);
    assert.match(runtimeSource, /cameraPitchMax:\s*Math\.PI\s*\*\s*0\.56/);
    assert.match(read('../terrain-prototype/index.html'), /CAMERA_PITCH_MAX = Math\.PI\s*\*\s*0\.56/);
  });

  it('lets passive statistics pass world pointer events through while keeping menu controls interactive', () => {
    assert.match(characterStyles, /\.hh-character-stats\s*\{[\s\S]*?pointer-events:\s*none;/);
    assert.match(characterStyles, /\.hh-character-menu\s*\{[\s\S]*?pointer-events:\s*none;/);
    assert.match(characterStyles, /\.hh-character-menu:not\(\.has-submenu\)[\s\S]*?pointer-events:\s*auto;/);
    assert.match(characterStyles, /\.hh-character-menu\.is-open \.hh-character-menu-root>\.hh-character-menu-action[\s\S]*?pointer-events:\s*auto;/);
  });

  it('exposes a focusable canvas with keyboard camera alternatives without removing movement keys', () => {
    assert.match(worldLayerSource, /tabIndex=\{0\}/);
    assert.match(worldLayerSource, /聚焦後使用 WASD[／/]方向鍵移動/);
    assert.match(runtimeSource, /getKeyboardCameraInput/);
    assert.match(runtimeSource, /isWorldCameraKey/);
    assert.match(runtimeSource, /getKeyboardMovement/);
    assert.match(runtimeSource, /cameraYaw/);
    assert.match(runtimeSource, /cameraPitch/);
    assert.match(runtimeSource, /cameraDistance/);
  });

  it('cleans async GLTF resources and handles context loss without forcing context loss', () => {
    assert.match(runtimeSource, /resourceRoots/);
    assert.match(runtimeSource, /trackResourceRoot\(treeSource/);
    assert.match(runtimeSource, /trackResourceRoot\(characterSource/);
    assert.match(runtimeSource, /webglcontextlost/);
    assert.doesNotMatch(runtimeSource, /forceContextLoss\s*\(/);
    assert.match(runtimeSource, /AbortError/);
    assert.match(runtimeSource, /alphaMap|normalMap|roughnessMap/);
  });

  it('does not render or query animation work while a feature panel is paused', () => {
    assert.match(runtimeSource, /if \(options\.pausedRef\.current\) \{[\s\S]{0,260}setTimeout/);
    assert.match(runtimeSource, /proceduralGrass\.update\(/);
    assert.equal((runtimeSource.match(/matchMedia\(/g) ?? []).length, 1);
  });

  it('does not preload hero media when a 3D scene owns the hero surface', () => {
    assert.match(heroSource, /const hasSceneLayer = Boolean\(sceneLayer\)/);
    assert.match(heroSource, /\{!hasSceneLayer && \(\s*<picture/);
    assert.match(heroSource, /\{!hasSceneLayer && mobileSceneVideo && \(/);
    assert.match(heroSource, /sceneLayer && <div className="hh-character-scene-layer">/);
  });

  it('patches the equipped character in local game data before the RPC settles', () => {
    const original = emptyChildGameData();
    const patched = patchEquippedCharacter(original, 'inventory-new');
    assert.equal(patched.loadout?.equippedCharacterInventoryId, 'inventory-new');
    assert.equal(patched.loadout?.followingPetInventoryId, null);
    assert.match(storeSource, /equipGameCharacter:[\s\S]*?patchEquippedCharacter/);
  });

  it('documents the actual quality strategy without claiming an absent fallback loader', () => {
    assert.match(docsSource, /high.*outer-density multiplier of 5/is);
    assert.match(docsSource, /low.*three forest layers.*disables renderer shadows/is);
    assert.doesNotMatch(docsSource, /low quality[^\n]*never starts the GLB loader/i);
  });
});
