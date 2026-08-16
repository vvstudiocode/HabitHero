import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORLD_BACKGROUND_MUSIC_SRC,
  WORLD_BACKGROUND_MUSIC_VOLUME,
  pauseWorldBackgroundMusic,
  startWorldBackgroundMusic,
  stopWorldBackgroundMusic,
  bindWorldBackgroundMusicVisibility,
  createWorldBackgroundMusicCrossfadePlayer,
} from '../src/lib/world-background-music';

class FakeAudio {
  loop = false;
  volume = 1;
  currentTime = 12;
  playCalls = 0;
  pauseCalls = 0;

  play() {
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
  }
}

class FakeCrossfadeAudio extends FakeAudio {
  duration = 10;
  preload = '';
  private timeUpdateListeners = new Set<() => void>();

  addEventListener(type: 'timeupdate', listener: () => void) {
    assert.equal(type, 'timeupdate');
    this.timeUpdateListeners.add(listener);
  }

  removeEventListener(type: 'timeupdate', listener: () => void) {
    assert.equal(type, 'timeupdate');
    this.timeUpdateListeners.delete(listener);
  }

  emitTimeUpdate() {
    for (const listener of this.timeUpdateListeners) listener();
  }
}

class FakeScheduler {
  nowValue = 0;
  private nextId = 1;
  private callbacks = new Map<number, () => void>();

  setInterval(callback: () => void) {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  }

  clearInterval(id: number) {
    this.callbacks.delete(id);
  }

  now() {
    return this.nowValue;
  }

  tick(milliseconds: number) {
    this.nowValue += milliseconds;
    for (const callback of this.callbacks.values()) callback();
  }
}

class FakeVisibilityDocument {
  visibilityState: 'visible' | 'hidden' = 'visible';
  private visibilityChangeListener: ((event: Event) => void) | null = null;

  addEventListener(type: 'visibilitychange', listener: (event: Event) => void) {
    assert.equal(type, 'visibilitychange');
    this.visibilityChangeListener = listener;
  }

  removeEventListener(type: 'visibilitychange', listener: (event: Event) => void) {
    assert.equal(type, 'visibilitychange');
    if (this.visibilityChangeListener === listener) this.visibilityChangeListener = null;
  }

  setVisibility(state: 'visible' | 'hidden') {
    this.visibilityState = state;
    this.visibilityChangeListener?.(new Event('visibilitychange'));
  }
}

test('world background music uses the supplied marimba track', () => {
  assert.equal(WORLD_BACKGROUND_MUSIC_SRC, '/audio/faespencer-monday-marimba-194523.mp3');
  assert.equal(WORLD_BACKGROUND_MUSIC_VOLUME, 0.24);
});

test('world background music starts quietly and loops', async () => {
  const audio = new FakeAudio();

  const didPlay = await startWorldBackgroundMusic(audio);

  assert.equal(didPlay, true);
  assert.equal(audio.loop, true);
  assert.equal(audio.volume, WORLD_BACKGROUND_MUSIC_VOLUME);
  assert.equal(audio.playCalls, 1);
  assert.equal(audio.currentTime, 12);
});

test('world background music pauses without resetting when the world is covered', () => {
  const audio = new FakeAudio();

  pauseWorldBackgroundMusic(audio);

  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.currentTime, 12);
});

test('world background music stops and resets when the world unmounts', () => {
  const audio = new FakeAudio();

  stopWorldBackgroundMusic(audio);

  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.currentTime, 0);
});

