export const FRIEND_CODE_LENGTH = 32;
const FRIEND_CODE_PATTERN = /^[A-Z0-9]{32}$/;

function normalizeCompatibilityDigits(value: string): string {
  return value.replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0));
}

export function normalizeFriendCode(value: string): string {
  return normalizeCompatibilityDigits(value)
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s-]/g, '');
}

export function validateFriendCode(value: string): { valid: true; normalized: string } | { valid: false; normalized: string; reason: string } {
  const normalized = normalizeFriendCode(value);
  if (!FRIEND_CODE_PATTERN.test(normalized)) return { valid: false, normalized, reason: '好友代碼格式不正確。' };
  return { valid: true, normalized };
}

export function formatFriendCode(value: string): string {
  const result = validateFriendCode(value);
  if (!result.valid) throw new TypeError('Invalid friend code.');
  return result.normalized.match(/.{1,4}/g)!.join('-');
}
