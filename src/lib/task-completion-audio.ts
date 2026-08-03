export const TIMER_COMPLETION_MUSIC_SRC = '/audio/timer-complete.mp3';

export interface TimerCompletionAudio {
  loop: boolean;
  currentTime: number;
  play: () => Promise<void> | void;
  pause: () => void;
}

export function startTimerCompletionMusic(audio: TimerCompletionAudio): Promise<boolean> {
  audio.loop = true;
  audio.currentTime = 0;

  try {
    return Promise.resolve(audio.play())
      .then(() => true)
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

export function stopTimerCompletionMusic(audio: TimerCompletionAudio): void {
  audio.pause();
  audio.currentTime = 0;
}
