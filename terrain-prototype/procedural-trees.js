import {
  FOREST_BRANCH_COUNT,
  FOREST_CANOPY_LOBE_COUNT,
  FOREST_PALETTE,
  getForestBoundaryTreeSpecs,
} from './procedural-tree-layout.js';

const CANOPY_LOBES = [
  { x: 0, z: 0, y: 0.58, width: 1.16, height: 0.72, depth: 0.96, turn: 0 },
  { x: -0.57, z: 0.04, y: 0.45, width: 0.94, height: 0.56, depth: 0.84, turn: 0.73 },
  { x: 0.54, z: -0.03, y: 0.42, width: 0.98, height: 0.59, depth: 0.88, turn: 1.41 },
];

function setInstanceTransform(THREE, mesh, index, { position, quaternion, rotation = 0, scale }) {
  const matrix = new THREE.Matrix4();
  const orientation = quaternion
    ?? new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotation);
  matrix.compose(position, orientation, scale);
  mesh.setMatrixAt(index, matrix);
}

function createPaintedCanopyGeometry(THREE) {
  const radialSegments = 15;
  const profile = [
    { y: -0.48, radius: 0.24 },
    { y: -0.38, radius: 0.72 },
    { y: -0.12, radius: 1 },
    { y: 0.2, radius: 0.92 },
    { y: 0.46, radius: 0.61 },
    { y: 0.57, radius: 0.12 },
  ];
  const positions = [];
  const indices = [];

  profile.forEach((ring, ringIndex) => {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const ripple = 1
        + Math.sin(segment * 2.17 + ringIndex * 1.31) * 0.095
        + Math.cos(segment * 3.07 - ringIndex * 0.83) * 0.055;
      const verticalRipple = Math.sin(segment * 1.73 + ringIndex) * 0.025;
      positions.push(
        Math.cos(angle) * ring.radius * ripple,
        ring.y + verticalRipple,
        Math.sin(angle) * ring.radius * (2 - ripple),
      );
    }
  });

  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments;
      const lower = ring * radialSegments;
      const upper = (ring + 1) * radialSegments;
      indices.push(lower + segment, upper + segment, upper + next);
      indices.push(lower + segment, upper + next, lower + next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addStaticInstancedMesh(THREE, forest, mesh) {
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  forest.add(mesh);
}

export function createProceduralForest(THREE, {
  terrainLimit,
  groundHeight = 0,
  heightLimit = 3.2,
  layers = 7,
}) {
  const specs = getForestBoundaryTreeSpecs({ terrainLimit, groundHeight, heightLimit, layers });
  const forest = new THREE.Group();
  forest.name = 'procedural-forest-boundary';

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const trunkGeometry = new THREE.CylinderGeometry(0.54, 1, 1, 8);
  const trunks = new THREE.InstancedMesh(trunkGeometry, woodMaterial, specs.length);
  trunks.name = 'forest-natural-trunks';

  specs.forEach((spec, index) => {
    const trunkQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(spec.lean, 0, spec.lean * 0.55),
    );
    setInstanceTransform(THREE, trunks, index, {
      position: new THREE.Vector3(
        spec.position.x,
        spec.position.y + spec.renderedTrunkHeight * 0.5,
        spec.position.z,
      ),
      quaternion: trunkQuaternion,
      scale: new THREE.Vector3(
        spec.trunkWidth,
        spec.renderedTrunkHeight,
        spec.trunkWidth,
      ),
    });
    trunks.setColorAt(index, new THREE.Color(
      FOREST_PALETTE.trunks[spec.index % FOREST_PALETTE.trunks.length],
    ));
  });
  addStaticInstancedMesh(THREE, forest, trunks);

  const branchGeometry = new THREE.CylinderGeometry(0.42, 0.78, 1, 7);
  const branches = new THREE.InstancedMesh(
    branchGeometry,
    woodMaterial,
    specs.length * FOREST_BRANCH_COUNT,
  );
  branches.name = 'forest-branches';

  specs.forEach((spec, treeIndex) => {
    for (let branchIndex = 0; branchIndex < FOREST_BRANCH_COUNT; branchIndex += 1) {
      const directionSign = branchIndex === 0 ? -1 : 1;
      const yaw = spec.rotation + directionSign * (0.75 + branchIndex * 0.18);
      const branchLength = spec.crownWidth * (0.78 + branchIndex * 0.08);
      const direction = new THREE.Vector3(
        Math.cos(yaw) * 0.74,
        0.55 + branchIndex * 0.06,
        Math.sin(yaw) * 0.74,
      ).normalize();
      const origin = new THREE.Vector3(
        spec.position.x,
        spec.position.y + spec.trunkHeight * (0.73 + branchIndex * 0.07),
        spec.position.z,
      );
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        THREE.Object3D.DEFAULT_UP,
        direction,
      );
      setInstanceTransform(THREE, branches, treeIndex * FOREST_BRANCH_COUNT + branchIndex, {
        position: origin.clone().addScaledVector(direction, branchLength * 0.5),
        quaternion,
        scale: new THREE.Vector3(
          spec.trunkWidth * 0.62,
          branchLength,
          spec.trunkWidth * 0.62,
        ),
      });
      branches.setColorAt(
        treeIndex * FOREST_BRANCH_COUNT + branchIndex,
        new THREE.Color(FOREST_PALETTE.trunks[(spec.index + branchIndex) % FOREST_PALETTE.trunks.length]),
      );
    }
  });
  addStaticInstancedMesh(THREE, forest, branches);

  const canopyGeometry = createPaintedCanopyGeometry(THREE);
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
  });
  const canopies = new THREE.InstancedMesh(
    canopyGeometry,
    canopyMaterial,
    specs.length * FOREST_CANOPY_LOBE_COUNT,
  );
  canopies.name = 'forest-watercolor-canopies';

  specs.forEach((spec, treeIndex) => {
    const crownHeight = spec.height - spec.trunkHeight;
    CANOPY_LOBES.forEach((lobe, lobeIndex) => {
      const instanceIndex = treeIndex * FOREST_CANOPY_LOBE_COUNT + lobeIndex;
      const cosine = Math.cos(spec.rotation);
      const sine = Math.sin(spec.rotation);
      const rotatedX = lobe.x * cosine - lobe.z * sine;
      const rotatedZ = lobe.x * sine + lobe.z * cosine;
      setInstanceTransform(THREE, canopies, instanceIndex, {
        position: new THREE.Vector3(
          spec.position.x + rotatedX * spec.crownWidth,
          spec.position.y + spec.trunkHeight + crownHeight * lobe.y,
          spec.position.z + rotatedZ * spec.crownWidth,
        ),
        rotation: spec.rotation + lobe.turn,
        scale: new THREE.Vector3(
          spec.crownWidth * lobe.width,
          crownHeight * lobe.height,
          spec.crownWidth * lobe.depth,
        ),
      });
      canopies.setColorAt(instanceIndex, new THREE.Color(
        FOREST_PALETTE.broadleaf[(spec.index + lobeIndex * 2) % FOREST_PALETTE.broadleaf.length],
      ));
    });
  });
  addStaticInstancedMesh(THREE, forest, canopies);

  return forest;
}
