using System;
using System.Collections.Generic;
using System.Globalization;

namespace HabitHero.Platform
{
    public static class SupabaseFriendWorldRealtimeContracts
    {
        public const int ProtocolVersion = 1;
        public const float WorldBoundary = 4.8f;
        public const int MaxWorldMembers = 3;
        public const int MaxIdentityLength = 128;
        public const int MaxCharacterAssetKeyLength = 128;
        public const string AvatarStateEvent = "avatar_state_v1";
        public const string AvatarStateRequestEvent = "avatar_state_request_v1";
        public const string WorldRevisionEvent = "world_revision_v1";
    }

    [Serializable]
    public sealed class SupabaseFriendWorldPresenceMember
    {
        public string connectionId;
        public string childProfileId;
        public string joinedAt;
    }

    public sealed class SupabaseFriendWorldPresenceAdmissionDecision
    {
        public bool accepted;
        public bool shouldUntrack;
        public string[] acceptedConnectionIds;
        public string[] rejectedConnectionIds;
    }

    public static class SupabaseFriendWorldPresenceAdmission
    {
        public static SupabaseFriendWorldPresenceAdmissionDecision Decide(
            SupabaseFriendWorldPresenceMember[] members,
            string connectionId,
            int capacity = SupabaseFriendWorldRealtimeContracts.MaxWorldMembers)
        {
            int safeCapacity = capacity >= 0
                ? capacity
                : SupabaseFriendWorldRealtimeContracts.MaxWorldMembers;
            List<SupabaseFriendWorldPresenceMember> uniqueMembers =
                DeduplicateMembers(members);
            uniqueMembers.Sort(CompareMembers);

            List<string> acceptedConnectionIds = new List<string>();
            List<string> rejectedConnectionIds = new List<string>();
            for (int index = 0; index < uniqueMembers.Count; index += 1)
            {
                if (index < safeCapacity)
                    acceptedConnectionIds.Add(uniqueMembers[index].connectionId);
                else
                    rejectedConnectionIds.Add(uniqueMembers[index].connectionId);
            }

            bool localPresent = acceptedConnectionIds.Contains(connectionId)
                || rejectedConnectionIds.Contains(connectionId);
            if (!localPresent
                && SupabaseFriendWorldRealtimeValidation.IsIdentity(connectionId)
                && acceptedConnectionIds.Count < safeCapacity)
            {
                acceptedConnectionIds.Add(connectionId);
            }

            bool accepted = acceptedConnectionIds.Contains(connectionId);
            return new SupabaseFriendWorldPresenceAdmissionDecision
            {
                accepted = accepted,
                shouldUntrack = !accepted,
                acceptedConnectionIds = acceptedConnectionIds.ToArray(),
                rejectedConnectionIds = rejectedConnectionIds.ToArray(),
            };
        }

        internal static int CompareMembers(
            SupabaseFriendWorldPresenceMember left,
            SupabaseFriendWorldPresenceMember right)
        {
            double leftNumber;
            double rightNumber;
            bool leftNumeric = double.TryParse(
                left.joinedAt,
                NumberStyles.Float,
                CultureInfo.InvariantCulture,
                out leftNumber);
            bool rightNumeric = double.TryParse(
                right.joinedAt,
                NumberStyles.Float,
                CultureInfo.InvariantCulture,
                out rightNumber);
            if (leftNumeric && rightNumeric && leftNumber != rightNumber)
                return leftNumber < rightNumber ? -1 : 1;
            if (leftNumeric != rightNumeric)
                return leftNumeric ? -1 : 1;

            DateTimeOffset leftDate;
            DateTimeOffset rightDate;
            bool leftDateValid = DateTimeOffset.TryParse(
                left.joinedAt,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out leftDate);
            bool rightDateValid = DateTimeOffset.TryParse(
                right.joinedAt,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out rightDate);
            if (leftDateValid && rightDateValid && leftDate != rightDate)
                return leftDate < rightDate ? -1 : 1;
            if (leftDateValid != rightDateValid)
                return leftDateValid ? -1 : 1;

            int textComparison = string.CompareOrdinal(left.joinedAt, right.joinedAt);
            return textComparison != 0
                ? textComparison
                : string.CompareOrdinal(left.connectionId, right.connectionId);
        }

