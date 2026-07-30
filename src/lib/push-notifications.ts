import { Capacitor } from '@capacitor/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PushNotifications, type ActionPerformed, type PushNotificationSchema } from '@capacitor/push-notifications';
import type { NotificationPermission } from './notification-preferences';

export interface PushDeviceContext {
  supabase: SupabaseClient;
  familyId: string;
  profileId: string;
  childProfileId: string | null;
}

export interface PushListeners {
  onReceived?: (notification: PushNotificationSchema) => void;
  onAction?: (notification: ActionPerformed) => void;
}

export const isIosPushSupported = () => Capacitor.getPlatform() === 'ios';

export async function getIosPushPermission(): Promise<NotificationPermission> {
  if (!isIosPushSupported()) return 'unsupported';
  const permission = await PushNotifications.checkPermissions();
  return permission.receive as NotificationPermission;
}

export async function addPushListeners(listeners: PushListeners) {
  if (!isIosPushSupported()) return () => undefined;
  const handles = await Promise.all([
    listeners.onReceived
      ? PushNotifications.addListener('pushNotificationReceived', listeners.onReceived)
      : Promise.resolve(null),
    listeners.onAction
      ? PushNotifications.addListener('pushNotificationActionPerformed', listeners.onAction)
      : Promise.resolve(null),
  ]);
  return () => {
    for (const handle of handles) void handle?.remove();
  };
}

export async function requestAndRegisterIosPush(context: PushDeviceContext) {
  if (!isIosPushSupported()) return { permission: 'unsupported' as const, token: null };

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return { permission: permission.receive as NotificationPermission, token: null };

  const token = await new Promise<string>((resolve, reject) => {
    let settled = false;
    let registrationHandle: { remove: () => Promise<void> } | null = null;
    let errorHandle: { remove: () => Promise<void> } | null = null;
    const finish = (error?: Error, value?: string) => {
      if (settled) return;
      settled = true;
      void registrationHandle?.remove();
      void errorHandle?.remove();
      if (error) reject(error);
      else resolve(value!);
    };
    void Promise.all([
      PushNotifications.addListener('registration', registration => finish(undefined, registration.value)),
      PushNotifications.addListener('registrationError', error => finish(new Error(error.error))),
    ]).then(([registered, failed]) => {
      registrationHandle = registered;
      errorHandle = failed;
      void PushNotifications.register().catch(error => finish(error instanceof Error ? error : new Error('Push registration failed')));
    }).catch(error => finish(error instanceof Error ? error : new Error('Push listener setup failed')));
  });

  const { error } = await context.supabase.from('push_devices').upsert({
    family_id: context.familyId,
    profile_id: context.profileId,
    child_profile_id: context.childProfileId,
    platform: 'ios',
    token,
    enabled: true,
  }, { onConflict: 'profile_id,token' });
  if (error) throw new Error(error.message);
  return { permission: 'granted' as const, token };
}

export async function readNotificationPreference(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase.from('profiles').select('notifications_enabled').eq('id', profileId).single();
  if (error) throw new Error(error.message);
  return Boolean(data?.notifications_enabled);
}

export async function setNotificationPreference(supabase: SupabaseClient, profileId: string, enabled: boolean) {
  const { error } = await supabase.from('profiles').update({ notifications_enabled: enabled }).eq('id', profileId);
  if (error) throw new Error(error.message);
  if (!enabled) {
    const { error: deviceError } = await supabase.from('push_devices').update({ enabled: false }).eq('profile_id', profileId);
    if (deviceError) throw new Error(deviceError.message);
  }
}

export async function disablePushDevicesForProfile(supabase: SupabaseClient, profileId: string) {
  const { error } = await supabase.from('push_devices').update({ enabled: false }).eq('profile_id', profileId);
  if (error) throw new Error(error.message);
}

export async function notifyTaskCreated(supabase: SupabaseClient, taskId: string) {
  if (!taskId) return;
  const { error } = await supabase.functions.invoke('notify-task-created', { body: { taskId } });
  if (error) throw new Error(error.message);
}
