import {
  GRASS_WIND_STRENGTH,
  MAX_GRASS_INTERACTORS,
  createProceduralGrassLayout,
  getProceduralGrassCount,
} from './procedural-grass-field.js';

function createCrossedBladeGeometry(THREE) {
  const positions = [];
  const indices = [];
  const segments = 3;
  const widthProfile = [1, 0.9, 0.56, 0.025];

  function appendBlade(angle) {
    const vertexStart = positions.length / 3;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    for (let row = 0; row <= segments; row += 1) {
      const progress = row / segments;
      const halfWidth = widthProfile[row] * 0.5;
      [-halfWidth, halfWidth].forEach(localX => {
        positions.push(localX * cosine, progress, localX * sine);
      });
    }

    for (let row = 0; row < segments; row += 1) {
      const current = vertexStart + row * 2;
      const next = current + 2;
      indices.push(current, current + 1, next, current + 1, next + 1, next);
    }
  }

  appendBlade(0);
  appendBlade(Math.PI / 2);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function createGrassMaterial(THREE) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uMotionScale: { value: 1 },
      uWindStrength: { value: GRASS_WIND_STRENGTH },
      uInteractorPositionA: { value: new THREE.Vector2(1000, 1000) },
      uInteractorPositionB: { value: new THREE.Vector2(1000, 1000) },
      uInteractorDirectionA: { value: new THREE.Vector2(0, 1) },
      uInteractorDirectionB: { value: new THREE.Vector2(0, 1) },
      uInteractorStrengthA: { value: 0 },
      uInteractorStrengthB: { value: 0 },
    },
  ]);

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: `
      precision highp float;

      attribute vec3 instanceOffset;
      attribute vec2 instanceScale;
      attribute float instanceRotation;
      attribute float instancePhase;
      attribute float instanceVariation;

      uniform float uTime;
      uniform float uMotionScale;
      uniform float uWindStrength;
      uniform vec2 uInteractorPositionA;
      uniform vec2 uInteractorPositionB;
      uniform vec2 uInteractorDirectionA;
      uniform vec2 uInteractorDirectionB;
      uniform float uInteractorStrengthA;
      uniform float uInteractorStrengthB;

      varying float vBladeHeight;
      varying float vVariation;
      varying float vWaveLight;

      #include <fog_pars_vertex>

      vec2 getInteractionOffset(
        vec2 bladePosition,
        vec2 interactorPosition,
        vec2 interactorDirection,
        float movementStrength,
        float bladeHeight
      ) {
        vec2 delta = bladePosition - interactorPosition;
        float distanceFromInteractor = max(length(delta), 0.001);
        vec2 radialDirection = delta / distanceFromInteractor;
        float contact = 1.0 - smoothstep(0.08, 0.62, distanceFromInteractor);
        float rippleEnvelope = 1.0 - smoothstep(0.28, 1.42, distanceFromInteractor);
        float ripple = sin(distanceFromInteractor * 12.0 - uTime * 7.4) * rippleEnvelope * movementStrength;
        vec2 contactPush = radialDirection * contact * (0.05 + movementStrength * 0.075);
        vec2 trailingPush = -interactorDirection * contact * movementStrength * 0.035;
        vec2 ripplePush = radialDirection * ripple * 0.022;
        return (contactPush + trailingPush + ripplePush) * pow(bladeHeight, 1.36);
      }

      void main() {
        float bladeHeight = position.y;
        float animatedTime = uTime * uMotionScale;
        float primaryWave = sin(
          animatedTime * 1.65
          + instancePhase
          + instanceOffset.x * 0.28
          + instanceOffset.z * 0.16
        );
        float detailWave = sin(
          animatedTime * 2.9
          - instancePhase * 0.62
          + instanceOffset.z * 0.48
        );
        float gust = primaryWave * 0.74 + detailWave * 0.26;
        float bend = uWindStrength * (0.075 + gust * 0.055) * pow(bladeHeight, 1.7);

        vec3 localPosition = position;
        localPosition.xz *= instanceScale.x;
        localPosition.y *= instanceScale.y;
        localPosition.x += bend;
        localPosition.z += bend * 0.44;

        float cosine = cos(instanceRotation);
        float sine = sin(instanceRotation);
        vec2 rotated = mat2(cosine, -sine, sine, cosine) * localPosition.xz;
        vec2 worldXZ = instanceOffset.xz + rotated;
        worldXZ += getInteractionOffset(
          instanceOffset.xz,
          uInteractorPositionA,
          uInteractorDirectionA,
          uInteractorStrengthA,
          bladeHeight
        );
        worldXZ += getInteractionOffset(
          instanceOffset.xz,
          uInteractorPositionB,
          uInteractorDirectionB,
          uInteractorStrengthB,
          bladeHeight
        );

        vec3 worldPosition = vec3(worldXZ.x, instanceOffset.y + localPosition.y, worldXZ.y);
        vec4 mvPosition = modelViewMatrix * vec4(worldPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        vBladeHeight = bladeHeight;
        vVariation = instanceVariation;
        vWaveLight = gust;

        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      precision highp float;

      varying float vBladeHeight;
      varying float vVariation;
      varying float vWaveLight;

      #include <fog_pars_fragment>

      void main() {
        vec3 rootColor = vec3(0.025, 0.16, 0.055);
        vec3 meadowColor = vec3(0.075, 0.34, 0.105);
        vec3 tipColor = vec3(0.24, 0.52, 0.16);
        vec3 color = mix(rootColor, meadowColor, smoothstep(0.0, 0.7, vBladeHeight));
        color = mix(color, tipColor, smoothstep(0.64, 1.0, vBladeHeight));
        color *= 0.9 + vVariation * 0.18 + vWaveLight * 0.02;

        gl_FragColor = vec4(color, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  return { material, uniforms };
}

export function createProceduralGrassField(THREE, {
  fieldSize,
  walkableSize,
  baseHeight,
  viewportWidth,
  pixelRatio,
  count,
  seed = 20260809,
  outerDensityMultiplier = 1,
}) {
  const baseCount = count ?? getProceduralGrassCount({ width: viewportWidth, pixelRatio });
  const layout = createProceduralGrassLayout({
    count: baseCount,
    fieldSize,
    walkableSize,
    baseHeight,
    clumpCount: 72,
    seed,
    outerDensityMultiplier,
  });
  const instanceCount = layout.length;
  const geometry = createCrossedBladeGeometry(THREE);
  const offsets = new Float32Array(instanceCount * 3);
  const scales = new Float32Array(instanceCount * 2);
  const rotations = new Float32Array(instanceCount);
  const phases = new Float32Array(instanceCount);
  const variations = new Float32Array(instanceCount);

  layout.forEach((blade, index) => {
    offsets[index * 3] = blade.x;
    offsets[index * 3 + 1] = blade.y;
    offsets[index * 3 + 2] = blade.z;
    scales[index * 2] = blade.width;
    scales[index * 2 + 1] = blade.height;
    rotations[index] = blade.rotation;
    phases[index] = blade.phase;
    variations[index] = blade.color;
  });

  geometry.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scales, 2));
  geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(rotations, 1));
  geometry.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.setAttribute('instanceVariation', new THREE.InstancedBufferAttribute(variations, 1));
  geometry.instanceCount = instanceCount;

  const { material, uniforms } = createGrassMaterial(THREE);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(fieldSize, fieldSize),
    new THREE.MeshStandardMaterial({
      color: 0x2d6938,
      roughness: 1,
      metalness: 0,
    }),
  );
  ground.name = 'procedural-meadow-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = baseHeight - 0.006;
  ground.receiveShadow = true;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'procedural-interactive-grass';
  mesh.frustumCulled = false;

  const interactorUniforms = [
    {
      position: uniforms.uInteractorPositionA.value,
      direction: uniforms.uInteractorDirectionA.value,
      strength: uniforms.uInteractorStrengthA,
    },
    {
      position: uniforms.uInteractorPositionB.value,
      direction: uniforms.uInteractorDirectionB.value,
      strength: uniforms.uInteractorStrengthB,
    },
  ];

  function update({ time, motionScale = 1, interactors = [] }) {
    uniforms.uTime.value = time;
    uniforms.uMotionScale.value = motionScale;

    for (let index = 0; index < MAX_GRASS_INTERACTORS; index += 1) {
      const target = interactorUniforms[index];
      const interactor = interactors[index];
      if (!interactor) {
        target.position.set(1000, 1000);
        target.direction.set(0, 1);
        target.strength.value = 0;
        continue;
      }

      target.position.set(interactor.position.x, interactor.position.z);
      target.direction.set(interactor.direction.x, interactor.direction.z);
      target.strength.value = interactor.strength;
    }
  }

  return { count: instanceCount, ground, mesh, update };
}
