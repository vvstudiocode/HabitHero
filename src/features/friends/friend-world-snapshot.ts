export const MAX_FRIEND_WORLD_SNAPSHOT_ENTITIES = 250;

export type FriendWorldEntityKind = 'pet' | 'decoration';
export type FriendWorldBehaviorMode = 'static' | 'idle' | 'wander';

export interface FriendWorldSnapshotEntity {
  id: string;
  entityKind: FriendWorldEntityKind;
  assetKey: string;
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
  behaviorMode: FriendWorldBehaviorMode;
  displayName?: string;
}

export interface FriendWorldSnapshot {
  worldOwnerChildProfileId: string;
  displayName: string;
  characterAssetKey: string;
  revision: number;
  entities: FriendWorldSnapshotEntity[];
}

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`好友世界資料缺少 ${field}。`);
  }
  return value as RecordValue;
}

function readString(record: RecordValue, field: string, maxLength: number): string {
  const value = record[field];
  if (typeof value !== 'string') throw new TypeError(`好友世界資料的 ${field} 無效。`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError(`好友世界資料的 ${field} 無效。`);
  }
  return normalized;
}

function readNumber(record: RecordValue, field: string): number {
  const value = record[field];
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) throw new TypeError(`好友世界資料的 ${field} 無效。`);
  return number;
}

function readOptionalDisplayName(record: RecordValue): string | undefined {
  const value = record.display_name;
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') throw new TypeError('好友世界資料的 display_name 無效。');
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 12 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError('好友世界資料的 display_name 無效。');
  }
  return normalized;
}

function normalizeEntity(value: unknown): FriendWorldSnapshotEntity {
  const record = asRecord(value, 'entity');
  const entityKind = record.entity_kind;
  const behaviorMode = record.behavior_mode;
  if (entityKind !== 'pet' && entityKind !== 'decoration') {
    throw new TypeError('好友世界資料的 entity_kind 無效。');
  }
  if (behaviorMode !== 'static' && behaviorMode !== 'idle' && behaviorMode !== 'wander') {
    throw new TypeError('好友世界資料的 behavior_mode 無效。');
  }

  const entity: FriendWorldSnapshotEntity = {
    id: readString(record, 'id', 80),
    entityKind,
    assetKey: readString(record, 'asset_key', 120),
    x: readNumber(record, 'position_x'),
    y: readNumber(record, 'position_y'),
    z: readNumber(record, 'position_z'),
    rotationX: readNumber(record, 'rotation_x'),
    rotationY: readNumber(record, 'rotation_y'),
    rotationZ: readNumber(record, 'rotation_z'),
    scale: readNumber(record, 'scale'),
    behaviorMode,
  };
  const displayName = readOptionalDisplayName(record);
  if (displayName) entity.displayName = displayName;
  return entity;
}

export function normalizeFriendWorldSnapshot(value: unknown): FriendWorldSnapshot {
  const record = asRecord(value, 'snapshot');
  const revision = readNumber(record, 'revision');
  if (!Number.isInteger(revision) || revision < 0) {
    throw new TypeError('好友世界資料的 revision 無效。');
  }

  const rawEntities = record.entities;
  let entityValues: unknown[] = [];
  if (rawEntities !== undefined) {
    if (!Array.isArray(rawEntities)) throw new TypeError('好友世界資料的 entities 無效。');
    entityValues = rawEntities;
  }
  const entities = entityValues
    .filter((entity) => {
      const record = asRecord(entity, 'entity');
      return record.is_active !== false;
    })
    .slice(0, MAX_FRIEND_WORLD_SNAPSHOT_ENTITIES)
    .map(normalizeEntity);

  return {
    worldOwnerChildProfileId: readString(record, 'world_owner_child_profile_id', 80),
    displayName: readString(record, 'display_name', 80),
    characterAssetKey: readString(record, 'character_asset_key', 120),
    revision,
    entities,
  };
}

export const mapFriendWorldSnapshot = normalizeFriendWorldSnapshot;
