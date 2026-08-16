import { useEffect, useRef } from 'react';
import {
  bindWorldBackgroundMusicVisibility,
  createWorldBackgroundMusicCrossfadePlayer,
  WorldBackgroundMusicCrossfadePlayer,
} from '../lib/world-background-music';
import {
  PARENT_DASHBOARD_BACKGROUND_MUSIC_SRC,
  PARENT_DASHBOARD_BACKGROUND_MUSIC_VOLUME,
} from '../lib/parent-background-music';

export function ParentDashboardBackgroundMusic({ enabled }: { enabled: boolean }) {
  const playerRef = useRef<WorldBackgroundMusicCrossfadePlayer | null>(null);

  useEffect(() => {
    if (!enabled) {
      playerRef.current?.stop();
      playerRef.current?.dispose();
      playerRef.current = null;
      return undefined;
    }

    const player = createWorldBackgroundMusicCrossfadePlayer({
      src: PARENT_DASHBOARD_BACKGROUND_MUSIC_SRC,
      volume: PARENT_DASHBOARD_BACKGROUND_MUSIC_VOLUME,
    });
    playerRef.current = player;

    const tryStartMusic = () => {
      if (document.visibilityState === 'hidden') return;
      void player.start();
    };

    const removeVisibilityListener = bindWorldBackgroundMusicVisibility(player, tryStartMusic);

    document.addEventListener('pointerdown', tryStartMusic, { passive: true });
    document.addEventListener('keydown', tryStartMusic);
    tryStartMusic();

    return () => {
      document.removeEventListener('pointerdown', tryStartMusic);
      document.removeEventListener('keydown', tryStartMusic);
      removeVisibilityListener();
      player.stop();
      player.dispose();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [enabled]);

  return null;
}
