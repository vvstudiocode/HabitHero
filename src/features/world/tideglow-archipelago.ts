export const TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS = Object.freeze({
  island: '/assets/world/tideglow-archipelago/main-island.glb',
  tidalHarbor: '/assets/world/tideglow-archipelago/tidal-harbor.glb',
  lighthouse: '/assets/world/tideglow-archipelago/lighthouse.glb',
  harborHuts1: '/assets/world/tideglow-archipelago/harbor-huts-1.glb',
  harborHuts2: '/assets/world/tideglow-archipelago/harbor-huts-2.glb',
  seasideMarket: '/assets/world/tideglow-archipelago/seaside-market.glb',
  glowingCoralReefIsland: '/assets/world/tideglow-archipelago/glowing-coral-reef-island.glb',
  mangroveMistIsland: '/assets/world/tideglow-archipelago/mangrove-mist-island.glb',
  tidalRockPool: '/assets/world/tideglow-archipelago/tidal-rock-pool.glb',
  navigationConnection: '/assets/world/tideglow-archipelago/navigation-connection.glb',
  energyCore: '/assets/world/tideglow-archipelago/tideglow-energy-core.glb',
  // Reuse the same packaged notice board asset used by Sunrise Village and
  // Forest Valley; only its authored placement changes for this world.
  noticeBoard: '/assets/world/sunrise-village/notice-board.glb',
});

export const TIDEGLOW_ARCHIPELAGO_SKYBOX_URL = '/assets/world/tideglow-archipelago/tideglow-archipelago-sky.png';
// Keep the generated panorama seam behind the initial camera while preserving
// the full 360-degree view during camera rotation.
export const TIDEGLOW_ARCHIPELAGO_SKYBOX_OFFSET = Object.freeze({ x: 0.5, y: 0 });

export type TideglowArchipelagoModuleKey = keyof typeof TIDEGLOW_ARCHIPELAGO_MODULE_ASSETS;

export interface TideglowArchipelagoModulePlacement {
  id: string;
  asset: TideglowArchipelagoModuleKey;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  scale: readonly [number, number, number];
  collision: boolean;
  collisionFootprintScale?: number;
}

const UPRIGHT_ROTATION = [0.707107, 0, 0, 0.707107] as const;
export const TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_COLLISION_FOOTPRINT_SCALE = 0.38;

// The first eleven placements are copied from
// `/Users/studio.vv/Downloads/潮光群島.blend`. Blender Z-up coordinates are
// converted to the runtime's [x, z, -y] position and [x, z, y] scale axes.
// The notice board is an extra shared landmark, kept at the same world size
// as the Sunrise Village and Forest Valley notice boards.
export const TIDEGLOW_NOTICE_BOARD_SCALE = [0.834023673, 1.029424, 1.1568] as const;

