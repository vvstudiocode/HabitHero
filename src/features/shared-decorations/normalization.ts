import type { FriendWorldSnapshotEntity } from '../friends/friend-world-snapshot';
import type { WorldTransform } from '../world/contracts';

export interface SharedDecorationMutationResult {
  revision: number;
  entity?: FriendWorldSnapshotEntity;
}

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`共享裝飾 ${field} 無效。`);
  return value as RecordValue;
}

function readFiniteNumber(record: RecordValue, field: string): number {
  const value = record[field];
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) throw new TypeError(`共享裝飾 ${field} 無效。`);
  return number;
}

function readString(record: RecordValue, field: string, maxLength = 120): string {
  const value = record[field];
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`共享裝飾 ${field} 無效。`);
  }
  return value.trim();
}

function readBoolean(record: RecordValue, field: string): boolean {
  if (typeof record[field] !== 'boolean') throw new TypeError(`共享裝飾 ${field} 無效。`);
  return record[field] as boolean;
}

export function normalizeSharedDecorationEntity(value: unknown): FriendWorldSnapshotEntity {
  const record = asRecord(value, 'entity');
  const entityKind = record.entity_kind;
  const behaviorMode = record.behavior_mode;
  const placementScope = record.placement_scope;
  if (entityKind !== 'decoration') throw new TypeError('共享裝飾 entity_kind 無效。');
  if (behaviorMode !== 'static' && behaviorMode !== 'idle' && behaviorMode !== 'wander') throw new TypeError('共享裝飾 behavior_mode 無效。');
  if (placementScope !== 'owned' && placementScope !== 'shared') throw new TypeError('共享裝飾 placement_scope 無效。');
  const entity: FriendWorldSnapshotEntity = {
    id: readString(record, 'id', 80),
    entityKind,
    assetKey: readString(record, 'asset_key'),
    x: readFiniteNumber(record, 'position_x'),
    y: readFiniteNumber(record, 'position_y'),
    z: readFiniteNumber(record, 'position_z'),
    rotationX: readFiniteNumber(record, 'rotation_x'),
    rotationY: readFiniteNumber(record, 'rotation_y'),
    rotationZ: readFiniteNumber(record, 'rotation_z'),
    scale: readFiniteNumber(record, 'scale'),
    behaviorMode,
    placementScope,
    canTransform: readBoolean(record, 'can_transform'),
    canRemove: readBoolean(record, 'can_remove'),
    sharedByMe: readBoolean(record, 'shared_by_me'),
  };
  if (record.shared_source_display_name !== null && record.shared_source_display_name !== undefined) {
    entity.sharedSourceDisplayName = readString(record, 'shared_source_display_name', 80);
  }
  return entity;
}

export function normalizeSharedDecorationMutationResult(value: unknown): SharedDecorationMutationResult {
  const record = asRecord(value, 'mutation result');
  const revision = readFiniteNumber(record, 'revision');
  if (!Number.isInteger(revision) || revision < 0) throw new TypeError('共享裝飾 revision 無效。');
  const entityValue = record.entity;
  return {
    revision,
    entity: entityValue === undefined || entityValue === null ? undefined : normalizeSharedDecorationEntity(entityValue),
  };
}

export function toSharedDecorationRpcTransform(transform: WorldTransform): Record<string, number> {
  return {
    position_x: transform.x,
    position_y: transform.y,
    position_z: transform.z,
    rotation_x: transform.rotationX,
    rotation_y: transform.rotationY,
    rotation_z: transform.rotationZ,
    scale: transform.scale,
  };
}
