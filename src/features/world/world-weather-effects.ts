import type { Camera, Group } from 'three';
import type { WorldTimePhase, WorldWeatherState } from './world-weather';
import {
  createFireflyLayout,
  getFireflyCount,
  getRainVisualIntensity,
  getRainVisualLength,
  type WeatherQuality,
} from './world-weather-effect-layout';

export {
  createFireflyLayout,
  getFireflyCount,
  getRainVisualIntensity,
  getRainVisualLength,
} from './world-weather-effect-layout';
export type { FireflyLayoutPosition, WeatherQuality } from './world-weather-effect-layout';

type ThreeNamespace = typeof import('three');

export interface WorldWeatherEffects {
  group: Group;
  update: (input: {
    time: number;
    delta: number;
    phase: WorldTimePhase;
    weather: WorldWeatherState;
    camera: Camera;
    prefersReducedMotion: boolean;
  }) => number;
}

function createStars(THREE: ThreeNamespace, quality: WeatherQuality) {
  const count = quality === 'low' ? 96 : 180;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 24;
    positions[index * 3 + 1] = 1.8 + Math.random() * 13;
    positions[index * 3 + 2] = -12 - Math.random() * 10;
    seeds[index] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSize: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      uniform float uSize;
      varying float vSeed;
      void main() {
        vSeed = aSeed;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = uSize * (128.0 / max(-viewPosition.z, 1.0));
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying float vSeed;
      void main() {
        float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
        float softCircle = smoothstep(0.5, 0.08, distanceFromCenter);
        float twinkle = 0.58 + 0.42 * sin(uTime * 1.7 + vSeed * 2.4);
        float alpha = softCircle * uOpacity * twinkle;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(1.0, 0.91, 0.61, alpha);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'world-night-stars';
  points.frustumCulled = false;
  points.renderOrder = 20;
  return points;
}

function createFireflies(
  THREE: ThreeNamespace,
  quality: WeatherQuality,
  fieldSize: number,
  walkableSize: number,
) {
  const count = getFireflyCount(quality);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const layout = createFireflyLayout({ count, fieldSize, walkableSize });
  for (let index = 0; index < layout.length; index += 1) {
    const position = layout[index];
    positions[index * 3] = position.x;
    positions[index * 3 + 1] = position.y;
    positions[index * 3 + 2] = position.z;
    seeds[index] = position.seed;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSize: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      uniform float uSize;
      varying float vSeed;
      void main() {
        vSeed = aSeed;
        vec3 animated = position;
        animated.x += sin(uTime * 0.45 + aSeed) * 0.18;
        animated.y += sin(uTime * 0.7 + aSeed * 1.7) * 0.1;
        animated.z += cos(uTime * 0.38 + aSeed) * 0.16;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = uSize * (100.0 / max(-viewPosition.z, 1.0));
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying float vSeed;
      void main() {
        float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
        float softCircle = smoothstep(0.5, 0.05, distanceFromCenter);
        float pulse = 0.56 + 0.44 * sin(uTime * 1.35 + vSeed);
        float alpha = softCircle * pulse * uOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(1.0, 0.86, 0.32, alpha);
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'world-night-fireflies';
  points.frustumCulled = false;
  points.renderOrder = 18;
  return points;
}

function createRain(THREE: ThreeNamespace, quality: WeatherQuality, fieldSize: number) {
  const count = quality === 'low' ? 180 : 420;
  const positions = new Float32Array(count * 2 * 3);
  const starts = new Float32Array(count * 2);
  const speeds = new Float32Array(count * 2);
  const lengths = new Float32Array(count * 2);
  const seeds = new Float32Array(count * 2);
  const halfField = fieldSize * 0.5;
  for (let index = 0; index < count; index += 1) {
    const x = (Math.random() * 2 - 1) * halfField;
    const z = (Math.random() * 2 - 1) * halfField;
    const startY = Math.random() * 12;
    const speed = 8 + Math.random() * 6;
    const seed = Math.random();
    for (let endpoint = 0; endpoint < 2; endpoint += 1) {
      const attributeIndex = index * 2 + endpoint;
      positions[attributeIndex * 3] = x;
      positions[attributeIndex * 3 + 2] = z;
      starts[attributeIndex] = startY;
      speeds[attributeIndex] = speed;
      lengths[attributeIndex] = endpoint === 0 ? 0 : 0.75;
      seeds[attributeIndex] = seed;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aStartY', new THREE.BufferAttribute(starts, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aLength', new THREE.BufferAttribute(lengths, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uLength: { value: 0.9 } },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexShader: `
      attribute float aStartY;
      attribute float aSpeed;
      attribute float aLength;
      attribute float aSeed;
      uniform float uTime;
      uniform float uLength;
      varying float vFade;
      void main() {
        float fall = mod(aStartY - uTime * aSpeed, 13.0);
        vec3 animated = position;
        animated.y = 0.35 + fall - aLength * uLength;
        animated.x += sin(uTime * 0.55 + aSeed * 11.0) * 0.05;
        animated.z += cos(uTime * 0.42 + aSeed * 7.0) * 0.05;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        vFade = smoothstep(0.2, 1.3, fall) * (1.0 - smoothstep(11.4, 13.0, fall));
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vFade;
      void main() { gl_FragColor = vec4(0.72, 0.88, 1.0, uOpacity * vFade); }
    `,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'world-gpu-rain-lines';
  lines.frustumCulled = false;
  lines.castShadow = false;
  lines.receiveShadow = false;
  lines.renderOrder = 12;
  return lines;
}

export function createWorldWeatherEffects(
  THREE: ThreeNamespace,
  { quality, fieldSize, walkableSize = fieldSize * 0.4, starsEnabled = true }: {
    quality: WeatherQuality;
    fieldSize: number;
    walkableSize?: number;
    starsEnabled?: boolean;
  },
): WorldWeatherEffects {
  const group = new THREE.Group();
  group.name = 'world-weather-effects';
  const stars = createStars(THREE, quality);
  const fireflies = createFireflies(THREE, quality, fieldSize, walkableSize);
  const rain = createRain(THREE, quality, fieldSize);
  const lightning = new THREE.DirectionalLight(0xdceaff, 0);
  lightning.name = 'world-storm-lightning';
  lightning.position.set(-3, 7, -1);
  lightning.castShadow = false;
  lightning.receiveShadow = false;
  group.add(stars, fireflies, rain, lightning);

  let lightningTimer = 0;
  let lightningStrength = 0;

  const update = ({ time, delta, phase, weather, camera, prefersReducedMotion }: {
    time: number;
    delta: number;
    phase: WorldTimePhase;
    weather: WorldWeatherState;
    camera: Camera;
    prefersReducedMotion: boolean;
  }) => {
    const isNight = phase === 'night';
    const isRain = weather.condition === 'rain' || weather.condition === 'storm';
    const starsMaterial = stars.material as import('three').ShaderMaterial;
    const firefliesMaterial = fireflies.material as import('three').ShaderMaterial;
    const rainMaterial = rain.material as import('three').ShaderMaterial;
    stars.position.copy(camera.position);
    stars.visible = starsEnabled && isNight;
    fireflies.visible = isNight;
    rain.visible = isRain;
    starsMaterial.uniforms.uTime.value = prefersReducedMotion ? 0 : time;
    starsMaterial.uniforms.uOpacity.value = starsEnabled && isNight ? 0.84 : 0;
    firefliesMaterial.uniforms.uTime.value = prefersReducedMotion ? 0 : time;
    firefliesMaterial.uniforms.uOpacity.value = isNight ? 0.7 : 0;
    rainMaterial.uniforms.uTime.value = time;
    rainMaterial.uniforms.uOpacity.value = getRainVisualIntensity(phase, weather.condition);
    rainMaterial.uniforms.uLength.value = getRainVisualLength(weather.condition);

    if (weather.condition !== 'storm') {
      lightningTimer = 0;
      lightningStrength = Math.max(0, lightningStrength - delta * 6);
    } else if (lightningTimer <= 0) {
      lightningTimer = 3.2 + Math.random() * 7.4;
      lightningStrength = 0.5 + Math.random() * 0.7;
    } else {
      lightningTimer -= delta;
      lightningStrength = Math.max(0, lightningStrength - delta * 8);
    }
    lightning.intensity = lightningStrength;
    return lightningStrength;
  };

  return { group, update };
}
