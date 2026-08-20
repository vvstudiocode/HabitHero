export async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: string; message?: string };
        if (body.error || body.message) return body.error ?? body.message ?? 'Edge Function 執行失敗。';
      } catch {
        // Fall through to the SDK error message when the response is not JSON.
      }
    }
  }
  return error instanceof Error ? error.message : 'Edge Function 執行失敗，請重試。';
}
