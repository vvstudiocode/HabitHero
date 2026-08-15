import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORLD_BACKGROUND_MUSIC_SRC,
  WORLD_BACKGROUND_MUSIC_VOLUME,
  pauseWorldBackgroundMusic,
  startWorldBackgroundMusic,
  stopWorldBackgroundMusic,
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
