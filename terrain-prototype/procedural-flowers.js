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

  FLOWER_COLORS.forEach(color => {
    const colorFlowers = flowers.filter(flower => flower.color === color);
    const heads = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 5),
      new THREE.MeshStandardMaterial({
        color: colorFlowers[0]?.colorValue ?? 0xffffff,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
      colorFlowers.length,
    );
    heads.name = `wildflower-${color}-heads`;
    colorFlowers.forEach((flower, index) => {
      const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2 + 0.14, flower.rotation, 0),
      );
      setMatrix(
        THREE,
        heads,
        index,
        new THREE.Vector3(flower.x, flower.y + flower.height, flower.z),
        quaternion,
        new THREE.Vector3(flower.size, flower.size, flower.size),
      );
    });
    heads.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    field.add(heads);
  });

  return field;
}
