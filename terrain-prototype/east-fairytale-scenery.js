export const EAST_FAIRYTALE_SCENERY_TYPES = Object.freeze([
  'castle',
  'windmill',
  'flower',
]);

export const EAST_FLOWER_COLORS = Object.freeze([
  0xffd85a,
  0xe96a62,
  0xfff8df,
  0x76aee8,
  0xb58be8,
]);

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

export function createEastFairytaleLayout({
  quality = 'high',
  seed = 20260811,
} = {}) {
  const random = createRandom(seed);
  const flowerCount = quality === 'low' ? 20 : 34;
  const items = [
    { type: 'castle', x: 12.8, y: 0, z: 0.15, scale: 2 },
    { type: 'windmill', x: 10.8, y: 0, z: -3.1, scale: 0.92, rotationSpeed: 0.72 },
  ];

  for (let index = 0; index < flowerCount; index += 1) {
    items.push({
      type: 'flower',
      x: 8.35 + random() * 3.15,
      y: 0.006,
      z: -3.15 + random() * 6.3,
      scale: 0.78 + random() * 0.44,
      color: EAST_FLOWER_COLORS[index % EAST_FLOWER_COLORS.length],
      rotation: random() * Math.PI * 2,
    });
  }

  return items;
}

export function createWindmillBladeLayout({
  count = 4,
  bladeLength = 1.15,
  startAngle = 0.18,
} = {}) {
  if (!Number.isInteger(count) || count <= 0) throw new Error('count must be a positive integer');
  requirePositiveNumber(bladeLength, 'bladeLength');

  const radius = bladeLength / 2;
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index / count) * Math.PI * 2;
    const normalizeZero = (value) => (Math.abs(value) < 1e-12 ? 0 : value);
    return {
      angle,
      y: normalizeZero(Math.cos(angle) * radius),
      z: normalizeZero(Math.sin(angle) * radius),
    };
  });
}

function createMaterial(THREE, color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
    ...options,
  });
}

