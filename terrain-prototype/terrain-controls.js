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

export function getGroundedCameraTargetHeight({
  pitch,
  pitchMin,
  pitchMax,
  normalHeight,
  groundHeight = 0.04,
}) {
  // Start lowering the look target after a 60-degree tilt. At the limit the
  // camera looks at the character's feet/ground instead of the torso.
  const groundingStart = Math.PI / 3;
  const groundingRange = Math.max(pitchMax - groundingStart, Number.EPSILON);
  const progress = clamp((pitch - groundingStart) / groundingRange, 0, 1);
  const safeProgress = pitchMax > pitchMin ? progress : 0;
  return normalHeight + (groundHeight - normalHeight) * safeProgress;
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
