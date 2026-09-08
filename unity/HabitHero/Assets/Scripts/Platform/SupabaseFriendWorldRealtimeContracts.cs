using System;
using System.Collections.Generic;

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
