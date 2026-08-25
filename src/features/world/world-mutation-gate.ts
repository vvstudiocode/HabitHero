export interface WorldMutationGate {
  run<T>(childId: string, operation: () => Promise<T>): Promise<T>;
  block(childId: string): void;
  clear(childId?: string): void;
}

export function createWorldMutationGate(): WorldMutationGate {
  const inFlight = new Map<string, Promise<unknown>>();
  const blocked = new Set<string>();

  return {
    run<T>(childId, operation) {
      if (blocked.has(childId)) return Promise.reject(new Error('world revision conflict'));
      const existing = inFlight.get(childId);
      if (existing) return existing as Promise<T>;

      const pending: Promise<T> = Promise.resolve().then(operation);
      const tracked: Promise<T> = pending.finally(() => {
        if (inFlight.get(childId) === tracked) inFlight.delete(childId);
      });
      inFlight.set(childId, tracked);
      return tracked;
    },
    block(childId) {
      blocked.add(childId);
    },
    clear(childId) {
      if (childId) blocked.delete(childId);
      else blocked.clear();
    },
  };
}
