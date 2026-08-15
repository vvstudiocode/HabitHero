import { getCenter, getDistance, getJoystickVector } from './input-math';
import {
  createInitialWorldInputState,
  type WorldInputEvent,
  type WorldInputState,
  type WorldInputZone,
  type WorldPointerRole,
} from './world-input-types';

const EMPTY_JOYSTICK = { x: 0, y: 0, strength: 0 } as const;

function withoutPointer(state: WorldInputState, pointerId: number): Record<string, { x: number; y: number }> {
  const next = { ...state.pointers };
  delete next[String(pointerId)];
  return next;
}

function withoutPointerRole(state: WorldInputState, pointerId: number): Record<string, WorldPointerRole> {
  const next = { ...state.pointerRoles };
  delete next[String(pointerId)];
  return next;
}

function pointerIdsForRole(roles: Record<string, WorldPointerRole>, role: WorldPointerRole): number[] {
  return Object.entries(roles)
    .filter(([, pointerRole]) => pointerRole === role)
    .map(([pointerId]) => Number(pointerId));
}

function getMode(pointers: Record<string, { x: number; y: number }>, roles: Record<string, WorldPointerRole>): WorldInputState['mode'] {
  if (Object.values(roles).some((role) => role === 'ignored')) return 'await-all-released';
  const movementCount = pointerIdsForRole(roles, 'movement').length;
  const cameraCount = pointerIdsForRole(roles, 'camera').length;
  if (movementCount === 0 && cameraCount === 0) return Object.keys(pointers).length === 0 ? 'idle' : 'await-all-released';
  if (movementCount === 1 && cameraCount === 0) return 'joystick';
  if (movementCount === 0 && cameraCount === 1) return 'camera-single';
  if (movementCount === 1 && cameraCount === 1) return 'joystick-camera';
  if (movementCount === 0 && cameraCount === 2) return 'camera-pinch';
  if (movementCount === 1 && cameraCount === 2) return 'joystick-camera-pinch';
  return 'await-all-released';
}

function getCameraPoints(
  pointers: Record<string, { x: number; y: number }>,
  roles: Record<string, WorldPointerRole>,
) {
  return pointerIdsForRole(roles, 'camera')
    .map((pointerId) => pointers[String(pointerId)])
    .filter((point): point is { x: number; y: number } => Boolean(point));
}

function withCameraAnchors(
  pointers: Record<string, { x: number; y: number }>,
  roles: Record<string, WorldPointerRole>,
): Pick<WorldInputState, 'cameraPreviousCenter' | 'cameraPreviousDistance'> {
  const cameraPoints = getCameraPoints(pointers, roles);
  if (cameraPoints.length === 1) {
    return { cameraPreviousCenter: cameraPoints[0], cameraPreviousDistance: null };
  }
  if (cameraPoints.length >= 2) {
    return {
      cameraPreviousCenter: getCenter(cameraPoints[0], cameraPoints[1]),
      cameraPreviousDistance: getDistance(cameraPoints[0], cameraPoints[1]),
    };
  }
  return { cameraPreviousCenter: null, cameraPreviousDistance: null };
}

function activatePointers(
  state: WorldInputState,
  pointers: Record<string, { x: number; y: number }>,
  roles: Record<string, WorldPointerRole>,
): WorldInputState {
  const movementPointerId = pointerIdsForRole(roles, 'movement')[0] ?? null;
  const keepsJoystick = movementPointerId !== null && state.joystickPointerId === movementPointerId && state.joystickOrigin;
  const joystickOrigin = movementPointerId === null
    ? null
    : keepsJoystick
      ? state.joystickOrigin
      : pointers[String(movementPointerId)];
  const anchors = withCameraAnchors(pointers, roles);
  return {
    ...state,
    mode: getMode(pointers, roles),
    pointers,
    pointerRoles: roles,
    joystickPointerId: movementPointerId,
    joystickOrigin,
    joystick: movementPointerId === null || !keepsJoystick ? { ...EMPTY_JOYSTICK } : state.joystick,
    ...anchors,
  };
}

function enterAwaitAllReleased(
  state: WorldInputState,
  pointers: Record<string, { x: number; y: number }>,
  roles: Record<string, WorldPointerRole>,
): WorldInputState {
  return {
    ...state,
    mode: 'await-all-released',
    pointers,
    pointerRoles: roles,
    joystickPointerId: null,
    joystickOrigin: null,
    joystick: { ...EMPTY_JOYSTICK },
    cameraPreviousCenter: null,
    cameraPreviousDistance: null,
  };
}

