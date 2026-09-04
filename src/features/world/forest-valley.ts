export const FOREST_VALLEY_MODULE_ASSETS = Object.freeze({
  // The shared island keeps the same ground mesh used by Sunrise Village.
  island: '/assets/world/sunrise-village/island.glb',
  rootGate: '/assets/world/forest-valley/root-gate.glb',
  multiTreeStoneGate: '/assets/world/forest-valley/multi-tree-stone-gate.glb',
  purpleMushroomTree: '/assets/world/forest-valley/purple-mushroom-tree.glb',
  moonSpring: '/assets/world/forest-valley/moon-spring.glb',
  treeHollowOne: '/assets/world/forest-valley/tree-hollow-one.glb',
  treeHollowTwo: '/assets/world/forest-valley/tree-hollow-two.glb',
  treeHollowThree: '/assets/world/forest-valley/tree-hollow-three.glb',
  treeHollowHouseOne: '/assets/world/forest-valley/tree-hollow-house-one.glb',
  treeHollowHouseTwo: '/assets/world/forest-valley/tree-hollow-house-two.glb',
  circularBoardwalk: '/assets/world/forest-valley/circular-boardwalk.glb',
  noticeBoard: '/assets/world/sunrise-village/notice-board.glb',
});

export const FOREST_VALLEY_SKYBOX_URL = '/assets/world/forest-valley/forest-valley-sky.png';

export type ForestValleyModuleKey = keyof typeof FOREST_VALLEY_MODULE_ASSETS;

export interface ForestValleyModulePlacement {
  id: string;
  asset: ForestValleyModuleKey;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  scale: readonly [number, number, number];
  collision: boolean;
  collisionFootprintScale?: number;
}

const UPRIGHT_ROTATION = [0.7071068, 0, 0, 0.7071068] as const;
// The right-hand house at the entrance faces the root gate. This keeps the
// Blender upright conversion and adds only a horizontal yaw toward the gate.
const ENTRY_HOUSE_ROTATION = [0.606673324, -0.363245755, 0.363245755, 0.606673324] as const;
// Blender node_0.010 mapped from Z-up [x, y, z] to runtime [x, z, -y].
// Keep the authored scene scale in one place so custom landmarks can express
// their offsets in the same coordinate system as the module placements.
const FOREST_VALLEY_AUTHORED_SCENE_SCALE = 0.6;
const FOREST_VALLEY_ISLAND_BASE_SCALE = [36.12309265136719, 41.04838180541992, 0.9106636047363281] as const;
export const FOREST_VALLEY_ISLAND_HORIZONTAL_SCALE_FACTOR = 1.45;
const FOREST_VALLEY_ISLAND_SCALE = [
  FOREST_VALLEY_ISLAND_BASE_SCALE[0] * FOREST_VALLEY_ISLAND_HORIZONTAL_SCALE_FACTOR,
  FOREST_VALLEY_ISLAND_BASE_SCALE[1] * FOREST_VALLEY_ISLAND_HORIZONTAL_SCALE_FACTOR,
  FOREST_VALLEY_ISLAND_BASE_SCALE[2],
] as const;
// Place the gate at the authored player standing position shown in the
// reference image, with a small downward offset so its base settles into the
// ground. Module positions are authored before the scene root's 0.6 scale.
const MULTI_TREE_STONE_GATE_POSITION = [8.20459985733032227, -0.8246994614601135, -21.15] as const;
const GATE_SCALE = [6.854072570800781, 7.431646347045898, 5.137313365936279] as const;
// Blender scale axes map to runtime as [x, z, y]. Keep the authored scale
// explicit and apply the requested 40% visual enlargement uniformly.
const MULTI_TREE_STONE_GATE_BASE_SCALE = [6.848701858520507, 9.4744966506958, 6.24041633605957] as const;
export const FOREST_VALLEY_MULTI_TREE_STONE_GATE_SCALE_FACTOR = 1.4;
const MULTI_TREE_STONE_GATE_SCALE = [
  MULTI_TREE_STONE_GATE_BASE_SCALE[0] * FOREST_VALLEY_MULTI_TREE_STONE_GATE_SCALE_FACTOR,
  MULTI_TREE_STONE_GATE_BASE_SCALE[1] * FOREST_VALLEY_MULTI_TREE_STONE_GATE_SCALE_FACTOR,
  MULTI_TREE_STONE_GATE_BASE_SCALE[2] * FOREST_VALLEY_MULTI_TREE_STONE_GATE_SCALE_FACTOR,
] as const;
export const FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SCALE = 13;
export const FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SINK = 5.2;
export const FOREST_VALLEY_PURPLE_MUSHROOM_TREE_BACK_OFFSET = 3.8;
export const FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SIDE_OFFSET = -8.2;
const CIRCULAR_BOARDWALK_POSITION = [-3.5640907287597656, -0.10935866832733154, -3.2409439086914062] as const;
const PURPLE_MUSHROOM_TREE_POSITION = [
  CIRCULAR_BOARDWALK_POSITION[0] - FOREST_VALLEY_PURPLE_MUSHROOM_TREE_BACK_OFFSET,
  -FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SINK,
  CIRCULAR_BOARDWALK_POSITION[2] + FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SIDE_OFFSET,
] as const;
const PURPLE_MUSHROOM_TREE_SCALE = [
  FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SCALE,
  FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SCALE,
  FOREST_VALLEY_PURPLE_MUSHROOM_TREE_SCALE,
] as const;

