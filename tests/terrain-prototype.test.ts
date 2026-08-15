import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createTerrainLayout,
  getTilePosition,
} from '../terrain-prototype/terrain-layout.js';

describe('terrain prototype layout', () => {
  it('builds a 5 by 5 terrain and marks exactly 18 center-nearest tree tiles', () => {
    const tiles = createTerrainLayout({ gridSize: 5, treeCount: 18 });
    const treeTiles = tiles.filter(tile => tile.isTree);

    assert.equal(tiles.length, 25);
    assert.equal(treeTiles.length, 18);
    assert.equal(tiles.find(tile => tile.row === 2 && tile.col === 2)?.isTree, true);
    assert.equal(new Set(tiles.map(tile => `${tile.row}:${tile.col}`)).size, 25);

    const nearestTreeDistance = Math.max(...treeTiles.map(tile => tile.distance));
    const farthestNonTreeDistance = Math.min(...tiles.filter(tile => !tile.isTree).map(tile => tile.distance));
    assert.equal(nearestTreeDistance <= farthestNonTreeDistance, true);
  });

  it('places the grid symmetrically around its center', () => {
    assert.deepEqual(getTilePosition(0, 0, 2, 5), { x: -4, z: -4 });
    assert.deepEqual(getTilePosition(2, 2, 2, 5), { x: 0, z: 0 });
    assert.deepEqual(getTilePosition(4, 4, 2, 5), { x: 4, z: 4 });
  });

  it('can reserve only the exact center tile for a tree', () => {
    const treeTiles = createTerrainLayout({ gridSize: 5, treeCount: 1 }).filter(tile => tile.isTree);

    assert.deepEqual(treeTiles.map(tile => [tile.row, tile.col]), [[2, 2]]);
  });

  it('supports a 9 by 9 terrain around the central tree tile', () => {
    const tiles = createTerrainLayout({ gridSize: 9, treeCount: 1 });
    const treeTiles = tiles.filter(tile => tile.isTree);

    assert.equal(tiles.length, 81);
    assert.deepEqual(treeTiles.map(tile => [tile.row, tile.col]), [[4, 4]]);
  });

  it('rejects invalid grid values', () => {
    assert.throws(() => createTerrainLayout({ gridSize: 4, treeCount: 18 }), /odd integer/);
    assert.throws(() => createTerrainLayout({ gridSize: 5, treeCount: 26 }), /treeCount/);
  });
});
