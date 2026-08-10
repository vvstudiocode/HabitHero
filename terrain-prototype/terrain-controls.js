function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function applySinglePointerCameraDrag(
  camera,
  { dx, dy },
  {
    pitchMin,
    pitchMax,
    yawSensitivity = 0.008,
    pitchSensitivity = 0.006,
  },
) {
  return {
    yaw: camera.yaw - dx * yawSensitivity,
    // A bottom-to-top drag has a negative dy and should look farther down.
    pitch: clamp(camera.pitch - dy * pitchSensitivity, pitchMin, pitchMax),
  };
}

export function getPinchCameraDistance({
  startDistance,
  startCameraDistance,
  currentDistance,
  minDistance,
  maxDistance,
}) {
  const safeStartDistance = Math.max(Math.abs(startDistance), 1);
  const safeCurrentDistance = Math.max(Math.abs(currentDistance), 1);
  const nextDistance = startCameraDistance * (safeStartDistance / safeCurrentDistance);
  return clamp(nextDistance, minDistance, maxDistance);
}
