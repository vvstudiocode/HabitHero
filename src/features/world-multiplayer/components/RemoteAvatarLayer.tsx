import type { RemoteAvatarStateSnapshot } from '../remote-avatar-state';

interface RemoteAvatarLayerProps {
  avatars: readonly RemoteAvatarStateSnapshot[];
}

export function RemoteAvatarLayer({ avatars }: RemoteAvatarLayerProps) {
  return (
    <div className="sr-only" aria-live="polite" aria-label="好友世界在線人物">
      {avatars.length > 0 ? `目前有 ${avatars.length} 位好友在線。` : '目前沒有其他好友在線。'}
    </div>
  );
}
