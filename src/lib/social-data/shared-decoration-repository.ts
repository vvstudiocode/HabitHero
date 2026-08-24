import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorldTransform } from '../../features/world/contracts';
import { normalizeSharedDecorationMutationResult, toSharedDecorationRpcTransform, type SharedDecorationMutationResult } from '../../features/shared-decorations/normalization';

export class SharedDecorationRepositoryError extends Error {
  constructor(public readonly code: 'revision-conflict' | 'not-authorized' | 'invalid' | 'unavailable', message: string) {
    super(message);
    this.name = 'SharedDecorationRepositoryError';
  }
}

interface TargetInput { targetWorldOwnerChildProfileId: string; }
interface TransformInput extends TargetInput { expectedRevision: number; transform: WorldTransform; }

export interface SharedDecorationRepository {
  setCollaboration(targetWorldOwnerChildProfileId: string, collaboratorChildProfileId: string, canCollaborate: boolean): Promise<void>;
  place(input: TargetInput & { sourceInventoryItemId: string; expectedRevision: number; transform: WorldTransform }): Promise<SharedDecorationMutationResult>;
  updateTransform(input: TargetInput & { sharedEntityId: string; expectedRevision: number; transform: WorldTransform }): Promise<SharedDecorationMutationResult>;
  remove(input: TargetInput & { sharedEntityId: string; expectedRevision: number }): Promise<SharedDecorationMutationResult>;
  collect(input: TargetInput & { expectedRevision: number }): Promise<SharedDecorationMutationResult>;
}

function normalizeId(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 80 || /[\u0000-\u001f\u007f]/u.test(value)) throw new SharedDecorationRepositoryError('invalid', `${label}無效。`);
  return value.trim();
}

function validateRevision(value: number): void {
  if (!Number.isInteger(value) || value < 0) throw new SharedDecorationRepositoryError('invalid', '世界版本無效。');
}

function validateTransform(transform: WorldTransform): void {
  if (!transform || ![transform.x, transform.y, transform.z, transform.rotationX, transform.rotationY, transform.rotationZ, transform.scale].every(Number.isFinite)) {
    throw new SharedDecorationRepositoryError('invalid', '裝飾座標無效。');
  }
}

function mapRpcError(message?: string): SharedDecorationRepositoryError {
  const raw = message?.toLowerCase() ?? '';
  if (raw.includes('revision') || raw.includes('conflict')) return new SharedDecorationRepositoryError('revision-conflict', '世界剛被好友更新，請重新確認位置。');
  if (raw.includes('authorized') || raw.includes('friend') || raw.includes('permission')) return new SharedDecorationRepositoryError('not-authorized', '目前沒有調整這張共享裝飾的權限。');
  return new SharedDecorationRepositoryError('unavailable', '共享裝飾目前無法同步，請稍後再試。');
}

async function call(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<SharedDecorationMutationResult> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw mapRpcError(error.message);
  try { return normalizeSharedDecorationMutationResult(data); } catch { throw new SharedDecorationRepositoryError('unavailable', '共享裝飾資料無效。'); }
}

export function createSharedDecorationRepository(client: SupabaseClient): SharedDecorationRepository {
  const target = (value: string) => normalizeId(value, '好友世界');
  return {
    async setCollaboration(targetWorldOwnerChildProfileId, collaboratorChildProfileId, canCollaborate) {
      const targetId = target(targetWorldOwnerChildProfileId);
      const collaboratorId = normalizeId(collaboratorChildProfileId, '好友');
      if (typeof canCollaborate !== 'boolean') throw new SharedDecorationRepositoryError('invalid', '共享權限無效。');
      const { error } = await client.rpc('set_friend_world_decoration_collaboration', {
        target_world_owner_child_profile_id: targetId,
        target_collaborator_child_profile_id: collaboratorId,
        target_can_collaborate: canCollaborate,
      });
      if (error) throw mapRpcError(error.message);
    },
    place: async ({ targetWorldOwnerChildProfileId, sourceInventoryItemId, expectedRevision, transform }) => {
      const targetId = target(targetWorldOwnerChildProfileId);
      const inventoryId = normalizeId(sourceInventoryItemId, '裝飾');
      validateRevision(expectedRevision);
      validateTransform(transform);
      return call(client, 'place_shared_world_decoration', { target_world_owner_child_profile_id: targetId, source_inventory_item_id: inventoryId, expected_revision: expectedRevision, ...toSharedDecorationRpcTransform(transform) });
    },
    updateTransform: async ({ targetWorldOwnerChildProfileId, sharedEntityId, expectedRevision, transform }) => {
      const targetId = target(targetWorldOwnerChildProfileId);
      const entityId = normalizeId(sharedEntityId, '共享裝飾');
      validateRevision(expectedRevision);
      validateTransform(transform);
      return call(client, 'update_shared_world_decoration_transform', { target_world_owner_child_profile_id: targetId, shared_entity_id: entityId, expected_revision: expectedRevision, ...toSharedDecorationRpcTransform(transform) });
    },
    remove: async ({ targetWorldOwnerChildProfileId, sharedEntityId, expectedRevision }) => {
      const targetId = target(targetWorldOwnerChildProfileId);
      const entityId = normalizeId(sharedEntityId, '共享裝飾');
      validateRevision(expectedRevision);
      return call(client, 'remove_shared_world_decoration', { target_world_owner_child_profile_id: targetId, shared_entity_id: entityId, expected_revision: expectedRevision });
    },
    collect: async ({ targetWorldOwnerChildProfileId, expectedRevision }) => {
      const targetId = target(targetWorldOwnerChildProfileId);
      validateRevision(expectedRevision);
      return call(client, 'collect_shared_world_decorations', { target_world_owner_child_profile_id: targetId, expected_revision: expectedRevision });
    },
  };
}
