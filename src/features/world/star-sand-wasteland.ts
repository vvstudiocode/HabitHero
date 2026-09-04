export const STAR_SAND_WASTELAND_MODULE_ASSETS = Object.freeze({
  island: '/assets/world/star-sand-wasteland/star-sand-wasteland.glb',
  windbreakTent: '/assets/world/star-sand-wasteland/windbreak-tent.glb',
  councilTent: '/assets/world/star-sand-wasteland/council-tent.glb',
  desertDomeHouse: '/assets/world/star-sand-wasteland/desert-dome-house.glb',
  caravanSunshade: '/assets/world/star-sand-wasteland/caravan-sunshade.glb',
  weatheredPillar1: '/assets/world/star-sand-wasteland/weathered-pillar-1.glb',
  boulder: '/assets/world/star-sand-wasteland/boulder.glb',
  luminousStarSand: '/assets/world/star-sand-wasteland/luminous-star-sand.glb',
  ancientCityEntrance: '/assets/world/star-sand-wasteland/ancient-city-entrance.glb',
  caravanRest: '/assets/world/star-sand-wasteland/caravan-rest.glb',
  weatheredPillar: '/assets/world/star-sand-wasteland/weathered-pillar.glb',
  noticeBoard: '/assets/world/sunrise-village/notice-board.glb',
});
export const STAR_SAND_WASTELAND_SKYBOX_URL = '/assets/world/star-sand-wasteland/star-sand-wasteland-sky.png';
// Normalized image translation. Positive y moves the panorama content upward
// without changing its angle, so the sand can meet the authored 3D island.
export const STAR_SAND_WASTELAND_SKYBOX_OFFSET = Object.freeze({ x: 0, y: 0.17 });

export type StarSandWastelandModuleKey = keyof typeof STAR_SAND_WASTELAND_MODULE_ASSETS;

export interface StarSandWastelandModulePlacement {
  id: string;
  asset: StarSandWastelandModuleKey;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  scale: readonly [number, number, number];
  collision: boolean;
  collisionFootprintScale?: number;
}

const UPRIGHT_ROTATION = [0.7071068286895752, 0, 0, 0.7071068286895752] as const;

// Edit this position to move only Star Sand Wasteland's notice board. The
// coordinates are authored scene-local values; the 1.7 scene root scale is
// applied automatically at runtime.
export const STAR_SAND_WASTELAND_NOTICE_BOARD_POSITION = Object.freeze({
  x: -0.8,
  y: 0.65764705882353,
  z: 1.2,
});
export const STAR_SAND_WASTELAND_NOTICE_BOARD_SCALE = Object.freeze([
  0.4906021605882353,
  0.6055435294117647,
  0.6804705882352941,
] as const);
// Negative values lower only Star Sand Wasteland's notice-board prompt toward
// the board's upper edge; the scene root scale is applied by the runtime.
export const STAR_SAND_WASTELAND_NOTICE_BOARD_PROMPT_OFFSET_Y = -0.35;

/**
 * The layout is copied from `/Users/studio.vv/Downloads/星砂荒原.blend`.
 * Blender is Z-up; the runtime keeps the authored horizontal axes as x/z,
 * maps Blender z to runtime y, and converts each imported GLB scale axis as
 * [x, z, y].
 */