/**
 * Forest Valley's imported GLBs are normalized one-object Blender exports.
 * These values are copied from `/Users/studio.vv/Downloads/森語谷.blend`.
 * Blender's Z-up scene coordinates are converted to the runtime's Y-up,
 * mirrored horizontal coordinates as [x, z, -y], while the imported GLB
 * scale axes are applied as [x, z, y].
 */
export const FOREST_VALLEY_MODULE_PLACEMENTS: readonly ForestValleyModulePlacement[] = [
  {
    id: 'forest-island',
    asset: 'island',
    position: [6.314953804016113, 0.07081437110900879, -6.358921051025391],
    rotation: UPRIGHT_ROTATION,
    // Expand only the island's two horizontal axes. Keep its vertical scale
    // unchanged so the authored ground height stays at the same elevation.
    scale: FOREST_VALLEY_ISLAND_SCALE,
    collision: false,
  },
  {
    id: 'root-gate',
    asset: 'rootGate',
    position: [-0.20459985733032227, 0.03695183992385864, 8.511223793029785],
    rotation: UPRIGHT_ROTATION,
    scale: GATE_SCALE,
    collision: true,
    collisionFootprintScale: 0.56,
  },
  {
    id: 'multi-tree-stone-gate',
    asset: 'multiTreeStoneGate',
    // Keep this landmark centered on the authored player standing position.
    position: MULTI_TREE_STONE_GATE_POSITION,
    rotation: UPRIGHT_ROTATION,
    scale: MULTI_TREE_STONE_GATE_SCALE,
    collision: true,
    collisionFootprintScale: 0.56,
  },
  {
    id: 'purple-mushroom-tree',
    asset: 'purpleMushroomTree',
    // Set this background tree behind the circular boardwalk and sink its
    // authored base slightly into the grass so the roots do not float.
    position: PURPLE_MUSHROOM_TREE_POSITION,
    rotation: UPRIGHT_ROTATION,
    scale: PURPLE_MUSHROOM_TREE_SCALE,
    collision: false,
  },
  {
    id: 'moon-spring',
    asset: 'moonSpring',
    position: [15.393996238708496, 0.07081437110900879, -13.96164321899414],
    rotation: UPRIGHT_ROTATION,
    scale: [5.6948699951171875, 6.93672513961792, 6.870035171508789],
    collision: true,
    collisionFootprintScale: 0.55,
  },
  {
    id: 'circular-boardwalk',
    asset: 'circularBoardwalk',
    position: CIRCULAR_BOARDWALK_POSITION,
    rotation: UPRIGHT_ROTATION,
    scale: [3.7085587978363037, 4.303830146789551, 5.320068359375],
    collision: false,
  },
  {
    id: 'tree-hollow-one',
    asset: 'treeHollowOne',
    position: [5.473932266235352, -0.3982875347137451, -7.699164390563965],
    rotation: UPRIGHT_ROTATION,
    scale: [4.554581165313721, 6.304469585418701, 8.362682342529297],
    collision: true,
    collisionFootprintScale: 0.58,
  },
  {
    id: 'tree-hollow-two',
    asset: 'treeHollowTwo',
    position: [-3.6336450576782227, 0.07081437110900879, -3.4628522396087646],
    rotation: UPRIGHT_ROTATION,
    scale: [6.073580741882324, 6.054525852203369, 8.181093215942383],
    collision: true,
    collisionFootprintScale: 0.58,
  },
  {
    id: 'tree-hollow-three',
    asset: 'treeHollowThree',
    position: [7.924214839935303, -0.23802244663238525, 9.155285835266113],
    rotation: UPRIGHT_ROTATION,
    scale: [3.1504833698272705, 4.870769023895264, 7.355684757232666],
    collision: true,
    collisionFootprintScale: 0.58,
  },
  {
    id: 'tree-hollow-house-one',
    asset: 'treeHollowHouseOne',
    // Move this entrance-side house a little toward the approach road.
    position: [13.125493049621582, -0.16671490669250488, 2.1639614582061768],
    rotation: ENTRY_HOUSE_ROTATION,
    scale: [6.019474029541016, 7.729004859924316, 7.051141262054443],
    collision: true,
    collisionFootprintScale: 0.56,
  },
  {
    id: 'tree-hollow-house-two',
    asset: 'treeHollowHouseTwo',
    position: [-0.1705169677734375, 0.07081437110900879, -17.30698013305664],
    rotation: UPRIGHT_ROTATION,
    scale: [5.053116321563721, 6.646393299102783, 6.4283447265625],
    collision: true,
    collisionFootprintScale: 0.58,
  },
  {
    id: 'notice-board',
    asset: 'noticeBoard',
    position: [0.16058099269866943, 0.07081437110900879, 1.2895534038543701],
    rotation: UPRIGHT_ROTATION,
    // Match Sunrise Village's notice-board world size after the scene roots
    // are applied: 0.05 / 0.6 = 1 / 12.
    scale: [1.3900394439697266, 1.7157217661539714, 1.928049882253011],
    collision: true,
    collisionFootprintScale: 0.62,
  },
];

