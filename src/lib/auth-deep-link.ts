export const APP_URL_SCHEME = 'com.vvstudiocode.habithero';

export type AppLinkRoute = 'login' | 'reset-password';

export interface AuthCallbackParams {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

export interface RecoverySessionTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
}

const callbackParamNames = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'type',
  'code',
  'error',
  'error_code',
  'error_description',
  'error_uri',
  'state',
] as const;

let initialAuthCallbackUrl: string | null | undefined;

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function getRoute(url: URL): string {
  const route = url.protocol === `${APP_URL_SCHEME}:`
    ? (url.hostname || url.pathname)
    : url.pathname;
  return route.replace(/^\/+|\/+$/g, '').toLowerCase();
}

function getParam(url: URL, hashParams: URLSearchParams, name: string): string | null {
  return url.searchParams.get(name) ?? hashParams.get(name);
}

export function getAuthCallbackParams(rawUrl: string): AuthCallbackParams {
  const url = parseUrl(rawUrl);
  if (!url) {
    return {
      accessToken: null,
      refreshToken: null,
      code: null,
      type: null,
      error: null,
      errorCode: null,
      errorDescription: null,
    };
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  return {
    accessToken: getParam(url, hashParams, 'access_token'),
    refreshToken: getParam(url, hashParams, 'refresh_token'),
    code: getParam(url, hashParams, 'code'),
    type: getParam(url, hashParams, 'type'),
    error: getParam(url, hashParams, 'error'),
    errorCode: getParam(url, hashParams, 'error_code'),
    errorDescription: getParam(url, hashParams, 'error_description'),
  };
}

export function hasAuthSessionPayload(rawUrl: string): boolean {
  const params = getAuthCallbackParams(rawUrl);
  return Boolean(
    params.accessToken && params.refreshToken
    || params.code,
  );
}

export function isPasswordRecoveryCallbackUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);
  if (!url) return false;

  const route = getRoute(url);
  const params = getAuthCallbackParams(rawUrl);
  if (url.protocol === `${APP_URL_SCHEME}:`) return route === 'reset-password';
  return route === 'reset-password' || params.type === 'recovery';
}

export function getAppLinkIntent(rawUrl: string): 'login' | 'password-recovery' | null {
  const url = parseUrl(rawUrl);
  if (!url) return null;

  const route = getRoute(url);
  if (url.protocol === `${APP_URL_SCHEME}:`) {
    if (route === 'reset-password') return 'password-recovery';
    if (route === 'login') return 'login';
    return null;
  }

  if (isPasswordRecoveryCallbackUrl(rawUrl)) return 'password-recovery';
  return null;
}

function setIfPresent(target: URLSearchParams, name: string, value: string | null): void {
  if (value) target.set(name, value);
}

export function buildAppDeepLink(
  route: AppLinkRoute,
  callbackUrl?: string | null,
  session?: RecoverySessionTokens | null,
): string {
  const destination = new URL(`${APP_URL_SCHEME}://${route}`);
  const queryParams = new URLSearchParams();
  const hashParams = new URLSearchParams();
  const callbackParams = callbackUrl ? getAuthCallbackParams(callbackUrl) : null;

  if (callbackParams) {
    setIfPresent(queryParams, 'code', callbackParams.code);
    setIfPresent(queryParams, 'state', getUrlParam(callbackUrl, 'state'));
    setIfPresent(hashParams, 'access_token', callbackParams.accessToken);
    setIfPresent(hashParams, 'refresh_token', callbackParams.refreshToken);
    setIfPresent(hashParams, 'expires_in', getUrlParam(callbackUrl, 'expires_in'));
    setIfPresent(hashParams, 'expires_at', getUrlParam(callbackUrl, 'expires_at'));
    setIfPresent(hashParams, 'token_type', getUrlParam(callbackUrl, 'token_type'));
    setIfPresent(hashParams, 'type', callbackParams.type);
    setIfPresent(hashParams, 'error', callbackParams.error);
    setIfPresent(hashParams, 'error_code', callbackParams.errorCode);
    setIfPresent(hashParams, 'error_description', callbackParams.errorDescription);
  }

  if (route === 'reset-password' && session && !hashParams.get('access_token')) {
    hashParams.set('access_token', session.access_token);
    hashParams.set('refresh_token', session.refresh_token);
    if (session.expires_in !== undefined) hashParams.set('expires_in', String(session.expires_in));
    if (session.expires_at !== undefined) hashParams.set('expires_at', String(session.expires_at));
    if (session.token_type) hashParams.set('token_type', session.token_type);
    hashParams.set('type', 'recovery');
  }

  destination.search = queryParams.toString();
  destination.hash = hashParams.toString();
  return destination.toString();
}

export function getInitialAuthCallbackUrl(): string | null {
  if (initialAuthCallbackUrl === undefined) {
    initialAuthCallbackUrl = typeof window === 'undefined' ? null : window.location.href;
  }
  return initialAuthCallbackUrl;
}

function getUrlParam(rawUrl: string, name: typeof callbackParamNames[number]): string | null {
  const url = parseUrl(rawUrl);
  if (!url) return null;
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  return getParam(url, hashParams, name);
}
