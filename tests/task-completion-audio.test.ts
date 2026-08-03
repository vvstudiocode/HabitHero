import assert from 'node:assert/strict';
import test from 'node:test';
import { startTimerCompletionMusic, stopTimerCompletionMusic } from '../src/lib/task-completion-audio';

class FakeAudio {
  loop = false;
  currentTime = 4;
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

test('timer completion music starts from the beginning and loops', async () => {
  const audio = new FakeAudio();

  await startTimerCompletionMusic(audio);

  assert.equal(audio.loop, true);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.playCalls, 1);
});

test('timer completion music stops and resets its position', () => {
  const audio = new FakeAudio();

  stopTimerCompletionMusic(audio);

  assert.equal(audio.pauseCalls, 1);
  assert.equal(audio.currentTime, 0);
});
