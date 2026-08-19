export const buildAdjustChildPointsPayload = (
  childProfileId: string,
  pointsDelta: number,
  note: string,
) => ({
  target_child_profile_id: childProfileId,
  points_delta: pointsDelta,
  adjustment_note: note,
});
