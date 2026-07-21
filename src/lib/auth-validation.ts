export type ValidationResult = { ok: true } | { ok: false; message: string };

const childPasswordPattern = /^[A-Za-z0-9]{6,}$/;
const childUsernamePattern = /^[a-z0-9][a-z0-9_]{2,31}$/;

export function normalizeChildUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateChildUsername(username: string): ValidationResult {
  if (!childUsernamePattern.test(normalizeChildUsername(username))) {
    return { ok: false, message: '小孩帳號需 3–32 碼，只能使用英文字母、數字與底線。' };
  }
  return { ok: true };
}

export function childAccountEmail(username: string): string {
  return `${normalizeChildUsername(username)}@children.habithero.local`;
}

export function validateParentCredentials(email: string, password: string): ValidationResult {
  const normalizedEmail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 6) {
    return { ok: false, message: '請輸入有效的 Email，密碼至少 6 碼。' };
  }
  return { ok: true };
}

export function validateChildPassword(password: string): ValidationResult {
  if (!childPasswordPattern.test(password)) {
    return { ok: false, message: '小孩密碼需至少 6 碼，且只能使用英文字母與數字。' };
  }
  return { ok: true };
}

export function validatePasswordConfirmation(password: string, confirmation: string): ValidationResult {
  if (!confirmation) return { ok: false, message: '請再次輸入相同的小孩密碼。' };
  if (password !== confirmation) return { ok: false, message: '兩次輸入的密碼不一致。' };
  return { ok: true };
}
