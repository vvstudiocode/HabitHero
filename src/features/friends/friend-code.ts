export const FRIEND_CODE_LENGTH = 32;
const FRIEND_CODE_PATTERN = /^[A-Z0-9]{32}$/;
export const FRIEND_ACCOUNT_NAME_PATTERN = /^[a-z0-9][a-z0-9_]{2,31}$/;

function normalizeCompatibilityDigits(value: string): string {
  return value.replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0));
}

export function normalizeFriendCode(value: string): string {
  return normalizeCompatibilityDigits(value)
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s-]/g, '');
}

export function normalizeFriendAccountName(value: string): string {
  return normalizeCompatibilityDigits(value).normalize('NFKC').trim().toLowerCase();
}

export function isFriendAccountName(value: string): boolean {
  return FRIEND_ACCOUNT_NAME_PATTERN.test(normalizeFriendAccountName(value));
}

export function validateFriendCode(value: string): { valid: true; normalized: string } | { valid: false; normalized: string; reason: string } {
  const normalized = normalizeFriendCode(value);
  if (FRIEND_CODE_PATTERN.test(normalized)) return { valid: true, normalized };
  const accountName = normalizeFriendAccountName(value);
  if (FRIEND_ACCOUNT_NAME_PATTERN.test(accountName)) return { valid: true, normalized: accountName };
  return { valid: false, normalized, reason: '好友帳號或代碼格式不正確。' };
}

export function formatFriendCode(value: string): string {
  const result = validateFriendCode(value);
  if (!result.valid) throw new TypeError('Invalid friend code.');
  return result.normalized.length === FRIEND_CODE_LENGTH
    ? result.normalized.match(/.{1,4}/g)!.join('-')
    : result.normalized;
}
