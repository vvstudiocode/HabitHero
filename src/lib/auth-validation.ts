export type ValidationResult = { ok: true } | { ok: false; message: string };

const childPasswordPattern = /^[A-Za-z0-9]{6,}$/;

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

export function isAnonymousAuthError(error: unknown): boolean {
  return error instanceof Error && /anonymous|anonymous sign-in|not enabled/i.test(error.message);
}
