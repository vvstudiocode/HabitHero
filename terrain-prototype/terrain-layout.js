export const DEFAULT_GRID_SIZE = 5;
export const DEFAULT_TREE_COUNT = 18;

const isOddInteger = value => Number.isInteger(value) && value > 0 && value % 2 === 1;

export function createTerrainLayout({
  gridSize = DEFAULT_GRID_SIZE,
  treeCount = DEFAULT_TREE_COUNT,
} = {}) {
  if (!isOddInteger(gridSize)) {
    throw new Error('gridSize must be a positive odd integer');
  }

  const tileCount = gridSize * gridSize;
  if (!Number.isInteger(treeCount) || treeCount < 0 || treeCount > tileCount) {
    throw new Error('treeCount must be between 0 and the total tile count');
  }

  const center = (gridSize - 1) / 2;
  const tiles = Array.from({ length: tileCount }, (_, index) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const distance = Math.hypot(row - center, col - center);

    return {
      row,
      col,
      key: `${row}:${col}`,
      distance,
      isTree: false,
    };
  });

  const centerNearestKeys = new Set(
    [...tiles]
      .sort((first, second) => (
        first.distance - second.distance
        || first.row - second.row
        || first.col - second.col
      ))
      .slice(0, treeCount)
      .map(tile => tile.key),
  );

  return tiles.map(tile => ({ ...tile, isTree: centerNearestKeys.has(tile.key) }));
}

export function getTilePosition(row, col, tileSize, gridSize = DEFAULT_GRID_SIZE) {
  const center = (gridSize - 1) / 2;
  return {
    x: (col - center) * tileSize,
    z: (row - center) * tileSize,
  };
}
