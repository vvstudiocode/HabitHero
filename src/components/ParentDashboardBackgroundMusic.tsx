import { useEffect, useRef } from 'react';
import {
  startWorldBackgroundMusic,
  stopWorldBackgroundMusic,
} from '../lib/world-background-music';
import {
  PARENT_DASHBOARD_BACKGROUND_MUSIC_SRC,
  PARENT_DASHBOARD_BACKGROUND_MUSIC_VOLUME,
} from '../lib/parent-background-music';

export function ParentDashboardBackgroundMusic({ enabled }: { enabled: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (audioRef.current) stopWorldBackgroundMusic(audioRef.current);
      audioRef.current = null;
      return undefined;
    }

    const audio = new Audio(PARENT_DASHBOARD_BACKGROUND_MUSIC_SRC);
    audio.preload = 'auto';
    audioRef.current = audio;

    const tryStartMusic = () => {
      void startWorldBackgroundMusic(audio, PARENT_DASHBOARD_BACKGROUND_MUSIC_VOLUME);
    };

    document.addEventListener('pointerdown', tryStartMusic, { passive: true });
    document.addEventListener('keydown', tryStartMusic);
    tryStartMusic();

    return () => {
      document.removeEventListener('pointerdown', tryStartMusic);
      document.removeEventListener('keydown', tryStartMusic);
      stopWorldBackgroundMusic(audio);
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [enabled]);

  return null;
}
