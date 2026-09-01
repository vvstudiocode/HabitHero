import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  FOREST_VALLEY_GATE_ENTER_RADIUS,
  FOREST_VALLEY_GATE_EXIT_RADIUS,
  FOREST_VALLEY_GROUND_Y,
  FOREST_VALLEY_GATE_POSITION,
  FOREST_VALLEY_GATE_PROMPT_BOTTOM_MARGIN,
  FOREST_VALLEY_GATE_PROMPT_LOWERING_RATIO,
  FOREST_VALLEY_GATE_PROMPT_SIDE_MARGIN,
  FOREST_VALLEY_GATE_PROMPT_TOP_MARGIN,
  FOREST_VALLEY_MOVEMENT_BOUNDARY,
  FOREST_VALLEY_MODULE_ASSETS,
  FOREST_VALLEY_MODULE_PLACEMENTS,
  FOREST_VALLEY_MULTI_TREE_STONE_GATE_SCALE_FACTOR,
  FOREST_VALLEY_PURPLE_MUSHROOM_TREE_BACK_OFFSET,
  FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SIDE_OFFSET,
  FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SCALE,
  FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SINK,
  FOREST_VALLEY_SCENE_TRANSFORM,
  FOREST_VALLEY_SPAWN_ANCHOR,
  getForestValleyGatePromptHeight,
  isForestValleyGateNearby,
} from '../src/features/world/forest-valley';

