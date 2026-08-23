import type {
  CoopAdventureNotification,
  CoopAdventureState,
  CoopCompletionInput,
  CoopMutationResult,
  CoopReviewInput,
  CreateCoopAdventureInput,
} from './contracts';
import { isGeneralAdventure } from './contracts';
import type { CoopAdventureRepository } from '../../lib/social-data/coop-adventure-repository';

export interface CoopAdventureService {
  list(worldOwnerChildProfileId: string): Promise<import('./contracts').CoopAdventureSummary[]>;
  subscribe(worldOwnerChildProfileId: string, onChange: () => void): () => void;
  createFromTask(task: CreateCoopAdventureInput & { adventureType?: string | null; isDaily?: boolean | null }): Promise<CoopAdventureNotification>;
  join(adventureId: string): Promise<CoopMutationResult>;
  submitCompletion(participantId: string, input: CoopCompletionInput): Promise<CoopMutationResult>;
  reviewCompletion(participantId: string, input: CoopReviewInput): Promise<CoopMutationResult>;
  load(adventureId: string): Promise<CoopAdventureState>;
}

export function createCoopAdventureService(repository: CoopAdventureRepository): CoopAdventureService {
  return {
    list: (worldOwnerChildProfileId) => repository.list(worldOwnerChildProfileId),
    subscribe: (worldOwnerChildProfileId, onChange) => repository.subscribe(worldOwnerChildProfileId, onChange),
    async createFromTask(task) {
      if (!isGeneralAdventure(task)) {
        throw new Error('只有一般冒險可以建立合作關聯。');
      }
      return repository.createFromGeneralTask(task.taskId);
    },
    join: (adventureId) => repository.join(adventureId),
    submitCompletion: (participantId, input) => repository.submitCompletion(participantId, input),
    reviewCompletion: (participantId, input) => repository.reviewCompletion(participantId, input),
    load: (adventureId) => repository.loadState(adventureId),
  };
}