export const TIDEGLOW_ARCHIPELAGO_MODULE_PLACEMENTS: readonly TideglowArchipelagoModulePlacement[] = [
  {
    id: 'main-island',
    asset: 'island',
    position: [0, 0, 0],
    rotation: UPRIGHT_ROTATION,
    scale: [10.718806, 10.043064, 11.6459],
    collision: false,
  },
  {
    id: 'tidal-harbor',
    asset: 'tidalHarbor',
    position: [-4.898774, 0.064913, 0.470489],
    rotation: [0.519985, -0.479182, 0.479182, 0.519985],
    scale: [2.691908, 4.080869, 5.084424],
    collision: true,
    collisionFootprintScale: 0.56,
  },
  {
    id: 'lighthouse',
    asset: 'lighthouse',
    position: [2.372684, 0.295654, 0.090972],
    rotation: UPRIGHT_ROTATION,
    scale: [6.279134, 6.125324, 5.126293],
    collision: true,
    collisionFootprintScale: 0.56,
  },
  {
    id: 'harbor-huts-1',
    asset: 'harborHuts1',
    position: [-2.580128, 0.412785, -3.516385],
    rotation: UPRIGHT_ROTATION,
    scale: [3.031168, 2.726988, 2.426073],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'harbor-huts-2',
    asset: 'harborHuts2',
    position: [0.85479, 0.407162, -4.060483],
    rotation: UPRIGHT_ROTATION,
    scale: [3.475309, 2.640864, 2.718159],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'seaside-market',
    asset: 'seasideMarket',
    position: [3.564279, 0.36973, -2.580076],
    rotation: [0.702762, 0.078271, -0.078271, 0.702762],
    scale: [3.425514, 3.325291, 3.741681],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'glowing-coral-reef-island',
    asset: 'glowingCoralReefIsland',
    position: [-4.919091, -0.165582, 1.800628],
    rotation: UPRIGHT_ROTATION,
    scale: [1.20111, 1.427791, 2.517197],
    collision: false,
  },
  {
    id: 'tidal-rock-pool',
    asset: 'tidalRockPool',
    position: [-2.400526, 0.400635, 3.761719],
    rotation: [0.015839, -0.706929, 0.706929, 0.015839],
    scale: [4.018461, 3.486788, 4.06796],
    collision: false,
  },
  {
    id: 'navigation-connection',
    asset: 'navigationConnection',
    // Bring the bridge head onto the island's beach edge instead of leaving
    // the whole navigation connection out in the surrounding ocean.
    position: [3.82, -0.1600015, 4.56],
    rotation: [0.22878, -0.669074, 0.669074, 0.22878],
    scale: [4.213338, 6.778663, 4.986842],
    collision: true,
    collisionFootprintScale: TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_COLLISION_FOOTPRINT_SCALE,
  },
  {
    id: 'tideglow-energy-core',
    asset: 'energyCore',
    position: [-4.677935, 0.323906, -1.624698],
    rotation: [-0.591789, -0.387022, 0.387022, -0.591789],
    scale: [3.115658, 2.456428, 2.807665],
    collision: true,
    collisionFootprintScale: 0.56,
  },
  {
    id: 'notice-board',
    asset: 'noticeBoard',
    position: [-1.2, 0.75, -1.6],
    rotation: UPRIGHT_ROTATION,
    scale: TIDEGLOW_NOTICE_BOARD_SCALE,
    collision: true,
    collisionFootprintScale: 0.62,
  },
];

export const TIDEGLOW_ARCHIPELAGO_SCENE_TRANSFORM = Object.freeze({
  scale: 1,
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
});

// Keep the virtual stone approach and the spawn point tied to the editable
// navigation-connection placement. This prevents moving the boat in the
// manifest from leaving the player at the old Blend position.
export const TIDEGLOW_ARCHIPELAGO_STREET_JUNCTION = Object.freeze({ x: 2.55, z: 0.1 });
const navigationConnectionPlacement = TIDEGLOW_ARCHIPELAGO_MODULE_PLACEMENTS.find(
  (placement) => placement.id === 'navigation-connection',
);
if (!navigationConnectionPlacement) throw new Error('Tideglow navigation connection placement is missing');
export const TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION = Object.freeze({
  x: navigationConnectionPlacement.position[0],
  z: navigationConnectionPlacement.position[2],
});
export const TIDEGLOW_ARCHIPELAGO_ENTRY_INSET = 1.25;
const navigationToIslandX = TIDEGLOW_ARCHIPELAGO_STREET_JUNCTION.x
  - TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION.x;
const navigationToIslandZ = TIDEGLOW_ARCHIPELAGO_STREET_JUNCTION.z
  - TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION.z;
const navigationToIslandDistance = Math.hypot(navigationToIslandX, navigationToIslandZ);
const navigationToIslandDirection = navigationToIslandDistance > 0
  ? {
    x: navigationToIslandX / navigationToIslandDistance,
    z: navigationToIslandZ / navigationToIslandDistance,
  }
  : { x: 0, z: -1 };

