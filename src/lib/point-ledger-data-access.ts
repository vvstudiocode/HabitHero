import { pointLedgerRowToViewModel } from './data-contracts';
import type { PointLedgerAdjustmentResult, PointLedgerRow } from '../types';

export const buildAdjustChildPointsPayload = (
  childProfileId: string,
  pointsDelta: number,
  note: string,
) => ({
  target_child_profile_id: childProfileId,
  points_delta: pointsDelta,
  adjustment_note: note,
});

export function pointLedgerAdjustmentResultFromRpc(value: unknown): PointLedgerAdjustmentResult {
  const result = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ledgerEntry = result.ledger_entry && typeof result.ledger_entry === 'object'
    ? result.ledger_entry as PointLedgerRow
    : null;
  if (!ledgerEntry) throw new Error('點數調整回應格式錯誤，請重試。');
  return {
    ledgerEntry: pointLedgerRowToViewModel(ledgerEntry),
    pointsBalance: Number(result.points_balance ?? 0),
  };
}
