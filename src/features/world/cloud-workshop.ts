export const CLOUD_WORKSHOP_MODULE_ASSETS = Object.freeze({
  cloudStairRailing1: '/assets/world/cloud-workshop/cloud-stair-railing-1.glb',
  cloudStairRailing2: '/assets/world/cloud-workshop/cloud-stair-railing-2.glb',
  cloudStairRailing3: '/assets/world/cloud-workshop/cloud-stair-railing-3.glb',
  skyGarden1: '/assets/world/cloud-workshop/sky-garden-1.glb',
  skyGarden2: '/assets/world/cloud-workshop/sky-garden-2.glb',
  skyGarden3: '/assets/world/cloud-workshop/sky-garden-3.glb',
  cloudMaterialHut1: '/assets/world/cloud-workshop/cloud-material-hut-1.glb',
  cloudMaterialHut2: '/assets/world/cloud-workshop/cloud-material-hut-2.glb',
  smallCloudAirship1: '/assets/world/cloud-workshop/small-cloud-airship-1.glb',
  smallCloudAirship2: '/assets/world/cloud-workshop/small-cloud-airship-2.glb',
  smallCloudAirship3: '/assets/world/cloud-workshop/small-cloud-airship-3.glb',
  smallCloudAirship4: '/assets/world/cloud-workshop/small-cloud-airship-4.glb',
  smallCloudAirship5: '/assets/world/cloud-workshop/small-cloud-airship-5.glb',
  airshipDock1: '/assets/world/cloud-workshop/airship-dock-1.glb',
  airshipDock2: '/assets/world/cloud-workshop/airship-dock-2.glb',
  windmillHighland1: '/assets/world/cloud-workshop/windmill-highland-1.glb',
  windmillHighland2: '/assets/world/cloud-workshop/windmill-highland-2.glb',
  cloudCoreWorkshop1: '/assets/world/cloud-workshop/cloud-core-workshop-1.glb',
  cloudCoreWorkshop2: '/assets/world/cloud-workshop/cloud-core-workshop-2.glb',
  cloudBridge1: '/assets/world/cloud-workshop/cloud-bridge-1.glb',
  cloudBridge2: '/assets/world/cloud-workshop/cloud-bridge-2.glb',
  cloudGround1: '/assets/world/cloud-workshop/cloud-ground-1.glb',
  cloudGround2: '/assets/world/cloud-workshop/cloud-ground-2.glb',
  cloudGround3: '/assets/world/cloud-workshop/cloud-ground-3.glb',
});

export type CloudWorkshopModuleKey = keyof typeof CLOUD_WORKSHOP_MODULE_ASSETS;
type BlenderVector3 = readonly [number, number, number];
type BlenderQuaternion = readonly [number, number, number, number];

export interface CloudWorkshopModulePlacement {
  id: string;
  asset: CloudWorkshopModuleKey;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  scale: readonly [number, number, number];
  collision: boolean;
  collisionFootprintScale?: number;
}

interface AuthoredPlacementInput {
  id: string;
  asset: CloudWorkshopModuleKey;
  location: BlenderVector3;
  rotation: BlenderQuaternion;
  scale: BlenderVector3;
  collision: boolean;
  collisionFootprintScale?: number;
}

function toRuntimePosition([x, y, z]: BlenderVector3): readonly [number, number, number] {
  // Blender is Z-up; the Three.js world keeps the authored horizontal axes as
  // x, z and uses Blender's vertical z as runtime y.
  return [x, z, -y];
}

function toRuntimeScale([x, y, z]: BlenderVector3): readonly [number, number, number] {
  return [x, z, y];
}

function toRuntimeQuaternion([w, x, y, z]: BlenderQuaternion): readonly [number, number, number, number] {
  // Keep the Blender-to-glTF basis conversion consistent with the exported
  // reference scene: the authored Blender Z axis becomes runtime Y and the
  // authored Blender Y axis becomes runtime -Z.
  return [x, y, -z, w];
}

function createPlacement(input: AuthoredPlacementInput): CloudWorkshopModulePlacement {
  return {
    id: input.id,
    asset: input.asset,
    position: toRuntimePosition(input.location),
    rotation: toRuntimeQuaternion(input.rotation),
    scale: toRuntimeScale(input.scale),
    collision: input.collision,
    ...(input.collisionFootprintScale === undefined ? {} : { collisionFootprintScale: input.collisionFootprintScale }),
  };
}

/**
 * The 22 modules below are the objects that have an authored placement in
 * `/Users/studio.vv/Downloads/雲工房.blend`. The values intentionally stay in
 * Blender's local scene space until the runtime conversion above is applied;
 * no hand-tuned vertical offset is mixed into the authored data.
 * The two alternative stair assets remain available in the asset map for a
 * later authored layout update.
 */
