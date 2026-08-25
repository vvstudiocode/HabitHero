import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createWorldMutationGate } from '../src/features/world/world-mutation-gate';

const storeSource = readFileSync(new URL('../src/store.tsx', import.meta.url), 'utf8');
const worldSocialLayerSource = readFileSync(new URL('../src/features/world-social/WorldSocialLayer.tsx', import.meta.url), 'utf8');

test('coalesces overlapping world mutations for the same child', async () => {
  const gate = createWorldMutationGate();
  let resolveMutation: (() => void) | undefined;
  let calls = 0;
  const operation = async () => {
    calls += 1;
    await new Promise<void>((resolve) => { resolveMutation = resolve; });
    return 'done';
  };

  const first = gate.run('child-1', operation);
  const duplicate = gate.run('child-1', operation);
  await Promise.resolve();
  resolveMutation?.();

  assert.equal(await first, 'done');
  assert.equal(await duplicate, 'done');
  assert.equal(calls, 1);
});

test('allows a new world mutation after the previous one settles', async () => {
  const gate = createWorldMutationGate();
  let calls = 0;
  const operation = async () => {
    calls += 1;
    return calls;
  };

  assert.equal(await gate.run('child-1', operation), 1);
  assert.equal(await gate.run('child-1', operation), 2);
});

test('blocks further world mutations after a revision conflict until data is refreshed', async () => {
  const gate = createWorldMutationGate();
  let calls = 0;

  gate.block('child-1');
  await assert.rejects(
    gate.run('child-1', async () => {
      calls += 1;
      return 'should not run';
    }),
    /world revision conflict/,
  );
  assert.equal(calls, 0);

  gate.clear('child-1');
  assert.equal(await gate.run('child-1', async () => {
    calls += 1;
    return 'refreshed';
  }), 'refreshed');
  assert.equal(calls, 1);
});

test('does not reopen a blocked world mutation gate during automatic refresh', () => {
  const retrySection = storeSource.slice(
    storeSource.indexOf('const retry = useCallback'),
    storeSource.indexOf('useEffect(() => {\n    worldMutationGateRef.current.clear'),
  );
  assert.match(retrySection, /recoverWorldMutations/);
  assert.match(retrySection, /if \(recoverWorldMutations\) worldMutationGateRef\.current\.clear\(\);/);
  assert.doesNotMatch(retrySection, /setStale\(false\);[\s\S]*worldMutationGateRef\.current\.clear\(\);/);
});

test('reconciles the provider revision after pet world RPCs', () => {
  const worldActionSection = storeSource.slice(
    storeSource.lastIndexOf('setFollowingPets:'),
    storeSource.lastIndexOf('setFamilyGameItemPrice:'),
  );

  assert.equal((worldActionSection.match(/reconcileWorldMutationResult\(childId, mutate\(/g) ?? []).length, 3);
});

test('recovers the own-world mutation gate after a revision conflict', () => {
  assert.match(worldSocialLayerSource, /const reloadOwnWorld = useCallback\(\(\) => retry\(\{ recoverWorldMutations: true \}\), \[retry\]\)/);
  assert.match(worldSocialLayerSource, /reloadSnapshot: worldOwnerChildProfileId !== childProfileId \? reloadVisitorWorld : reloadOwnWorld/);
});
