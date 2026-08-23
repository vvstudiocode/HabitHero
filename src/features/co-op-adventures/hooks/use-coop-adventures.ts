import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CoopAdventureState, CoopCompletionInput, CoopReviewInput } from '../contracts';
import { createInitialCoopAdventureState, mergeCoopAdventureState } from '../coop-adventure-state';
import { createCoopAdventureService } from '../coop-adventure-service';
import type { CoopAdventureRepository } from '../../../lib/social-data/coop-adventure-repository';

export function useCoopAdventures(repository: CoopAdventureRepository | null, worldOwnerChildProfileId: string | null, enabled = true) {
  const service = useMemo(() => repository ? createCoopAdventureService(repository) : null, [repository]);
  const [state, setState] = useState<CoopAdventureState>(createInitialCoopAdventureState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!service || !worldOwnerChildProfileId) return;
    setLoading(true);
    setError(null);
    try {
      const adventures = await service.list(worldOwnerChildProfileId);
      const firstAdventure = adventures[0];
      const syncedState = firstAdventure ? await service.loadState(firstAdventure.id) : createInitialCoopAdventureState();
      setState((current) => mergeCoopAdventureState(current, {
        ...syncedState,
        adventures: adventures.length > 0 ? adventures : syncedState.adventures,
        lastSyncedAt: new Date().toISOString(),
      }));
    } catch {
      setError('合作冒險目前無法取得。');
    } finally {
      setLoading(false);
    }
  }, [service, worldOwnerChildProfileId]);

  useEffect(() => {
    if (!enabled || !service || !worldOwnerChildProfileId) return undefined;
    void reload();
    return service.subscribe(worldOwnerChildProfileId, () => { void reload(); });
  }, [enabled, reload, service, worldOwnerChildProfileId]);

  const createFromTask = useCallback((taskId: string) => service?.createFromTask({ taskId, adventureType: 'general', isDaily: false }) ?? Promise.reject(new Error('合作冒險目前無法建立。')), [service]);
  const join = useCallback((adventureId: string) => service?.join(adventureId) ?? Promise.reject(new Error('合作冒險目前無法加入。')), [service]);
  const submitCompletion = useCallback((participantId: string, input: CoopCompletionInput) => service?.submitCompletion(participantId, input) ?? Promise.reject(new Error('合作回報目前無法送出。')), [service]);
  const reviewCompletion = useCallback((participantId: string, input: CoopReviewInput) => service?.reviewCompletion(participantId, input) ?? Promise.reject(new Error('合作回報目前無法批改。')), [service]);

  return { ...state, loading, error, reload, createFromTask, join, submitCompletion, reviewCompletion };
}