export const CLOUD_WORKSHOP_MODULE_PLACEMENTS: readonly CloudWorkshopModulePlacement[] = [
  createPlacement({ id: 'cloud-stair-railing-2', asset: 'cloudStairRailing2', location: [-5.42154, -10.808601, 0.605515], rotation: [0.299787, 0.299787, 0.640412, 0.640412], scale: [4.341374, 3.685314, 4.363312], collision: false }),
  createPlacement({ id: 'sky-garden-3', asset: 'skyGarden3', location: [13.600777, 38.944847, 6.06283], rotation: [0.707107, 0.707107, 0, 0], scale: [4.341374, 2.9123, 4.363312], collision: true, collisionFootprintScale: 0.58 }),
  createPlacement({ id: 'sky-garden-2', asset: 'skyGarden2', location: [-18.817284, 11.419928, 3.324733], rotation: [0.707107, 0.707107, 0, 0], scale: [6.489112, 9.188263, 7.783464], collision: true, collisionFootprintScale: 0.58 }),
  createPlacement({ id: 'sky-garden-1', asset: 'skyGarden1', location: [14.762848, 13.604042, 1.710608], rotation: [0.707107, 0.707107, 0, 0], scale: [5.910575, 3.474912, 5.293674], collision: true, collisionFootprintScale: 0.58 }),
  createPlacement({ id: 'cloud-material-hut-2', asset: 'cloudMaterialHut2', location: [-5.721454, -5.072284, 0.461118], rotation: [0.707107, 0.707107, 0, 0], scale: [4.341374, 2.9123, 4.363312], collision: true, collisionFootprintScale: 0.62 }),
  createPlacement({ id: 'cloud-material-hut-1', asset: 'cloudMaterialHut1', location: [12.558412, 3.313997, 4.00361], rotation: [0.707107, 0.707107, 0, 0], scale: [5.474481, 4.786979, 4.909924], collision: true, collisionFootprintScale: 0.62 }),
  createPlacement({ id: 'small-cloud-airship-5', asset: 'smallCloudAirship5', location: [14.974216, -7.667232, 4.654183], rotation: [0.607784, 0.607784, -0.361385, -0.361385], scale: [16.320539, 10.915453, 22.547758], collision: false }),
  createPlacement({ id: 'small-cloud-airship-4', asset: 'smallCloudAirship4', location: [12.5358, 19.694786, 4.72822], rotation: [-0.596245, -0.596245, -0.380121, -0.380121], scale: [10.564891, 9.268155, 24.113035], collision: false }),
  createPlacement({ id: 'small-cloud-airship-3', asset: 'smallCloudAirship3', location: [-10.788319, 18.199547, 2.562693], rotation: [0.707107, 0.707107, 0, 0], scale: [8.666135, 6.373074, 9.541717], collision: false }),
  createPlacement({ id: 'small-cloud-airship-2', asset: 'smallCloudAirship2', location: [5.688611, 12.534347, -3.16176], rotation: [0.674122, 0.674122, -0.213447, -0.213447], scale: [7.654636, 7.254757, 7.112394], collision: false }),
  createPlacement({ id: 'small-cloud-airship-1', asset: 'smallCloudAirship1', location: [4.129849, -17.491947, 5.377812], rotation: [0.707107, 0.707107, 0, 0], scale: [7.430038, 9.34434, 9.305112], collision: false }),
  createPlacement({ id: 'airship-dock-2', asset: 'airshipDock2', location: [-11.232282, -14.244297, -2.437723], rotation: [0.397084, 0.397084, 0.585085, 0.585085], scale: [6.939563, 8.695527, 8.770261], collision: true, collisionFootprintScale: 0.56 }),
  // The third Blender location value is Z-up height and remains editable.
  createPlacement({ id: 'airship-dock-1', asset: 'airshipDock1', location: [-10.931229, 0.197237, 0.866029], rotation: [0.541033, 0.541033, 0.455284, 0.455284], scale: [5.295177, 6.265191, 5.264868], collision: true, collisionFootprintScale: 0.56 }),
  createPlacement({ id: 'windmill-highland-2', asset: 'windmillHighland2', location: [0.643265, 3.040414, 0.710145], rotation: [0.707107, 0.707107, 0, 0], scale: [4.807683, 2.9123, 5.103664], collision: true, collisionFootprintScale: 0.56 }),
  createPlacement({ id: 'windmill-highland-1', asset: 'windmillHighland1', location: [-16.079582, -7.319924, 4.124313], rotation: [0.231883, 0.231883, 0.668005, 0.668005], scale: [8.911756, 7.204527, 8.931539], collision: true, collisionFootprintScale: 0.56 }),
  createPlacement({ id: 'cloud-core-workshop-2', asset: 'cloudCoreWorkshop2', location: [-0.133675, 22.260759, 3.182963], rotation: [0.707107, 0.707107, 0, 0], scale: [6.293447, 6.232743, 8.566187], collision: true, collisionFootprintScale: 0.62 }),
  createPlacement({ id: 'cloud-core-workshop-1', asset: 'cloudCoreWorkshop1', location: [2.330486, -3.677336, 0.908118], rotation: [0.707107, 0.707107, 0, 0], scale: [4.341374, 2.9123, 4.363312], collision: true, collisionFootprintScale: 0.62 }),
  createPlacement({ id: 'cloud-bridge-2', asset: 'cloudBridge2', location: [6.672983, -12.971371, -0.108262], rotation: [0.652293, 0.652293, -0.272972, -0.272972], scale: [7.265494, 5.314168, 6.831656], collision: false }),
  createPlacement({ id: 'cloud-bridge-1', asset: 'cloudBridge1', location: [-10.93528, 30.008635, 3.416403], rotation: [0.707107, 0.707107, 0, 0], scale: [4.341374, 2.9123, 4.363312], collision: false }),
  createPlacement({ id: 'cloud-ground-3', asset: 'cloudGround3', location: [-2.51525, -16.559797, 3.712343], rotation: [0.707107, 0.707107, 0, 0], scale: [4.341374, 2.9123, 4.363312], collision: false }),
  createPlacement({ id: 'cloud-ground-2', asset: 'cloudGround2', location: [-0.05743, 22.489912, 2.638747], rotation: [0.707107, 0.707107, 0, 0], scale: [6.816502, 2.9123, 8.622053], collision: false }),
  createPlacement({ id: 'cloud-ground-1', asset: 'cloudGround1', location: [-0.054438, 0.407657, -8.434945], rotation: [0.707107, 0.707107, 0, 0], scale: [25.593407, 18.474667, 27.185076], collision: false }),
];