export const STAR_SAND_WASTELAND_MODULE_PLACEMENTS: readonly StarSandWastelandModulePlacement[] = [
  {
    id: 'boulder',
    asset: 'boulder',
    position: [3.1320369243621826, 0.33421018719673157, 0.7337015867233276],
    rotation: UPRIGHT_ROTATION,
    scale: [1.3060252666473389, 1.386892557144165, 1.249153733253479],
    collision: true,
    collisionFootprintScale: 0.6,
  },
  {
    id: 'weathered-pillar-1',
    asset: 'weatheredPillar1',
    position: [-2.8198421001434326, 0.5716087818145752, 3.7127373218536377],
    rotation: UPRIGHT_ROTATION,
    scale: [1.2002601623535156, 1.3103222846984863, 2.904935598373413],
    collision: true,
    collisionFootprintScale: 0.52,
  },
  {
    id: 'caravan-sunshade',
    asset: 'caravanSunshade',
    position: [1.5587027072906494, 0.6045937538146973, -0.44093164801597595],
    rotation: [-0.5329676866531372, 0.4567526578903198, -0.4270372986793518, -0.5700542330741882],
    scale: [1.228216290473938, 1.2416448593139648, 2.0265963077545166],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'desert-dome-house',
    asset: 'desertDomeHouse',
    position: [-2.3605716228485107, 0.6053212881088257, 2.444227457046509],
    rotation: [0.4063135087490082, 0.578713595867157, -0.578713595867157, 0.4063135087490082],
    scale: [1.178600549697876, 1.1442898511886597, 1.5756516456604004],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'luminous-star-sand',
    asset: 'luminousStarSand',
    position: [-3.497076988220215, 0.48894721269607544, 2.976418972015381],
    rotation: UPRIGHT_ROTATION,
    scale: [1.8166090250015259, 2.465224027633667, 2.666860818862915],
    collision: false,
  },
  {
    id: 'weathered-pillar',
    asset: 'weatheredPillar',
    position: [0.7162097096443176, 0.5934038162231445, -3.0775654315948486],
    rotation: UPRIGHT_ROTATION,
    scale: [1.858019232749939, 1.6852561235427856, 2.325526237487793],
    collision: true,
    collisionFootprintScale: 0.52,
  },
  {
    id: 'caravan-rest',
    asset: 'caravanRest',
    position: [-3.1941933631896973, 0.6294199228286743, -0.08191385865211487],
    rotation: [0.3673401176929474, 0.6042030453681946, -0.6042030453681946, 0.3673401176929474],
    scale: [1.5808812379837036, 1.3626576662063599, 1.3277069330215454],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'ancient-city-entrance',
    asset: 'ancientCityEntrance',
    position: [-0.03590448200702667, 0.474254846572876, 3.9487998485565186],
    rotation: [0.003966282121837139, -0.7070956826210022, 0.7070956826210022, 0.003966282121837139],
    scale: [2.5135140419006348, 2.5244271755218506, 3.817413568496704],
    collision: true,
    collisionFootprintScale: 0.5,
  },
  {
    id: 'star-sand-island',
    asset: 'island',
    position: [-0.03590448200702667, 0.01598811149597168, 0.1313418745994568],
    rotation: UPRIGHT_ROTATION,
    scale: [10.743047714233398, 10.986701965332031, 8.25477123260498],
    collision: false,
  },
  {
    id: 'council-tent',
    asset: 'councilTent',
    position: [-0.9093344211578369, 0.6520087718963623, -1.8632670640945435],
    rotation: [0.7059458494186401, 0.04050328955054283, -0.04050328955054283, 0.7059458494186401],
    scale: [2.0174052715301514, 2.0751495361328125, 1.837498664855957],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'windbreak-tent',
    asset: 'windbreakTent',
    position: [2.098217725753784, 0.7237177491188049, 1.5612761974334717],
    rotation: [0.34923702478408813, -0.675051212310791, 0.5946537256240845, 0.26215773820877075],
    scale: [1.134793996810913, 1.1427472829818726, 1.7205101251602173],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'notice-board',
    asset: 'noticeBoard',
    position: [
      STAR_SAND_WASTELAND_NOTICE_BOARD_POSITION.x,
      STAR_SAND_WASTELAND_NOTICE_BOARD_POSITION.y,
      STAR_SAND_WASTELAND_NOTICE_BOARD_POSITION.z,
    ] as const,
    rotation: UPRIGHT_ROTATION,
    scale: STAR_SAND_WASTELAND_NOTICE_BOARD_SCALE,
    collision: true,
    collisionFootprintScale: 0.62,
  },
];

export const STAR_SAND_WASTELAND_SCENE_TRANSFORM = Object.freeze({
  scale: 1.7,
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
});

