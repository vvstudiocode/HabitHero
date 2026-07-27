export type RewardPointsValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateRewardPoints(points: number): RewardPointsValidation {
  if (!Number.isInteger(points) || points <= 0) {
    return { ok: false, message: '獎勵點數必須是大於 0 的整數。' };
  }
  return { ok: true };
}
