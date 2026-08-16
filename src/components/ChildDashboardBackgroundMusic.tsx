import { useEffect, useRef } from 'react';
import {
  bindWorldBackgroundMusicVisibility,
  createWorldBackgroundMusicCrossfadePlayer,
  WorldBackgroundMusicCrossfadePlayer,
  WORLD_BACKGROUND_MUSIC_SRC,
} from '../lib/world-background-music';

export function ChildDashboardBackgroundMusic({ enabled }: { enabled: boolean }) {
  const playerRef = useRef<WorldBackgroundMusicCrossfadePlayer | null>(null);

  useEffect(() => {
    if (!enabled) {
      playerRef.current?.stop();
      playerRef.current?.dispose();
      playerRef.current = null;
      return undefined;
    }

    const player = createWorldBackgroundMusicCrossfadePlayer({
      src: WORLD_BACKGROUND_MUSIC_SRC,
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
