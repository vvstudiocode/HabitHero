import { MAX_CHARACTER_ASSET_KEY_LENGTH, MAX_PRESENCE_ID_LENGTH } from './limits';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isShortIdentity(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_PRESENCE_ID_LENGTH
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function isOptionalCharacterAssetKey(value: unknown): value is string | undefined {
  return value === undefined || (
    typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_CHARACTER_ASSET_KEY_LENGTH
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

export function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

