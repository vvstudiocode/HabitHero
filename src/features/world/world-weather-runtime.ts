import type { DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Points, Scene, WebGLRenderer } from 'three';
import {
  DEFAULT_WORLD_WEATHER,
  DEFAULT_WEATHER_LOCATION,
  fetchWorldWeather,
  getWorldTimeState,
  WORLD_TIME_LIGHTING,
  WORLD_TIME_PHASES,
  WORLD_WEATHER_REFRESH_MS,
  type WorldTimePhase,
  type WorldWeatherState,
} from './world-weather';
import { fetchCwaWorldWeather } from './world-weather-client';
import { createWorldWeatherEffects } from './world-weather-effects';
import { PROTOTYPE_WORLD_ASSETS } from './world-runtime-assets';
import { getNaturalWorldVisualSettings } from '../../../terrain-prototype/natural-world-visuals.js';

type ThreeNamespace = typeof import('three');
type WorldQuality = 'low' | 'high';
type VisualSettings = ReturnType<typeof getNaturalWorldVisualSettings>;

export interface WorldWeatherRuntime {
  update: (input: { time: number; delta: number; camera: PerspectiveCamera }) => void;
  setDayNightEnabled: (enabled: boolean) => void;
}

export interface WorldWeatherRuntimeOptions {
  THREE: ThreeNamespace;
  scene: Scene;
  renderer: WebGLRenderer;
  quality: WorldQuality;
  fieldSize: number;
  walkableSize: number;
  dayNightEnabled: boolean;
  fixedTimePhase?: WorldTimePhase;
  skyboxUrl?: string;
  skyboxOffset?: Readonly<{ x: number; y: number }>;
  visualSettings: VisualSettings;
  ambient: HemisphereLight;
  sun: DirectionalLight;
  nightFill: HemisphereLight;
  moonFill: DirectionalLight;
  sunlightPatches: Group;
  pollen: Points;
  butterflies: Group;
  signal: AbortSignal;
  prefersReducedMotion: boolean;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function createWorldWeatherRuntime({
  THREE,
  scene,
  renderer,
  quality,
  fieldSize,
  walkableSize,
  dayNightEnabled: initialDayNightEnabled,
  fixedTimePhase,
  skyboxUrl,
  skyboxOffset,
  visualSettings,
  ambient,
  sun,
  nightFill,
  moonFill,
  sunlightPatches,
  pollen,
  butterflies,
  signal,
  prefersReducedMotion,
}: WorldWeatherRuntimeOptions): WorldWeatherRuntime {
  scene.background = new THREE.Color(visualSettings.backgroundColor);
  scene.fog = null;
  const weatherEffects = createWorldWeatherEffects(THREE, { quality, fieldSize, walkableSize });
  scene.add(weatherEffects.group);
  const pollenMaterial = pollen.material as import('three').ShaderMaterial;
  let dayNightEnabled = initialDayNightEnabled;
  const getActiveWorldTimeState = () => fixedTimePhase
    ? { phase: fixedTimePhase, phaseIndex: WORLD_TIME_PHASES.indexOf(fixedTimePhase), phaseProgress: 0 }
    : dayNightEnabled
      ? getWorldTimeState()
      : { phase: 'day' as const, phaseIndex: 1, phaseProgress: 0 };
  let currentWorldTime = getActiveWorldTimeState();
  let currentWeather: WorldWeatherState = DEFAULT_WORLD_WEATHER;
  let appliedWorldVisualKey = '';
  let activeSkyPhase: WorldTimePhase | undefined;
  let activeSkyTexture: import('three').Texture | undefined;
  let skyRequestSequence = 0;
  let weatherRefreshTimer: number | undefined;
  const textureLoader = new THREE.TextureLoader();
  const skyboxDome = skyboxOffset
    ? (() => {
      const geometry = new THREE.SphereGeometry(1, 48, 32);
      const material = new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(100);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1000;
      scene.add(mesh);
      return { geometry, material, mesh };
    })()
    : undefined;

  const setSkyboxDomeTexture = (source: import('three').Texture) => {
    if (!skyboxDome || !skyboxOffset) return;
    const texture = source.clone();
    texture.mapping = THREE.UVMapping;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(-1, 1);
    texture.offset.set(1 - skyboxOffset.x, -skyboxOffset.y);
    texture.needsUpdate = true;
    skyboxDome.material.map?.dispose();
    skyboxDome.material.map = texture;
    skyboxDome.material.needsUpdate = true;
  };

  const applyWorldVisualState = (phase: WorldTimePhase, weather: WorldWeatherState) => {
    const lighting = WORLD_TIME_LIGHTING[phase];
    const isNight = phase === 'night';
    const isCloudyWeather = weather.condition === 'cloudy' || weather.condition === 'storm';
    const weatherLightFactor = isCloudyWeather ? 0.72 : 1;
    ambient.intensity = lighting.hemisphereIntensity * weatherLightFactor;
    sun.intensity = lighting.sunIntensity * weatherLightFactor;
    sun.color.setHex(lighting.sunColor);
    nightFill.intensity = isNight ? 1.05 : 0;
    moonFill.intensity = isNight ? 0.36 : 0;
    scene.environmentIntensity = lighting.environmentIntensity * weatherLightFactor;
    renderer.toneMappingExposure = lighting.exposure * (isCloudyWeather ? 0.82 : 1);
    pollenMaterial.uniforms.uOpacity.value = isNight
      ? 0
      : visualSettings.pollenOpacity * (isCloudyWeather ? 0.2 : 1);
    sunlightPatches.visible = !isNight && !isCloudyWeather;
    butterflies.visible = !isNight && weather.condition === 'clear';
  };

  const loadSkyForPhase = (phase: WorldTimePhase) => new Promise<import('three').Texture>((resolve, reject) => {
    textureLoader.load(skyboxUrl ?? PROTOTYPE_WORLD_ASSETS.skyboxes[phase], resolve, undefined, reject);
  });

  const applySkyForPhase = async (phase: WorldTimePhase) => {
    if (activeSkyPhase === phase || signal.aborted) return;
    const requestSequence = ++skyRequestSequence;
    const loadedTexture = await loadSkyForPhase(phase);
    if (signal.aborted || requestSequence !== skyRequestSequence) {
      loadedTexture.dispose();
      return;
    }
    loadedTexture.colorSpace = THREE.SRGBColorSpace;
    loadedTexture.mapping = THREE.EquirectangularReflectionMapping;
    loadedTexture.needsUpdate = true;
    activeSkyPhase = phase;
    if (skyboxDome) {
      setSkyboxDomeTexture(loadedTexture);
      scene.background = new THREE.Color(visualSettings.backgroundColor);
    } else {
      scene.background = loadedTexture;
    }
    scene.environment = loadedTexture;
    scene.environmentIntensity = WORLD_TIME_LIGHTING[phase].environmentIntensity;
    activeSkyTexture?.dispose();
    activeSkyTexture = loadedTexture;
  };

  const setDayNightEnabled = (enabled: boolean) => {
    if (dayNightEnabled === enabled) return;
    dayNightEnabled = enabled;
    const nextWorldTime = getActiveWorldTimeState();
    if (nextWorldTime.phase !== currentWorldTime.phase) {
      currentWorldTime = nextWorldTime;
      void applySkyForPhase(nextWorldTime.phase).catch((error: unknown) => {
        if (!signal.aborted) console.warn('Unable to switch the world time sky texture.', error);
      });
    }
    appliedWorldVisualKey = '';
    applyWorldVisualState(currentWorldTime.phase, currentWeather);
  };

  const refreshWorldWeather = () => {
    void fetchCwaWorldWeather()
      .catch((cwaError: unknown) => {
        if (signal.aborted) throw cwaError;
        console.warn('Unable to load CWA weather; using Open-Meteo fallback.');
        return fetchWorldWeather({ location: DEFAULT_WEATHER_LOCATION, signal });
      })
      .then((weather) => { currentWeather = weather; })
      .catch((error: unknown) => {
        if (!signal.aborted && !isAbortError(error)) {
          console.warn('Unable to load live weather; keeping the last known weather.');
        }
      })
      .finally(() => {
        if (!signal.aborted) weatherRefreshTimer = window.setTimeout(refreshWorldWeather, WORLD_WEATHER_REFRESH_MS);
      });
  };

  signal.addEventListener('abort', () => {
    skyRequestSequence += 1;
    if (weatherRefreshTimer !== undefined) window.clearTimeout(weatherRefreshTimer);
    activeSkyTexture?.dispose();
    activeSkyTexture = undefined;
    if (skyboxDome) {
      scene.remove(skyboxDome.mesh);
      skyboxDome.material.map?.dispose();
      skyboxDome.material.dispose();
      skyboxDome.geometry.dispose();
    }
  }, { once: true });

  applyWorldVisualState(currentWorldTime.phase, currentWeather);
  void applySkyForPhase(currentWorldTime.phase).catch((error: unknown) => {
    if (!signal.aborted) console.warn('Unable to load the world time sky texture.', error);
  });
  refreshWorldWeather();

  return {
    update: ({ time, delta, camera }) => {
      if (skyboxDome) skyboxDome.mesh.position.copy(camera.position);
      const nextWorldTime = getActiveWorldTimeState();
      if (nextWorldTime.phase !== currentWorldTime.phase) {
        currentWorldTime = nextWorldTime;
        void applySkyForPhase(nextWorldTime.phase).catch((error: unknown) => {
          if (!signal.aborted) console.warn('Unable to switch the world time sky texture.', error);
        });
      }
      const weatherKey = `${currentWorldTime.phase}:${currentWeather.condition}:${currentWeather.intensity}`;
      if (weatherKey !== appliedWorldVisualKey) {
        appliedWorldVisualKey = weatherKey;
        applyWorldVisualState(currentWorldTime.phase, currentWeather);
      }
      const lightningStrength = weatherEffects.update({
        time,
        delta,
        phase: currentWorldTime.phase,
        weather: currentWeather,
        camera,
        prefersReducedMotion,
      });
      const lighting = WORLD_TIME_LIGHTING[currentWorldTime.phase];
      const weatherExposureFactor = currentWeather.condition === 'cloudy' || currentWeather.condition === 'storm' ? 0.82 : 1;
      renderer.toneMappingExposure = lighting.exposure * weatherExposureFactor + lightningStrength * 0.06;
    },
    setDayNightEnabled,
  };
}
