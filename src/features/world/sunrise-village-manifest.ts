import { SUNRISE_VILLAGE_MODULE_ASSETS } from './world-runtime-assets';

export type SunriseVillageModuleKey = keyof typeof SUNRISE_VILLAGE_MODULE_ASSETS;

export interface SunriseVillageModulePlacement {
  id: string;
  asset: SunriseVillageModuleKey;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  scale: readonly [number, number, number];
  collision: boolean;
  collisionFootprintScale?: number;
}

/**
 * These transforms are the authored Blender layout from the retired composite
 * export. The runtime applies them to each source mesh so the scene remains
 * editable without baking the village into one large GLB again.
 */
export const SUNRISE_VILLAGE_MODULE_PLACEMENTS: readonly SunriseVillageModulePlacement[] = [
  {
    id: 'straight-road-north',
    asset: 'straightStoneRoad',
    position: [136.83164978027344, -21.075048446655273, -33.91035842895508],
    rotation: [-0.9999422430992126, 0.0018561225151643157, -0.009235445410013199, 0.005180057603865862],
    scale: [160.1005096435547, 2.3669869899749756, 53.09268569946289],
    collision: false,
  },
  {
    id: 'round-road-plaza',
    asset: 'roundStoneRoad',
    position: [-22.87413787841797, -20.47650718688965, -19.38809585571289],
    rotation: [0, 0.70710688829422, -0.7071066498756409, 0],
    scale: [122.281494140625, 107.72142028808594, 1.0283643007278442],
    collision: false,
  },
  {
    id: 'golden-tree-plaza',
    asset: 'goldenTree',
    position: [-19.837657928466797, -24.351621627807617, -20.158742904663086],
    rotation: [0.70710688829422, 0, 0, 0.7071066498756409],
    scale: [55.29009246826172, 62.8057746887207, 73.89452362060547],
    collision: true,
    collisionFootprintScale: 0.45,
  },
  {
    id: 'forest-house',
    asset: 'forestHouse',
    position: [10.855151176452637, -37.310062408447266, 87.97762298583984],
    rotation: [0.517218291759491, -0.4821672737598419, 0.48216721415519714, 0.5172183513641357],
    scale: [113.43370819091797, 109.73043060302734, 191.69007873535156],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'rooster-house',
    asset: 'roosterHouse',
    position: [-38.382110595703125, -35.28313446044922, -166.08123779296875],
    rotation: [0.6829625368118286, 0.1831999570131302, -0.18319997191429138, 0.6829624772071838],
    scale: [104.8868179321289, 82.85099029541016, 163.3356170654297],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'golden-tree-house',
    asset: 'goldenTreeHouse',
    position: [-144.55809020996094, -31.816539764404297, -50.18247985839844],
    rotation: [0.06954532116651535, 0.7036784887313843, -0.703678548336029, 0.06954531371593435],
    scale: [121.71304321289062, 136.2895965576172, 176.28565979003906],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'notice-board',
    asset: 'noticeBoard',
    position: [30.444988250732422, -21.451921463012695, 13.047876358032227],
    rotation: [0.70710688829422, 0, 0, 0.7071066498756409],
    scale: [16.68047332763672, 20.588661193847656, 23.136598587036133],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'market-stall',
    asset: 'marketStall',
    position: [101.20174407958984, -19.82333755493164, -102.5714874267578],
    rotation: [0.70710688829422, 0, 0, 0.7071066498756409],
    scale: [108.14989471435547, 103.7725601196289, 125.02649688720703],
    collision: true,
    collisionFootprintScale: 0.62,
  },
  {
    id: 'island',
    asset: 'island',
    position: [-0.6998481750488281, -21.245948791503906, -11.555709838867188],
    rotation: [0, 0.70710688829422, -0.7071066498756409, 0],
    scale: [-446.1269226074219, -426.786376953125, -469.39349365234375],
    collision: false,
  },
  {
    id: 'straight-road-south',
    asset: 'straightStoneRoad',
    position: [-153.32069396972656, -21.01824188232422, 56.071319580078125],
    rotation: [0.9509533047676086, -0.0023556111846119165, -0.309325635433197, 0.00015394164074677974],
    scale: [171.92733764648438, 2.367480754852295, 62.421630859375],
    collision: false,
  },
];

// The entrance sits just inside the far end of the south straight road shown
// in the Blender layout, so the player can reach it without walking beyond
// the authored island boundary.
export const SUNRISE_VILLAGE_FOREST_VALLEY_GATE_POSITION = Object.freeze({ x: -9.67, z: 6.06 });

// Return just inside the Sunrise Village side of the gate. This is a
// navigation destination, not the village's regular tree spawn anchor.
export const SUNRISE_VILLAGE_FOREST_VALLEY_ENTRY_POSITION = Object.freeze({
  // The south road approaches the gate diagonally. Keep the return point on
  // that road's center line instead of copying the gate's end-cap position.
  x: -8.9,
  z: 5.5,
});

// The Sunrise Village road surface is slightly above the authored island
// top. Keep this village-specific contact height separate from Forest Valley.
export const SUNRISE_VILLAGE_GROUND_Y = 0.107;

// This portal is a Sunrise Village-only placement. Its coordinates and
// presentation must not be borrowed from Forest Valley's authored manifest.
export const SUNRISE_VILLAGE_FOREST_VALLEY_GATE_PLACEMENT = Object.freeze({
  position: Object.freeze([SUNRISE_VILLAGE_FOREST_VALLEY_GATE_POSITION.x, 0, SUNRISE_VILLAGE_FOREST_VALLEY_GATE_POSITION.z] as const),
  // Keep the Blender upright rotation and turn only on the horizontal Y axis
  // so the opening angles toward the road instead of pitching the gate.
  rotation: Object.freeze({ x: Math.PI / 2, y: -Math.PI / 4, z: 0 }),
  scale: 3.6,
  groundY: SUNRISE_VILLAGE_GROUND_Y,
});
