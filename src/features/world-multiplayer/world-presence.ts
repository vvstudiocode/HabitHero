import { MAX_PRESENCE_ID_LENGTH, MAX_WORLD_MEMBERS } from './limits';

export interface WorldPresenceMember {
  connectionId: string;
  joinedAt: string | number;
  childProfileId?: string;
}

export interface WorldMemberCapacityResult {
  accepted: WorldPresenceMember[];
  rejected: WorldPresenceMember[];
}

export interface PresenceAdmissionDecision {
  accepted: boolean;
  shouldUntrack: boolean;
  acceptedConnectionIds: string[];
  rejectedConnectionIds: string[];
}

export type PresenceLifecycleAction = 'keep' | 'untrack';

export interface PresenceLifecycleDecision {
  action: PresenceLifecycleAction;
  shouldBroadcast: boolean;
}

function isValidConnectionId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_PRESENCE_ID_LENGTH
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function joinedAtSortKey(value: string | number): { valid: boolean; value: number; text: string } {
  if (typeof value === 'number' && Number.isFinite(value)) return { valid: true, value, text: String(value) };
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return { valid: true, value: parsed, text: value };
    return { valid: false, value: Number.POSITIVE_INFINITY, text: value };
  }
  return { valid: false, value: Number.POSITIVE_INFINITY, text: String(value) };
}

function comparePresenceMembers(left: WorldPresenceMember, right: WorldPresenceMember): number {
  const leftKey = joinedAtSortKey(left.joinedAt);
  const rightKey = joinedAtSortKey(right.joinedAt);
  if (leftKey.valid && rightKey.valid && leftKey.value !== rightKey.value) return leftKey.value - rightKey.value;
  if (leftKey.valid !== rightKey.valid) return leftKey.valid ? -1 : 1;
  if (leftKey.text < rightKey.text) return -1;
  if (leftKey.text > rightKey.text) return 1;
  if (left.connectionId < right.connectionId) return -1;
  if (left.connectionId > right.connectionId) return 1;
  return 0;
}

function deduplicateMembers(members: readonly WorldPresenceMember[]): WorldPresenceMember[] {
  const byConnectionId = new Map<string, WorldPresenceMember>();
  for (const member of members) {
    if (!isValidConnectionId(member?.connectionId)) continue;
    const candidate = { ...member };
    const existing = byConnectionId.get(candidate.connectionId);
    if (!existing || comparePresenceMembers(candidate, existing) < 0) byConnectionId.set(candidate.connectionId, candidate);
  }
  return [...byConnectionId.values()];
}

export function selectWorldMembers(
  members: readonly WorldPresenceMember[],
  capacity = MAX_WORLD_MEMBERS,
): WorldMemberCapacityResult {
  const safeCapacity = Number.isInteger(capacity) && capacity >= 0 ? capacity : MAX_WORLD_MEMBERS;
  const sorted = deduplicateMembers(members).sort(comparePresenceMembers);
  return {
    accepted: sorted.slice(0, safeCapacity),
    rejected: sorted.slice(safeCapacity),
  };
}

export function getPresenceAdmissionDecision(
  members: readonly WorldPresenceMember[],
  connectionId: string,
  capacity = MAX_WORLD_MEMBERS,
): PresenceAdmissionDecision {
  if (members.length === 0) {
    return {
      accepted: true,
      shouldUntrack: false,
      acceptedConnectionIds: [connectionId],
      rejectedConnectionIds: [],
    };
  }
  const selected = selectWorldMembers(members, capacity);
  const acceptedConnectionIds = selected.accepted.map((member) => member.connectionId);
  const rejectedConnectionIds = selected.rejected.map((member) => member.connectionId);
  const accepted = acceptedConnectionIds.includes(connectionId);
  return {
    accepted,
    shouldUntrack: !accepted,
    acceptedConnectionIds,
    rejectedConnectionIds,
  };
}

export function getPresenceLifecycleDecision(options: { isBackgrounded: boolean }): PresenceLifecycleDecision {
  return options.isBackgrounded
    ? { action: 'untrack', shouldBroadcast: false }
    : { action: 'keep', shouldBroadcast: true };
}

export function shouldUntrackPresence(options: { isBackgrounded: boolean; overCapacity?: boolean }): boolean {
  return options.isBackgrounded || options.overCapacity === true;
}

function toPresenceMember(value: unknown, fallbackConnectionId?: string): WorldPresenceMember | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const connectionId = record.connectionId ?? record.connection_id ?? fallbackConnectionId;
  const joinedAt = record.joinedAt ?? record.joined_at;
  if (!isValidConnectionId(connectionId)) return null;
  if (!(typeof joinedAt === 'string' || (typeof joinedAt === 'number' && Number.isFinite(joinedAt)))) return null;
  const childProfileId = record.childProfileId ?? record.child_profile_id;
  return {
    connectionId,
    joinedAt,
    ...(typeof childProfileId === 'string' && childProfileId.length > 0 ? { childProfileId } : {}),
  };
}

export function flattenPresenceState(input: unknown): WorldPresenceMember[] {
  if (Array.isArray(input)) return input.flatMap((value) => {
    const member = toPresenceMember(value);
    return member ? [member] : [];
  });
  if (typeof input !== 'object' || input === null) return [];
  return Object.entries(input as Record<string, unknown>).flatMap(([connectionId, entries]) => {
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry) => {
      const member = toPresenceMember(entry, connectionId);
      return member ? [member] : [];
    });
  });
}
