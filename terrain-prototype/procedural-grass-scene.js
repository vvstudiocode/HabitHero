import {
  MAX_GRASS_INTERACTORS,
  createProceduralGrassLayout,
  getProceduralGrassCount,
} from './procedural-grass-field.js';

export const GRASS_COLOR_LAYER_THRESHOLDS = Object.freeze({
  edgeEnd: 0.24,
  distantStart: 0.58,
  distantEnd: 0.92,
});

export function getGrassColorLayer({ distanceFromCenter, walkableHalf, fieldHalf }) {
  const safeDistance = Number.isFinite(distanceFromCenter) ? distanceFromCenter : 0;
  const safeWalkableHalf = Number.isFinite(walkableHalf) ? Math.max(walkableHalf, 0) : 0;
  const safeFieldHalf = Number.isFinite(fieldHalf)
    ? Math.max(fieldHalf, safeWalkableHalf + 0.001)
    : safeWalkableHalf + 0.001;
  const outerProgress = Math.min(
    Math.max((safeDistance - safeWalkableHalf) / (safeFieldHalf - safeWalkableHalf), 0),
    1,
  );

  if (safeDistance > safeWalkableHalf && outerProgress <= GRASS_COLOR_LAYER_THRESHOLDS.edgeEnd) {
    return 'edge';
  }
  if (outerProgress >= GRASS_COLOR_LAYER_THRESHOLDS.distantStart) return 'distant';
  return 'middle';
}

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