test('world background music crossfades into the next loop before the current loop ends', async () => {
  const audios: FakeCrossfadeAudio[] = [];
  const scheduler = new FakeScheduler();
  const player = createWorldBackgroundMusicCrossfadePlayer({
    src: WORLD_BACKGROUND_MUSIC_SRC,
    volume: WORLD_BACKGROUND_MUSIC_VOLUME,
    fadeDurationSeconds: 2,
    audioFactory: () => {
      const audio = new FakeCrossfadeAudio();
      audios.push(audio);
      return audio;
    },
    scheduler,
  });

  const didPlay = await player.start();
  const currentAudio = audios[0];
  const nextAudio = audios[1];

  assert.equal(didPlay, true);
  assert.equal(audios.length, 2);
  assert.equal(currentAudio.playCalls, 1);
  assert.equal(nextAudio.playCalls, 0);
  assert.equal(currentAudio.loop, false);
  assert.equal(nextAudio.loop, false);
  assert.equal(currentAudio.volume, WORLD_BACKGROUND_MUSIC_VOLUME);
  assert.equal(nextAudio.volume, 0);

  currentAudio.currentTime = 8.1;
  currentAudio.emitTimeUpdate();
  await Promise.resolve();

  assert.equal(nextAudio.playCalls, 1);
  assert.equal(nextAudio.currentTime, 0);
  assert.equal(nextAudio.volume, 0);

  scheduler.tick(1000);
  assert.ok(currentAudio.volume > 0);
  assert.ok(currentAudio.volume < WORLD_BACKGROUND_MUSIC_VOLUME);
  assert.ok(nextAudio.volume > 0);
  assert.ok(nextAudio.volume < WORLD_BACKGROUND_MUSIC_VOLUME);

  scheduler.tick(1000);
  assert.equal(currentAudio.volume, 0);
  assert.equal(nextAudio.volume, WORLD_BACKGROUND_MUSIC_VOLUME);
  assert.equal(currentAudio.pauseCalls, 1);

  player.dispose();
});

test('world background music crossfade player stops and resets both audio decks', async () => {
  const audios: FakeCrossfadeAudio[] = [];
  const player = createWorldBackgroundMusicCrossfadePlayer({
    src: WORLD_BACKGROUND_MUSIC_SRC,
    audioFactory: () => {
      const audio = new FakeCrossfadeAudio();
      audios.push(audio);
      return audio;
    },
  });

  await player.start();
  audios[0].currentTime = 4;
  audios[1].currentTime = 6;

  player.stop();

  assert.equal(audios[0].pauseCalls, 1);
  assert.equal(audios[1].pauseCalls, 1);
  assert.equal(audios[0].currentTime, 0);
  assert.equal(audios[1].currentTime, 0);

  player.dispose();
});

test('world background music shortens the fade when timeupdate arrives very close to the end', async () => {
  const audios: FakeCrossfadeAudio[] = [];
  const scheduler = new FakeScheduler();
  const player = createWorldBackgroundMusicCrossfadePlayer({
    src: WORLD_BACKGROUND_MUSIC_SRC,
    volume: WORLD_BACKGROUND_MUSIC_VOLUME,
    fadeDurationSeconds: 2,
    audioFactory: () => {
      const audio = new FakeCrossfadeAudio();
      audios.push(audio);
      return audio;
    },
    scheduler,
  });

  await player.start();
  audios[0].currentTime = 9.8;
  audios[0].emitTimeUpdate();
  await Promise.resolve();

  scheduler.tick(200);

  assert.equal(audios[0].volume, 0);
  assert.equal(audios[1].volume, WORLD_BACKGROUND_MUSIC_VOLUME);
  assert.equal(audios[0].pauseCalls, 1);

  player.dispose();
});

test('world background music stops when the app becomes hidden and removes its listener', () => {
  const audio = new FakeAudio();
  const page = new FakeVisibilityDocument();
  let visibleCalls = 0;
  const cleanup = bindWorldBackgroundMusicVisibility(audio, () => { visibleCalls += 1; }, page);

  page.setVisibility('hidden');

  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.currentTime, 0);

  page.setVisibility('visible');
  assert.equal(audio.pauseCalls, 1);
  assert.equal(visibleCalls, 1);

  cleanup();
  audio.currentTime = 9;
  page.setVisibility('hidden');
  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.currentTime, 9);
  page.setVisibility('visible');
  assert.equal(visibleCalls, 1);
});
