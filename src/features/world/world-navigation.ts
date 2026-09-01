import type { WorldLocation } from './world-location';

export type PublicWorldLocation = Exclude<WorldLocation, 'my-world'>;

export interface WorldNavigationPoint {
  x: number;
  z: number;
}

export interface WorldReturnTarget {
  location: PublicWorldLocation;
  position: WorldNavigationPoint;
}

export interface WorldNavigationState {
  returnTarget: WorldReturnTarget | null;
}

export interface WorldNavigationTransition {
  nextLocation: WorldLocation;
  entryPosition?: WorldNavigationPoint;
  entryFacingY?: number;
  entryCameraYaw?: number;
  returnTarget: WorldReturnTarget | null;
}

export function createInitialWorldNavigationState(): WorldNavigationState {
  return { returnTarget: null };
}

function isPublicWorldLocation(location: WorldLocation): location is PublicWorldLocation {
  return location !== 'my-world';
}

function isFinitePoint(point: WorldNavigationPoint | null | undefined): point is WorldNavigationPoint {
  return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.z);
}

function copyPoint(point: WorldNavigationPoint): WorldNavigationPoint {
  return { x: point.x, z: point.z };
}

function copyReturnTarget(target: WorldReturnTarget): WorldReturnTarget {
  return { location: target.location, position: copyPoint(target.position) };
}

function getEntryFacingY(
  location: PublicWorldLocation,
  entryFacings: Partial<Record<PublicWorldLocation, number>> | undefined,
): number | undefined {
  const facingY = entryFacings?.[location];
  return Number.isFinite(facingY) ? facingY : undefined;
}

function getEntryCameraYaw(
  location: PublicWorldLocation,
  entryCameraYaws: Partial<Record<PublicWorldLocation, number>> | undefined,
): number | undefined {
  const cameraYaw = entryCameraYaws?.[location];
  return Number.isFinite(cameraYaw) ? cameraYaw : undefined;
}

export function resolveWorldNavigationTransition(input: {
  currentLocation: WorldLocation;
  requestedLocation: WorldLocation;
  currentPosition?: WorldNavigationPoint | null;
  returnTarget?: WorldReturnTarget | null;
  entryPositions?: Partial<Record<PublicWorldLocation, WorldNavigationPoint>>;
  entryPositionsBySource?: Partial<Record<WorldLocation, Partial<Record<PublicWorldLocation, WorldNavigationPoint>>>>;
  entryFacings?: Partial<Record<PublicWorldLocation, number>>;
  entryCameraYaws?: Partial<Record<PublicWorldLocation, number>>;
}): WorldNavigationTransition {
  const returnTarget = input.returnTarget && isFinitePoint(input.returnTarget.position)
    ? copyReturnTarget(input.returnTarget)
    : null;
  const getDestinationEntryPosition = (destination: PublicWorldLocation): WorldNavigationPoint | undefined => (
    input.entryPositionsBySource?.[input.currentLocation]?.[destination]
    ?? input.entryPositions?.[destination]
  );

  if (input.currentLocation !== 'my-world' && input.requestedLocation === 'my-world') {
    return {
      nextLocation: 'my-world',
      entryPosition: undefined,
      returnTarget: isPublicWorldLocation(input.currentLocation) && isFinitePoint(input.currentPosition)
        ? { location: input.currentLocation, position: copyPoint(input.currentPosition) }
        : returnTarget,
    };
  }

  if (input.currentLocation === 'my-world' && isPublicWorldLocation(input.requestedLocation)) {
    const destination = returnTarget ?? {
      location: input.requestedLocation,
      position: getDestinationEntryPosition(input.requestedLocation),
    };
    const entryFacingY = returnTarget
      ? undefined
      : getEntryFacingY(input.requestedLocation, input.entryFacings);
    const entryCameraYaw = returnTarget
      ? undefined
      : getEntryCameraYaw(input.requestedLocation, input.entryCameraYaws);
    return {
      nextLocation: destination.location,
      entryPosition: destination.position ? copyPoint(destination.position) : undefined,
      ...(entryFacingY === undefined ? {} : { entryFacingY }),
      ...(entryCameraYaw === undefined ? {} : { entryCameraYaw }),
      returnTarget: null,
    };
  }

  const entryFacingY = isPublicWorldLocation(input.requestedLocation)
    ? getEntryFacingY(input.requestedLocation, input.entryFacings)
    : undefined;
  const entryCameraYaw = isPublicWorldLocation(input.requestedLocation)
    ? getEntryCameraYaw(input.requestedLocation, input.entryCameraYaws)
    : undefined;
  return {
    nextLocation: input.requestedLocation,
    entryPosition: isPublicWorldLocation(input.requestedLocation)
      ? getDestinationEntryPosition(input.requestedLocation)
      : undefined,
    ...(entryFacingY === undefined ? {} : { entryFacingY }),
    ...(entryCameraYaw === undefined ? {} : { entryCameraYaw }),
    returnTarget,
  };
}
