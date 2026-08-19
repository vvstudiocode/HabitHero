import type {
  ChildWorldEntity,
  WorldMutationPayload,
  WorldMutationResult,
} from './contracts';

export function toWorldMutationResult(value: unknown): WorldMutationResult {
  const result = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawEntity = result.entity && typeof result.entity === 'object' ? result.entity as Record<string, unknown> : undefined;
  if (!rawEntity) return { revision: Number(result.revision ?? 0) };
  const entity: ChildWorldEntity = {
    id: String(rawEntity.id),
    inventoryItemId: String(rawEntity.inventory_item_id),
    entityKind: rawEntity.entity_kind === 'pet' ? 'pet' : 'decoration',
    worldLayoutVersion: Number(rawEntity.world_layout_version ?? 1),
    x: Number(rawEntity.position_x ?? 0),
    y: Number(rawEntity.position_y ?? 0),
    z: Number(rawEntity.position_z ?? 0),
    rotationX: Number(rawEntity.rotation_x ?? 0),
    rotationY: Number(rawEntity.rotation_y ?? 0),
    rotationZ: Number(rawEntity.rotation_z ?? 0),
    scale: Number(rawEntity.scale ?? 1),
    behaviorMode: rawEntity.behavior_mode === 'wander' ? 'wander' : rawEntity.behavior_mode === 'idle' ? 'idle' : 'static',
    roamingSlot: rawEntity.roaming_slot == null ? null : Number(rawEntity.roaming_slot),
    isActive: rawEntity.is_active !== false,
  };
  return { revision: Number(result.revision ?? 0), entity };
}

export function toWorldTransformRpcArgs(payload: WorldMutationPayload): Record<string, unknown> {
  if (!payload.transform) throw new Error('世界物件變更缺少座標。');
  return {
    target_inventory_item_id: payload.inventoryItemId,
    ...(payload.entityId ? { target_entity_id: payload.entityId } : {}),
    expected_revision: payload.expectedRevision,
    position_x: payload.transform.x,
    position_y: payload.transform.y,
    position_z: payload.transform.z,
    rotation_x: payload.transform.rotationX,
    rotation_y: payload.transform.rotationY,
    rotation_z: payload.transform.rotationZ,
    target_scale: payload.transform.scale,
  };
}

export function toWorldPlacementRpcArgs(payload: WorldMutationPayload): Record<string, unknown> {
  return {
    ...toWorldTransformRpcArgs(payload),
    ...(payload.behaviorMode ? { target_behavior_mode: payload.behaviorMode } : {}),
    ...(payload.roamingSlot !== undefined ? { target_roaming_slot: payload.roamingSlot } : {}),
  };
}
