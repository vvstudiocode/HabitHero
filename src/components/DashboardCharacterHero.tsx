import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface DashboardCharacterHeroProps {
  title: string;
  eyebrow: string;
  subtitle: string;
  firstStatLabel: string;
  firstStatValue: string | number;
  firstStatSuffix?: string;
  secondStatLabel: string;
  secondStatValue: string | number;
  secondStatSuffix?: string;
  actions?: React.ReactNode;
}

function createMaterial(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0 });
}

function addCharacter(scene: THREE.Scene) {
  const character = new THREE.Group();
  character.position.set(0.78, -0.56, 0);
  character.scale.setScalar(1.22);
  scene.add(character);

  const cream = createMaterial(0xfff9e8);
  const orange = createMaterial(0xf18b26);
  const dark = createMaterial(0x183d55);
  const pink = createMaterial(0xff9bb5);
  const leaf = createMaterial(0x4aaf83);

  const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 22), cream);
  body.scale.set(0.84, 1.08, 0.68);
  body.position.y = 0.42;
  body.castShadow = true;
  character.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 18), createMaterial(0xfffdf4));
  belly.scale.set(0.9, 1.1, 0.18);
  belly.position.set(0, 0.17, 0.61);
  character.add(belly);

  const wing = (side: number) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), orange);
    mesh.scale.set(0.75, 1.35, 0.35);
    mesh.position.set(side * 0.76, 0.17, 0.05);
    mesh.rotation.z = side * -0.45;
    mesh.castShadow = true;
    character.add(mesh);
    return mesh;
  };
  const leftWing = wing(-1);
  const rightWing = wing(1);

  const eye = (x: number) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 12), dark);
    mesh.scale.z = 0.35;
    mesh.position.set(x, 0.72, 0.62);
    character.add(mesh);
    return mesh;
  };
  const leftEye = eye(-0.28);
  const rightEye = eye(0.28);

  const cheek = (x: number) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), pink);
    mesh.scale.z = 0.18;
    mesh.position.set(x, 0.48, 0.63);
    character.add(mesh);
  };
  cheek(-0.47);
  cheek(0.47);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 3), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.59, 0.68);
  character.add(beak);

  const hat = new THREE.Group();
  const hatTop = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), pink);
  hatTop.scale.set(1.1, 0.5, 0.7);
  hatTop.position.y = 1.24;
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.09, 32), pink);
  hatBrim.position.y = 1.09;
  hat.add(hatTop, hatBrim);
  character.add(hat);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 10), leaf);
  stem.position.y = 1.55;
  const leafMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), leaf);
  leafMesh.scale.set(1.4, 0.55, 0.35);
  leafMesh.position.set(0.1, 1.69, 0);
  character.add(stem, leafMesh);

  const foot = (x: number) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12), orange);
    mesh.scale.set(1.45, 0.48, 0.9);
    mesh.position.set(x, -0.75, 0.12);
    character.add(mesh);
  };
  foot(-0.37);
  foot(0.37);

  return { character, leftWing, rightWing, leftEye, rightEye, hat };
}

function CharacterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-3.6, 3.6, 2.5, -2.5, 0.1, 100);
    camera.position.set(0, 0.25, 10);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x75bbb4, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);

    const parts = addCharacter(scene);
    let pointerX = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const aspect = Math.max(rect.width / Math.max(rect.height, 1), 1);
      camera.left = (-3.6 * aspect) / 1.9;
      camera.right = (3.6 * aspect) / 1.9;
      camera.top = 2.5;
      camera.bottom = -2.5;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / rect.width - 0.5;
    };
    const onPointerLeave = () => { pointerX = 0; };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const motionTime = reducedMotion ? 0 : time;
      parts.character.position.x = 0.78 + pointerX * 0.18;
      parts.character.position.y = -0.56 + Math.sin(motionTime * 2.1) * 0.035;
      parts.character.rotation.z = Math.sin(motionTime * 1.6) * 0.025;
      parts.leftWing.rotation.z = -0.08 + Math.sin(motionTime * 1.8) * 0.05;
      parts.rightWing.rotation.z = 0.08 - Math.sin(motionTime * 1.8) * 0.05;
      const blink = reducedMotion ? 1 : (Math.sin(time * 0.75) > 0.985 ? 0.18 : 1);
      parts.leftEye.scale.y = blink;
      parts.rightEye.scale.y = blink;
      parts.hat.rotation.z = Math.sin(motionTime * 1.6) * 0.025;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
    };
  }, []);

  return <canvas ref={canvasRef} className="hh-character-hero__canvas" aria-label="正在呼吸和眨眼的 3D 陪伴角色" />;
}

export function DashboardCharacterHero({
  title,
  eyebrow,
  subtitle,
  firstStatLabel,
  firstStatValue,
  firstStatSuffix,
  secondStatLabel,
  secondStatValue,
  secondStatSuffix,
  actions,
}: DashboardCharacterHeroProps) {
  return (
    <header className="hh-character-dashboard-header">
      <div className="hh-character-hero-panel">
        <div className="hh-character-hero-copy">
          {eyebrow && <p>{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <div className="hh-character-hero-sun" aria-hidden="true" />
        <div className="hh-character-hero-cloud hh-character-hero-cloud--one" aria-hidden="true" />
        <div className="hh-character-hero-cloud hh-character-hero-cloud--two" aria-hidden="true" />
        <div className="hh-character-hero-hill hh-character-hero-hill--back" aria-hidden="true" />
        <div className="hh-character-hero-hill" aria-hidden="true" />
        <CharacterCanvas />
        <div className="hh-character-stats" aria-label="儀表板統計">
          <div aria-label={firstStatLabel}><strong>{firstStatValue} <em>{firstStatSuffix}</em></strong></div>
          <div aria-label={secondStatLabel}><strong>{secondStatValue} <em>{secondStatSuffix}</em></strong></div>
        </div>
        <div className="hh-character-dashboard-actions">{actions}</div>
      </div>
    </header>
  );
}
