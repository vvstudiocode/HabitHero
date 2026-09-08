using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseCoopAdventureSummary
    {
        public string id;
        public string world_owner_child_profile_id;
        public string title;
        public string description;
        public string status;
        public int participant_count;
        public string created_at;
        public string completed_at;
    }

    [Serializable]
    public sealed class SupabaseCoopAdventureParticipant
    {
        public string id;
        public string coop_adventure_id;
        public string child_profile_id;
        public string display_name;
        public string role;
        public string joined_at;
    }

    [Serializable]
    public sealed class SupabaseCoopAdventureCompletion
    {
        public string id;
        public string coop_adventure_id;
        public string participant_id;
        public string status;
        public string submitted_at;
        public string reviewed_at;
    }

    public sealed class SupabaseCoopAdventureState
    {
        public SupabaseCoopAdventureSummary[] adventures;
        public SupabaseCoopAdventureParticipant[] participants;
        public SupabaseCoopAdventureCompletion[] completions;
        public string synced_at;
    }

    [Serializable]
    public sealed class SupabaseCoopAdventureNotification
    {
        public string coop_adventure_id;
        public string world_owner_child_profile_id;
        public string creator_child_profile_id;
        public string title;
        public string created_at;
    }

    [Serializable]
    public sealed class SupabaseCoopMutationResult
    {
        public string coop_adventure_id;
        public string participant_id;
        public string completion_id;
        public string status;
    }

    public sealed class SupabaseCoopCompletionInput
    {
        public string idempotencyKey;
        public string quickReport;
        public string reflection;
        public string mood;
        public int? difficulty;
    }

    public sealed class SupabaseCoopReviewInput
    {
        public bool approved;
        public int? approvedPoints;
        public string feedback;
        public string correction;
        public string tone;
        public string revisionNote;
    }

    public sealed class SupabaseChildCoopAdventureClient
    {
        [Serializable]
        private sealed class StateResponse
        {
            public SupabaseCoopAdventureSummary[] adventures;
            public SupabaseCoopAdventureParticipant[] participants;
            public SupabaseCoopAdventureCompletion[] completions;
            public string synced_at;
        }

        private readonly SupabaseRestClient restClient;

        public SupabaseChildCoopAdventureClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<SupabaseCoopAdventureSummary[]> ListAsync(
            string worldOwnerChildProfileId,
            CancellationToken cancellationToken)
        {
            RequireValue(worldOwnerChildProfileId, "合作冒險世界");
            string response = await restClient.CallRpcAsync(
                "list_coop_adventures",
                "{\"target_world_owner_child_profile_id\":"
                    + SupabaseJson.Quote(worldOwnerChildProfileId.Trim()) + "}",
                cancellationToken);
            SupabaseCoopAdventureSummary[] adventures;
            string error;
            if (!SupabaseJsonArrayParser.TryParseArray(
                    response,
                    out adventures,
                    out error))
            {
                throw new SupabaseDataException("合作冒險列表無法解析：" + error);
            }

            return adventures ?? new SupabaseCoopAdventureSummary[0];
        }

        public async Task<SupabaseCoopAdventureState> LoadStateAsync(
            string adventureId,
            CancellationToken cancellationToken)
        {
            RequireValue(adventureId, "合作冒險");
            string response = await restClient.CallRpcAsync(
                "get_coop_adventure_state",
                "{\"target_coop_adventure_id\":"
                    + SupabaseJson.Quote(adventureId.Trim()) + "}",
                cancellationToken);
            StateResponse state;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out state,
                    out error))
            {
                throw new SupabaseDataException("合作冒險狀態無法解析：" + error);
            }

            return new SupabaseCoopAdventureState
            {
                adventures = state.adventures ?? new SupabaseCoopAdventureSummary[0],
                participants = state.participants
                    ?? new SupabaseCoopAdventureParticipant[0],
                completions = state.completions
                    ?? new SupabaseCoopAdventureCompletion[0],
                synced_at = state.synced_at,
            };
        }

        public async Task<SupabaseCoopAdventureNotification>
            CreateFromGeneralTaskAsync(
                string taskId,
                CancellationToken cancellationToken)
        {
            RequireValue(taskId, "合作冒險任務");
            string response = await restClient.CallRpcAsync(
                "create_coop_adventure",
                "{\"target_task_id\":" + SupabaseJson.Quote(taskId.Trim()) + "}",
                cancellationToken);
            return ParseObject<SupabaseCoopAdventureNotification>(
                response,
                "合作冒險建立結果");
        }

        public async Task<SupabaseCoopMutationResult> JoinAsync(
            string adventureId,
            CancellationToken cancellationToken)
        {
            RequireValue(adventureId, "合作冒險");
            string response = await restClient.CallRpcAsync(
                "join_coop_adventure",
                "{\"target_coop_adventure_id\":"
                    + SupabaseJson.Quote(adventureId.Trim()) + "}",
                cancellationToken);
            return ParseObject<SupabaseCoopMutationResult>(
                response,
                "合作冒險加入結果");
        }

        public async Task<SupabaseCoopMutationResult> SubmitCompletionAsync(
            string participantId,
            SupabaseCoopCompletionInput input,
            CancellationToken cancellationToken)
        {
            ValidateCompletion(participantId, input);
            string body = "{\"target_participant_id\":"
                + SupabaseJson.Quote(participantId.Trim())
                + ",\"idempotency_key\":"
                + SupabaseJson.Quote(input.idempotencyKey.Trim())
                + ",\"quick_report\":"
                + SupabaseJson.NullableString(input.quickReport)
                + ",\"reflection\":"
                + SupabaseJson.NullableString(input.reflection)
                + ",\"mood\":"
                + SupabaseJson.NullableString(input.mood)
                + ",\"difficulty\":"
                + (input.difficulty.HasValue
                    ? input.difficulty.Value.ToString(CultureInfo.InvariantCulture)
                    : "null")
                + "}";
            string response = await restClient.CallRpcAsync(
                "submit_coop_adventure_completion",
                body,
                cancellationToken);
            return ParseObject<SupabaseCoopMutationResult>(
                response,
                "合作冒險完成回報結果");
        }

        public async Task<SupabaseCoopMutationResult> ReviewCompletionAsync(
            string participantId,
            SupabaseCoopReviewInput input,
            CancellationToken cancellationToken)
        {
            RequireValue(participantId, "合作冒險參與者");
            if (input == null)
            {
                throw new SupabaseDataException("合作冒險批改資料不可為空。");
            }

            string body = "{\"target_participant_id\":"
                + SupabaseJson.Quote(participantId.Trim())
                + ",\"approved\":"
                + (input.approved ? "true" : "false")
                + ",\"approved_points\":"
                + (input.approvedPoints.HasValue
                    ? input.approvedPoints.Value.ToString(CultureInfo.InvariantCulture)
                    : "null")
                + ",\"feedback\":"
                + SupabaseJson.NullableString(input.feedback)
                + ",\"correction\":"
                + SupabaseJson.NullableString(input.correction)
                + ",\"tone\":"
                + SupabaseJson.NullableString(input.tone)
                + ",\"revision_note\":"
                + SupabaseJson.NullableString(input.revisionNote)
                + "}";
            string response = await restClient.CallRpcAsync(
                "review_coop_adventure_completion",
                body,
                cancellationToken);
            return ParseObject<SupabaseCoopMutationResult>(
                response,
                "合作冒險批改結果");
        }

        private static void ValidateCompletion(
            string participantId,
            SupabaseCoopCompletionInput input)
        {
            RequireValue(participantId, "合作冒險參與者");
            if (input == null)
            {
                throw new SupabaseDataException("合作冒險完成回報不可為空。");
            }
            Guid idempotencyKey;
            if (!Guid.TryParse(input.idempotencyKey, out idempotencyKey))
            {
                throw new SupabaseDataException("合作冒險回報需要有效的同步識別碼。");
            }
            if (!string.IsNullOrWhiteSpace(input.quickReport)
                && input.quickReport != "smooth"
                && input.quickReport != "hard"
                && input.quickReport != "help")
            {
                throw new SupabaseDataException("合作冒險回報類型無效。");
            }
            if (input.difficulty.HasValue
                && (input.difficulty.Value < 1 || input.difficulty.Value > 5))
            {
                throw new SupabaseDataException("合作冒險難度必須介於 1 到 5。");
            }
        }

        private static T ParseObject<T>(string response, string label)
        {
            T value;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out value,
                    out error))
            {
                throw new SupabaseDataException(label + "無法解析：" + error);
            }

            return value;
        }

        private static void RequireValue(string value, string label)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new SupabaseDataException(label + "不可為空。");
            }
        }
    }
}
