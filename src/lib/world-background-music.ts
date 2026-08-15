export const WORLD_BACKGROUND_MUSIC_SRC = '/audio/faespencer-monday-marimba-194523.mp3';
export const WORLD_BACKGROUND_MUSIC_VOLUME = 0.24;

export interface WorldBackgroundAudio {
  loop: boolean;
  volume: number;
  currentTime: number;
  play: () => Promise<void> | void;
  pause: () => void;
}

export function startWorldBackgroundMusic(
  audio: WorldBackgroundAudio,
  volume = WORLD_BACKGROUND_MUSIC_VOLUME,
): Promise<boolean> {
  audio.loop = true;
  audio.volume = volume;

  try {
    return Promise.resolve(audio.play())
      .then(() => true)
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

export function pauseWorldBackgroundMusic(audio: WorldBackgroundAudio): void {
  audio.pause();
}

export function stopWorldBackgroundMusic(audio: WorldBackgroundAudio): void {
  audio.pause();
  audio.currentTime = 0;
}
