import { useEffect, useRef } from 'react';
import {
  bindWorldBackgroundMusicVisibility,
  createWorldBackgroundMusicCrossfadePlayer,
  getWorldBackgroundMusicConfig,
  WorldBackgroundMusicCrossfadePlayer,
} from '../lib/world-background-music';
import type { WorldLocation } from '../features/world/world-location';

export function ChildDashboardBackgroundMusic({ enabled, worldLocation }: { enabled: boolean; worldLocation: WorldLocation }) {
  const playerRef = useRef<WorldBackgroundMusicCrossfadePlayer | null>(null);

  useEffect(() => {
    if (!enabled) {
      playerRef.current?.stop();
      playerRef.current?.dispose();
      playerRef.current = null;
      return undefined;
    }

    const musicConfig = getWorldBackgroundMusicConfig(worldLocation);
    const player = createWorldBackgroundMusicCrossfadePlayer(musicConfig);
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
  }, [enabled, worldLocation]);

  return null;
}
