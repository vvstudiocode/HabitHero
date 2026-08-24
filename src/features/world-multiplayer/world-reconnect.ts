export const WORLD_RECONNECT_BASE_DELAY_MS = 1000;
export const WORLD_RECONNECT_MAX_DELAY_MS = 10000;

export function getWorldReconnectDelay(attempt: number, jitter = 0.5): number {
  const safeAttempt = Number.isFinite(attempt) && attempt >= 0 ? Math.floor(attempt) : 0;
  const safeJitter = Number.isFinite(jitter) ? Math.min(1, Math.max(0, jitter)) : 0.5;
  const exponentialDelay = Math.min(
    WORLD_RECONNECT_MAX_DELAY_MS,
    WORLD_RECONNECT_BASE_DELAY_MS * (2 ** safeAttempt),
  );
  return Math.round(exponentialDelay * (0.75 + safeJitter * 0.5));
}

export function isRecoverableWorldChannelStatus(status: string): boolean {
  return status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED';
}
