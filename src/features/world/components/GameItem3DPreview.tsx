import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { AnimationMixer, Material, Mesh, Object3D } from 'three';
import type { GameCatalogItem } from '../contracts';
import { applyPicturebookPetMaterial, type PicturebookPetMaterial } from '../character-material-style';
import { getLocalGameModelUrl } from '../game-content-assets';
import { getPetAnimationClipName } from '../pet-animation';

const WORLD_SKYBOX_URL = new URL('../../../../terrain-prototype/assets/sky-equirectangular-day.png', import.meta.url).href;
const PREVIEW_MODEL_DIMENSION = 2.7625 * 0.325;
const DEFAULT_PREVIEW_ZOOM = 1;
const MIN_PREVIEW_ZOOM = 0.72;
const MAX_PREVIEW_ZOOM = 1.8;

interface GameItem3DPreviewProps {
  item: Pick<GameCatalogItem, 'name' | 'itemType' | 'assetKey' | 'thumbnailUrl'>;
}

type PreviewStatus = 'loading' | 'ready' | 'error';

interface PointerDragState {
  pointerId: number;
  clientX: number;
}

interface PointerPoint {
  clientX: number;
  clientY: number;
}

function getPinchDistance(points: ReadonlyMap<number, PointerPoint>): number | null {
  if (points.size < 2) return null;
  const [first, second] = Array.from(points.values()).slice(0, 2);
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function disposeObject3D(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const materialRecord = material as Material & Record<string, unknown>;
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap'].forEach((textureKey) => {
        const texture = materialRecord[textureKey] as { dispose?: () => void } | undefined;
        texture?.dispose?.();
      });
      material.dispose();
    });
  });
}

function setModelToGround(THREE: typeof import('three'), model: Object3D) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z, 0.01);

  model.position.set(-center.x, -bounds.min.y, -center.z);
  model.scale.setScalar(PREVIEW_MODEL_DIMENSION / largestDimension);
}

function applyPreviewPetMaterialStyle(source: Object3D) {
  source.traverse((object) => {
    const mesh = object as {
      isMesh?: boolean;
      material?: PicturebookPetMaterial | PicturebookPetMaterial[];
    };
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => applyPicturebookPetMaterial(material));
  });
}

