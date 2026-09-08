using System;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseWorldChatMessageRecord
    {
        public string id;
        public string world_owner_child_profile_id;
        public string sender_child_profile_id;
        public string sender_display_name;
        public string body;
        public string status;
        public string created_at;
    }

    public sealed class SupabaseChildWorldChatData
    {
        public string worldOwnerChildProfileId;
        public SupabaseWorldChatMessageRecord[] messages;
        public int unreadCount;
    }

    public sealed class SupabaseChildWorldChatClient
    {
        private const int MaxPageSize = 50;

        [Serializable]
        private sealed class IntegerResponse
        {
            public int value;
        }

        private readonly SupabaseRestClient restClient;

        public SupabaseChildWorldChatClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<SupabaseChildWorldChatData> LoadAsync(
            string worldOwnerChildProfileId,
            CancellationToken cancellationToken)
        {
            RequireTarget(worldOwnerChildProfileId);
            string normalizedOwner = worldOwnerChildProfileId.Trim();
            SupabaseWorldChatMessageRecord[] messages =
                await restClient.SelectManyAsync<SupabaseWorldChatMessageRecord>(
                    "friend_world_messages",
                    new[]
                    {
                        new SupabaseRestFilter(
                            "world_owner_child_profile_id",
                            "eq",
                            normalizedOwner),
                        new SupabaseRestFilter("status", "eq", "visible"),
                    },
                    "*",
                    "created_at.asc",
                    MaxPageSize,
                    cancellationToken);
            string unreadResponse = await restClient.CallRpcAsync(
                "get_friend_world_message_unread_count",
                "{\"target_world_owner_child_profile_id\":"
                    + SupabaseJson.Quote(normalizedOwner)
                    + "}",
                cancellationToken);

            return new SupabaseChildWorldChatData
            {
                worldOwnerChildProfileId = normalizedOwner,
                messages = messages ?? new SupabaseWorldChatMessageRecord[0],
                unreadCount = ParseUnreadCount(unreadResponse),
            };
        }

        public async Task<SupabaseWorldChatMessageRecord> SendAsync(
            string worldOwnerChildProfileId,
            string body,
            CancellationToken cancellationToken)
        {
            RequireTarget(worldOwnerChildProfileId);
            string normalizedBody = NormalizeMessage(body);
            string response = await restClient.CallRpcAsync(
                "send_friend_world_message",
                "{\"target_world_owner_child_profile_id\":"
                    + SupabaseJson.Quote(worldOwnerChildProfileId.Trim())
                    + ",\"message_text\":"
                    + SupabaseJson.Quote(normalizedBody)
                    + "}",
                cancellationToken);

            SupabaseWorldChatMessageRecord message;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out message,
                    out error)
                || message == null
                || string.IsNullOrWhiteSpace(message.id))
            {
                throw new SupabaseDataException("聊天訊息回應無法解析：" + error);
            }

            return message;
        }

        public Task MarkReadAsync(
            string worldOwnerChildProfileId,
            string messageId,
            CancellationToken cancellationToken)
        {
            RequireTarget(worldOwnerChildProfileId);
            string targetMessage = string.IsNullOrWhiteSpace(messageId)
                ? "null"
                : SupabaseJson.Quote(messageId.Trim());
            return restClient.CallRpcAsync(
                "mark_friend_world_messages_read",
                "{\"target_world_owner_child_profile_id\":"
                    + SupabaseJson.Quote(worldOwnerChildProfileId.Trim())
                    + ",\"target_message_id\":"
                    + targetMessage
                    + "}",
                cancellationToken);
        }

        public Task ReportAsync(
            string messageId,
            string reason,
            CancellationToken cancellationToken)
        {
            RequireTarget(messageId);
            string normalizedReason = string.IsNullOrWhiteSpace(reason)
                ? "未提供原因"
                : reason.Trim();
            return restClient.CallRpcAsync(
                "report_friend_world_message",
                "{\"target_message_id\":"
                    + SupabaseJson.Quote(messageId.Trim())
                    + ",\"report_reason\":"
                    + SupabaseJson.Quote(normalizedReason)
                    + "}",
                cancellationToken);
        }

        public static bool IsValidMessage(string value)
        {
            try
            {
                NormalizeMessage(value);
                return true;
            }
            catch (SupabaseDataException)
            {
                return false;
            }
        }

        private static string NormalizeMessage(string value)
        {
            string normalized = (value ?? string.Empty).Trim();
            if (normalized.Length < 1 || normalized.Length > 120)
            {
                throw new SupabaseDataException("訊息長度必須是 1 到 120 個字。");
            }

            if (ContainsControlCharacter(normalized))
            {
                throw new SupabaseDataException("訊息不能包含控制字元或換行。");
            }

            if (Regex.IsMatch(normalized, "(?:https?://|www\\.)", RegexOptions.IgnoreCase))
            {
                throw new SupabaseDataException("聊天訊息不能包含連結。");
            }

            if (Regex.IsMatch(
                    normalized,
                    "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}",
                    RegexOptions.IgnoreCase))
            {
                throw new SupabaseDataException("聊天訊息不能包含電子郵件。");
            }

            if (Regex.IsMatch(
                    normalized,
                    "(?:^|[^0-9])\\+?[0-9][0-9 .()/-]{5,}[0-9](?:[^0-9]|$)"))
            {
                throw new SupabaseDataException("聊天訊息不能包含電話號碼。");
            }

            return normalized;
        }

        private static int ParseUnreadCount(string response)
        {
            string trimmed = (response ?? string.Empty).Trim();
            int count;
            if (int.TryParse(
                    trimmed,
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out count))
            {
                return Math.Max(0, count);
            }

            IntegerResponse objectResponse;
            string error;
            if (SupabaseJsonObjectParser.TryParseObject(
                    trimmed,
                    out objectResponse,
                    out error))
            {
                return Math.Max(0, objectResponse.value);
            }

            throw new SupabaseDataException("未讀聊天數量無法解析：" + error);
        }

        private static void RequireTarget(string value)
        {
            if (string.IsNullOrWhiteSpace(value)
                || ContainsControlCharacter(value))
            {
                throw new SupabaseDataException("聊天目標不可為空白或包含控制字元。");
            }
        }

        private static bool ContainsControlCharacter(string value)
        {
            foreach (char character in value)
            {
                if (character < 32 || character == 127) return true;
            }

            return false;
        }
    }
}
