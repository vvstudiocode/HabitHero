import type { WorldPoint2D } from './world-collision';

export type TideglowSurfaceKind = 'stone-street' | 'grass' | 'beach' | 'ocean';

export interface TideglowSurfaceSample {
  kind: TideglowSurfaceKind;
  elevation: number;
  walkable: boolean;
}

interface EllipseZone {
  center: WorldPoint2D;
  radiusX: number;
  radiusZ: number;
}

interface StreetSegment {
  start: WorldPoint2D;
  end: WorldPoint2D;
  halfWidth: number;
}

const SURFACE_LEVELS = {
  // The authored stone slabs sit only slightly above the grass. Keeping this
  // low prevents the character from appearing to step onto a tall platform.
  'stone-street': { elevation: 0.12, walkable: true },
  grass: { elevation: 0, walkable: true },
  beach: { elevation: -0.14, walkable: true },
  ocean: { elevation: -0.45, walkable: false },
} as const satisfies Record<TideglowSurfaceKind, { elevation: number; walkable: boolean }>;

export const TIDEGLOW_ARCHIPELAGO_SURFACE_LEVELS = Object.freeze(SURFACE_LEVELS);
export const TIDEGLOW_ARCHIPELAGO_MAX_STEP_HEIGHT = 0.16;

export const TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS = Object.freeze({
  street: 0.42,
  grass: 0.6,
  beach: 0.38,
  water: 0.28,
});

const TIDEGLOW_ELEVATION_FOLLOW_SPEED = 12;

// These boundaries are expressed in the runtime's X/Z plane. They are kept
// separate from GLB geometry so the layer edges can be tuned without touching
// the authored assets or bringing the source .blend into the project.
const MAIN_ISLAND_ZONE: EllipseZone = {
  center: { x: 0, z: 0 },
  radiusX: 6.15,
  radiusZ: 5.9,
};

const GRASS_PLATEAU_ZONE: EllipseZone = {
  center: { x: 0.35, z: -0.25 },
  radiusX: 4.25,
  radiusZ: 3.35,
};

// The authored stone street crosses the centre of the island. The boat-side
// beach remains on its own authored surface instead of receiving an invisible
// elevated approach.
const STONE_STREET_SEGMENTS: readonly StreetSegment[] = [
  { start: { x: -5.4, z: 0 }, end: { x: 2.55, z: 0.1 }, halfWidth: 0.52 },
];

// Inner water pools are blocked like the ocean, but remain inside the beach
// and grass footprints instead of being mistaken for walkable terrain.
const WATER_ZONES: readonly EllipseZone[] = [
  { center: { x: 0.5, z: -2.2 }, radiusX: 1.15, radiusZ: 1.2 },
  { center: { x: -2.8, z: 3.9 }, radiusX: 1.3, radiusZ: 1.0 },
];

function isInsideEllipse(point: WorldPoint2D, zone: EllipseZone): boolean {
  const normalizedX = (point.x - zone.center.x) / zone.radiusX;
  const normalizedZ = (point.z - zone.center.z) / zone.radiusZ;
  return normalizedX * normalizedX + normalizedZ * normalizedZ <= 1;
}

/** Approximate signed distance to an ellipse boundary in the X/Z plane. */
function getSignedEllipseBoundaryDistance(point: WorldPoint2D, zone: EllipseZone): number {
  const normalizedX = (point.x - zone.center.x) / zone.radiusX;
  const normalizedZ = (point.z - zone.center.z) / zone.radiusZ;
  return (1 - Math.hypot(normalizedX, normalizedZ)) * Math.min(zone.radiusX, zone.radiusZ);
}

function distanceToSegment(point: WorldPoint2D, segment: StreetSegment): number {
  const deltaX = segment.end.x - segment.start.x;
  const deltaZ = segment.end.z - segment.start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared <= 0.000001) return Math.hypot(point.x - segment.start.x, point.z - segment.start.z);
  const progress = Math.max(0, Math.min(1, (
    (point.x - segment.start.x) * deltaX + (point.z - segment.start.z) * deltaZ
  ) / lengthSquared));
  const closestX = segment.start.x + progress * deltaX;
  const closestZ = segment.start.z + progress * deltaZ;
  return Math.hypot(point.x - closestX, point.z - closestZ);
}