export const FOREST_VALLEY_SCENE_TRANSFORM = Object.freeze({
  // The Blender layout is authored at a larger world-unit scale than the
  // shared runtime camera. Keep the authored module transforms intact and
  // reduce only this world's root so its whole layout remains proportional.
  scale: FOREST_VALLEY_AUTHORED_SCENE_SCALE,
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
});

// Forest Valley is grounded by its own authored island after the scene root
// scale is applied. It must not inherit Sunrise Village's road elevation.
export const FOREST_VALLEY_GROUND_Y = 0.06;

// Keep the pre-expansion movement boundary. The enlarged island is visual
// padding for the panorama; its newly added outer ground is not walkable.
export const FOREST_VALLEY_MOVEMENT_BOUNDARY = 31.5 * FOREST_VALLEY_SCENE_TRANSFORM.scale;
export const FOREST_VALLEY_SPAWN_ANCHOR = Object.freeze({
  x: -0.2046 * FOREST_VALLEY_SCENE_TRANSFORM.scale,
  // Start slightly farther along the approach, closer to the road.
  z: 6.15 * FOREST_VALLEY_SCENE_TRANSFORM.scale,
});
export const FOREST_VALLEY_GATE_POSITION = Object.freeze({ x: -0.20459985733032227, z: 8.511223793029785 });
export const FOREST_VALLEY_GATE_ENTER_RADIUS = 2.4;
export const FOREST_VALLEY_GATE_EXIT_RADIUS = 3.2;
export const FOREST_VALLEY_GATE_PROMPT_LOWERING_RATIO = 0.75;
export const FOREST_VALLEY_GATE_PROMPT_SIDE_MARGIN = 96;
export const FOREST_VALLEY_GATE_PROMPT_TOP_MARGIN = 112;
export const FOREST_VALLEY_GATE_PROMPT_BOTTOM_MARGIN = 176;

export interface ForestValleyGateScreenPosition {
  x: number;
  y: number;
  scale: number;
}

export function getForestValleyGatePromptHeight(topY: number, baseY: number): number {
  return topY + (baseY - topY) * FOREST_VALLEY_GATE_PROMPT_LOWERING_RATIO;
}

export function isForestValleyGateNearby(distance: number, wasNearby: boolean): boolean {
  if (!Number.isFinite(distance) || distance < 0) return false;
  return distance <= (wasNearby ? FOREST_VALLEY_GATE_EXIT_RADIUS : FOREST_VALLEY_GATE_ENTER_RADIUS);
}
