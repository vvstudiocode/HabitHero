import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ADVENTURE_TABLE_ASSET_KEY,
  ADVENTURE_TABLE_POSITION,
  ADVENTURE_TABLE_SCALE,
  getAdventureTableCatalogItem,
  getAdventureTablePromptHeight,
  getAdventureTableWorldTransform,
  getAdventureTablePromptScale,
  isAdventureTableNearby,
} from '../src/features/world/adventure-table';
import { isTransformWithinWorld } from '../src/features/world/world-collision';
import type { ChildGameData } from '../src/features/world/contracts';

const childGamePanelSource = readFileSync(
  new URL('../src/features/world/components/ChildGamePanel.tsx', import.meta.url),
  'utf8',
);
const parentGamePanelSource = readFileSync(
  new URL('../src/features/world/components/ParentGamePricePanel.tsx', import.meta.url),
  'utf8',
);
const childDashboardSource = readFileSync(
  new URL('../src/components/ChildDashboard.tsx', import.meta.url),
  'utf8',
);
const terrainWorldSource = readFileSync(
  new URL('../src/features/world/TerrainWorldLayer.tsx', import.meta.url),
  'utf8',
);
const runtimeSource = readFileSync(
  new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url),
  'utf8',
);
const boardSource = readFileSync(
  new URL('../src/features/adventures/components/ChildAdventureBoard.tsx', import.meta.url),
  'utf8',
);

const emptyGameData: ChildGameData = {
  walletBalance: 0,
  catalog: [],
  prices: {},
  inventory: [],
  loadout: null,
  worldEntities: [],
  worldRevision: 0,
};

describe('adventure table landmark', () => {
  it('uses the packaged adventure table asset and a deterministic catalog fallback', () => {
    const item = getAdventureTableCatalogItem(emptyGameData);

    assert.equal(ADVENTURE_TABLE_ASSET_KEY, 'decoration.adventure-table');
    assert.equal(item.assetKey, ADVENTURE_TABLE_ASSET_KEY);
    assert.equal(item.itemType, 'decoration');
    assert.equal(item.isActive, true);
  });

  it('places the table in the upper-left walkable area facing the big tree', () => {
    const tree = { x: 1.1, z: -8.9 };
    const transform = getAdventureTableWorldTransform(tree);
    const towardTree = Math.atan2(tree.x - transform.x, tree.z - transform.z);

    assert.deepEqual({ x: transform.x, z: transform.z }, ADVENTURE_TABLE_POSITION);
    assert.equal(transform.scale, ADVENTURE_TABLE_SCALE);
    assert.equal(ADVENTURE_TABLE_SCALE, 0.38);
    assert.ok(isTransformWithinWorld(transform, 0.78, []));
    assert.ok(Math.abs(transform.rotationY - towardTree) < 0.000001);
  });

  it('uses hysteresis so the dialogue icon does not flicker at the boundary', () => {
    assert.equal(isAdventureTableNearby(1.5, false), true);
    assert.equal(isAdventureTableNearby(1.8, true), true);
    assert.equal(isAdventureTableNearby(2.01, true), false);
  });

  it('anchors the prompt halfway toward the table and scales it for a distant camera', () => {
    assert.equal(getAdventureTablePromptHeight(2, 0), 1);
    assert.equal(getAdventureTablePromptScale(4.1, 4.1, 6.5), 1);
    assert.equal(getAdventureTablePromptScale(6.5, 4.1, 6.5), 0.72);
    assert.ok(getAdventureTablePromptScale(5.2, 4.1, 6.5) < 1);
    assert.match(runtimeSource, /getAdventureTablePromptHeight/);
    assert.match(runtimeSource, /getAdventureTablePromptScale/);
    assert.match(runtimeSource, /const tableScreenPosition = getAdventureTableScreenPosition\(viewport\) \?\? null/);
    assert.match(runtimeSource, /adventureTableScreenPosition = adventureTableNearby\s*\?\s*tableScreenPosition\s*:\s*null/);
    assert.match(runtimeSource, /onAdventureTableIndicatorScreenPositionChange\?\.\(tableScreenPosition\)/);
    assert.doesNotMatch(runtimeSource, /if \(!adventureTableScreenPosition\)/);
    assert.doesNotMatch(runtimeSource, /getStableAdventureTableScreenPosition/);
  });

  it('hides the table from both shop surfaces while retaining local asset support', () => {
    assert.match(childGamePanelSource, /isLocalGameItemShopVisible\(item\)/);
    assert.match(parentGamePanelSource, /isLocalGameItemShopVisible\(item\)/);
  });

  it('wires proximity and projected table position into the child world entry', () => {
    assert.match(runtimeSource, /onAdventureTableScreenPositionChange/);
    assert.match(runtimeSource, /onAdventureTableIndicatorScreenPositionChange/);
    assert.doesNotMatch(runtimeSource, /onAdventureTableProximityChange/);
    assert.doesNotMatch(runtimeSource, /onAdventureTableSelect/);
    assert.doesNotMatch(runtimeSource, /adventureTableSelectionFromEvent/);
    assert.match(terrainWorldSource, /onAdventureTableScreenPositionChange/);
    assert.match(terrainWorldSource, /onAdventureTableIndicatorScreenPositionChange/);
    assert.doesNotMatch(terrainWorldSource, /onAdventureTableNearbyChange/);
    assert.match(childDashboardSource, /AdventureTableDialogue/);
    assert.match(childDashboardSource, /開始冒險/);
    assert.match(childDashboardSource, /onAdventureTableScreenPositionChange/);
    assert.match(childDashboardSource, /onAdventureTableIndicatorScreenPositionChange/);
    assert.match(childDashboardSource, /setAdventureBoardOpen\(true\)/);
  });

  it('opens the board as a two-column category and detail surface', () => {
    assert.match(boardSource, /open\?: boolean/);
    assert.match(boardSource, /onRequestClose\?: \(\) => void/);
    assert.match(boardSource, /hh-adventure-board-layout/);
    assert.match(boardSource, /hh-adventure-board-detail/);
    assert.match(boardSource, /embedded/);
  });
});
