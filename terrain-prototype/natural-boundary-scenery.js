export const BOUNDARY_SCENERY_TYPES = Object.freeze([
  'stone',
  'shrub',
  'log',
]);

const STONE_COLORS = Object.freeze([0x8c9a82, 0xa4aa8c, 0x777f70, 0xb1ad91]);
const SHRUB_COLORS = Object.freeze([0x5e8d63, 0x739b68, 0x86a675, 0x4f795b]);

function createRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function requirePositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}

function createPerimeterPosition(random, index, boundary, inset) {
  const side = index % 4;
  const along = -boundary + 0.85 + random() * (boundary * 2 - 1.7);
  const edge = boundary - inset - random() * 0.32;
  if (side === 0) return { x: along, z: edge };
  if (side === 1) return { x: edge, z: along };
  if (side === 2) return { x: -along, z: -edge };
  return { x: -edge, z: -along };
}

export function createBoundarySceneryLayout({
  boundary = 4.8,
  quality = 'high',
  seed = 20260811,
} = {}) {
  requirePositiveNumber(boundary, 'boundary');
  const random = createRandom(seed);
  const highQuality = quality !== 'low';
  const stoneCount = highQuality ? 16 : 9;
  const shrubCount = highQuality ? 9 : 5;
  const items = [];

  for (let index = 0; index < stoneCount; index += 1) {
    const position = createPerimeterPosition(random, index, boundary, 0.28);
    items.push({
      type: 'stone',
      ...position,
      y: 0.05,
      scale: 0.55 + random() * 0.48,
      rotation: random() * Math.PI,
      color: STONE_COLORS[index % STONE_COLORS.length],
    });
  }

  for (let index = 0; index < shrubCount; index += 1) {
    const position = createPerimeterPosition(random, index + 1, boundary, 0.58);
    items.push({
      type: 'shrub',
      ...position,
      y: 0.16,
      scale: 0.52 + random() * 0.3,
      rotation: random() * Math.PI * 2,
      color: SHRUB_COLORS[index % SHRUB_COLORS.length],
    });
  }

  items.push(
    { type: 'log', x: -3.5, y: 0.14, z: 3.55, scale: 0.9, rotation: -0.38, color: 0x795b45 },
    { type: 'log', x: 3.45, y: 0.14, z: -3.62, scale: 0.74, rotation: 0.62, color: 0x88664a },
  );

  return items;
}

function createShrub(THREE, geometry, material) {
  const shrub = new THREE.Group();
  const lower = new THREE.Mesh(geometry, material);
  const upper = new THREE.Mesh(geometry, material);
  lower.scale.set(1.05, 0.72, 0.9);
  upper.position.set(0.2, 0.22, -0.08);
  upper.scale.set(0.72, 0.62, 0.66);
  shrub.add(lower, upper);
  return shrub;
}

export function createNaturalBoundaryScenery(THREE, options = {}) {
  const layout = createBoundarySceneryLayout(options);
  const group = new THREE.Group();
  group.name = 'natural-air-wall-transition';

  const stoneGeometry = new THREE.IcosahedronGeometry(0.23, 1);
  const shrubGeometry = new THREE.IcosahedronGeometry(0.34, 1);
  const logGeometry = new THREE.CylinderGeometry(0.12, 0.17, 1, 7);

  layout.forEach((item) => {
    if (item.type === 'stone') {
      const stone = new THREE.Mesh(
        stoneGeometry,
        new THREE.MeshStandardMaterial({ color: item.color, roughness: 1, metalness: 0, flatShading: true }),
      );
      stone.position.set(item.x, item.y, item.z);
      stone.rotation.y = item.rotation;
      stone.scale.set(item.scale * 1.25, item.scale * 0.68, item.scale);
      stone.receiveShadow = true;
      group.add(stone);
      return;
    }

    if (item.type === 'shrub') {
      const shrub = createShrub(
        THREE,
        shrubGeometry,
        new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.96, metalness: 0, flatShading: true }),
      );
      shrub.position.set(item.x, item.y, item.z);
      shrub.rotation.y = item.rotation;
      shrub.scale.setScalar(item.scale);
      shrub.traverse((object) => {
        if (object.isMesh) object.castShadow = true;
      });
      group.add(shrub);
      return;
    }

    if (item.type === 'log') {
      const log = new THREE.Mesh(
        logGeometry,
        new THREE.MeshStandardMaterial({ color: item.color, roughness: 1, metalness: 0, flatShading: true }),
      );
      log.position.set(item.x, item.y, item.z);
      log.rotation.set(0.12, item.rotation, Math.PI * 0.5);
      log.scale.setScalar(item.scale);
      log.castShadow = true;
      group.add(log);
      return;
    }

  });

  return { layout, group };
}
