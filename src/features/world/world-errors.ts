function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
}

export function isWorldRevisionConflict(error: unknown): boolean {
  const message = getErrorText(error).toLowerCase();
  return message.includes('world revision conflict')
    || (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'revision-conflict');
}

export function toWorldMutationErrorMessage(error: unknown, fallback: string): string {
  const message = getErrorText(error).toLowerCase();
  if (message.includes('child_world_entities_rotation_y_check') || message.includes('rotation_y')) {
    return '家具旋轉角度超出範圍，請稍微調整後再試一次。';
  }
  if (message.includes('decorations cannot overlap')) {
    return '這裡有其他家具，請換個位置。';
  }
  if (message.includes('inside a protected area')) {
    return '這個位置不能放置家具。';
  }
  if (message.includes('outside the playable area')) {
    return '請把家具移回看得到的草地。';
  }
  if (isWorldRevisionConflict(error) || message.includes('世界剛被好友更新')) {
    return '世界剛剛有變化，請再試一次。';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return '目前無法連線，請檢查網路後再試一次。';
  }
  return fallback;
}