describe('Forest Valley world gate', () => {
  it('registers every Blender-exported Forest Valley module and keeps the root gate spawn anchor explicit', () => {
    assert.deepEqual(Object.keys(FOREST_VALLEY_MODULE_ASSETS), [
      'island',
      'rootGate',
      'multiTreeStoneGate',
      'purpleMushroomTree',
      'moonSpring',
      'treeHollowOne',
      'treeHollowTwo',
      'treeHollowThree',
      'treeHollowHouseOne',
      'treeHollowHouseTwo',
      'circularBoardwalk',
      'noticeBoard',
    ]);
    assert.ok(Object.values(FOREST_VALLEY_MODULE_ASSETS).every((url) => url.startsWith('/assets/world/forest-valley/') || url.endsWith('/island.glb') || url.endsWith('/notice-board.glb')));
    assert.equal(FOREST_VALLEY_SCENE_TRANSFORM.scale, 0.6);
    assert.equal(FOREST_VALLEY_GROUND_Y, 0.06);
    assert.deepEqual(FOREST_VALLEY_SPAWN_ANCHOR, { x: -0.12276, z: 3.69 });
    assert.equal(FOREST_VALLEY_MOVEMENT_BOUNDARY, 18.9);
    assert.equal(FOREST_VALLEY_MODULE_ASSETS.multiTreeStoneGate, '/assets/world/forest-valley/multi-tree-stone-gate.glb');
    assert.equal(FOREST_VALLEY_MODULE_ASSETS.purpleMushroomTree, '/assets/world/forest-valley/purple-mushroom-tree.glb');
    assert.equal(FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'rootGate')?.collision, true);
    assert.equal(FOREST_VALLEY_MULTI_TREE_STONE_GATE_SCALE_FACTOR, 1.4);
    const multiTreeStoneGate = FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'multiTreeStoneGate');
    assert.deepEqual(multiTreeStoneGate?.position, [-0.20459985733032227, -0.5246994614601135, 6.15]);
    assert.deepEqual(multiTreeStoneGate?.scale, [9.58818260192871, 13.264295310974118, 8.736582870483398]);
    assert.equal(multiTreeStoneGate?.collision, true);
    assert.equal(multiTreeStoneGate?.collisionFootprintScale, 0.56);
    const circularBoardwalk = FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'circularBoardwalk');
    const purpleMushroomTree = FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'purpleMushroomTree');
    assert.equal(FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SCALE, 5.2);
    assert.equal(FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SINK, 0.18);
    assert.equal(FOREST_VALLEY_PURPLE_MUSHROOM_TREE_BACK_OFFSET, 4.6);
    assert.equal(FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SIDE_OFFSET, 2.2);
    assert.deepEqual(purpleMushroomTree?.position, [
      (circularBoardwalk?.position[0] ?? 0) - FOREST_VALLEY_PURPLE_MUSHROOM_TREE_BACK_OFFSET,
      -FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SINK,
      (circularBoardwalk?.position[2] ?? 0) + FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SIDE_OFFSET,
    ]);
    assert.deepEqual(purpleMushroomTree?.scale, [5.2, 5.2, 5.2]);
    assert.equal(purpleMushroomTree?.collision, false);
    assert.deepEqual(FOREST_VALLEY_GATE_POSITION, { x: -0.20459985733032227, z: 8.511223793029785 });
    assert.deepEqual(FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'rootGate')?.position, [-0.20459985733032227, 0.03695183992385864, 8.511223793029785]);
    assert.deepEqual(FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'noticeBoard')?.position, [0.16058099269866943, 0.07081437110900879, 1.2895534038543701]);
    assert.deepEqual(FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'noticeBoard')?.scale, [1.3900394439697266, 1.7157217661539714, 1.928049882253011]);
    assert.deepEqual(FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'treeHollowHouseOne')?.position, [13.125493049621582, -0.16671490669250488, 2.1639614582061768]);
    assert.deepEqual(FOREST_VALLEY_MODULE_PLACEMENTS.find((placement) => placement.asset === 'treeHollowHouseOne')?.rotation, [0.606673324, -0.363245755, 0.363245755, 0.606673324]);
  });

  it('uses hysteresis so the enter prompt does not flicker at the boundary', () => {
    assert.equal(isForestValleyGateNearby(2.4, false), true);
    assert.equal(isForestValleyGateNearby(3, true), true);
    assert.equal(isForestValleyGateNearby(3.21, true), false);
    assert.equal(isForestValleyGateNearby(Number.NaN, false), false);
    assert.ok(FOREST_VALLEY_GATE_EXIT_RADIUS > FOREST_VALLEY_GATE_ENTER_RADIUS);
    assert.equal(FOREST_VALLEY_GATE_ENTER_RADIUS, 2.4);
    assert.equal(FOREST_VALLEY_GATE_EXIT_RADIUS, 3.2);
  });

  it('anchors the entrance prompt like the notice board instead of above the gate', () => {
    const assets = readFileSync(new URL('../src/features/world/forest-valley.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../src/features/world/prototype-world-runtime.ts', import.meta.url), 'utf8');
    const dashboard = readFileSync(new URL('../src/components/ChildDashboard.tsx', import.meta.url), 'utf8');
    assert.equal(FOREST_VALLEY_GATE_PROMPT_LOWERING_RATIO, 0.75);
    assert.equal(getForestValleyGatePromptHeight(10, 0), 2.5);
    assert.match(runtime, /getForestValleyGatePromptHeight\(\s*Math\.max\(forestValleyGateBounds\.max\.y \+ 0\.25, 0\.9\),\s*forestValleyGateBounds\.min\.y/);
    assert.match(runtime, /SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT\.rotation\.y/);
    assert.match(assets, /ENTRY_HOUSE_ROTATION/);
    assert.match(runtime, /FOREST_VALLEY_GATE_PROMPT_SIDE_MARGIN/);
    assert.match(runtime, /FOREST_VALLEY_GATE_PROMPT_TOP_MARGIN/);
    assert.match(runtime, /FOREST_VALLEY_GATE_PROMPT_BOTTOM_MARGIN/);
    assert.match(runtime, /options\.worldLocation === 'forest-valley'/);
    assert.match(runtime, /groundY: worldGroundY/);
    assert.match(dashboard, /進入晨光村/);
    assert.ok(FOREST_VALLEY_GATE_PROMPT_SIDE_MARGIN >= 44);
    assert.ok(FOREST_VALLEY_GATE_PROMPT_TOP_MARGIN > 0);
    assert.ok(FOREST_VALLEY_GATE_PROMPT_BOTTOM_MARGIN > 0);
  });
});
