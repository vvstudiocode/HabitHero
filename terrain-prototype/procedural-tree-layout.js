export const FOREST_CANOPY_LOBE_COUNT = 3;
export const FOREST_BRANCH_COUNT = 2;

export const FOREST_PALETTE = Object.freeze({
  trunks: [0x9a7658, 0xad8966, 0x88694f, 0xb18f6c],
  broadleaf: [0x73946c, 0x87a977, 0x9ab784, 0x66866a, 0xa7bf8b],
});

function createForestTreeSpec({ index, x, z, groundHeight, layer, heightLimit }) {
  const seed = Math.abs(Math.imul(index + 17, 2654435761) ^ Math.round((x + 31) * 997) ^ Math.round((z + 29) * 991));
  const variation = (seed % 1000) / 1000;
  const height = heightLimit * (0.58 + variation * 0.38);
  const nearBoundaryScale = layer === 0 ? 0.72 : 1;
  const trunkHeight = height * (0.47 + variation * 0.035);

  return {
    index,
    type: 'broadleaf',
    layer,
    position: { x, y: groundHeight, z },
    rotation: variation * Math.PI * 2,
    lean: (variation - 0.5) * 0.09,
    height,
    trunkHeight,
    renderedTrunkHeight: trunkHeight + (height - trunkHeight) * 0.34,
    crownWidth: height * 0.27 * (0.9 + variation * 0.16) * nearBoundaryScale,
    trunkWidth: height * (0.04 + variation * 0.009),
    canopyStyle: 'painted-canopy',
  };
}

export function getForestBoundaryTreeSpecs({
  terrainLimit,
  groundHeight = 0,
  layers = 7,
  heightLimit = 3.2,
}) {
  if (!Number.isFinite(terrainLimit) || terrainLimit <= 0) {
    throw new Error('terrainLimit must be a positive number');
  }
  if (!Number.isInteger(layers) || layers <= 0) {
    throw new Error('layers must be a positive integer');
  }
  if (!Number.isFinite(heightLimit) || heightLimit <= 0) {
    throw new Error('heightLimit must be a positive number');
  }

  const trees = [];
  for (let layer = 0; layer < layers; layer += 1) {
    const extent = terrainLimit + 0.16 + layer * 0.62;
    const spacing = 0.74 + layer * 0.09;
    const sideCount = Math.max(8, Math.ceil((extent * 2) / spacing));

    for (let sideIndex = 0; sideIndex < sideCount; sideIndex += 1) {
      const along = -extent + ((sideIndex + 0.5) / sideCount) * extent * 2;
      const jitter = ((sideIndex * 37 + layer * 19) % 13) / 13 - 0.5;
      const offset = jitter * spacing * 0.28;
      const radialOffset = side => {
        const variation = ((sideIndex * 53 + layer * 31 + side * 11) % 17) / 17;
        return (variation - 0.15) * 0.35;
      };
      const positions = [
        { x: along + offset, z: -(extent + radialOffset(0)) },
        { x: extent + radialOffset(1), z: along - offset },
        { x: -along + offset, z: extent + radialOffset(2) },
        { x: -(extent + radialOffset(3)), z: -along - offset },
      ];

      positions.forEach(position => {
        trees.push(createForestTreeSpec({
          index: trees.length,
          x: position.x,
          z: position.z,
          groundHeight,
          layer,
          heightLimit,
        }));
      });
    }
  }

  return trees;
}
