using System;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseFriendSummaryRecord
    {
        public string child_profile_id;
        public string display_name;
        public bool is_online;
        public int world_revision;
        public bool can_collaborate_in_my_world;
    }

    [Serializable]
    public sealed class SupabaseFriendRequestRecord
    {
        public string id;
        public string direction;
        public string child_profile_id;
        public string display_name;
        public string created_at;
    }

    public sealed class SupabaseChildSocialData
    {
        public string childProfileId;
        public string friendCode;
        public SupabaseFriendSummaryRecord[] friends;
        public SupabaseFriendRequestRecord[] requests;
    }

    public sealed class SupabaseChildSocialClient
    {
        [Serializable]
        private sealed class StringResponse
        {
            public string value;
        }

        [Serializable]
        private sealed class CodeResponse
        {
            public string code;
        }

        private readonly SupabaseRestClient restClient;

        public SupabaseChildSocialClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<SupabaseChildSocialData> LoadAsync(
            string childProfileId,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            string codeResponse = await restClient.CallRpcAsync(
                "get_my_friend_code",
                "{}",
                cancellationToken);
            string friendsResponse = await restClient.CallRpcAsync(
                "list_my_friends",
                "{}",
                cancellationToken);
            string requestsResponse = await restClient.CallRpcAsync(
                "list_my_friend_requests",
                "{}",
                cancellationToken);

            return new SupabaseChildSocialData
            {
                childProfileId = childProfileId,
                friendCode = ParseFriendCode(codeResponse),
                friends = ParseArray<SupabaseFriendSummaryRecord>(
                    friendsResponse,
                    "好友名單"),
                requests = ParseArray<SupabaseFriendRequestRecord>(
                    requestsResponse,
                    "好友邀請"),
            };
        }

        public Task SendFriendRequestAsync(
            string friendCode,
            CancellationToken cancellationToken)
        {
            RequireValue(friendCode, "好友代碼");
            string body = "{\"target_friend_code\":"
                + SupabaseJson.Quote(friendCode.Trim())
                + "}";
            return CallMutationAsync("send_friend_request", body, cancellationToken);
        }

        public Task AcceptFriendRequestAsync(
            string requestId,
            CancellationToken cancellationToken)
        {
            return CallTargetMutationAsync(
                "accept_friend_request",
                "target_request_id",
                requestId,
                "好友邀請",
                cancellationToken);
        }

        public Task DeclineFriendRequestAsync(
            string requestId,
            CancellationToken cancellationToken)
        {
            return CallTargetMutationAsync(
                "decline_friend_request",
                "target_request_id",
                requestId,
                "好友邀請",
                cancellationToken);
        }

        public Task RemoveFriendAsync(
            string childProfileId,
            CancellationToken cancellationToken)
        {
            return CallTargetMutationAsync(
                "remove_friend",
                "target_child_profile_id",
                childProfileId,
                "好友資料",
                cancellationToken);
        }

        public Task BlockFriendAsync(
            string childProfileId,
            CancellationToken cancellationToken)
        {
            return CallTargetMutationAsync(
                "block_child",
                "target_child_profile_id",
                childProfileId,
                "好友資料",
                cancellationToken);
        }

        public static string GetFriendOperationMessage(string rawMessage)
        {
            string message = (rawMessage ?? string.Empty).ToLowerInvariant();
            if (message.Contains("friend request already sent"))
            {
                return "好友邀請已送出，等待對方接受。";
            }

            if (message.Contains("friend request received"))
            {
                return "對方已送出好友邀請，請到待處理邀請接受。";
            }

            if (message.Contains("already friends"))
            {
                return "你們已經是好友。";
            }

            return "好友操作目前無法完成。";
        }

        private Task CallTargetMutationAsync(
            string functionName,
            string parameterName,
            string value,
            string label,
            CancellationToken cancellationToken)
        {
            RequireValue(value, label);
            string body = "{" + SupabaseJson.Quote(parameterName) + ":"
                + SupabaseJson.Quote(value.Trim()) + "}";
            return CallMutationAsync(functionName, body, cancellationToken);
        }

        private async Task CallMutationAsync(
            string functionName,
            string body,
            CancellationToken cancellationToken)
        {
            try
            {
                await restClient.CallRpcAsync(functionName, body, cancellationToken);
            }
            catch (SupabaseDataException exception)
            {
                throw new SupabaseDataException(
                    GetFriendOperationMessage(exception.Message),
                    exception.StatusCode);
            }
        }

        private static string ParseFriendCode(string response)
        {
            if (string.IsNullOrWhiteSpace(response))
            {
                throw new SupabaseDataException("好友代碼無法解析：回應為空白。");
            }

            string trimmed = response.Trim();
            StringResponse stringResponse;
            string error;
            if (trimmed.StartsWith("\"")
                && SupabaseJsonObjectParser.TryParseObject(
                    "{\"value\":" + trimmed + "}",
                    out stringResponse,
                    out error)
                && !string.IsNullOrWhiteSpace(stringResponse.value))
            {
                return stringResponse.value;
            }

            CodeResponse codeResponse;
            if (SupabaseJsonObjectParser.TryParseObject(
                    trimmed,
                    out codeResponse,
                    out error)
                && !string.IsNullOrWhiteSpace(codeResponse.code))
            {
                return codeResponse.code;
            }

            throw new SupabaseDataException("好友代碼無法解析：" + error);
        }

        private static T[] ParseArray<T>(string response, string label)
        {
            T[] values;
            string error;
            if (!SupabaseJsonArrayParser.TryParseArray(response, out values, out error))
            {
                throw new SupabaseDataException(label + "無法解析：" + error);
            }

            return values ?? new T[0];
        }

        private static void RequireValue(string value, string label)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new SupabaseDataException(label + "不可為空白。");
            }
        }
    }
}