// The generic authored-scene grounding pass currently aligns the imported
// island's highest bound to the character plane. The supplied Tideglow island
// uses the opposite bound for its walkable plane, so lift the composed root
// back to the authored layout after that pass.
export const TIDEGLOW_ARCHIPELAGO_SCENE_VERTICAL_OFFSET = 3.4;
export const TIDEGLOW_ARCHIPELAGO_GROUND_Y = 0.06;
export const TIDEGLOW_ARCHIPELAGO_MOVEMENT_BOUNDARY = 6.25;
export const TIDEGLOW_ARCHIPELAGO_GATE_MODULE_ID = 'navigation-connection';
export const TIDEGLOW_ARCHIPELAGO_ENTRY_POSITION = Object.freeze({
  x: TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION.x
    + navigationToIslandDirection.x * TIDEGLOW_ARCHIPELAGO_ENTRY_INSET,
  z: TIDEGLOW_ARCHIPELAGO_NAVIGATION_CONNECTION_POSITION.z
    + navigationToIslandDirection.z * TIDEGLOW_ARCHIPELAGO_ENTRY_INSET,
});
export const TIDEGLOW_ARCHIPELAGO_SPAWN_ANCHOR = TIDEGLOW_ARCHIPELAGO_ENTRY_POSITION;
export const TIDEGLOW_ARCHIPELAGO_GATE_ENTER_RADIUS = 2.4;
export const TIDEGLOW_ARCHIPELAGO_GATE_EXIT_RADIUS = 3.2;
export const TIDEGLOW_ARCHIPELAGO_GATE_PROMPT_LOWERING_RATIO = 0.75;
export const TIDEGLOW_ARCHIPELAGO_GATE_PROMPT_SIDE_MARGIN = 96;
export const TIDEGLOW_ARCHIPELAGO_GATE_PROMPT_TOP_MARGIN = 112;
export const TIDEGLOW_ARCHIPELAGO_GATE_PROMPT_BOTTOM_MARGIN = 176;

// The same connection asset is placed in Sunrise Village as the return side
// of this route. Keep the return point outside the model's footprint.
export const SUNRISE_VILLAGE_TIDEGLOW_GATE_PLACEMENT = Object.freeze({
  position: Object.freeze([4, 0, -9.9] as const),
  rotation: Object.freeze({ x: Math.PI / 2, y: -Math.PI / 5, z: 0 }),
  scale: 3.5,
  groundY: -0.27,
});
export const SUNRISE_VILLAGE_TIDEGLOW_ENTRY_FORWARD_OFFSET = 1.8;
export const SUNRISE_VILLAGE_TIDEGLOW_ENTRY_POSITION = Object.freeze({
  x: SUNRISE_VILLAGE_TIDEGLOW_GATE_PLACEMENT.position[0]
    + Math.cos(SUNRISE_VILLAGE_TIDEGLOW_GATE_PLACEMENT.rotation.y)
    * SUNRISE_VILLAGE_TIDEGLOW_ENTRY_FORWARD_OFFSET,
  z: SUNRISE_VILLAGE_TIDEGLOW_GATE_PLACEMENT.position[2]
    + Math.sin(SUNRISE_VILLAGE_TIDEGLOW_GATE_PLACEMENT.rotation.y)
    * SUNRISE_VILLAGE_TIDEGLOW_ENTRY_FORWARD_OFFSET,
});

export interface TideglowGateScreenPosition {
  x: number;
  y: number;
  scale: number;
}

export function getTideglowGatePromptHeight(topY: number, baseY: number): number {
  return topY + (baseY - topY) * TIDEGLOW_ARCHIPELAGO_GATE_PROMPT_LOWERING_RATIO;
}

export function isTideglowGateNearby(distance: number, wasNearby: boolean): boolean {
  if (!Number.isFinite(distance) || distance < 0) return false;
  return distance <= (wasNearby ? TIDEGLOW_ARCHIPELAGO_GATE_EXIT_RADIUS : TIDEGLOW_ARCHIPELAGO_GATE_ENTER_RADIUS);
}