function getSignedStoneStreetDistance(point: WorldPoint2D): number {
  return Math.max(...STONE_STREET_SEGMENTS.map((segment) => segment.halfWidth - distanceToSegment(point, segment)));
}

function isInsideStoneStreet(point: WorldPoint2D): boolean {
  return getSignedStoneStreetDistance(point) >= 0;
}

function sample(kind: TideglowSurfaceKind, elevation: number = SURFACE_LEVELS[kind].elevation): TideglowSurfaceSample {
  return { kind, elevation, walkable: SURFACE_LEVELS[kind].walkable };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function blendAcrossBoundary(
  signedDistance: number,
  width: number,
  insideElevation: number,
  outsideElevation: number,
): number {
  if (width <= 0) return signedDistance >= 0 ? insideElevation : outsideElevation;
  const insideWeight = smoothstep((signedDistance + width) / (2 * width));
  return outsideElevation + (insideElevation - outsideElevation) * insideWeight;
}

function getSignedWaterBoundaryDistance(point: WorldPoint2D): number {
  return Math.max(...WATER_ZONES.map((zone) => getSignedEllipseBoundaryDistance(point, zone)));
}

function getLandElevation(point: WorldPoint2D): number {
  const grassBoundaryDistance = getSignedEllipseBoundaryDistance(point, GRASS_PLATEAU_ZONE);
  return blendAcrossBoundary(
    grassBoundaryDistance,
    TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS.grass,
    SURFACE_LEVELS.grass.elevation,
    SURFACE_LEVELS.beach.elevation,
  );
}

function getSurfaceWithoutStreet(point: WorldPoint2D): TideglowSurfaceSample {
  const islandBoundaryDistance = getSignedEllipseBoundaryDistance(point, MAIN_ISLAND_ZONE);
  const landElevation = getLandElevation(point);
  const waterBoundaryDistance = getSignedWaterBoundaryDistance(point);
  const waterElevation = waterBoundaryDistance > -TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS.water
    ? blendAcrossBoundary(
      waterBoundaryDistance,
      TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS.water,
      SURFACE_LEVELS.ocean.elevation,
      landElevation,
    )
    : landElevation;
  const elevation = blendAcrossBoundary(
    islandBoundaryDistance,
    TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS.beach,
    waterElevation,
    SURFACE_LEVELS.ocean.elevation,
  );

  if (islandBoundaryDistance < 0 || waterBoundaryDistance >= 0) return sample('ocean', elevation);
  return isInsideEllipse(point, GRASS_PLATEAU_ZONE)
    ? sample('grass', elevation)
    : sample('beach', elevation);
}

export function getTideglowSurfaceAt(x: number, z: number): TideglowSurfaceSample {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return sample('ocean');
  const point = { x, z };
  const baseSurface = getSurfaceWithoutStreet(point);
  const signedStreetDistance = getSignedStoneStreetDistance(point);
  if (signedStreetDistance < -TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS.street) return baseSurface;

  // The authored street is a walkable overlay only on the visible island
  // street; the boat-side beach must not become an invisible high platform.
  const streetBaseElevation = baseSurface.walkable
    ? baseSurface.elevation
    : SURFACE_LEVELS.beach.elevation;
  const elevation = blendAcrossBoundary(
    signedStreetDistance,
    TIDEGLOW_ARCHIPELAGO_SURFACE_TRANSITION_WIDTHS.street,
    SURFACE_LEVELS['stone-street'].elevation,
    streetBaseElevation,
  );
  if (!isInsideStoneStreet(point)) return sample(baseSurface.kind, elevation);
  return sample('stone-street', elevation);
}

export function smoothTideglowElevation(current: number, target: number, delta: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return current;
  if (!Number.isFinite(delta) || delta <= 0) return current;
  const blend = 1 - Math.exp(-delta * TIDEGLOW_ELEVATION_FOLLOW_SPEED);
  return current + (target - current) * Math.min(blend, 1);
}

export function canTraverseTideglowSurface(
  from: TideglowSurfaceSample,
  to: TideglowSurfaceSample,
): boolean {
  if (!from.walkable || !to.walkable) return false;
  return Math.abs(to.elevation - from.elevation) <= TIDEGLOW_ARCHIPELAGO_MAX_STEP_HEIGHT;
}
