import type { Camera, Group } from 'three';
import {
  DEFAULT_PROCEDURAL_SKY_CONFIG,
  getProceduralSkyFrame,
  getProceduralSkyFrameAtHour,
  normalizeProceduralSkyConfig,
  type ProceduralSkyConfig,
  type ProceduralSkyFrame,
  type ProceduralSkyRgb,
} from './procedural-sky-palette';

type ThreeNamespace = typeof import('three');

export interface ProceduralSkyRuntime {
  group: Group;
  update: (input: {
    time: number;
    camera: Camera;
    dayNightEnabled: boolean;
    cloudCover: number;
  }) => ProceduralSkyFrame;
  dispose: () => void;
}

export interface ProceduralSkyRuntimeOptions extends Partial<ProceduralSkyConfig> {
  THREE: ThreeNamespace;
  prefersReducedMotion: boolean;
  quality?: 'low' | 'high';
}

function setRgb(target: import('three').Color, rgb: ProceduralSkyRgb): void {
  target.setRGB(rgb[0], rgb[1], rgb[2]);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

const VERTEX_SHADER = `
  varying vec3 vWorldDirection;

  void main() {
    vWorldDirection = normalize(mat3(modelMatrix) * position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform float uCloudCover;
  uniform float uNight;
  uniform float uTwilight;
  uniform float uSunVisibility;
  uniform float uMoonVisibility;
  uniform float uExposure;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uBelow;
  uniform vec3 uCloudLight;
  uniform vec3 uCloudShadow;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  varying vec3 vWorldDirection;

  // Original WebGL adaptation: procedural gradient, sun, moon, stars and
  // cloud noise are generated here instead of sampling a sky image.
  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float noise2(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = smoothstep(0.0, 1.0, fract(point));
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 3; octave += 1) {
      value += noise2(point) * amplitude;
      point = point * 2.02 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }
    return value;
  }

  float starField(vec3 direction) {
    // Use continuous direction coordinates so the sphere's -PI/+PI seam
    // cannot split the star field into two different columns.
    vec2 cell = vec2(
      direction.x * 21.0 + direction.z * 8.0,
      direction.y * 15.0
    );
    vec2 local = fract(cell) - 0.5;
    float seed = hash21(floor(cell));
    vec2 offset = vec2(hash21(floor(cell) + 4.7), hash21(floor(cell) + 9.1)) - 0.5;
    float point = smoothstep(0.11, 0.0, length(local - offset * 0.55));
    float sparse = step(0.90, seed);
    float warm = step(0.86, hash21(floor(cell) + 15.2));
    return point * sparse * mix(0.72, 1.2, warm);
  }

  float milkyWay(vec3 direction) {
    float longitude = atan(direction.z, direction.x);
    float latitude = asin(clamp(direction.y, -1.0, 1.0));
    float sweep = latitude - 0.12 + sin(longitude * 2.0) * 0.14;
    float band = 1.0 - smoothstep(0.02, 0.42, abs(sweep));
    float dust = 0.52 + 0.48 * noise2(direction.xz * 5.0 + vec2(4.0, 1.7));
    return band * dust;
  }

  void main() {
    vec3 direction = normalize(vWorldDirection);
    float height = direction.y;
    float upper = smoothstep(0.02, 0.82, height);
    float lower = smoothstep(-0.18, 0.08, height);
    vec3 color = mix(uBelow, uHorizon, lower);
    color = mix(color, uZenith, upper);

    float warmHorizon = exp(-abs(height) * 18.0) * uTwilight;
    color = mix(color, uHorizon + vec3(0.08, 0.02, 0.0), warmHorizon * 0.48);

    float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
    float sunHalo = pow(sunDot, 16.0) * 0.04;
    float sunGlow = sunHalo + pow(sunDot, 40.0) * 0.16 + pow(sunDot, 180.0) * 0.5;
    float sunDisc = smoothstep(0.9992, 0.99975, sunDot);
    color += uSunColor * (sunGlow + sunDisc * 1.35) * uSunVisibility;

    // Lower the cloud band's soft edge below the playable horizon so a 45°
    // camera does not see a dark horizontal strip across the sky.
    float cloudHeight = height + 0.34;
    vec2 cloudCoordinates = direction.xz / max(cloudHeight + 0.24, 0.28);
    float cloudMass = fbm(cloudCoordinates * 3.6 + vec2(uTime * 0.003, 0.0));
    float cloudMask = smoothstep(0.36, 0.58, cloudMass);
    cloudMask *= smoothstep(-0.02, 0.22, cloudHeight);
    cloudMask *= mix(0.36, 1.0, clamp(uCloudCover, 0.0, 1.0));
    float cloudLight = 0.78 + 0.22 * max(dot(direction, normalize(uSunDirection)), 0.0);
    vec3 cloudColor = mix(uCloudShadow, uCloudLight, cloudLight);
    cloudColor = mix(cloudColor, uCloudShadow, uNight * 0.55);
    color = mix(color, cloudColor, cloudMask * 0.9);

    // Composite the moon after the cloud layer so its disc and glow remain
    // readable in front of clouds at night.
    float moonDot = max(dot(direction, normalize(uMoonDirection)), 0.0);
    float moonGlow = pow(moonDot, 28.0) * 0.18;
    float moonDisc = smoothstep(0.997, 0.9993, moonDot);
    color += uMoonColor * (moonGlow + moonDisc * 1.1) * uMoonVisibility;

    float stars = starField(direction) * uNight * smoothstep(0.01, 0.18, height);
    stars *= 1.0 - cloudMask * 0.38;
    float twinkle = 0.78 + 0.22 * sin(uTime * 1.4 + direction.x * 18.0 + direction.z * 11.0);
    color += mix(vec3(0.7, 0.82, 1.0), vec3(1.0, 0.82, 0.62), stars * 0.35) * stars * twinkle * 1.7;

    float galaxy = milkyWay(direction) * uNight * smoothstep(0.02, 0.42, height);
    galaxy *= 1.0 - cloudMask * 0.45;
    color += vec3(0.28, 0.38, 0.9) * galaxy * 2.2;

    gl_FragColor = vec4(max(color * uExposure, vec3(0.0)), 1.0);
  }
`;

export function createProceduralSky({ THREE, prefersReducedMotion, quality = 'high', ...rawConfig }: ProceduralSkyRuntimeOptions): ProceduralSkyRuntime {
  const config = normalizeProceduralSkyConfig({
    ...DEFAULT_PROCEDURAL_SKY_CONFIG,
    ...rawConfig,
  });
  const group = new THREE.Group();
  group.name = 'my-world-procedural-sky';
  const uniforms = {
    uTime: { value: 0 },
    uCloudCover: { value: 0 },
    uNight: { value: 0 },
    uTwilight: { value: 0 },
    uSunVisibility: { value: 1 },
    uMoonVisibility: { value: 0 },
    uExposure: { value: 1 },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBelow: { value: new THREE.Color() },
    uCloudLight: { value: new THREE.Color() },
    uCloudShadow: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uMoonColor: { value: new THREE.Color() },
    uSunDirection: { value: new THREE.Vector3() },
    uMoonDirection: { value: new THREE.Vector3() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const geometry = new THREE.SphereGeometry(1, quality === 'low' ? 32 : 48, quality === 'low' ? 20 : 32);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'my-world-procedural-sky-dome';
  mesh.scale.setScalar(100);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  group.add(mesh);

  const update = ({ time, camera, dayNightEnabled, cloudCover }: {
    time: number;
    camera: Camera;
    dayNightEnabled: boolean;
    cloudCover: number;
  }): ProceduralSkyFrame => {
    const frame = dayNightEnabled
      ? getProceduralSkyFrame(time, config)
      : getProceduralSkyFrameAtHour(12);
    mesh.position.copy(camera.position);
    uniforms.uTime.value = prefersReducedMotion ? 0 : Math.max(0, time);
    uniforms.uCloudCover.value = clamp(cloudCover / 100, 0, 1);
    uniforms.uNight.value = frame.night;
    uniforms.uTwilight.value = frame.twilight;
    uniforms.uSunVisibility.value = frame.sunVisibility;
    uniforms.uMoonVisibility.value = frame.moonVisibility;
    uniforms.uExposure.value = frame.exposure;
    setRgb(uniforms.uZenith.value, frame.zenith);
    setRgb(uniforms.uHorizon.value, frame.horizon);
    setRgb(uniforms.uBelow.value, frame.below);
    setRgb(uniforms.uCloudLight.value, frame.cloudLight);
    setRgb(uniforms.uCloudShadow.value, frame.cloudShadow);
    setRgb(uniforms.uSunColor.value, frame.sun);
    setRgb(uniforms.uMoonColor.value, frame.moon);
    uniforms.uSunDirection.value.fromArray(frame.sunDirection);
    uniforms.uMoonDirection.value.fromArray(frame.moonDirection);
    return frame;
  };

  return {
    group,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

export { VERTEX_SHADER as PROCEDURAL_SKY_VERTEX_SHADER, FRAGMENT_SHADER as PROCEDURAL_SKY_FRAGMENT_SHADER };
