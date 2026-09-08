using System;
using System.Collections.Generic;
using System.Globalization;
using static HabitHero.Platform.SupabaseFriendWorldRealtimeValidation;

namespace HabitHero.Platform
{
    public static class SupabaseChildFriendWorldRealtimeMapper
    {
        public static bool TryMapPresenceState(
            SupabaseRealtimeEnvelope envelope,
            string worldOwnerChildProfileId,
            out SupabaseFriendWorldPresenceMember[] members)
        {
            members = new SupabaseFriendWorldPresenceMember[0];
            if (!IsTopicEvent(envelope, worldOwnerChildProfileId, "presence_state")) return false;
            Dictionary<string, object> payload = AsObject(envelope.Payload);
            return payload != null && TryMapPresenceRecord(payload, out members);
        }

        public static bool TryMapPresenceDiff(
            SupabaseRealtimeEnvelope envelope,
            string worldOwnerChildProfileId,
            out SupabaseFriendWorldPresenceMember[] joins,
            out string[] leaves)
        {
            joins = new SupabaseFriendWorldPresenceMember[0];
            leaves = new string[0];
            if (!IsTopicEvent(envelope, worldOwnerChildProfileId, "presence_diff")) return false;
            Dictionary<string, object> payload = AsObject(envelope.Payload);
            if (payload == null) return false;
            Dictionary<string, object> joinRecord = AsObject(
                payload.ContainsKey("joins") ? payload["joins"] : null);
            Dictionary<string, object> leaveRecord = AsObject(
                payload.ContainsKey("leaves") ? payload["leaves"] : null);
            if (joinRecord == null || leaveRecord == null) return false;
            if (!TryMapPresenceRecord(joinRecord, out joins)) return false;
            leaves = MapConnectionIds(leaveRecord);
            return true;
        }

        public static bool TryMapAvatarState(
            SupabaseRealtimeEnvelope envelope,
            string worldOwnerChildProfileId,
            out SupabaseFriendWorldAvatarState state)
        {
            state = null;
            Dictionary<string, object> payload;
            if (!TryMapBroadcastPayload(
                    envelope,
                    worldOwnerChildProfileId,
                    SupabaseFriendWorldRealtimeContracts.AvatarStateEvent,
                    out payload))
            {
                return false;
            }

            int version;
            string connectionId;
            string childProfileId;
            string characterAssetKey;
            long sequence;
            float x;
            float z;
            float rotationY;
            string motion;
            string emote;
            double sentAt;
            if (!TryInteger(payload, "v", out version)
                || version != SupabaseFriendWorldRealtimeContracts.ProtocolVersion
                || !TryIdentity(payload, "connectionId", out connectionId)
                || !TryIdentity(payload, "childProfileId", out childProfileId)
                || !TryOptionalCharacter(payload, out characterAssetKey)
                || !TrySequence(payload, out sequence)
                || !TryFloat(payload, "x", out x)
                || !TryFloat(payload, "z", out z)
                || Math.Abs(x) > SupabaseFriendWorldRealtimeContracts.WorldBoundary
                || Math.Abs(z) > SupabaseFriendWorldRealtimeContracts.WorldBoundary
                || !TryFloat(payload, "rotationY", out rotationY)
                || !TryOneOf(payload, "motion", new[] { "idle", "walk" }, out motion)
                || !TryOneOf(payload, "emote", new[] { "none", "wave", "sit", "dance" }, out emote)
                || !TryNonNegative(payload, "sentAt", out sentAt))
            {
                return false;
            }

            state = new SupabaseFriendWorldAvatarState
            {
                version = version,
                connectionId = connectionId,
                childProfileId = childProfileId,
                characterAssetKey = characterAssetKey,
                sequence = sequence,
                x = x,
                z = z,
                rotationY = rotationY,
                motion = motion,
                emote = emote,
                sentAt = sentAt,
            };
            return true;
        }

        public static bool TryMapAvatarStateRequest(
            SupabaseRealtimeEnvelope envelope,
            string worldOwnerChildProfileId,
            out string requesterConnectionId)
        {
            requesterConnectionId = null;
            Dictionary<string, object> payload;
            if (!TryMapBroadcastPayload(
                    envelope,
                    worldOwnerChildProfileId,
                    SupabaseFriendWorldRealtimeContracts.AvatarStateRequestEvent,
                    out payload))
            {
                return false;
            }

            return TryIdentity(payload, "connectionId", out requesterConnectionId);
        }

        public static bool IsWorldRevision(
            SupabaseRealtimeEnvelope envelope,
            string worldOwnerChildProfileId)
        {
            Dictionary<string, object> ignoredPayload;
            return TryMapBroadcastPayload(
                envelope,
                worldOwnerChildProfileId,
                SupabaseFriendWorldRealtimeContracts.WorldRevisionEvent,
                out ignoredPayload);
        }

