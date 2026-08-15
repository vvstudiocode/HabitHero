import {
  FLOWER_COLORS,
  createProceduralFlowerLayout,
  getProceduralFlowerCount,
} from './procedural-flower-layout.js';

function setMatrix(THREE, mesh, index, position, quaternion, scale) {
  const matrix = new THREE.Matrix4();
  matrix.compose(position, quaternion, scale);
  mesh.setMatrixAt(index, matrix);
}

export function createProceduralFlowerField(THREE, {
  walkableSize,
  baseHeight = 0,
  viewportWidth = 375,
  count,
}) {
  const flowers = createProceduralFlowerLayout({
    count: count ?? getProceduralFlowerCount({ width: viewportWidth }),
    walkableSize,
    baseHeight,
  });
  const field = new THREE.Group();
  field.name = 'procedural-wildflowers';

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4e8b4d, roughness: 1 });
  const stems = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.003, 0.0045, 1, 5),
    stemMaterial,
    flowers.length,
  );
  stems.name = 'wildflower-stems';

  flowers.forEach((flower, index) => {
    setMatrix(
      THREE,
      stems,
      index,
      new THREE.Vector3(flower.x, flower.y + flower.height * 0.5, flower.z),
      new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, flower.rotation),
      new THREE.Vector3(1, flower.height, 1),
    );
  });
  stems.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  field.add(stems);

  const centerMesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffc45c,
      roughness: 0.84,
      side: THREE.DoubleSide,
    }),
    flowers.length,
  );
  centerMesh.name = 'wildflower-centers';

  FLOWER_COLORS.forEach(color => {
    const colorFlowers = flowers.filter(flower => flower.color === color);
    const petals = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 10),
      new THREE.MeshStandardMaterial({
        color: colorFlowers[0]?.colorValue ?? 0xffffff,
        roughness: 0.86,
        side: THREE.DoubleSide,
      }),
      colorFlowers.length * 5,
    );
    petals.name = `wildflower-${color}-petals`;
    colorFlowers.forEach((flower, index) => {
      for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
        const petalAngle = flower.rotation + (petalIndex / 5) * Math.PI * 2;
        const petalRadius = flower.size * 0.48;
        const petalIndexInMesh = index * 5 + petalIndex;
        setMatrix(
          THREE,
          petals,
          petalIndexInMesh,
          new THREE.Vector3(
            flower.x + Math.cos(petalAngle) * petalRadius,
            flower.y + flower.height,
            flower.z + Math.sin(petalAngle) * petalRadius,
          ),
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-Math.PI / 2 + 0.12, 0, petalAngle),
          ),
          new THREE.Vector3(flower.size * 0.72, flower.size * 0.48, flower.size),
        );
      }
      setMatrix(
        THREE,
        centerMesh,
        flowers.indexOf(flower),
        new THREE.Vector3(flower.x, flower.y + flower.height + 0.004, flower.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
        new THREE.Vector3(flower.size * 0.36, flower.size * 0.36, flower.size),
      );
    });
    petals.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    field.add(petals);
  });

  centerMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  field.add(centerMesh);

  return field;
}
