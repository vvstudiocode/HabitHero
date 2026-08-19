import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createDisposalTracker,
  disposeObject3D,
  disposeScene,
  loadGltfSafely,
} from '../src/features/world/prototype-world-runtime';

function createDisposable(label: string, calls: string[]) {
  return {
    label,
    dispose: () => calls.push(label),
  };
}

function createScene(objects: unknown[]) {
  return {
    traverse: (callback: (object: unknown) => void) => {
      objects.forEach(callback);
    },
  };
}

describe('world runtime resource lifecycle', () => {
  it('disposes shared geometry, materials, and texture maps only once', () => {
    const calls: string[] = [];
    const geometry = createDisposable('geometry', calls);
    const texture = createDisposable('texture', calls);
    const normalMap = createDisposable('normalMap', calls);
    const roughnessMap = createDisposable('roughnessMap', calls);
    const alphaMap = createDisposable('alphaMap', calls);
    const material = {
      map: texture,
      normalMap,
      roughnessMap,
      alphaMap,
      dispose: () => calls.push('material'),
    };
    const scene = createScene([
      { geometry, material },
      { geometry, material },
    ]);

    disposeObject3D(scene);

    assert.deepEqual(calls.sort(), ['alphaMap', 'geometry', 'material', 'normalMap', 'roughnessMap', 'texture'].sort());
  });

  it('shares a disposal tracker across several scene disposals and disposes renderer last', () => {
    const calls: string[] = [];
    const geometry = createDisposable('geometry', calls);
    const firstMaterial = { dispose: () => calls.push('first-material') };
    const secondMaterial = { dispose: () => calls.push('second-material') };
    const tracker = createDisposalTracker();
    const renderer = { dispose: () => calls.push('renderer') };

    disposeObject3D(createScene([{ geometry, material: firstMaterial }]), tracker);
    disposeScene(createScene([{ geometry, material: [firstMaterial, secondMaterial] }]), renderer, tracker);

    assert.deepEqual(calls, ['geometry', 'first-material', 'second-material', 'renderer']);
  });

  it('rejects immediately with AbortError when a GLTF load starts after abort', async () => {
    const controller = new AbortController();
    controller.abort();
    const loader = {
      loadAsync: async () => ({ scene: createScene([]) }),
    };

    await assert.rejects(
      loadGltfSafely(loader, '/assets/example.glb', controller.signal),
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError' && error.message === 'GLTF loading aborted',
    );
  });

  it('disposes a loaded scene when abort wins before GLTF resolution is handled', async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    const scene = createScene([{ geometry: createDisposable('geometry', calls) }]);
    let resolveLoad: (value: { scene: typeof scene }) => void = () => undefined;
    const loader = {
      loadAsync: () => new Promise<{ scene: typeof scene }>((resolve) => {
        resolveLoad = resolve;
      }),
    };

    const loading = loadGltfSafely(loader, '/assets/example.glb', controller.signal);
    controller.abort();
    resolveLoad({ scene });

    await assert.rejects(
      loading,
      (error: unknown) => error instanceof DOMException && error.name === 'AbortError' && error.message === 'GLTF loading aborted',
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(calls, ['geometry']);
  });

  it('passes loader failures through without replacing the original error', async () => {
    const failure = new Error('loader failed');
    const loader = {
      loadAsync: async () => {
        throw failure;
      },
    };

    await assert.rejects(
      loadGltfSafely(loader, '/assets/missing.glb', new AbortController().signal),
      failure,
    );
  });
});