        public static string BuildAvatarStatePayload(SupabaseFriendWorldAvatarState state)
        {
            if (state == null) throw new ArgumentNullException("state");
            ValidateAvatarState(state);
            return "{\"v\":" + state.version.ToString(CultureInfo.InvariantCulture)
                + ",\"connectionId\":" + SupabaseJson.Quote(state.connectionId)
                + ",\"childProfileId\":" + SupabaseJson.Quote(state.childProfileId)
                + (state.characterAssetKey == null
                    ? string.Empty
                    : ",\"characterAssetKey\":" + SupabaseJson.Quote(state.characterAssetKey))
                + ",\"seq\":" + state.sequence.ToString(CultureInfo.InvariantCulture)
                + ",\"x\":" + state.x.ToString("R", CultureInfo.InvariantCulture)
                + ",\"z\":" + state.z.ToString("R", CultureInfo.InvariantCulture)
                + ",\"rotationY\":" + state.rotationY.ToString("R", CultureInfo.InvariantCulture)
                + ",\"motion\":" + SupabaseJson.Quote(state.motion)
                + ",\"emote\":" + SupabaseJson.Quote(state.emote)
                + ",\"sentAt\":" + state.sentAt.ToString("R", CultureInfo.InvariantCulture)
                + "}";
        }

        private static bool TryMapBroadcastPayload(
            SupabaseRealtimeEnvelope envelope,
            string worldOwnerChildProfileId,
            string expectedEvent,
            out Dictionary<string, object> payload)
        {
            payload = null;
            if (!IsTopicEvent(envelope, worldOwnerChildProfileId, "broadcast")) return false;
            Dictionary<string, object> envelopePayload = AsObject(envelope.Payload);
            if (envelopePayload == null
                || GetString(envelopePayload, "type") != "broadcast"
                || GetString(envelopePayload, "event") != expectedEvent)
            {
                return false;
            }

            payload = AsObject(
                envelopePayload.ContainsKey("payload")
                    ? envelopePayload["payload"]
                    : null);
            return payload != null;
        }

        private static bool TryMapPresenceRecord(
            Dictionary<string, object> record,
            out SupabaseFriendWorldPresenceMember[] members)
        {
            List<SupabaseFriendWorldPresenceMember> mapped =
                new List<SupabaseFriendWorldPresenceMember>();
            foreach (KeyValuePair<string, object> entry in record)
            {
                List<object> values = SupabaseRealtimeMessageParser.AsArray(entry.Value);
                if (values == null) continue;
                foreach (object value in values)
                {
                    SupabaseFriendWorldPresenceMember member;
                    if (TryMapPresenceMember(value, entry.Key, out member))
                    {
                        ReplacePresenceMember(mapped, member);
                    }
                }
            }

            mapped.Sort(ComparePresenceMembers);
            members = mapped.ToArray();
            return true;
        }

        private static string[] MapConnectionIds(Dictionary<string, object> record)
        {
            List<string> ids = new List<string>();
            foreach (string key in record.Keys)
            {
                if (IsIdentity(key) && !ids.Contains(key)) ids.Add(key);
            }

            return ids.ToArray();
        }

        private static bool TryMapPresenceMember(
            object value,
            string fallbackConnectionId,
            out SupabaseFriendWorldPresenceMember member)
        {
            member = null;
            Dictionary<string, object> record = AsObject(value);
            if (record == null) return false;
            string connectionId = GetString(record, "connectionId")
                ?? GetString(record, "connection_id")
                ?? fallbackConnectionId;
            string childProfileId = GetString(record, "childProfileId")
                ?? GetString(record, "child_profile_id");
            string joinedAt = GetString(record, "joinedAt")
                ?? GetString(record, "joined_at");
            double joinedAtNumber;
            if (joinedAt == null
                && (TryNumber(record, "joinedAt", out joinedAtNumber)
                    || TryNumber(record, "joined_at", out joinedAtNumber)))
            {
                joinedAt = joinedAtNumber.ToString("R", CultureInfo.InvariantCulture);
            }

            if (!IsIdentity(connectionId) || string.IsNullOrWhiteSpace(joinedAt)
                || (!string.IsNullOrEmpty(childProfileId) && !IsIdentity(childProfileId)))
            {
                return false;
            }

            member = new SupabaseFriendWorldPresenceMember
            {
                connectionId = connectionId,
                childProfileId = childProfileId,
                joinedAt = joinedAt,
            };
            return true;
        }

        private static void ReplacePresenceMember(
            List<SupabaseFriendWorldPresenceMember> members,
            SupabaseFriendWorldPresenceMember candidate)
        {
            for (int index = 0; index < members.Count; index += 1)
            {
                if (members[index].connectionId != candidate.connectionId) continue;
                if (ComparePresenceMembers(candidate, members[index]) < 0)
                    members[index] = candidate;
                return;
            }

            members.Add(candidate);
        }

        private static int ComparePresenceMembers(
            SupabaseFriendWorldPresenceMember left,
            SupabaseFriendWorldPresenceMember right)
        {
            return SupabaseFriendWorldPresenceAdmission.CompareMembers(left, right);
        }

        private static bool IsTopicEvent(
            SupabaseRealtimeEnvelope envelope,
            string owner,
            string eventName)
        {
            if (envelope == null || string.IsNullOrWhiteSpace(owner)
                || envelope.Event != eventName)
                return false;
            return string.Equals(
                envelope.Topic,
                SupabaseRealtimeProtocol.NormalizeTopic("friend-world-live:" + owner.Trim()),
                StringComparison.Ordinal);
        }

    }
}