export function GameItem3DPreview({ item }: GameItem3DPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<import('three').PerspectiveCamera | null>(null);
  const modelRef = useRef<Object3D | null>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const activePointersRef = useRef(new Map<number, PointerPoint>());
  const pinchDistanceRef = useRef<number | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('loading');

  const modelUrl = getLocalGameModelUrl(item);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !modelUrl) {
      setStatus('error');
      return undefined;
    }

    let disposed = false;
    let animationFrame = 0;
    let renderer: import('three').WebGLRenderer | undefined;
    let scene: import('three').Scene | undefined;
    let camera: import('three').PerspectiveCamera | undefined;
    let mixer: AnimationMixer | undefined;
    let modelRoot: Object3D | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let removeWindowResize: (() => void) | undefined;
    let dracoDecoderLoader: { setDecoderPath: (path: string) => unknown; dispose: () => void } | undefined;
    let environmentTexture: import('three').Texture | undefined;
    const prefersReducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const mountPreview = async () => {
      try {
        const THREE = await import('three');
        const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/DRACOLoader.js'),
        ]);
        if (disposed) return;

        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.setClearColor(0x000000, 0);

        scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffebdf, 0x777265, 1.86));

        const sun = new THREE.DirectionalLight(0xffd4b2, 3.3);
        sun.position.set(5.5, 8.5, -4.5);
        sun.target.position.set(0, 0, 0);
        scene.add(sun.target, sun);

        const environmentLoader = new THREE.TextureLoader();
        environmentTexture = environmentLoader.load(WORLD_SKYBOX_URL, (loadedTexture) => {
          if (disposed) {
            loadedTexture.dispose();
            return;
          }
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.mapping = THREE.EquirectangularReflectionMapping;
          loadedTexture.needsUpdate = true;
          if (scene) {
            scene.environment = loadedTexture;
            scene.environmentIntensity = 0.31;
          }
        });

        camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
        camera.position.set(0, 1.27, 4.6);
        camera.lookAt(0, 1.12, 0);
        cameraRef.current = camera;

        const resize = () => {
          if (!renderer || !camera) return;
          const width = Math.max(canvas.clientWidth, 1);
          const height = Math.max(canvas.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };

        resize();
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(canvas);
        } else {
          window.addEventListener('resize', resize);
          removeWindowResize = () => window.removeEventListener('resize', resize);
        }

        const clock = new THREE.Clock();
        const renderFrame = () => {
          if (disposed || !renderer || !scene || !camera) return;
          const delta = Math.min(clock.getDelta(), 0.05);
          if (!prefersReducedMotion) {
            if (modelRoot && !pointerDragRef.current) modelRoot.rotation.y += delta * 0.3;
            mixer?.update(delta);
          }
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(renderFrame);
        };
        animationFrame = requestAnimationFrame(renderFrame);

        const loader = new GLTFLoader();
        dracoDecoderLoader = new DRACOLoader();
        dracoDecoderLoader.setDecoderPath('/draco/');
        loader.setDRACOLoader(dracoDecoderLoader);
        loader.load(
          modelUrl,
          (gltf) => {
            if (disposed) {
              disposeObject3D(gltf.scene);
              return;
            }

            modelRoot = new THREE.Group();
            setModelToGround(THREE, gltf.scene);
            applyPreviewPetMaterialStyle(gltf.scene);
            modelRoot.add(gltf.scene);
            scene?.add(modelRoot);
            modelRef.current = modelRoot;

            const animationName = getPetAnimationClipName(
              gltf.animations.map((clip) => clip.name),
              'idle',
            );
            const animationClip = gltf.animations.find((clip) => clip.name === animationName);
            if (animationClip) {
              mixer = new THREE.AnimationMixer(gltf.scene);
              mixer.clipAction(animationClip).play();
            }

            setStatus('ready');
          },
          undefined,
          () => {
            if (!disposed) {
              cancelAnimationFrame(animationFrame);
              setStatus('error');
            }
          },
        );
      } catch {
        if (!disposed) {
          cancelAnimationFrame(animationFrame);
          setStatus('error');
        }
      }
    };

    setStatus('loading');
    void mountPreview();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      removeWindowResize?.();
      if (scene) disposeObject3D(scene);
      environmentTexture?.dispose();
      dracoDecoderLoader?.dispose();
      renderer?.dispose();
      renderer = undefined;
          modelRoot = undefined;
          cameraRef.current = null;
          modelRef.current = null;
          pointerDragRef.current = null;
          activePointersRef.current.clear();
          pinchDistanceRef.current = null;
        };
  }, [item.assetKey, modelUrl]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (status !== 'ready') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    const pinchDistance = getPinchDistance(activePointersRef.current);
    if (pinchDistance !== null) {
      pointerDragRef.current = null;
      pinchDistanceRef.current = pinchDistance;
    } else {
      pointerDragRef.current = { pointerId: event.pointerId, clientX: event.clientX };
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;
    activePointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    const pinchDistance = getPinchDistance(activePointersRef.current);
    if (pinchDistance !== null) {
      const previousDistance = pinchDistanceRef.current;
      const camera = cameraRef.current;
      if (camera && previousDistance && previousDistance > 0) {
        const zoomScale = pinchDistance / previousDistance;
        camera.zoom = Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, camera.zoom * zoomScale));
        camera.updateProjectionMatrix();
      }
      pinchDistanceRef.current = pinchDistance;
      pointerDragRef.current = null;
      return;
    }

    const drag = pointerDragRef.current;
    const model = modelRef.current;
    if (!drag || !model || drag.pointerId !== event.pointerId) return;
    model.rotation.y += (event.clientX - drag.clientX) * 0.012;
    pointerDragRef.current = { ...drag, clientX: event.clientX };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const remainingPointer = activePointersRef.current.size > 0
      ? activePointersRef.current.entries().next().value as [number, PointerPoint] | undefined
      : undefined;
    if (activePointersRef.current.size >= 2) {
      pinchDistanceRef.current = getPinchDistance(activePointersRef.current);
      pointerDragRef.current = null;
    } else if (remainingPointer) {
      const [pointerId, point] = remainingPointer;
      pinchDistanceRef.current = null;
      pointerDragRef.current = { pointerId, clientX: point.clientX };
    } else {
      pinchDistanceRef.current = null;
      pointerDragRef.current = null;
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Home' && modelRef.current) {
      event.preventDefault();
      modelRef.current.rotation.x = 0;
      modelRef.current.rotation.y = 0;
      if (cameraRef.current) {
        cameraRef.current.zoom = DEFAULT_PREVIEW_ZOOM;
        cameraRef.current.updateProjectionMatrix();
      }
    }
  };

  return (
    <div
      className={`hh-game-item-lightbox-3d${status === 'error' ? ' is-fallback' : ''}`}
      role="img"
      aria-label={`${item.name} 3D 預覽，可拖曳左右旋轉，雙指縮放`}
      aria-busy={status === 'loading'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      {status === 'error' && item.thumbnailUrl && (
        <div className="hh-game-item-lightbox-3d-fallback">
          <img src={item.thumbnailUrl} alt={`${item.name} 圖片預覽`} />
          <span>目前改用圖片預覽</span>
        </div>
      )}
    </div>
  );
}
