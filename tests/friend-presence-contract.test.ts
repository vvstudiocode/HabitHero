import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('friend presence observes live world presence instead of trusting the static offline flag', () => {
  const hook = readFileSync(new URL('../src/features/friends/hooks/use-friend-presence.ts', import.meta.url), 'utf8');
  assert.match(hook, /getFriendWorldLiveTopic/);
  assert.match(hook, /presenceState/);
  assert.match(hook, /childProfileId/);
  assert.match(hook, /removeChannel/);
});
