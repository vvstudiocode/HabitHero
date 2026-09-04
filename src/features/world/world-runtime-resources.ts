export type DisposableScene = { traverse: (callback: (object: unknown) => void) => void };

export interface DisposalTracker {
  geometries: Set<object>;
  materials: Set<object>;
  textures: Set<object>;
}

export function createDisposalTracker(): DisposalTracker {
  return { geometries: new Set(), materials: new Set(), textures: new Set() };
}

const MATERIAL_TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularMap',
  'specularColorMap',
  'specularIntensityMap',
  'thicknessMap',
  'transmissionMap',
] as const;

export function disposeTexture(texture: unknown, tracker: DisposalTracker) {
  if (!texture || typeof texture !== 'object' || !('dispose' in texture) || typeof texture.dispose !== 'function') return;
  const disposableTexture = texture as object & { dispose: () => void };
  if (tracker.textures.has(disposableTexture)) return;
  tracker.textures.add(disposableTexture);
  disposableTexture.dispose();
}

export function disposeObject3D(scene: DisposableScene, tracker = createDisposalTracker()) {
  scene.traverse((object) => {
    const mesh = object as {
      geometry?: object & { dispose?: () => void };
      material?: object & Record<string, unknown> & { dispose?: () => void } | Array<object & Record<string, unknown> & { dispose?: () => void }>;
    };
    if (mesh.geometry && !tracker.geometries.has(mesh.geometry)) {
      tracker.geometries.add(mesh.geometry);
      mesh.geometry.dispose?.();
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach((material) => {
      if (tracker.materials.has(material)) return;
      MATERIAL_TEXTURE_KEYS.forEach((key) => disposeTexture(material[key], tracker));
      tracker.materials.add(material);
      material.dispose?.();
    });
  });
}

export function disposeScene(scene: DisposableScene, renderer: { dispose: () => void }, tracker: DisposalTracker) {
  disposeObject3D(scene, tracker);
  renderer.dispose();
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function loadGltfSafely<T extends { scene: DisposableScene }>(
  loader: { loadAsync: (url: string) => Promise<T> },
  url: string,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (!settled) {
        settled = true;
        reject(new DOMException('GLTF loading aborted', 'AbortError'));
      }
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    void loader.loadAsync(url).then((result) => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted || settled) {
        disposeObject3D(result.scene);
        return;
      }
      settled = true;
      resolve(result);
    }).catch((error: unknown) => {
      signal.removeEventListener('abort', abort);
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

export interface GltfUrlCache<T extends { scene: DisposableScene }> {
  load: (url: string) => Promise<T>;
}

/**
 * Keep one in-flight/resolved GLTF promise per URL for a mounted world. The
 * caller owns cloning the returned scene before placing it in more than one
 * parent; the cache owns only the loader result and its abort lifecycle.
 */
export function createGltfUrlCache<T extends { scene: DisposableScene }>(
  loader: { loadAsync: (url: string) => Promise<T> },
  signal: AbortSignal,
): GltfUrlCache<T> {
  const loads = new Map<string, Promise<T>>();
  return {
    load: (url) => {
      const cached = loads.get(url);
      if (cached) return cached;
      const pending = loadGltfSafely(loader, url, signal);
      loads.set(url, pending);
      void pending.catch(() => {
        if (loads.get(url) === pending) loads.delete(url);
      });
      return pending;
    },
  };
}