function createNaturalGroundMaterial(THREE, { walkableSize = 1, fieldSize = 1 } = {}) {
  const walkableHalf = Math.min(walkableSize, fieldSize) * 0.5;
  const fieldHalf = fieldSize * 0.5;
  const material = new THREE.MeshStandardMaterial({
    color: 0x2d6938,
    roughness: 1,
    metalness: 0,
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uGroundWalkableHalf = { value: walkableHalf };
    shader.uniforms.uGroundFieldHalf = { value: fieldHalf };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vHabitHeroGroundUv;
         varying float vHabitHeroGroundEdgeFactor;
         varying float vHabitHeroGroundDistantFactor;
         uniform float uGroundWalkableHalf;
         uniform float uGroundFieldHalf;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vHabitHeroGroundUv = uv;
         float groundDistance = max(abs(position.x), abs(position.y));
         float groundOuterProgress = clamp(
           (groundDistance - uGroundWalkableHalf) / max(uGroundFieldHalf - uGroundWalkableHalf, 0.001),
           0.0,
           1.0
         );
         vHabitHeroGroundEdgeFactor = smoothstep(0.0, 0.08, groundOuterProgress)
           * (1.0 - smoothstep(0.20, 0.30, groundOuterProgress));
         vHabitHeroGroundDistantFactor = smoothstep(0.58, 0.92, groundOuterProgress);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vHabitHeroGroundUv;
         varying float vHabitHeroGroundEdgeFactor;
         varying float vHabitHeroGroundDistantFactor;

         float habitHeroGroundHash(vec2 point) {
           return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
         }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec2 groundCell = floor(vHabitHeroGroundUv * 34.0);
         float broadVariation = habitHeroGroundHash(floor(vHabitHeroGroundUv * 8.0));
         float fineVariation = habitHeroGroundHash(groundCell);
         float naturalVariation = 0.9 + broadVariation * 0.13 + fineVariation * 0.045;
         diffuseColor.rgb *= naturalVariation;
         diffuseColor.rgb += vec3(0.002, 0.008, 0.001) * broadVariation;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 groundEdgeColor = vec3(0.16, 0.43, 0.12);
         vec3 groundMiddleColor = vec3(0.16, 0.43, 0.12);
         vec3 groundDistantColor = vec3(0.28, 0.36, 0.24);
         vec3 groundLayerColor = mix(groundMiddleColor, groundEdgeColor, vHabitHeroGroundEdgeFactor);
         groundLayerColor = mix(groundLayerColor, groundDistantColor, vHabitHeroGroundDistantFactor);
         float groundMiddleFactor = clamp(
           1.0 - vHabitHeroGroundEdgeFactor - vHabitHeroGroundDistantFactor,
           0.0,
           1.0
         );
         diffuseColor.rgb = mix(diffuseColor.rgb, groundLayerColor, 0.34);
         diffuseColor.rgb *= 1.0 + groundMiddleFactor * 0.08;`,
      );
  };
  material.customProgramCacheKey = () => 'habit-hero-natural-ground-v2';
  return material;
}

function createGrassMaterial(THREE, {
  fieldSize = 1,
  walkableSize = 1,
  sunDirection = [-0.52, 0.78, -0.36],
  sunColor = 0xffe2b0,
  ambientColor = 0xc1dfc4,
} = {}) {
  const walkableHalf = Math.min(walkableSize, fieldSize) * 0.5;
  const fieldHalf = fieldSize * 0.5;
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uInteractorPositionA: { value: new THREE.Vector2(1000, 1000) },
      uInteractorPositionB: { value: new THREE.Vector2(1000, 1000) },
      uInteractorDirectionA: { value: new THREE.Vector2(0, 1) },
      uInteractorDirectionB: { value: new THREE.Vector2(0, 1) },
      uInteractorStrengthA: { value: 0 },
      uInteractorStrengthB: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
      uSunColor: { value: new THREE.Color(sunColor) },
      uAmbientColor: { value: new THREE.Color(ambientColor) },
      uWalkableHalf: { value: walkableHalf },
      uFieldHalf: { value: fieldHalf },
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
      attribute float instanceVariation;

      uniform float uTime;
      uniform vec2 uInteractorPositionA;
      uniform vec2 uInteractorPositionB;
      uniform vec2 uInteractorDirectionA;
      uniform vec2 uInteractorDirectionB;
      uniform float uInteractorStrengthA;
      uniform float uInteractorStrengthB;
      uniform float uWalkableHalf;
      uniform float uFieldHalf;

      varying float vBladeHeight;
      varying float vVariation;
      varying float vWaveLight;
      varying float vGrassEdgeFactor;
      varying float vGrassDistantFactor;

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

        vec3 localPosition = position;
        localPosition.xz *= instanceScale.x;
        localPosition.y *= instanceScale.y;

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
        vWaveLight = 0.0;
        float grassDistance = max(abs(instanceOffset.x), abs(instanceOffset.z));
        float grassOuterProgress = clamp(
          (grassDistance - uWalkableHalf) / max(uFieldHalf - uWalkableHalf, 0.001),
          0.0,
          1.0
        );
        vGrassEdgeFactor = smoothstep(0.0, 0.08, grassOuterProgress)
          * (1.0 - smoothstep(0.20, 0.30, grassOuterProgress));
        vGrassDistantFactor = smoothstep(0.58, 0.92, grassOuterProgress);

        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      precision highp float;

      varying float vBladeHeight;
      varying float vVariation;
      varying float vWaveLight;
      varying float vGrassEdgeFactor;
      varying float vGrassDistantFactor;

      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;

      #include <fog_pars_fragment>

      void main() {
        vec3 rootColor = vec3(0.025, 0.16, 0.055);
        vec3 meadowColor = vec3(0.075, 0.34, 0.105);
        vec3 tipColor = vec3(0.24, 0.52, 0.16);
        vec3 color = mix(rootColor, meadowColor, smoothstep(0.0, 0.7, vBladeHeight));
        color = mix(color, tipColor, smoothstep(0.64, 1.0, vBladeHeight));
        vec3 edgeLayerColor = vec3(0.15, 0.47, 0.12);
        vec3 middleLayerColor = vec3(0.15, 0.47, 0.12);
        vec3 distantLayerColor = vec3(0.27, 0.37, 0.23);
        vec3 distanceLayerColor = mix(middleLayerColor, edgeLayerColor, vGrassEdgeFactor);
        distanceLayerColor = mix(distanceLayerColor, distantLayerColor, vGrassDistantFactor);
        float middleLayerFactor = clamp(
          1.0 - vGrassEdgeFactor - vGrassDistantFactor,
          0.0,
          1.0
        );
        color = mix(color, distanceLayerColor, 0.30);
        color *= 1.0 + middleLayerFactor * 0.10;
        float variation = 0.92 + (vVariation - 0.5) * 0.16;
        vec3 bladeNormal = normalize(vec3(-vWaveLight * 0.12, 0.86, 0.28));
        float sunAmount = 0.58 + 0.42 * max(dot(bladeNormal, normalize(uSunDirection)), 0.0);
        vec3 naturalLight = mix(uAmbientColor, uSunColor, sunAmount);
        color *= variation * naturalLight;
        color += uSunColor * smoothstep(0.72, 1.0, vBladeHeight) * 0.018;

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
  boundaryDensityMultiplier = 1,
  sunDirection,
  sunColor,
  ambientColor,
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
    boundaryDensityMultiplier,
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

  const { material, uniforms } = createGrassMaterial(THREE, {
    fieldSize,
    walkableSize,
    sunDirection,
    sunColor,
    ambientColor,
  });
  const groundMaterial = createNaturalGroundMaterial(THREE, { walkableSize, fieldSize });
  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(fieldSize, fieldSize),
    groundMaterial,
  );
  outerGround.name = 'procedural-meadow-outer-ground';
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = baseHeight - 0.006;
  outerGround.receiveShadow = false;

  const walkableGround = new THREE.Mesh(
    new THREE.PlaneGeometry(walkableSize, walkableSize),
    groundMaterial,
  );
  walkableGround.name = 'procedural-walkable-shadow-ground';
  walkableGround.rotation.x = -Math.PI / 2;
  walkableGround.position.y = baseHeight - 0.005;
  walkableGround.receiveShadow = true;

  const ground = new THREE.Group();
  ground.name = 'procedural-meadow-ground';
  ground.add(outerGround, walkableGround);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'procedural-interactive-grass';
  // Keep the grass lit by its custom shader without adding blade shadows to
  // the scene's shadow pass. The walkable ground still receives main-scene
  // shadows, so trees and characters retain their depth cues there.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
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

  function update({ time, interactors = [] }) {
    uniforms.uTime.value = time;

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
