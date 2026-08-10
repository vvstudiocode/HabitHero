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
    groundingSensitivity = 0.006,
  },
) {
  const verticalLimit = Math.min(Math.PI / 2, pitchMax);
  const currentGrounding = clamp(camera.grounding ?? 0, 0, 1);
  let nextPitch = clamp(camera.pitch - dy * pitchSensitivity, pitchMin, verticalLimit);
  let nextGrounding = currentGrounding;

  // Once the camera is directly above the character, a downward drag should
  // lower the view toward the grass without crossing the vertical limit.
  if (dy > 0 && camera.pitch >= verticalLimit - Number.EPSILON) {
    nextPitch = verticalLimit;
    nextGrounding = clamp(currentGrounding + dy * groundingSensitivity, 0, 1);
  } else if (dy < 0) {
    nextGrounding = clamp(currentGrounding + dy * groundingSensitivity, 0, 1);
  }

  return {
    yaw: camera.yaw - dx * yawSensitivity,
    pitch: nextPitch,
    grounding: nextGrounding,
  };
}

export function getGroundedCameraTargetHeight({
  grounding = 0,
  normalHeight,
  groundHeight = 0.04,
}) {
  const progress = clamp(grounding, 0, 1);
  return normalHeight + (groundHeight - normalHeight) * progress;
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
