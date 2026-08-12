import { createAmbientPollenLayout } from './natural-world-visuals.js';

export function createAmbientPollenField(THREE, {
  fieldSize = 1,
  count = 1,
  opacity = 0.16,
  seed = 20260811,
} = {}) {
  const layout = createAmbientPollenLayout({ count, fieldSize, seed });
  const positions = new Float32Array(layout.length * 3);
  const sizes = new Float32Array(layout.length);
  const phases = new Float32Array(layout.length);

  layout.forEach((particle, index) => {
    positions[index * 3] = particle.x;
    positions[index * 3 + 1] = particle.y;
    positions[index * 3 + 2] = particle.z;
    sizes[index] = particle.size;
    phases[index] = particle.phase;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aParticleSize', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aParticlePhase', new THREE.Float32BufferAttribute(phases, 1));

  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: opacity },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      precision highp float;

      attribute float aParticleSize;
      attribute float aParticlePhase;

      uniform float uTime;

      varying float vParticlePulse;

      void main() {
        vec3 animatedPosition = position;
        animatedPosition.x += sin(uTime * 0.17 + aParticlePhase) * 0.12;
        animatedPosition.y += sin(uTime * 0.72 + aParticlePhase * 1.7) * 0.055;
        animatedPosition.z += cos(uTime * 0.21 + aParticlePhase * 0.8) * 0.1;

        vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = aParticleSize * (150.0 / max(-mvPosition.z, 1.0));
        vParticlePulse = 0.72 + 0.28 * sin(uTime * 0.9 + aParticlePhase);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform float uOpacity;
      varying float vParticlePulse;

      void main() {
        float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
        float softCircle = smoothstep(0.5, 0.04, distanceFromCenter);
        float alpha = softCircle * uOpacity * vParticlePulse;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(1.0, 0.93, 0.68, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'ambient-pollen';
  points.frustumCulled = false;

  function update(time) {
    uniforms.uTime.value = time;
  }

  return { count: layout.length, points, update };
}

export function createSunlightPatchField(THREE, {
  color = 0xffc878,
  opacity = 0.07,
  count = 4,
} = {}) {
  const patchPositions = [
    { x: -1.18, z: -0.92, scale: 1.05, rotation: -0.26 },
    { x: 1.12, z: -1.42, scale: 0.82, rotation: 0.38 },
    { x: -1.62, z: 1.38, scale: 0.74, rotation: 0.14 },
    { x: 1.76, z: 1.24, scale: 0.62, rotation: -0.5 },
  ].slice(0, Math.max(1, Math.min(count, 4)));
  const geometry = new THREE.PlaneGeometry(1.9, 1.25);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vPatchUv;

      void main() {
        vPatchUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vPatchUv;

      void main() {
        vec2 centered = (vPatchUv - 0.5) * 2.0;
        float distanceFromCenter = dot(centered, centered);
        float edgeFade = smoothstep(1.0, 0.12, distanceFromCenter);
        float softBreakup = 0.86 + 0.14 * sin(vPatchUv.x * 11.0 + vPatchUv.y * 7.0);
        float alpha = edgeFade * softBreakup * uOpacity;
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const group = new THREE.Group();
  group.name = 'subtle-afternoon-sunlight-patches';

  patchPositions.forEach((patch) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(patch.x, 0.012, patch.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = patch.rotation;
    mesh.scale.setScalar(patch.scale);
    group.add(mesh);
  });

  return { count: patchPositions.length, group };
}
