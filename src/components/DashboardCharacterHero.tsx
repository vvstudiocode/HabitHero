import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type CharacterMenuAction = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  closeOnSelect?: boolean;
  onSelect: () => void;
};

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
  menuActions?: CharacterMenuAction[];
  rootMenuActions?: CharacterMenuAction[];
  activeMenuId?: string | null;
  menuVariant?: 'parent' | 'child';
  onMenuClose?: () => void;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}

const MODEL_URL = '/models/black-man-character.glb';

function CharacterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2.2, 2.2, 2.35, -2.35, 0.1, 100);
    camera.position.set(0, 0.3, 10);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xf2f2f2, 2.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(3, 2, 4);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.1);
    rimLight.position.set(4, 3, -4);
    scene.add(rimLight);

    const group = new THREE.Group();
    scene.add(group);
    let character: THREE.Object3D | null = null;
    let disposed = false;

    new GLTFLoader().load(MODEL_URL, (gltf) => {
      if (disposed) return;
      character = gltf.scene;
      const box = new THREE.Box3().setFromObject(character);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2.85 / Math.max(size.x, size.y, size.z);
      character.scale.setScalar(scale);
      character.position.sub(center.multiplyScalar(scale));
      character.position.y -= 0.06;
      character.rotation.y = 0;
      character.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      group.add(character);
      renderer.render(scene, camera);
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const aspect = Math.max(rect.width / Math.max(rect.height, 1), 1);
      camera.left = (-2.2 * aspect) / 1.45;
      camera.right = (2.2 * aspect) / 1.45;
      camera.top = 2.35;
      camera.bottom = -2.35;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
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

  return <canvas ref={canvasRef} className="hh-character-hero__canvas" aria-label="置中的 3D 家長角色" />;
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
  menuActions,
  rootMenuActions,
  activeMenuId = null,
  menuVariant = 'parent',
  onMenuClose,
  menuOpen: menuOpenProp,
  onMenuOpenChange,
}: DashboardCharacterHeroProps) {
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const menuOpen = menuOpenProp ?? internalMenuOpen;
  const setMenuOpen = (open: boolean) => {
    if (menuOpenProp === undefined) setInternalMenuOpen(open);
    onMenuOpenChange?.(open);
  };
  const rootActions = rootMenuActions ?? menuActions ?? [];
  const subActions = rootMenuActions && activeMenuId ? (menuActions ?? []) : [];
  const hasMenu = rootActions.length > 0;

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
        {hasMenu && (
          <>
            <button
              type="button"
              className="hh-character-hero-hitbox"
              aria-label={menuOpen ? '關閉家長功能按鈕' : '開啟家長功能按鈕'}
              aria-expanded={menuOpen}
              onClick={() => {
                if (menuOpen) {
                  setMenuOpen(false);
                  onMenuClose?.();
                } else {
                  setMenuOpen(true);
                }
              }}
            />
            {menuOpen && (
              <div className={`hh-character-menu is-open ${activeMenuId ? 'has-submenu' : ''}`} data-active-menu={activeMenuId ?? undefined} data-menu-variant={menuVariant}>
                <div className="hh-character-menu-root" aria-label="家長功能主選單">
                  {rootActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={`hh-character-menu-action ${activeMenuId === action.id ? 'is-selected' : ''}`}
                      onClick={() => {
                        if (action.closeOnSelect !== false) setMenuOpen(false);
                        action.onSelect();
                      }}
                    >
                      {action.icon && <span aria-hidden="true">{action.icon}</span>}
                      <strong>{action.title}</strong>
                    </button>
                  ))}
                </div>
                {subActions.length > 0 && (
                  <div className="hh-character-menu-submenu" aria-label="家長功能子選單">
                    {subActions.map((action, index) => (
                      <button
                        key={`${action.id}-${index}`}
                        type="button"
                        className="hh-character-menu-action"
                        onClick={() => {
                          if (action.closeOnSelect !== false) setMenuOpen(false);
                          action.onSelect();
                        }}
                      >
                        {action.icon && <span aria-hidden="true">{action.icon}</span>}
                        <strong>{action.title}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <div className="hh-character-stats" aria-label="儀表板統計">
          <div aria-label={firstStatLabel}><strong>{firstStatValue} <em>{firstStatSuffix}</em></strong></div>
          <div aria-label={secondStatLabel}><strong>{secondStatValue} <em>{secondStatSuffix}</em></strong></div>
        </div>
        <div className="hh-character-dashboard-actions">{actions}</div>
      </div>
    </header>
  );
}
