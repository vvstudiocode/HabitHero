export const MIN_MESSAGE_CHARS = 1;
export const MAX_MESSAGE_CHARS = 120;
export const MAX_CHAT_PAGE_SIZE = 50;
export const MAX_CHAT_HISTORY = 200;

export const CHAT_RATE_LIMITS = {
  shortWindowMs: 10_000,
  shortWindowMax: 5,
  longWindowMs: 60_000,
  longWindowMax: 30,
} as const;

export interface ChatTextValidation {
  ok: boolean;
  normalized: string;
  reason?: string;
}

export function validateChatMessageText(value: string): ChatTextValidation {
  const normalized = value.trim();
  if ([...normalized].length < MIN_MESSAGE_CHARS || [...normalized].length > MAX_MESSAGE_CHARS) {
    return { ok: false, normalized, reason: '訊息長度必須是 1 到 120 個字。' };
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    return { ok: false, normalized, reason: '訊息不能包含控制字元或換行。' };
  }
  if (/(?:https?:\/\/|www\.)/iu.test(normalized)) {
    return { ok: false, normalized, reason: '聊天訊息不能包含連結。' };
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(normalized)) {
    return { ok: false, normalized, reason: '聊天訊息不能包含電子郵件。' };
  }
  if (/(?:^|[^0-9])\+?[0-9][0-9 .()\/-]{5,}[0-9](?:[^0-9]|$)/u.test(normalized)) {
    return { ok: false, normalized, reason: '聊天訊息不能包含電話號碼。' };
  }
  return { ok: true, normalized };
}

export function canSendChatMessage(timestamps: readonly number[], now: number): boolean {
  const recent = timestamps.filter((timestamp) => Number.isFinite(timestamp) && timestamp <= now);
  const shortCount = recent.filter((timestamp) => timestamp > now - CHAT_RATE_LIMITS.shortWindowMs).length;
  const longCount = recent.filter((timestamp) => timestamp > now - CHAT_RATE_LIMITS.longWindowMs).length;
  return shortCount < CHAT_RATE_LIMITS.shortWindowMax && longCount < CHAT_RATE_LIMITS.longWindowMax;
}

export function pruneChatTimestamps(timestamps: readonly number[], now: number): number[] {
  return timestamps
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > now - CHAT_RATE_LIMITS.shortWindowMs && timestamp <= now)
    .sort((left, right) => left - right);
}