function getRequestedZone(state: WorldInputState, event: Extract<WorldInputEvent, { type: 'pointer-down' }>): WorldInputZone {
  if (event.zone) return event.zone;
  return Object.keys(state.pointers).length === 0 ? 'movement' : 'camera';
}

export function worldInputReducer(
  state: WorldInputState,
  event: WorldInputEvent,
): WorldInputState {
  switch (event.type) {
    case 'reset':
      return createInitialWorldInputState();
    case 'clear-camera-delta':
      return { ...state, cameraDelta: { x: 0, y: 0 }, zoomDelta: 0 };
    case 'pointer-down': {
      if (state.pointers[String(event.pointerId)]) return state;
      const pointers = { ...state.pointers, [String(event.pointerId)]: event.point };
      const roles = { ...state.pointerRoles };
      if (state.mode === 'await-all-released') {
        roles[String(event.pointerId)] = 'ignored';
        return enterAwaitAllReleased(state, pointers, roles);
      }

      const pointerCount = Object.keys(pointers).length;
      if (event.pointerType === 'mouse') {
        if (pointerCount !== 1) {
          roles[String(event.pointerId)] = 'ignored';
          return enterAwaitAllReleased(state, pointers, roles);
        }
        roles[String(event.pointerId)] = 'camera';
        return {
          ...activatePointers(state, pointers, roles),
          mode: 'camera-mouse',
        };
      }

      const zone = getRequestedZone(state, event);
      const movementCount = pointerIdsForRole(roles, 'movement').length;
      const cameraCount = pointerIdsForRole(roles, 'camera').length;
      const canAssign = pointerCount <= 3
        && (zone === 'movement' ? movementCount === 0 : cameraCount < 2);
      if (!canAssign) {
        roles[String(event.pointerId)] = 'ignored';
        return enterAwaitAllReleased(state, pointers, roles);
      }
      roles[String(event.pointerId)] = zone;
      return activatePointers(state, pointers, roles);
    }
    case 'pointer-move': {
      if (!state.pointers[String(event.pointerId)] || state.mode === 'await-all-released') return state;
      const pointers = { ...state.pointers, [String(event.pointerId)]: event.point };
      const role = state.pointerRoles[String(event.pointerId)];
      if (role === 'movement' && state.joystickPointerId === event.pointerId && state.joystickOrigin) {
        return { ...state, pointers, joystick: getJoystickVector(state.joystickOrigin, event.point) };
      }
      if (role !== 'camera') return { ...state, pointers };

      const cameraPoints = getCameraPoints(pointers, state.pointerRoles);
      if (cameraPoints.length === 1 && state.cameraPreviousCenter) {
        const cameraDelta = {
          x: event.point.x - state.cameraPreviousCenter.x,
          y: event.point.y - state.cameraPreviousCenter.y,
        };
        return {
          ...state,
          pointers,
          cameraPreviousCenter: event.point,
          cameraDelta: {
            x: state.cameraDelta.x + cameraDelta.x,
            y: state.cameraDelta.y + cameraDelta.y,
          },
        };
      }
      if (cameraPoints.length < 2 || !state.cameraPreviousCenter || state.cameraPreviousDistance === null) return { ...state, pointers };
      const center = getCenter(cameraPoints[0], cameraPoints[1]);
      const distance = getDistance(cameraPoints[0], cameraPoints[1]);
      return {
        ...state,
        pointers,
        cameraPreviousCenter: center,
        cameraPreviousDistance: distance,
        zoomDelta: state.zoomDelta + distance - state.cameraPreviousDistance,
      };
    }
    case 'pointer-up':
    case 'pointer-cancel': {
      if (!state.pointers[String(event.pointerId)]) return state;
      const pointers = withoutPointer(state, event.pointerId);
      const roles = withoutPointerRole(state, event.pointerId);
      if (Object.keys(pointers).length === 0) {
        return { ...createInitialWorldInputState(), cameraDelta: state.cameraDelta, zoomDelta: state.zoomDelta };
      }
      if (state.mode === 'await-all-released') return { ...state, pointers, pointerRoles: roles };
      return activatePointers(state, pointers, roles);
    }
  }
}
