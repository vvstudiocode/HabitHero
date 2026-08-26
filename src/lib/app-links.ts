import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  buildAppDeepLink,
  type AppLinkRoute,
  type RecoverySessionTokens,
} from './auth-deep-link';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function openAppLink(
  route: AppLinkRoute,
  callbackUrl?: string | null,
  session?: RecoverySessionTokens | null,
): boolean {
  if (typeof window === 'undefined' || isNativeApp()) return false;
  window.location.assign(buildAppDeepLink(route, callbackUrl, session));
  return true;
}

export async function registerAppLinkListener(
  onUrl: (url: string) => void | Promise<void>,
): Promise<() => void> {
  if (!isNativeApp()) return () => undefined;

  const listener: PluginListenerHandle = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    void onUrl(url);
  });
  const launchUrl = await CapacitorApp.getLaunchUrl();
  if (launchUrl?.url) void onUrl(launchUrl.url);

  return () => {
    void listener.remove();
  };
}
