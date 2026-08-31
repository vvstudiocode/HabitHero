(function skyDemoCore(global) {
  'use strict';

  const THREE = global.THREE;
  if (!THREE) {
    document.body.innerHTML = '<p style="padding:24px;font-family:system-ui">Three.js 載入失敗，請確認瀏覽器可以連線到 CDN。</p>';
    return;
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const color = (hex) => new THREE.Color(hex);

  const PHASES = [
    { name: '深夜', start: 0, top: '#07132e', bottom: '#192b55', sun: '#7d9bd1', light: 0.2 },
    { name: '黎明', start: 5, top: '#5f85b2', bottom: '#f4b68e', sun: '#ffd08a', light: 0.78 },
    { name: '白天', start: 7, top: '#3f94d1', bottom: '#cceeff', sun: '#fff0b0', light: 1 },
    { name: '黃昏', start: 17, top: '#5a5c9a', bottom: '#f29c75', sun: '#ffbb7a', light: 0.68 },
    { name: '深夜', start: 19, top: '#07132e', bottom: '#192b55', sun: '#7d9bd1', light: 0.2 },
    { name: '深夜', start: 24, top: '#07132e', bottom: '#192b55', sun: '#7d9bd1', light: 0.2 },
  ];

  function getSkyState(hour) {
    const normalized = ((hour % 24) + 24) % 24;
    for (let index = 0; index < PHASES.length - 1; index += 1) {
      const left = PHASES[index];
      const right = PHASES[index + 1];
      if (normalized >= left.start && normalized < right.start) {
        const progress = (normalized - left.start) / (right.start - left.start);
        return {
          phase: progress < 0.45 ? left.name : right.name,
          top: color(left.top).lerp(color(right.top), progress),
          bottom: color(left.bottom).lerp(color(right.bottom), progress),
          sun: color(left.sun).lerp(color(right.sun), progress),
          light: lerp(left.light, right.light, progress),
          isNight: normalized < 5 || normalized >= 19,
          normalized,
        };
      }
    }
    return getSkyState(12);
  }

  function createSkyDome() {
    const geometry = new THREE.SphereGeometry(75, 32, 18);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: color('#3f94d1') },
        bottomColor: { value: color('#cceeff') },
        cloudCover: { value: 0.2 },
      },
      vertexShader: `
        varying vec3 vSkyPosition;
        void main() {
          vSkyPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float cloudCover;
        varying vec3 vSkyPosition;
        void main() {
          float height = clamp(normalize(vSkyPosition).y * 0.5 + 0.5, 0.0, 1.0);
          float horizon = smoothstep(0.03, 0.9, height);
          vec3 sky = mix(bottomColor, topColor, horizon);
          sky = mix(sky, sky * vec3(0.7, 0.75, 0.8), cloudCover * 0.28);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(geometry, material);
    dome.name = 'js-sky-gradient';
    dome.renderOrder = -100;
    return dome;
  }

  function createStars() {
    const count = 520;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const theta = Math.random() * Math.PI * 2;
      const height = Math.random() * 2 - 1;
      const horizontalRadius = Math.sqrt(1 - height * height);
      const radius = 58;
      positions[index * 3] = Math.cos(theta) * horizontalRadius * radius;
      positions[index * 3 + 1] = height * radius;
      positions[index * 3 + 2] = Math.sin(theta) * horizontalRadius * radius;
      seeds[index] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uSize: { value: 2.25 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        uniform float uSize;
        varying float vSeed;
        void main() {
          vSeed = aSeed;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          float pulse = 0.72 + 0.28 * sin(uTime * 1.5 + aSeed * 2.7);
          gl_PointSize = uSize * pulse * (150.0 / max(-viewPosition.z, 1.0));
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying float vSeed;
        void main() {
          float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
          float softCircle = smoothstep(0.5, 0.04, distanceFromCenter);
          float twinkle = 0.48 + 0.52 * (0.5 + 0.5 * sin(uTime * 2.2 + vSeed * 5.0));
          vec3 warmYellow = mix(vec3(1.0, 0.48, 0.02), vec3(1.0, 0.86, 0.18), twinkle);
          float alpha = softCircle * uOpacity * (0.56 + 0.44 * twinkle);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(warmYellow, alpha);
        }
      `,
    });
    const stars = new THREE.Points(geometry, material);
    stars.name = 'js-night-stars';
    stars.renderOrder = 40;
    return stars;
  }

  function createSunAndMoon() {
    const group = new THREE.Group();
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffefad, transparent: true, opacity: 1 }),
    );
    sun.name = 'js-sun';
    sun.renderOrder = 30;
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.48, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xd9e8ff, transparent: true, opacity: 0 }),
    );
    moon.name = 'js-moon';
    moon.renderOrder = 30;
    sun.material.depthTest = false;
    sun.material.depthWrite = false;
    moon.material.depthTest = false;
    moon.material.depthWrite = false;
    group.add(sun, moon);
    return { group, sun, moon };
  }

  function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 150;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 18, 0, 140);
    gradient.addColorStop(0, 'rgba(255,255,255,0.96)');
    gradient.addColorStop(1, 'rgba(202,226,242,0.82)');
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(90, 86, 70, 42, 0, 0, Math.PI * 2);
    context.ellipse(152, 65, 64, 55, 0, 0, Math.PI * 2);
    context.ellipse(218, 86, 74, 42, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.7)';
    context.beginPath();
    context.ellipse(143, 44, 33, 27, 0, 0, Math.PI * 2);
    context.fill();
    return new THREE.CanvasTexture(canvas);
  }

  function createPuffCloud({ shader = false, glossy = false, soft = false } = {}) {
    const cloud = new THREE.Group();
    cloud.userData.seed = Math.random() * Math.PI * 2;
    cloud.userData.materials = [];
    cloud.userData.baseOpacities = [];
    const puffCount = soft ? 7 : glossy ? 5 : 6;
    for (let index = 0; index < puffCount; index += 1) {
      let material;
      if (shader) {
        material = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { uTint: { value: color('#f3fbff') }, uAlpha: { value: 0.76 } },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 uTint;
            uniform float uAlpha;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
              float edge = pow(max(dot(vNormal, vec3(0.25, 0.9, 0.4)), 0.0), 0.28);
              float softNoise = 0.82 + 0.12 * sin(vPosition.x * 3.1 + vPosition.y * 4.7);
              gl_FragColor = vec4(uTint * (0.72 + edge * 0.35), uAlpha * edge * softNoise);
            }
          `,
        });
      } else {
        material = new THREE.MeshPhongMaterial({
          color: soft ? 0xe6f3f8 : glossy ? 0xf7fcff : 0xeaf7ff,
          transparent: true,
          opacity: soft ? 0.28 : glossy ? 0.86 : 0.76,
          shininess: soft ? 24 : glossy ? 80 : 20,
          depthWrite: false,
        });
      }
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material);
      const spread = index - (puffCount - 1) / 2;
      puff.position.set(spread * (soft ? 0.62 : 0.72), index % 2 === 0 ? 0 : 0.38, (index % 3 - 1) * 0.18);
      puff.scale.set(
        (soft ? 1.05 : 1.15) + Math.random() * 0.44,
        (soft ? 0.56 : 0.64) + Math.random() * 0.3,
        (soft ? 0.64 : 0.72) + Math.random() * 0.3,
      );
      cloud.add(puff);
      cloud.userData.materials.push(material);
      cloud.userData.baseOpacities.push(material.opacity ?? 1);
    }
    cloud.scale.setScalar(soft ? 0.94 + Math.random() * 0.34 : 0.82 + Math.random() * 0.45);
    return cloud;
  }

  function createCloudLayer(variant) {
    const group = new THREE.Group();
    group.name = `js-cloud-layer-${variant}`;
    const clouds = [];
    const texture = variant === 'canvas' ? createCloudTexture() : null;
    const count = variant === 'nimbus' ? 18 : variant === 'canvas' ? 16 : 10;
    for (let index = 0; index < count; index += 1) {
      let cloud;
      if (variant === 'canvas') {
        cloud = new THREE.Sprite(new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        }));
        cloud.scale.set(4.4 + Math.random() * 3.2, 1.9 + Math.random() * 0.9, 1);
        cloud.userData.materials = [cloud.material];
        cloud.userData.baseOpacities = [0.72];
      } else if (variant === 'nimbus') {
        cloud = createPuffCloud({ soft: true });
      } else {
        cloud = createPuffCloud({ shader: variant === 'volumetric', glossy: variant === 'nimbus' });
      }
      if (variant === 'nimbus') {
        const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
        const radius = 23 + Math.random() * 17;
        cloud.position.set(
          Math.cos(angle) * radius,
          6.4 + Math.random() * 2.8,
          Math.sin(angle) * radius,
        );
      } else {
        cloud.position.set(-16 + Math.random() * 32, 8.7 + Math.random() * 5.3, -14 - Math.random() * 16);
      }
      cloud.userData.speed = 0.22 + Math.random() * 0.28;
      cloud.userData.seed = Math.random() * 6.28;
      cloud.userData.baseY = cloud.position.y;
      group.add(cloud);
      clouds.push(cloud);
    }
    return { group, clouds, texture };
  }

  function createTree(x, z, scale = 1) {
    const tree = new THREE.Group();
    tree.position.set(x, -0.05, z);
    tree.scale.setScalar(scale);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.25, 1.35, 8),
      new THREE.MeshStandardMaterial({ color: 0x8f5b3f, roughness: 0.9 }),
    );
    trunk.position.y = 0.65;
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 1),
      new THREE.MeshStandardMaterial({ color: 0x55a872, roughness: 0.92 }),
    );
    crown.position.y = 1.55;
    tree.add(trunk, crown);
    return tree;
  }

  function createWorld() {
    const world = new THREE.Group();
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(7.8, 9, 1, 48),
      new THREE.MeshStandardMaterial({ color: 0x72b26f, roughness: 1 }),
    );
    island.position.y = -1.05;
    world.add(island);

    const path = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 5.7, 48, 2, Math.PI * 0.1, Math.PI * 1.48),
      new THREE.MeshStandardMaterial({ color: 0xe9c98a, roughness: 1, side: THREE.DoubleSide }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.y = -0.53;
    world.add(path);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(10.5, 10.5, 0.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x5bb9d7, roughness: 0.32, metalness: 0.05 }),
    );
    water.position.y = -1.7;
    world.add(water);

    const house = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.7, 2),
      new THREE.MeshStandardMaterial({ color: 0xffd17c, roughness: 0.85 }),
    );
    body.position.y = 0.32;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 1.35, 4),
      new THREE.MeshStandardMaterial({ color: 0xe9775d, roughness: 0.88 }),
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.84;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.78, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x6d4b42, roughness: 0.9 }),
    );
    door.position.set(0, -0.05, 1.04);
    house.position.set(-1.7, 0, -1.6);
    house.add(body, roof, door);
    world.add(house);
    world.add(createTree(3.6, -1.8, 1.2), createTree(4.5, 1.1, 0.82), createTree(-4.1, 2.5, 1.08));

    const child = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf4b183, roughness: 0.8 }));
    head.position.y = 1.45;
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.38, 0.92, 12), new THREE.MeshStandardMaterial({ color: 0x6b93dd, roughness: 0.82 }));
    bodyMesh.position.y = 0.72;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), new THREE.MeshStandardMaterial({ color: 0xf2b24d, roughness: 0.8 }));
    cap.position.y = 1.62;
    child.position.set(1.6, -0.43, 1.5);
    child.add(head, bodyMesh, cap);
    world.add(child);
    return world;
  }

  function createOrbit(canvas, camera, target, renderer) {
    const orbit = { yaw: 0.52, pitch: 0.68, distance: 16, pointerId: null, x: 0, y: 0 };
    const updateCamera = () => {
      const sinPitch = Math.sin(orbit.pitch);
      camera.position.set(
        target.x + Math.sin(orbit.yaw) * sinPitch * orbit.distance,
        target.y + Math.cos(orbit.pitch) * orbit.distance,
        target.z + Math.cos(orbit.yaw) * sinPitch * orbit.distance,
      );
      camera.lookAt(target);
    };
    const onPointerDown = (event) => {
      orbit.pointerId = event.pointerId;
      orbit.x = event.clientX;
      orbit.y = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (orbit.pointerId !== event.pointerId) return;
      orbit.yaw -= (event.clientX - orbit.x) * 0.008;
      orbit.pitch = clamp(orbit.pitch + (event.clientY - orbit.y) * 0.006, 0.38, 1.25);
      orbit.x = event.clientX;
      orbit.y = event.clientY;
      updateCamera();
    };
    const onPointerUp = (event) => {
      if (orbit.pointerId === event.pointerId) orbit.pointerId = null;
    };
    const onWheel = (event) => {
      event.preventDefault();
      orbit.distance = clamp(orbit.distance + event.deltaY * 0.012, 10, 25);
      updateCamera();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    updateCamera();
    return {
      reset() {
        orbit.yaw = 0.52;
        orbit.pitch = 0.68;
        orbit.distance = 16;
        updateCamera();
      },
      updateCamera,
      dispose() {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);
        renderer.dispose();
      },
    };
  }

  function hourLabel(hour) {
    const safeHour = ((hour % 24) + 24) % 24;
    const h = Math.floor(safeHour).toString().padStart(2, '0');
    const m = Math.round((safeHour % 1) * 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function create(options) {
    const canvas = document.getElementById('scene');
    const timeRange = document.getElementById('time-range');
    const timeValue = document.getElementById('time-value');
    const autoButton = document.getElementById('auto-time');
    const resetButton = document.getElementById('reset-camera');
    const cloudRange = document.getElementById('cloud-range');
    const cloudValue = document.getElementById('cloud-value');
    const weatherName = document.getElementById('weather-name');
    const weatherDetails = document.getElementById('weather-details');
    if (!canvas || !timeRange || !autoButton || !resetButton) return null;

    const reducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = {
      hour: options.defaultHour ?? 10.5,
      autoTime: false,
      cloudCover: options.cloudCover ?? 0.32,
      wind: options.wind ?? 0.35,
      weather: options.weather ?? '晴朗',
      temperature: null,
    };
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x8fcbea, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
    const target = new THREE.Vector3(0, 1.3, 0);
    const orbit = createOrbit(canvas, camera, target, renderer);
    const celestialAnchor = new THREE.Vector3();
    const skyFrameForward = new THREE.Vector3();
    const skyFrameRight = new THREE.Vector3();
    const skyFrameUp = new THREE.Vector3();
    camera.updateMatrixWorld();
    camera.getWorldDirection(skyFrameForward);
    skyFrameRight.setFromMatrixColumn(camera.matrixWorld, 0);
    skyFrameUp.setFromMatrixColumn(camera.matrixWorld, 1);
    celestialAnchor.copy(target).addScaledVector(skyFrameForward, 22);
    const dome = createSkyDome();
    const stars = createStars();
    // Keep the star field in world space so it stays in the sky as the camera
    // rotates, instead of being re-centered on the viewer each frame.
    stars.position.copy(target);
    const celestial = createSunAndMoon();
    const clouds = createCloudLayer(options.variant || 'puffy');
    const world = createWorld();
    const ambient = new THREE.HemisphereLight(0xc9e9ff, 0x375071, 1.4);
    const sunLight = new THREE.DirectionalLight(0xffdcad, 2.1);
    sunLight.position.set(-4, 10, 5);
    scene.add(dome, stars, celestial.group, clouds.group, world, ambient, sunLight);
    scene.fog = new THREE.Fog(0x9bcfea, 24, 70);

    function resize() {
      const width = canvas.clientWidth || canvas.parentElement.clientWidth;
      const height = canvas.clientHeight || canvas.parentElement.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }
    global.addEventListener('resize', resize);
    resize();

    function updateUi(sky) {
      timeRange.value = String(state.hour);
      timeValue.textContent = hourLabel(state.hour);
      cloudRange.value = String(Math.round(state.cloudCover * 100));
      cloudValue.textContent = `${Math.round(state.cloudCover * 100)}%`;
      autoButton.textContent = state.autoTime ? '停止自動' : '自動日夜';
      autoButton.classList.toggle('primary', state.autoTime);
      weatherName.innerHTML = `<span class="status-dot"></span>${state.weather} · ${sky.phase}`;
      const liveTemperature = state.temperature === null ? '' : ` · ${state.temperature.toFixed(1)}°C`;
      weatherDetails.textContent = `${hourLabel(state.hour)} · 雲量 ${Math.round(state.cloudCover * 100)}%${liveTemperature}`;
    }

    timeRange.addEventListener('input', () => {
      state.hour = Number(timeRange.value);
      state.autoTime = false;
      updateUi(getSkyState(state.hour));
    });
    cloudRange.addEventListener('input', () => {
      state.cloudCover = Number(cloudRange.value) / 100;
      updateUi(getSkyState(state.hour));
    });
    autoButton.addEventListener('click', () => {
      state.autoTime = !state.autoTime;
      updateUi(getSkyState(state.hour));
    });
    resetButton.addEventListener('click', () => orbit.reset());

    const liveWeatherPromise = options.liveWeather ? fetchLiveWeather(state, updateUi) : Promise.resolve();
    let previous = performance.now();
    let animationFrame = 0;
    function render(now) {
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (state.autoTime && !reducedMotion) state.hour = (state.hour + delta * (options.daySpeed ?? 0.7)) % 24;
      const sky = getSkyState(state.hour);
      const domeMaterial = dome.material;
      domeMaterial.uniforms.topColor.value.copy(sky.top);
      domeMaterial.uniforms.bottomColor.value.copy(sky.bottom);
      domeMaterial.uniforms.cloudCover.value = state.cloudCover;
      const starsMaterial = stars.material;
      starsMaterial.uniforms.uTime.value = reducedMotion ? 0 : now * 0.001;
      starsMaterial.uniforms.uOpacity.value = sky.isNight ? 0.9 : 0;
      const angle = ((state.hour - 6) / 24) * Math.PI * 2;
      const celestialX = Math.cos(angle) * 9;
      const celestialY = Math.sin(angle) * 1.3 + 4.2;
      celestial.sun.position.copy(celestialAnchor)
        .addScaledVector(skyFrameRight, celestialX * 0.48)
        .addScaledVector(skyFrameUp, celestialY);
      celestial.moon.position.copy(celestialAnchor)
        .addScaledVector(skyFrameRight, -celestialX * 0.48)
        .addScaledVector(skyFrameUp, 4.2 - Math.sin(angle) * 1.3);
      celestial.sun.material.opacity = sky.isNight ? 0 : clamp(0.62 + Math.sin(angle) * 0.3, 0.42, 1);
      celestial.moon.material.opacity = sky.isNight ? 1 : 0;
      celestial.sun.scale.setScalar(0.92 + Math.max(0, Math.sin(angle)) * 0.18);
      celestial.moon.scale.setScalar(sky.isNight ? 1.12 : 0.92);
      const brightness = sky.light * (1 - state.cloudCover * 0.33);
      ambient.intensity = 0.45 + brightness * 1.08;
      sunLight.intensity = 0.18 + brightness * 2.2;
      sunLight.position.set(celestialX * 0.3, Math.max(2, celestialY * 0.5), 4);
      scene.fog.color.copy(sky.bottom);
      scene.fog.near = 24 - state.cloudCover * 4;
      scene.fog.far = options.variant === 'nimbus'
        ? 58 - state.cloudCover * 10
        : 70 - state.cloudCover * 18;
      const cloudTint = options.variant === 'nimbus'
        ? (sky.isNight ? color('#a8bdd6') : sky.phase === '黃昏' ? color('#f0d1c3') : color('#ffffff'))
        : null;
      clouds.clouds.forEach((cloud, index) => {
        cloud.position.x += delta * cloud.userData.speed * (0.5 + state.wind);
        if (cloud.position.x > (options.variant === 'nimbus' ? 36 : 22)) cloud.position.x = options.variant === 'nimbus' ? -36 : -22;
        cloud.position.y = cloud.userData.baseY + Math.sin(now * 0.00018 + cloud.userData.seed) * 0.13;
        const cloudAlpha = options.variant === 'nimbus'
          ? clamp(0.62 + state.cloudCover * 0.3, 0.58, 0.88)
          : clamp(0.26 + state.cloudCover * 0.86, 0.18, 1);
        const materials = cloud.userData.materials || (cloud.material ? [cloud.material] : []);
        const baseOpacities = cloud.userData.baseOpacities || materials.map(() => 1);
        materials.forEach((material, materialIndex) => {
          material.opacity = baseOpacities[materialIndex] * cloudAlpha;
          if (cloudTint && material.color) material.color.copy(cloudTint);
        });
        if (options.variant === 'volumetric') cloud.rotation.y += delta * 0.014 * (index % 2 ? 1 : -1);
      });
      if (options.update) options.update({ THREE, state, sky, delta, now, scene, clouds, celestial, world });
      updateUi(sky);
      renderer.render(scene, camera);
      animationFrame = global.requestAnimationFrame(render);
    }
    updateUi(getSkyState(state.hour));
    animationFrame = global.requestAnimationFrame(render);

    return {
      state,
      scene,
      renderer,
      setWeather(weather) {
        Object.assign(state, weather);
        updateUi(getSkyState(state.hour));
      },
      destroy() {
        global.cancelAnimationFrame(animationFrame);
        global.removeEventListener('resize', resize);
        orbit.dispose();
        renderer.dispose();
      },
      liveWeatherPromise,
    };
  }

  async function fetchLiveWeather(state, updateUi) {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=25.033&longitude=121.565&current=weather_code,cloud_cover,wind_speed_10m,temperature_2m&timezone=Asia%2FTaipei';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const current = payload.current || {};
      const code = Number(current.weather_code || 0);
      const weather = code >= 95 ? '雷雨' : code >= 51 ? '降雨' : code >= 45 ? '多雲' : '晴朗';
      state.weather = weather;
      state.cloudCover = clamp(Number(current.cloud_cover || 0) / 100, 0, 1);
      state.wind = clamp(Number(current.wind_speed_10m || 0) / 35, 0, 1);
      state.temperature = Number.isFinite(Number(current.temperature_2m)) ? Number(current.temperature_2m) : null;
      if (current.time) {
        const date = new Date(current.time);
        state.hour = date.getHours() + date.getMinutes() / 60;
      }
      updateUi(getSkyState(state.hour));
    } catch (error) {
      state.weather = '示範模式（即時資料未連線）';
      updateUi(getSkyState(state.hour));
      console.warn('Open-Meteo unavailable; using demo weather.', error);
    }
  }

  global.SkyDemo = { create };
}(window));