export const STAR_SAND_WASTELAND_GROUND_Y = 0.06;
const STAR_SAND_WASTELAND_BASE_MOVEMENT_BOUNDARY = 4.25;
export const STAR_SAND_WASTELAND_MOVEMENT_BOUNDARY = STAR_SAND_WASTELAND_BASE_MOVEMENT_BOUNDARY * STAR_SAND_WASTELAND_SCENE_TRANSFORM.scale;
export const STAR_SAND_WASTELAND_GATE_MODULE_ID = 'ancient-city-entrance';
const STAR_SAND_WASTELAND_AUTHORED_GATE_POSITION = Object.freeze({ x: -0.03590448200702667, z: 3.9487998485565186 });
export const STAR_SAND_WASTELAND_GATE_POSITION = Object.freeze({
  x: STAR_SAND_WASTELAND_AUTHORED_GATE_POSITION.x * STAR_SAND_WASTELAND_SCENE_TRANSFORM.scale,
  z: STAR_SAND_WASTELAND_AUTHORED_GATE_POSITION.z * STAR_SAND_WASTELAND_SCENE_TRANSFORM.scale,
});
export const STAR_SAND_WASTELAND_ENTRY_INSET = 1.35 * STAR_SAND_WASTELAND_SCENE_TRANSFORM.scale;
export const STAR_SAND_WASTELAND_ENTRY_POSITION = Object.freeze({
  x: STAR_SAND_WASTELAND_GATE_POSITION.x,
  z: STAR_SAND_WASTELAND_GATE_POSITION.z - STAR_SAND_WASTELAND_ENTRY_INSET,
});
export const STAR_SAND_WASTELAND_SPAWN_ANCHOR = STAR_SAND_WASTELAND_ENTRY_POSITION;
export const STAR_SAND_WASTELAND_GATE_ENTER_RADIUS = 2.4;
export const STAR_SAND_WASTELAND_GATE_EXIT_RADIUS = 3.2;
export const STAR_SAND_WASTELAND_GATE_PROMPT_LOWERING_RATIO = 0.75;
export const STAR_SAND_WASTELAND_GATE_PROMPT_SIDE_MARGIN = 96;
export const STAR_SAND_WASTELAND_GATE_PROMPT_TOP_MARGIN = 112;
export const STAR_SAND_WASTELAND_GATE_PROMPT_BOTTOM_MARGIN = 176;

// The south-west village edge is the remaining clear approach after the
// Forest Valley, Cloud Workshop, and Tideglow entrances are placed.
export const SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT = Object.freeze({
  position: Object.freeze([-6.4, 0, -8.2] as const),
  rotation: Object.freeze({ x: Math.PI / 2, y: -Math.PI / 1.5, z: 0 }),
  scale: 3,
  groundY: -0.1807,
});
export const SUNRISE_VILLAGE_STAR_SAND_WASTELAND_ENTRY_FORWARD_OFFSET = 1.8;
export const SUNRISE_VILLAGE_STAR_SAND_WASTELAND_ENTRY_POSITION = Object.freeze({
  x: SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT.position[0]
    + Math.cos(SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT.rotation.y)
    * SUNRISE_VILLAGE_STAR_SAND_WASTELAND_ENTRY_FORWARD_OFFSET,
  z: SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT.position[2]
    + Math.sin(SUNRISE_VILLAGE_STAR_SAND_WASTELAND_GATE_PLACEMENT.rotation.y)
    * SUNRISE_VILLAGE_STAR_SAND_WASTELAND_ENTRY_FORWARD_OFFSET,
});

export interface StarSandWastelandGateScreenPosition {
  x: number;
  y: number;
  scale: number;
}

export function getStarSandWastelandGatePromptHeight(topY: number, baseY: number): number {
  return topY + (baseY - topY) * STAR_SAND_WASTELAND_GATE_PROMPT_LOWERING_RATIO;
}

export function isStarSandWastelandGateNearby(distance: number, wasNearby: boolean): boolean {
  if (!Number.isFinite(distance) || distance < 0) return false;
  return distance <= (wasNearby ? STAR_SAND_WASTELAND_GATE_EXIT_RADIUS : STAR_SAND_WASTELAND_GATE_ENTER_RADIUS);
}