export const CLOUD_WORKSHOP_SCENE_TRANSFORM = Object.freeze({
  scale: 0.6,
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
});

export const CLOUD_WORKSHOP_GROUND_MODULE_KEY = 'cloud-ground-1';
export const CLOUD_WORKSHOP_GATE_MODULE_ID = 'airship-dock-1';
export const CLOUD_WORKSHOP_GROUND_Y = 0.06;
export const CLOUD_WORKSHOP_MOVEMENT_BOUNDARY = 18.9;
// The authored dock is a visual landmark below the main island, not a safe
// character standing surface. Enter the workshop from the clear central
// plaza so the player starts on the grounded cloud land instead of in mid-air.
export const CLOUD_WORKSHOP_ENTRY_POSITION = Object.freeze({ x: 0, z: 0 });
export const CLOUD_WORKSHOP_SPAWN_ANCHOR = CLOUD_WORKSHOP_ENTRY_POSITION;
export const CLOUD_WORKSHOP_GATE_ENTER_RADIUS = 2.4;
export const CLOUD_WORKSHOP_GATE_EXIT_RADIUS = 3.2;
export const CLOUD_WORKSHOP_GATE_PROMPT_LOWERING_RATIO = 0.75;
export const CLOUD_WORKSHOP_GATE_PROMPT_SIDE_MARGIN = 96;
export const CLOUD_WORKSHOP_GATE_PROMPT_TOP_MARGIN = 112;
export const CLOUD_WORKSHOP_GATE_PROMPT_BOTTOM_MARGIN = 176;

// Keep the new dock beside the existing Forest Valley gate at the same road
// junction until a dedicated entrance asset is supplied later.
export const SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT = Object.freeze({
  // position[1] is an additional world-height offset above the ground base.
  position: Object.freeze([11, 0, -0.85] as const),
  rotation: Object.freeze({ x: Math.PI / 2, y: -Math.PI / 2, z: 0 }),
  scale: 3.2,
  groundY: 0.107,
});

// Start just outside the dock instead of at its center, where the character
// would be hidden inside the cloud model when returning from Cloud Workshop.
export const SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_FORWARD_OFFSET = 1.8;
export const SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_POSITION = Object.freeze({
  x: SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT.position[0]
    + Math.cos(SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT.rotation.y)
      * SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_FORWARD_OFFSET,
  z: SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT.position[2]
    + Math.sin(SUNRISE_VILLAGE_CLOUD_WORKSHOP_GATE_PLACEMENT.rotation.y)
      * SUNRISE_VILLAGE_CLOUD_WORKSHOP_ENTRY_FORWARD_OFFSET,
});

export interface CloudWorkshopGateScreenPosition {
  x: number;
  y: number;
  scale: number;
}

export function getCloudWorkshopGatePromptHeight(topY: number, baseY: number): number {
  return topY + (baseY - topY) * CLOUD_WORKSHOP_GATE_PROMPT_LOWERING_RATIO;
}

export function isCloudWorkshopGateNearby(distance: number, wasNearby: boolean): boolean {
  if (!Number.isFinite(distance) || distance < 0) return false;
  return distance <= (wasNearby ? CLOUD_WORKSHOP_GATE_EXIT_RADIUS : CLOUD_WORKSHOP_GATE_ENTER_RADIUS);
}
