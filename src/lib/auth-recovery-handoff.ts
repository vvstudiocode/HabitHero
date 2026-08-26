import { getSession, toAuthErrorMessage } from '../auth';
import { getAuthCallbackParams } from './auth-deep-link';
import { openAppLink } from './app-links';

export async function openPasswordRecoveryInApp(
  initialAuthCallbackUrl: string | null,
  onError: (message: string) => void,
): Promise<void> {
  const callbackUrl = initialAuthCallbackUrl ?? (typeof window === 'undefined' ? null : window.location.href);
  try {
    const { data, error: sessionError } = await getSession();
    if (sessionError) throw sessionError;
    const params = callbackUrl ? getAuthCallbackParams(callbackUrl) : null;
    const hasRecoveryPayload = Boolean(params?.accessToken && params.refreshToken || params?.code);
    if (!hasRecoveryPayload && !data.session) {
      onError('目前找不到有效的重設狀態，請重新點擊 Email 中的重設連結。');
      return;
    }
    if (!openAppLink('reset-password', callbackUrl, data.session)) {
      onError('目前無法開啟 App，仍可直接在此頁完成密碼重設。');
    }
  } catch (failure) {
    onError(toAuthErrorMessage(failure));
  }
}