        private static List<SupabaseFriendWorldPresenceMember> DeduplicateMembers(
            SupabaseFriendWorldPresenceMember[] members)
        {
            List<SupabaseFriendWorldPresenceMember> uniqueMembers =
                new List<SupabaseFriendWorldPresenceMember>();
            if (members == null) return uniqueMembers;

            foreach (SupabaseFriendWorldPresenceMember candidate in members)
            {
                if (candidate == null
                    || !SupabaseFriendWorldRealtimeValidation.IsIdentity(candidate.connectionId)
                    || string.IsNullOrWhiteSpace(candidate.joinedAt))
                    continue;

                bool replaced = false;
                for (int index = 0; index < uniqueMembers.Count; index += 1)
                {
                    if (uniqueMembers[index].connectionId != candidate.connectionId) continue;
                    if (CompareMembers(candidate, uniqueMembers[index]) < 0)
                        uniqueMembers[index] = candidate;
                    replaced = true;
                    break;
                }

                if (!replaced) uniqueMembers.Add(candidate);
            }

            return uniqueMembers;
        }
    }

    [Serializable]
    public sealed class SupabaseFriendWorldAvatarState
    {
        public int version;
        public string connectionId;
        public string childProfileId;
        public string characterAssetKey;
        public long sequence;
        public float x;
        public float z;
        public float rotationY;
        public string motion;
        public string emote;
        public double sentAt;
    }

    public static class SupabaseFriendWorldAvatarStateFactory
    {
        public static SupabaseFriendWorldAvatarState Create(
            string connectionId,
            string childProfileId,
            string characterAssetKey,
            long sequence,
            float x,
            float z,
            float rotationY,
            double sentAt)
        {
            SupabaseFriendWorldAvatarState state = new SupabaseFriendWorldAvatarState
            {
                version = SupabaseFriendWorldRealtimeContracts.ProtocolVersion,
                connectionId = connectionId,
                childProfileId = childProfileId,
                characterAssetKey = string.IsNullOrWhiteSpace(characterAssetKey)
                    ? null
                    : characterAssetKey,
                sequence = sequence,
                x = x,
                z = z,
                rotationY = rotationY,
                motion = "idle",
                emote = "none",
                sentAt = sentAt,
            };
            SupabaseFriendWorldRealtimeValidation.ValidateAvatarState(state);
            return state;
        }
    }

    public sealed class SupabaseFriendWorldAvatarStateTracker
    {
        private readonly Dictionary<string, long> latestSequenceByConnectionId =
            new Dictionary<string, long>();

        public bool TryAccept(
            SupabaseRealtimeEnvelope envelope,
            string worldOwnerChildProfileId,
            out SupabaseFriendWorldAvatarState state)
        {
            state = null;
            SupabaseFriendWorldAvatarState candidate;
            if (!SupabaseChildFriendWorldRealtimeMapper.TryMapAvatarState(
                    envelope,
                    worldOwnerChildProfileId,
                    out candidate))
            {
                return false;
            }

            long latest;
            if (latestSequenceByConnectionId.TryGetValue(candidate.connectionId, out latest)
                && candidate.sequence <= latest)
            {
                return false;
            }

            latestSequenceByConnectionId[candidate.connectionId] = candidate.sequence;
            state = candidate;
            return true;
        }

        public void Clear(string connectionId = null)
        {
            if (connectionId == null)
            {
                latestSequenceByConnectionId.Clear();
                return;
            }

            latestSequenceByConnectionId.Remove(connectionId);
        }
    }
}
