export const MAX_GROUND_COVER_MASKS = 8;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothstep(edge0, edge1, value) {
  const range = Math.max(edge1 - edge0, 0.0001);
  const normalized = clamp((value - edge0) / range, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

/** Returns 0 under a cover, 1 outside it, and a soft transition at its edge. */
export function getGroundCoverMaskVisibility(point, masks = []) {
  return masks.slice(0, MAX_GROUND_COVER_MASKS).reduce((visibility, mask) => {
    const deltaX = point.x - mask.x;
    const deltaZ = point.z - mask.z;
    const cosine = Math.cos(mask.rotationY ?? 0);
    const sine = Math.sin(mask.rotationY ?? 0);
    const localX = cosine * deltaX + sine * deltaZ;
    const localZ = -sine * deltaX + cosine * deltaZ;
    const edgeDistance = mask.shape === 'circle'
      ? Math.min(mask.halfWidth, mask.halfDepth) * (1 - Math.hypot(
        localX / Math.max(mask.halfWidth, 0.001),
        localZ / Math.max(mask.halfDepth, 0.001),
      ))
      : Math.min(
        mask.halfWidth - Math.abs(localX),
        mask.halfDepth - Math.abs(localZ),
      );
    const softness = Math.max(mask.edgeSoftness ?? 0.08, 0.001);
    const maskVisibility = 1 - smoothstep(-softness, 0, edgeDistance);
    return Math.min(visibility, maskVisibility);
  }, 1);
}