function addMesh(THREE, parent, geometry, material, position, rotation = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  if (rotation) mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createCastle(THREE, item) {
  const castle = new THREE.Group();
  castle.name = 'east-fairytale-castle';
  castle.position.set(item.x, item.y, item.z);
  castle.scale.setScalar(item.scale);

  const stoneMaterial = createMaterial(THREE, 0xf3e7c5);
  const warmStoneMaterial = createMaterial(THREE, 0xd9c58f);
  const roofMaterial = createMaterial(THREE, 0xd98272);
  const windowMaterial = createMaterial(THREE, 0x79b9d6, { roughness: 0.68 });
  const doorMaterial = createMaterial(THREE, 0x835a4a);

  addMesh(THREE, castle, new THREE.BoxGeometry(1.45, 0.86, 1.06), stoneMaterial, { x: 0, y: 0.43, z: 0 });
  addMesh(THREE, castle, new THREE.BoxGeometry(0.92, 0.5, 0.78), warmStoneMaterial, { x: -0.02, y: 1.06, z: 0 });

  [-0.48, 0.48].forEach((z) => {
    addMesh(
      THREE,
      castle,
      new THREE.CylinderGeometry(0.25, 0.3, 1.48, 7),
      stoneMaterial,
      { x: 0, y: 0.74, z },
    );
    addMesh(
      THREE,
      castle,
      new THREE.ConeGeometry(0.39, 0.46, 7),
      roofMaterial,
      { x: 0, y: 1.71, z },
    );
  });

  addMesh(THREE, castle, new THREE.ConeGeometry(0.52, 0.36, 6), roofMaterial, { x: -0.02, y: 1.47, z: 0 });
  addMesh(THREE, castle, new THREE.CylinderGeometry(0.27, 0.32, 1.3, 7), stoneMaterial, { x: 0.06, y: 1.82, z: 0 });
  addMesh(THREE, castle, new THREE.ConeGeometry(0.43, 0.42, 7), roofMaterial, { x: 0.06, y: 2.68, z: 0 });
  addMesh(THREE, castle, new THREE.CylinderGeometry(0.026, 0.026, 0.52, 5), doorMaterial, { x: 0.06, y: 3.15, z: 0 });
  addMesh(THREE, castle, new THREE.BoxGeometry(0.28, 0.16, 0.035), roofMaterial, { x: -0.08, y: 3.32, z: 0 });
  addMesh(THREE, castle, new THREE.BoxGeometry(0.24, 0.4, 0.04), doorMaterial, { x: -0.735, y: 0.22, z: 0 }, { x: 0, y: -Math.PI / 2, z: 0 });

  [-0.3, 0.3].forEach((z) => {
    addMesh(THREE, castle, new THREE.BoxGeometry(0.13, 0.17, 0.04), windowMaterial, { x: -0.74, y: 0.62, z }, { x: 0, y: -Math.PI / 2, z: 0 });
  });

  return castle;
}

function createWindmill(THREE, item) {
  const windmill = new THREE.Group();
  windmill.name = 'east-fairytale-windmill';
  windmill.position.set(item.x, item.y, item.z);
  windmill.scale.setScalar(item.scale);

  const towerMaterial = createMaterial(THREE, 0xb57857);
  const trimMaterial = createMaterial(THREE, 0xf2dfb4);
  const bladeMaterial = createMaterial(THREE, 0xf7edcf);

  addMesh(THREE, windmill, new THREE.ConeGeometry(0.36, 1.92, 6), towerMaterial, { x: 0, y: 0.96, z: 0 });
  addMesh(THREE, windmill, new THREE.ConeGeometry(0.48, 0.36, 6), trimMaterial, { x: 0, y: 1.98, z: 0 });

  const rotor = new THREE.Group();
  rotor.name = 'windmill-rotor';
  rotor.position.set(-0.43, 1.67, 0);
  rotor.rotation.y = Math.atan2(-item.z, item.x);
  createWindmillBladeLayout().forEach(({ angle, y, z }) => {
    const blade = addMesh(
      THREE,
      rotor,
      new THREE.BoxGeometry(0.12, 1.15, 0.2),
      bladeMaterial,
      { x: 0, y, z },
    );
    blade.rotation.x = angle;
  });
  addMesh(THREE, rotor, new THREE.IcosahedronGeometry(0.13, 1), trimMaterial, { x: 0, y: 0, z: 0 });
  windmill.userData.rotor = rotor;
  windmill.userData.rotationSpeed = item.rotationSpeed ?? 0.72;
  windmill.add(rotor);

  return windmill;
}

function createFlower(THREE, item) {
  const flower = new THREE.Group();
  flower.name = 'east-fairytale-flower';
  flower.position.set(item.x, item.y, item.z);
  flower.rotation.y = item.rotation;
  flower.scale.setScalar(item.scale);

  const stem = addMesh(
    THREE,
    flower,
    new THREE.CylinderGeometry(0.014, 0.021, 0.29, 5),
    createMaterial(THREE, 0x4f8b55),
    { x: 0, y: 0.145, z: 0 },
  );
  stem.castShadow = false;

  addMesh(
    THREE,
    flower,
    new THREE.IcosahedronGeometry(0.105, 1),
    createMaterial(THREE, item.color),
    { x: 0, y: 0.32, z: 0 },
  );
  addMesh(
    THREE,
    flower,
    new THREE.IcosahedronGeometry(0.034, 1),
    createMaterial(THREE, 0xffc45c),
    { x: 0, y: 0.39, z: 0 },
  );

  return flower;
}

export function createEastFairytaleScenery(THREE, options = {}) {
  const layout = createEastFairytaleLayout(options);
  requirePositiveNumber(options.scale ?? 1, 'scale');

  const group = new THREE.Group();
  group.name = 'east-fairytale-horizon';
  group.scale.setScalar(options.scale ?? 1);
  const windmillRotors = [];

  layout.forEach((item) => {
    if (item.type === 'castle') group.add(createCastle(THREE, item));
    if (item.type === 'windmill') {
      const windmill = createWindmill(THREE, item);
      windmillRotors.push({
        rotor: windmill.userData.rotor,
        rotationSpeed: windmill.userData.rotationSpeed,
      });
      group.add(windmill);
    }
    if (item.type === 'flower') group.add(createFlower(THREE, item));
  });

  return {
    layout,
    group,
    update(time) {
      windmillRotors.forEach(({ rotor, rotationSpeed }) => {
        rotor.rotation.x = time * rotationSpeed;
      });
    },
  };
}
