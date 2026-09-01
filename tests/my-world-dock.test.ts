import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('my world dock', () => {
  it('is an accessible icon control for entering and returning from the private world', () => {
    const dock = read('../src/features/world-social/components/MyWorldDock.tsx');
    assert.match(dock, /Home/);
    assert.match(dock, /進入我的世界/);
    assert.match(dock, /返回晨光村/);
    assert.match(dock, /返回雲工房/);
    assert.match(dock, /min-h-11/);
    assert.match(dock, /aria-label=/);
  });

  it('renders the my-world dock before the friend dock', () => {
    const social = read('../src/features/world-social/WorldSocialLayer.tsx');
    assert.match(social, /hh-world-social-dock-group/);
    assert.match(social, /<MyWorldDock[\s\S]*?<FriendDock/);
    assert.match(social, /onEnterMyWorld/);
  });

  it('always enters my world from a public world, including Forest Valley', () => {
    const dock = read('../src/features/world-social/components/MyWorldDock.tsx');
    assert.doesNotMatch(dock, /worldLocation === 'forest-valley'\s*\?\s*'sunrise-village'/);
    assert.match(dock, /const nextLocation = isInMyWorld \? returnLocation : 'my-world'/);
    assert.match(dock, /returnLocation === 'forest-valley'/);
    assert.match(dock, /returnLocation === 'cloud-workshop'/);
    assert.match(dock, /返回雲工房/);
  });
});
