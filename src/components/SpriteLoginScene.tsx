import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function SpriteLoginScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    const readyTimer = window.setTimeout(() => setReady(true), 450);
    let disposed = false;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = prefersReducedMotion.matches;
    let paused = reducedMotion;
    let mobileLift = 0;
    let mobileSceneX = 0;
    let last = performance.now();
    const targetParallax = new THREE.Vector2();
    const parallax = new THREE.Vector2();
    let pointerDown: { x: number; y: number; time: number; id: number } | null = null;
    const interactiveBubbles: THREE.Group[] = [];
    const sparkles: THREE.Sprite[] = [];

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b6d7d, 0.032);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0.1, 2.2, 9.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 5.4;
    controls.maxDistance = 12.5;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.minPolarAngle = Math.PI * 0.23;
    controls.target.set(0, 0.9, 0);
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.34;

    const hemi = new THREE.HemisphereLight(0xd9ffff, 0x0b4450, 1.8);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfaffce, 4.2);
    sun.position.set(-4.8, 7.2, 4.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    scene.add(sun);

    const rim = new THREE.PointLight(0x62eaff, 22, 13, 2.1);
    rim.position.set(3.6, 2.8, -2.4);
    scene.add(rim);

    const glow = new THREE.PointLight(0xbaff8e, 12, 8, 2);
    glow.position.set(-2.6, 1.2, 2.6);
    scene.add(glow);

    const gradient = new THREE.Mesh(
      new THREE.SphereGeometry(60, 48, 32),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color(0x7fe7ea) },
          middle: { value: new THREE.Color(0x178ea0) },
          bottom: { value: new THREE.Color(0x06324b) },
        },
        vertexShader:
          'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = normalize(w.xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 middle; uniform vec3 bottom; varying vec3 vWorld; void main(){ float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0); vec3 c = mix(bottom, middle, smoothstep(0.05, 0.55, h)); c = mix(c, top, smoothstep(0.48, 1.0, h)); gl_FragColor = vec4(c, 1.0); }',
      })
    );
    scene.add(gradient);

    const roundedCapsuleTexture = () => {
      const size = 256;
      const textureCanvas = document.createElement('canvas');
      textureCanvas.width = size;
      textureCanvas.height = size;
      const ctx = textureCanvas.getContext('2d');
      if (!ctx) return null;
      const g = ctx.createRadialGradient(84, 74, 18, 128, 128, 132);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.16, 'rgba(218,255,255,0.82)');
      g.addColorStop(0.52, 'rgba(84,223,255,0.25)');
      g.addColorStop(1, 'rgba(25,117,144,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(textureCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const softDisc = roundedCapsuleTexture();

    function makeIsland() {
      const group = new THREE.Group();
      group.position.y = -0.52;

      const earth = new THREE.Mesh(
        new THREE.CylinderGeometry(2.72, 1.34, 1.08, 96, 1, false),
        new THREE.MeshStandardMaterial({ color: 0x24412d, roughness: 0.92, metalness: 0.02 })
      );
      earth.position.y = -0.52;
      earth.castShadow = true;
      earth.receiveShadow = true;
      group.add(earth);

      const underside = new THREE.Mesh(
        new THREE.ConeGeometry(1.46, 1.86, 86),
        new THREE.MeshStandardMaterial({ color: 0x193021, roughness: 1 })
      );
      underside.position.y = -1.98;
      underside.castShadow = true;
      group.add(underside);

      const grassTop = new THREE.Mesh(
        new THREE.SphereGeometry(2.76, 96, 24, 0, Math.PI * 2, 0, Math.PI * 0.46),
        new THREE.MeshStandardMaterial({
          color: 0x77a947,
          roughness: 0.78,
          metalness: 0,
          emissive: 0x163a22,
          emissiveIntensity: 0.14,
        })
      );
      grassTop.scale.set(1, 0.22, 0.66);
      grassTop.position.y = 0.08;
      grassTop.receiveShadow = true;
      group.add(grassTop);

      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb6e771, roughness: 0.88, side: THREE.DoubleSide });
      const bladeGeom = new THREE.ConeGeometry(0.018, 0.34, 5);
      const blades = new THREE.InstancedMesh(bladeGeom, bladeMat, 560);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 560; i += 1) {
        const r = Math.sqrt(Math.random()) * 2.55;
        const a = Math.random() * Math.PI * 2;
        const edge = r / 2.55;
        dummy.position.set(Math.cos(a) * r, 0.13 + Math.random() * 0.08 - edge * 0.05, Math.sin(a) * r * 0.62);
        dummy.rotation.set(Math.random() * 0.38, a + Math.PI * 0.5, Math.random() * 0.22);
        dummy.scale.setScalar(THREE.MathUtils.lerp(0.45, 1.15, Math.random()) * (1 - edge * 0.25));
        dummy.updateMatrix();
        blades.setMatrixAt(i, dummy.matrix);
      }
      blades.castShadow = true;
      group.add(blades);

      const flowerMat = new THREE.MeshBasicMaterial({ color: 0xc5fbff, transparent: true, opacity: 0.76 });
      const flowerGeom = new THREE.CircleGeometry(0.045, 7);
      for (let i = 0; i < 22; i += 1) {
        const r = 0.35 + Math.random() * 2.05;
        const a = Math.random() * Math.PI * 2;
        const flower = new THREE.Mesh(flowerGeom, flowerMat);
        flower.position.set(Math.cos(a) * r, 0.31, Math.sin(a) * r * 0.58);
        flower.rotation.x = -Math.PI / 2;
        group.add(flower);
      }

      return group;
    }

    const island = makeIsland();
    scene.add(island);

    function createHairLines(count: number, radius: number, colorA: number, colorB: number, hemisphere = false) {
      const positions: number[] = [];
      const colors: number[] = [];
      const ca = new THREE.Color(colorA);
      const cb = new THREE.Color(colorB);
      for (let i = 0; i < count; i += 1) {
        const theta = Math.random() * Math.PI * 2;
        const y = hemisphere ? Math.random() * 1.75 - 0.45 : Math.random() * 2 - 1;
        const rr = Math.sqrt(Math.max(0.02, 1 - y * y));
        const normal = new THREE.Vector3(Math.cos(theta) * rr, y, Math.sin(theta) * rr).normalize();
        const base = normal.clone().multiplyScalar(radius * THREE.MathUtils.lerp(0.86, 1.02, Math.random()));
        const length = THREE.MathUtils.lerp(0.16, 0.42, Math.random()) * (normal.y > 0.35 ? 1.3 : 1);
        const tip = base.clone().add(normal.clone().multiplyScalar(length));
        tip.x += (Math.random() - 0.5) * 0.08;
        tip.z += (Math.random() - 0.5) * 0.08;
        positions.push(base.x, base.y, base.z, tip.x, tip.y, tip.z);
        const c = ca.clone().lerp(cb, Math.random() * 0.72);
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      return new THREE.LineSegments(
        geom,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending })
      );
    }

    function createCreature() {
      const root = new THREE.Group();
      root.position.set(0.4, 0.1, 0.08);

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(1.13, 96, 64),
        new THREE.MeshPhysicalMaterial({
          color: 0xf7fffa,
          roughness: 0.72,
          sheen: 1,
          sheenColor: 0xeaffff,
          clearcoat: 0.18,
          emissive: 0x1ea5cb,
          emissiveIntensity: 0.025,
        })
      );
      body.scale.set(1.07, 0.96, 0.98);
      body.castShadow = true;
      body.receiveShadow = true;
      root.add(body);

      const bluePatch = new THREE.Mesh(
        new THREE.SphereGeometry(1.132, 64, 42),
        new THREE.MeshPhysicalMaterial({ color: 0x39cfff, roughness: 0.82, transparent: true, opacity: 0.64, sheen: 1, side: THREE.FrontSide })
      );
      bluePatch.scale.set(1.02, 0.94, 0.98);
      bluePatch.position.set(0.43, -0.05, -0.05);
      bluePatch.rotation.z = -0.14;
      root.add(bluePatch);

      const hair = createHairLines(1450, 1.04, 0xffffff, 0xa7f3ff, true);
      hair.scale.copy(body.scale);
      root.add(hair);

      const eyeMat = new THREE.MeshPhysicalMaterial({
        color: 0x06355e,
        roughness: 0.02,
        metalness: 0,
        transmission: 0.12,
        thickness: 0.55,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        emissive: 0x00a8e6,
        emissiveIntensity: 0.16,
      });
      const eyeGeom = new THREE.SphereGeometry(0.245, 48, 32);
      const eyes: THREE.Mesh[] = [];
      [-0.35, 0.35].forEach((x) => {
        const eye = new THREE.Mesh(eyeGeom, eyeMat);
        eye.position.set(x, 0.26, 0.94);
        eye.scale.set(0.86, 1.13, 0.42);
        eye.castShadow = true;
        root.add(eye);
        eyes.push(eye);

        const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        highlight.position.set(x - 0.06, 0.38, 1.055);
        highlight.scale.set(1, 1, 0.42);
        root.add(highlight);
      });

      const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff9fc3, transparent: true, opacity: 0.23, depthWrite: false });
      [-0.58, 0.58].forEach((x) => {
        const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), cheekMat);
        cheek.position.set(x, 0.02, 1.06);
        cheek.scale.set(1.3, 0.68, 1);
        root.add(cheek);
      });

      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), new THREE.MeshStandardMaterial({ color: 0x8a5355, roughness: 0.3 }));
      nose.position.set(0, 0.06, 1.13);
      root.add(nose);

      const mouthGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.045, -0.055, 1.135),
        new THREE.Vector3(0, -0.082, 1.148),
        new THREE.Vector3(0.045, -0.055, 1.135),
      ]);
      root.add(new THREE.Line(mouthGeom, new THREE.LineBasicMaterial({ color: 0x32505a, transparent: true, opacity: 0.78 })));

      const earMat = new THREE.MeshPhysicalMaterial({ color: 0x34c9ff, roughness: 0.58, sheen: 1 });
      const innerEarMat = new THREE.MeshBasicMaterial({ color: 0xc9f9ff, transparent: true, opacity: 0.58 });
      [-1, 1].forEach((side) => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.58, 36), earMat);
        ear.position.set(side * 0.74, 0.56, 0.08);
        ear.rotation.set(0.4, 0, side * -0.74);
        ear.castShadow = true;
        root.add(ear);

        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.34, 28), innerEarMat);
        inner.position.set(side * 0.75, 0.55, 0.18);
        inner.rotation.copy(ear.rotation);
        root.add(inner);
      });

      const footMat = new THREE.MeshPhysicalMaterial({ color: 0x1db9ee, roughness: 0.64, sheen: 0.8 });
      const feet: THREE.Mesh[] = [];
      [-0.45, 0.45].forEach((x) => {
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), footMat);
        foot.position.set(x, -0.89, 0.44);
        foot.scale.set(1.25, 0.46, 0.82);
        foot.castShadow = true;
        root.add(foot);
        feet.push(foot);
      });

      const antennaMat = new THREE.LineBasicMaterial({ color: 0xdbffff, transparent: true, opacity: 0.88 });
      const antennas: Array<{ line: THREE.Line; plume: THREE.LineSegments; basePoints: THREE.Vector3[]; side: number }> = [];
      [-0.28, 0.34].forEach((x, i) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, 0.95, 0.16),
          new THREE.Vector3(x * 0.86, 1.34, 0.16),
          new THREE.Vector3(x + (i ? 0.22 : -0.08), 1.65, 0.04),
          new THREE.Vector3(x + (i ? 0.48 : -0.18), 1.82, 0.08),
        ]);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), antennaMat);
        root.add(line);
        const plume = createHairLines(110, 0.16, 0x4cd8ff, 0xffffff, false);
        plume.position.copy(curve.points[curve.points.length - 1]);
        plume.scale.set(0.78, 0.44, 0.78);
        root.add(plume);
        antennas.push({ line, plume, basePoints: curve.points.map((p) => p.clone()), side: i ? 1 : -1 });
      });

      root.userData = { body, hair, eyes, feet, antennas };
      return root;
    }

    const creature = createCreature();
    scene.add(creature);

    function makeBubble(radius: number, position: THREE.Vector3, speed: number, phase: number) {
      const group = new THREE.Group();
      group.position.copy(position);
      group.userData = { base: position.clone(), speed, phase, radius, pop: 0, alive: true };
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 48, 32),
        new THREE.MeshPhysicalMaterial({
          color: 0xbafcff,
          roughness: 0.03,
          metalness: 0,
          transmission: 0.72,
          thickness: 0.34,
          transparent: true,
          opacity: 0.24,
          clearcoat: 1,
          clearcoatRoughness: 0.02,
          envMapIntensity: 1.5,
        })
      );
      group.add(shell);

      if (softDisc) {
        const highlight = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc, color: 0xffffff, transparent: true, opacity: 0.84, depthWrite: false, blending: THREE.AdditiveBlending }));
        highlight.position.set(-radius * 0.36, radius * 0.34, radius * 0.68);
        highlight.scale.set(radius * 0.92, radius * 0.92, 1);
        group.add(highlight);
      }

      scene.add(group);
      interactiveBubbles.push(group);
      return group;
    }

    [
      [0.45, [-4.1, 1.45, 1.3], 0.12, 0.1],
      [0.32, [3.3, 4.8, -1.8], 0.08, 1.4],
      [0.18, [-1.85, 2.2, 0.6], 0.18, 2.6],
      [0.16, [-2.95, 0.58, 1.4], 0.2, 3.1],
      [0.13, [-2.12, 1.2, 1.1], 0.22, 4.4],
      [0.14, [2.7, -1.28, 1.7], 0.16, 2.1],
      [0.23, [-4.0, -2.25, 2.4], 0.11, 5.2],
      [0.09, [0.9, 3.28, -1.0], 0.2, 4.8],
    ].forEach(([r, p, s, phase]) => makeBubble(r as number, new THREE.Vector3(...(p as number[])), s as number, phase as number));

    function makeLeaves() {
      const group = new THREE.Group();
      group.position.set(-3.2, 4.5, 1.1);
      group.rotation.set(0.2, -0.25, -0.05);

      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0x496d28, roughness: 0.8 }));
      branch.rotation.z = 0.95;
      group.add(branch);

      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, 0.46);
      leafShape.bezierCurveTo(0.3, 0.28, 0.3, -0.28, 0, -0.48);
      leafShape.bezierCurveTo(-0.3, -0.28, -0.3, 0.28, 0, 0.46);
      const leafGeom = new THREE.ShapeGeometry(leafShape, 18);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x80bb44, roughness: 0.64, side: THREE.DoubleSide, emissive: 0x173c19, emissiveIntensity: 0.1 });
      for (let i = 0; i < 18; i += 1) {
        const leaf = new THREE.Mesh(leafGeom, leafMat);
        const t = i / 17;
        leaf.position.set(THREE.MathUtils.lerp(-1.25, 1.05, t), Math.sin(t * 6) * 0.18, Math.cos(t * 4) * 0.22);
        leaf.rotation.set(Math.random() * 0.45, Math.random() * 0.55, (i % 2 ? -0.9 : 0.9) + Math.random() * 0.25);
        leaf.scale.setScalar(THREE.MathUtils.lerp(0.52, 0.88, Math.random()));
        leaf.castShadow = true;
        group.add(leaf);
      }
      return group;
    }

    const leaves = makeLeaves();
    scene.add(leaves);

    function makeFireflies() {
      const count = 260;
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 13;
        positions[i * 3 + 1] = Math.random() * 7 - 2.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1.5;
        sizes[i] = Math.random();
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('sizeSeed', new THREE.BufferAttribute(sizes, 1));
      const points = new THREE.Points(
        geom,
        new THREE.PointsMaterial({ map: softDisc || undefined, color: 0xdffff0, size: 0.09, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      scene.add(points);
      return points;
    }

    const fireflies = makeFireflies();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(2, 2);

    function spawnSparkle(position: THREE.Vector3) {
      if (!softDisc) return;
      for (let i = 0; i < 18; i += 1) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: softDisc, color: i % 2 ? 0xdffff8 : 0x87edff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        sprite.position.copy(position);
        sprite.scale.setScalar(0.12 + Math.random() * 0.12);
        sprite.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.15) * 1.4, (Math.random() - 0.5) * 1.5);
        sprite.userData.life = 1;
        scene.add(sprite);
        sparkles.push(sprite);
      }
    }

    function updateCreature(t: number, dt: number) {
      const walk = Math.sin(t * 0.48) * 0.72;
      const bob = Math.sin(t * 2.7) * 0.035;
      creature.position.x = 0.36 + mobileSceneX + walk * 0.2;
      creature.position.z = 0.08 + Math.cos(t * 0.48) * 0.12;
      creature.position.y = 0.1 + mobileLift + bob;
      creature.rotation.y = Math.sin(t * 0.48) * 0.12 + parallax.x * 0.08;
      creature.rotation.z = Math.sin(t * 1.4) * 0.016;
      creature.userData.body.scale.y = 0.96 + Math.sin(t * 2.7) * 0.018;
      creature.userData.body.scale.x = 1.07 - Math.sin(t * 2.7) * 0.014;
      creature.userData.hair.rotation.y = Math.sin(t * 0.62) * 0.04;

      creature.userData.eyes.forEach((eye: THREE.Mesh, i: number) => {
        const blink = Math.max(0.12, Math.abs(Math.sin(t * 0.74 + i * 0.2)) > 0.965 ? 0.12 : 1);
        eye.scale.y = 1.13 * blink;
        eye.rotation.y = parallax.x * 0.16;
        eye.rotation.x = -parallax.y * 0.12;
      });

      creature.userData.feet.forEach((foot: THREE.Mesh, i: number) => {
        foot.position.y = -0.89 + Math.sin(t * 5 + i * Math.PI) * 0.026;
        foot.position.z = 0.44 + Math.cos(t * 5 + i * Math.PI) * 0.035;
      });

      creature.userData.antennas.forEach((antenna: any, index: number) => {
        const pts = antenna.basePoints.map((p: THREE.Vector3, i: number) => {
          const np = p.clone();
          np.x += Math.sin(t * 1.55 + i * 0.8 + index) * 0.04 * i;
          np.z += Math.cos(t * 1.35 + i * 0.6) * 0.026 * i;
          return np;
        });
        antenna.line.geometry.setFromPoints(new THREE.CatmullRomCurve3(pts).getPoints(24));
        antenna.plume.position.copy(pts[pts.length - 1]);
        antenna.plume.rotation.z += dt * 0.8 * antenna.side;
      });
    }

    function updateBubbles(t: number, dt: number) {
      interactiveBubbles.forEach((bubble, i) => {
        const data = bubble.userData;
        if (!data.alive) {
          data.pop += dt * 2.4;
          bubble.scale.setScalar(Math.max(0.01, 1 - data.pop));
          bubble.traverse((child: any) => {
            if (child.material) child.material.opacity = Math.max(0, child.material.opacity - dt * 0.8);
          });
          if (data.pop >= 1) {
            data.alive = true;
            data.pop = 0;
            bubble.scale.setScalar(0.01);
            bubble.position.copy(data.base).add(new THREE.Vector3(0, -1.1, 0));
            bubble.traverse((child: any) => {
              if (child.material) child.material.opacity = child.isSprite ? 0.84 : child.material.wireframe ? 0.24 : 0.24;
            });
          }
          return;
        }
        bubble.position.x = data.base.x + Math.sin(t * data.speed + data.phase) * 0.22;
        bubble.position.y = data.base.y + Math.sin(t * data.speed * 1.7 + data.phase) * 0.38 + ((t * data.speed * 0.12) % 1.5);
        bubble.position.z = data.base.z + Math.cos(t * data.speed + data.phase) * 0.18;
        bubble.rotation.y += dt * (0.1 + i * 0.01);
        bubble.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 2.3);
      });
    }

    function updateSparkles(dt: number) {
      for (let i = sparkles.length - 1; i >= 0; i -= 1) {
        const sparkle = sparkles[i];
        sparkle.userData.life -= dt * 1.5;
        sparkle.position.addScaledVector(sparkle.userData.velocity, dt);
        sparkle.userData.velocity.y -= dt * 0.25;
        sparkle.material.opacity = Math.max(0, sparkle.userData.life);
        sparkle.scale.multiplyScalar(1 + dt * 0.9);
        if (sparkle.userData.life <= 0) {
          scene.remove(sparkle);
          sparkle.material.dispose();
          sparkles.splice(i, 1);
        }
      }
    }

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isPhone = w < 700;
      const isTabletPortrait = w < 860 && h > w;
      mobileLift = isPhone ? 1.58 : isTabletPortrait ? 0.74 : 0;
      mobileSceneX = isPhone ? -0.82 : isTabletPortrait ? -0.42 : 0;
      island.position.y = -0.52 + mobileLift;
      island.position.x = mobileSceneX;
      controls.target.set(mobileSceneX * 0.34, 0.9 + mobileLift * 0.72, 0);
      camera.aspect = w / h;
      camera.position.z = isPhone ? 11.25 : 9.2;
      camera.position.y = isPhone ? 3.55 : isTabletPortrait ? 2.8 : 2.2;
      camera.position.x = isPhone ? -0.35 : 0.1;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    function updatePointer(event: PointerEvent) {
      const x = event.clientX ?? window.innerWidth / 2;
      const y = event.clientY ?? window.innerHeight / 2;
      pointer.x = (x / window.innerWidth) * 2 - 1;
      pointer.y = -(y / window.innerHeight) * 2 + 1;
      targetParallax.set(pointer.x, pointer.y);
    }

    function popBubble(event: PointerEvent) {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveBubbles, true);
      if (!hits.length) return;
      let bubble: THREE.Object3D | null = hits[0].object;
      while (bubble.parent && !interactiveBubbles.includes(bubble as THREE.Group)) bubble = bubble.parent;
      if (!bubble?.userData.alive) return;
      bubble.userData.alive = false;
      spawnSparkle(bubble.position.clone());
    }

    function handlePointerDown(event: PointerEvent) {
      updatePointer(event);
      pointerDown = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
    }

    function handlePointerUp(event: PointerEvent) {
      if (!pointerDown || pointerDown.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      const elapsed = performance.now() - pointerDown.time;
      pointerDown = null;
      if (distance < 12 && elapsed < 420) popBubble(event);
    }

    function handleReducedMotion(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
      paused = event.matches;
    }

    function animate(now: number) {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      parallax.lerp(targetParallax, 0.045);
      controls.autoRotate = !paused && !reducedMotion;
      controls.update();

      if (!paused && !reducedMotion) {
        island.rotation.y = Math.sin(t * 0.16) * 0.035;
        leaves.rotation.z = -0.05 + Math.sin(t * 0.9) * 0.035;
        leaves.rotation.y = -0.25 + parallax.x * 0.12;
        fireflies.rotation.y += dt * 0.018;
        fireflies.position.y = Math.sin(t * 0.32) * 0.08;
        updateCreature(t, dt);
        updateBubbles(t, dt);
        updateSparkles(dt);
        rim.position.x = 3.6 + Math.sin(t * 0.62) * 0.6;
      }

      camera.position.x += parallax.x * 0.012;
      camera.position.y += parallax.y * 0.006;
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', () => {
      pointerDown = null;
    });
    prefersReducedMotion.addEventListener('change', handleReducedMotion);

    resize();
    frame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.clearTimeout(readyTimer);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      prefersReducedMotion.removeEventListener('change', handleReducedMotion);
      controls.dispose();
      scene.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material: THREE.Material) => material.dispose());
        }
      });
      softDisc?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="hh-login-canvas" aria-label="森林漂浮島與絨毛精靈的互動 3D 場景" />
      <div className={`hh-login-loading ${ready ? 'hide' : ''}`}>正在喚醒森林精靈...</div>
    </>
  );
}
