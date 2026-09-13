import type { DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Points, Scene, WebGLRenderer } from 'three';
import {
  DEFAULT_WORLD_WEATHER,
  DEFAULT_WEATHER_LOCATION,
  fetchWorldWeather,
  getWorldTimeState,
  WORLD_TIME_LIGHTING,
  WORLD_TIME_PHASES,
  WORLD_TIME_PHASE_SCHEDULE,
  WORLD_WEATHER_REFRESH_MS,
  type WorldTimePhase,
  type WorldWeatherState,
} from './world-weather';
import { fetchCwaWorldWeather } from './world-weather-client';
import { createWorldWeatherEffects } from './world-weather-effects';
import { createProceduralSky } from './procedural-sky/create-procedural-sky';
import type { ProceduralSkyFrame } from './procedural-sky/procedural-sky-palette';
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
  useProceduralSky?: boolean;
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

function getProceduralSkyStartHour(worldTime: { phase: WorldTimePhase; phaseProgress: number }): number {
  const schedule = WORLD_TIME_PHASE_SCHEDULE[worldTime.phase];
  return (schedule.startMinute + schedule.durationMinutes * worldTime.phaseProgress) / 60 % 24;
}

export function createWorldWeatherRuntime({
  THREE,
  scene,
  renderer,
  quality,
  fieldSize,
  walkableSize,
  dayNightEnabled: initialDayNightEnabled,
  useProceduralSky = false,
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
  let dayNightEnabled = initialDayNightEnabled;
  const getActiveWorldTimeState = () => fixedTimePhase
    ? {
      phase: fixedTimePhase,
      phaseIndex: WORLD_TIME_PHASES.indexOf(fixedTimePhase),
      phaseProgress: 0,
    }
    : dayNightEnabled
      ? getWorldTimeState()
      : { phase: 'day' as const, phaseIndex: 1, phaseProgress: 0 };
  let currentWorldTime = getActiveWorldTimeState();
  const proceduralSky = useProceduralSky
    ? createProceduralSky({
      THREE,
      prefersReducedMotion,
      quality,
      cycleSeconds: 3600,
      startHour: getProceduralSkyStartHour(currentWorldTime),
    })
    : undefined;
  const weatherEffects = createWorldWeatherEffects(THREE, {
    quality,
    fieldSize,
    walkableSize,
    starsEnabled: !proceduralSky,
  });
  scene.add(weatherEffects.group);
  if (proceduralSky) scene.add(proceduralSky.group);
  const pollenMaterial = pollen.material as import('three').ShaderMaterial;
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

  const applyProceduralLighting = (frame: ProceduralSkyFrame, weather: WorldWeatherState) => {
    const isCloudyWeather = weather.condition === 'cloudy' || weather.condition === 'storm';
    const weatherLightFactor = isCloudyWeather ? 0.72 : 1;
    const daylight = 1 - frame.night;
    ambient.intensity = (0.55 + daylight * 1.17 + frame.moonVisibility * 0.15) * weatherLightFactor;
    sun.position.fromArray(frame.sunDirection).multiplyScalar(28);
    sun.intensity = (0.05 + frame.sunVisibility * 2.65) * weatherLightFactor;
    sun.color.setRGB(frame.sun[0], frame.sun[1], frame.sun[2]);
    nightFill.intensity = frame.night * 1.05;
    moonFill.position.fromArray(frame.moonDirection).multiplyScalar(24);
    moonFill.intensity = frame.moonVisibility * 0.5;
    moonFill.color.setRGB(frame.moon[0], frame.moon[1], frame.moon[2]);
    scene.environmentIntensity = (0.15 + daylight * 0.12) * weatherLightFactor;
  };

  const loadSkyForPhase = (phase: WorldTimePhase) => new Promise<import('three').Texture>((resolve, reject) => {
    textureLoader.load(skyboxUrl ?? PROTOTYPE_WORLD_ASSETS.skyboxes[phase], resolve, undefined, reject);
  });

  const applySkyForPhase = async (phase: WorldTimePhase) => {
    if (proceduralSky || activeSkyPhase === phase || signal.aborted) return;
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
    if (proceduralSky) {
      scene.remove(proceduralSky.group);
      proceduralSky.dispose();
    }
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
      const proceduralFrame = proceduralSky?.update({
        time,
        camera,
        dayNightEnabled,
        // Keep a readable cloud layer even when the live weather endpoint
        // reports a clear sky; weather still increases it above this floor.
        cloudCover: Math.max(currentWeather.cloudCover, 72),
      });
      const visualPhase = proceduralFrame?.phase ?? currentWorldTime.phase;
      const weatherKey = `${visualPhase}:${currentWeather.condition}:${currentWeather.intensity}`;
      if (weatherKey !== appliedWorldVisualKey) {
        appliedWorldVisualKey = weatherKey;
        applyWorldVisualState(visualPhase, currentWeather);
      }
      if (proceduralFrame) applyProceduralLighting(proceduralFrame, currentWeather);
      const lightningStrength = weatherEffects.update({
        time,
        delta,
        phase: visualPhase,
        weather: currentWeather,
        camera,
        prefersReducedMotion,
      });
      const lighting = WORLD_TIME_LIGHTING[visualPhase];
      const weatherExposureFactor = currentWeather.condition === 'cloudy' || currentWeather.condition === 'storm' ? 0.82 : 1;
      renderer.toneMappingExposure = proceduralFrame
        ? proceduralFrame.exposure * weatherExposureFactor + lightningStrength * 0.06
        : lighting.exposure * weatherExposureFactor + lightningStrength * 0.06;
    },
    setDayNightEnabled,
  };
}
