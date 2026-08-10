const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const CAMERA_KEYS = new Set(['i', 'j', 'k', 'l', '+', '=', '-', '_']);

export function isWorldMovementKey(key: string): boolean {
  return MOVEMENT_KEYS.has(key.toLowerCase());
}

export function isWorldCameraKey(key: string): boolean {
  return CAMERA_KEYS.has(key.toLowerCase());
}

export function getKeyboardMovement(keys: ReadonlySet<string>): { x: number; y: number } {
  const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  const side = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  const length = Math.hypot(side, forward);
  return length > 0 ? { x: side / length, y: forward / length } : { x: 0, y: 0 };
}

export function getKeyboardCameraInput(keys: ReadonlySet<string>): { yaw: number; pitch: number; zoom: number } {
  return {
    yaw: Number(keys.has('j')) - Number(keys.has('l')),
    pitch: Number(keys.has('k')) - Number(keys.has('i')),
    zoom: Number(keys.has('+') || keys.has('=')) - Number(keys.has('-') || keys.has('_')),
  };
}
