export const WORLD_BACKGROUND_MUSIC_SRC = '/audio/faespencer-monday-marimba-194523.mp3';
export const WORLD_BACKGROUND_MUSIC_VOLUME = 0.24;
export const WORLD_BACKGROUND_MUSIC_CROSSFADE_SECONDS = 2;

export interface WorldBackgroundAudio {
  loop: boolean;
  volume: number;
  currentTime: number;
  play: () => Promise<void> | void;
  pause: () => void;
}

export interface CrossfadeBackgroundAudio extends WorldBackgroundAudio {
  duration: number;
  preload: string;
  addEventListener: (type: 'timeupdate', listener: () => void) => void;
  removeEventListener: (type: 'timeupdate', listener: () => void) => void;
}

export type BackgroundMusicTimerHandle = ReturnType<typeof setInterval> | number;

export interface BackgroundMusicScheduler {
  setInterval: (callback: () => void, delay: number) => BackgroundMusicTimerHandle;
  clearInterval: (handle: BackgroundMusicTimerHandle) => void;
  now: () => number;
}

export interface WorldBackgroundMusicCrossfadePlayer {
  start: () => Promise<boolean>;
  pause: () => void;
  stop: () => void;
  dispose: () => void;
}

export interface WorldBackgroundMusicCrossfadeOptions {
  src: string;
  volume?: number;
  fadeDurationSeconds?: number;
  audioFactory?: (src: string) => CrossfadeBackgroundAudio;
  scheduler?: BackgroundMusicScheduler;
}

export interface BackgroundMusicVisibilityDocument {
  visibilityState: 'visible' | 'hidden';
  addEventListener: (type: 'visibilitychange', listener: (event: Event) => void) => void;
  removeEventListener: (type: 'visibilitychange', listener: (event: Event) => void) => void;
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

const defaultBackgroundMusicScheduler: BackgroundMusicScheduler = {
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (handle) => clearInterval(handle),
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
};

function createNativeCrossfadeAudio(src: string): CrossfadeBackgroundAudio {
  return new Audio(src) as unknown as CrossfadeBackgroundAudio;
}

export function createWorldBackgroundMusicCrossfadePlayer({
  src,
  volume = WORLD_BACKGROUND_MUSIC_VOLUME,
  fadeDurationSeconds = WORLD_BACKGROUND_MUSIC_CROSSFADE_SECONDS,
  audioFactory = createNativeCrossfadeAudio,
  scheduler = defaultBackgroundMusicScheduler,
}: WorldBackgroundMusicCrossfadeOptions): WorldBackgroundMusicCrossfadePlayer {
  const audios = [audioFactory(src), audioFactory(src)];
  const crossfadeVolume = Math.max(0, Math.min(1, volume));
  const crossfadeDurationMs = Math.max(1, fadeDurationSeconds * 1000);
  let activeIndex = 0;
  let fadeTimer: BackgroundMusicTimerHandle | null = null;
  let isCrossfading = false;
  let isDisposed = false;

  for (const [index, audio] of audios.entries()) {
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = index === activeIndex ? crossfadeVolume : 0;
  }

  const clearFadeTimer = () => {
    if (fadeTimer === null) return;
    scheduler.clearInterval(fadeTimer);
    fadeTimer = null;
  };

  const finishCrossfade = (currentAudio: CrossfadeBackgroundAudio, nextAudio: CrossfadeBackgroundAudio) => {
    clearFadeTimer();
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.volume = 0;
    nextAudio.volume = crossfadeVolume;
    activeIndex = audios.indexOf(nextAudio);
    isCrossfading = false;
  };

  const cancelCrossfade = () => {
    clearFadeTimer();
    isCrossfading = false;
    audios[activeIndex].volume = crossfadeVolume;
    audios[1 - activeIndex].volume = 0;
  };

  const beginCrossfade = () => {
    if (isDisposed || isCrossfading) return;

    const currentAudio = audios[activeIndex];
    const nextAudio = audios[1 - activeIndex];
    const remainingDurationMs = Math.max(1, (currentAudio.duration - currentAudio.currentTime) * 1000);
    const activeFadeDurationMs = Math.min(crossfadeDurationMs, remainingDurationMs);
    isCrossfading = true;
    nextAudio.pause();
    nextAudio.currentTime = 0;
    nextAudio.volume = 0;

    try {
      const playResult = nextAudio.play();
      const startedAt = scheduler.now();
      fadeTimer = scheduler.setInterval(() => {
        const progress = Math.min(1, Math.max(0, (scheduler.now() - startedAt) / activeFadeDurationMs));
        currentAudio.volume = crossfadeVolume * (1 - progress);
        nextAudio.volume = crossfadeVolume * progress;
        if (progress >= 1) finishCrossfade(currentAudio, nextAudio);
      }, 50);
      Promise.resolve(playResult)
        .catch(() => {
          if (isDisposed || !isCrossfading) return;
          nextAudio.pause();
          nextAudio.currentTime = 0;
          cancelCrossfade();
        });
    } catch {
      nextAudio.pause();
      nextAudio.currentTime = 0;
      cancelCrossfade();
    }
  };

  const handleTimeUpdate = () => {
    const currentAudio = audios[activeIndex];
    if (isCrossfading || !Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) return;
    if (currentAudio.duration - currentAudio.currentTime <= fadeDurationSeconds) beginCrossfade();
  };

  const timeUpdateListeners = audios.map((audio) => {
    const listener = () => {
      if (audios[activeIndex] === audio) handleTimeUpdate();
    };
    audio.addEventListener('timeupdate', listener);
    return listener;
  });

  return {
    start: () => {
      if (isDisposed) return Promise.resolve(false);
      const currentAudio = audios[activeIndex];
      currentAudio.volume = crossfadeVolume;
      try {
        return Promise.resolve(currentAudio.play())
          .then(() => true)
          .catch(() => false);
      } catch {
        return Promise.resolve(false);
      }
    },
    pause: () => {
      cancelCrossfade();
      for (const audio of audios) audio.pause();
    },
    stop: () => {
      cancelCrossfade();
      for (const audio of audios) {
        audio.pause();
        audio.currentTime = 0;
      }
    },
    dispose: () => {
      if (isDisposed) return;
      for (const [index, audio] of audios.entries()) {
        audio.removeEventListener('timeupdate', timeUpdateListeners[index]);
      }
      clearFadeTimer();
      isCrossfading = false;
      isDisposed = true;
      for (const audio of audios) {
        audio.pause();
        audio.currentTime = 0;
      }
    },
  };
}

export function bindWorldBackgroundMusicVisibility(
  audio: WorldBackgroundAudio | Pick<WorldBackgroundMusicCrossfadePlayer, 'stop'>,
  onVisible: () => void,
  documentLike: BackgroundMusicVisibilityDocument = document,
): () => void {
  const handleVisibilityChange = () => {
    if (documentLike.visibilityState === 'hidden') {
      if ('stop' in audio) audio.stop();
      else stopWorldBackgroundMusic(audio);
      return;
    }
    onVisible();
  };

  documentLike.addEventListener('visibilitychange', handleVisibilityChange);
  return () => documentLike.removeEventListener('visibilitychange', handleVisibilityChange);
}
