using System;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseFamilyRecord
    {
        public string id;
        public string name;
    }

    [Serializable]
    public sealed class SupabaseParentHomeSnapshot
    {
        public string familyId;
        public SupabaseFamilyRecord family;
        public SupabaseChildProfileRecord[] children;
        public SupabaseChildTaskRecord[] tasks;
        public SupabaseChildRewardRecord[] rewards;
        public SupabaseChildWishlistRecord[] wishlist;
        public SupabaseChildTicketRecord[] tickets;
        public SupabaseChildLedgerRecord[] ledger;
    }

    public sealed class SupabaseParentTaskReviewResult
    {
        public SupabaseChildTaskRecord Task { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseParentTaskCreateInput
    {
        public string childProfileId;
        public string name;
        public int points;
        public string icon;
        public int? durationMinutes;
        public bool isDaily;
        public string dueOn;
        public string dueTime;
        public string endTime;
        public string category;
        public bool requiresReviewBeforeNextTask;
    }

    public sealed class SupabaseParentTaskMutationResult
    {
        public bool Created { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseParentRewardMutationResult
    {
        public SupabaseChildRewardRecord Reward { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseParentHomeClient
    {
        private readonly SupabaseRestClient restClient;

        public SupabaseParentHomeClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<SupabaseParentHomeSnapshot> LoadAsync(
            CancellationToken cancellationToken)
        {
            SupabaseSession session = await restClient.EnsureSessionAsync(cancellationToken);
            if (session == null || session.User == null
                || string.IsNullOrWhiteSpace(session.User.Id))
            {
                throw new SupabaseDataException("Supabase session 缺少使用者 ID。");
            }

            SupabaseFamilyMemberRecord[] members =
                await restClient.SelectManyAsync<SupabaseFamilyMemberRecord>(
                    "family_members",
                    new[]
                    {
                        new SupabaseRestFilter("profile_id", "eq", session.User.Id),
                        new SupabaseRestFilter("role", "eq", "parent"),
                    },
                    "*",
                    null,
                    0,
                    cancellationToken);
            if (members.Length == 0 || string.IsNullOrWhiteSpace(members[0].family_id))
            {
                throw new SupabaseDataException("此家長帳號尚未加入家庭。");
            }

            string familyId = members[0].family_id;
            SupabaseRestFilter familyFilter =
                new SupabaseRestFilter("family_id", "eq", familyId);
            Task<SupabaseFamilyRecord> family = restClient.SelectSingleAsync<SupabaseFamilyRecord>(
                "families",
                new[] { new SupabaseRestFilter("id", "eq", familyId) },
                "*",
                cancellationToken);
            Task<SupabaseChildProfileRecord[]> children =
                restClient.SelectManyAsync<SupabaseChildProfileRecord>(
                    "child_profiles",
                    new[] { familyFilter },
                    "*",
                    "display_name.asc",
                    0,
                    cancellationToken);
            Task<SupabaseChildTaskRecord[]> tasks =
                restClient.SelectManyAsync<SupabaseChildTaskRecord>(
                    "tasks",
                    new[] { familyFilter },
                    "*",
                    "updated_at.desc",
                    200,
                    cancellationToken);
            Task<SupabaseChildRewardRecord[]> rewards =
                restClient.SelectManyAsync<SupabaseChildRewardRecord>(
                    "rewards",
                    new[] { familyFilter },
                    "*",
                    "sort_order.asc",
                    0,
                    cancellationToken);
            Task<SupabaseChildWishlistRecord[]> wishlist =
                restClient.SelectManyAsync<SupabaseChildWishlistRecord>(
                    "wishlist_items",
                    new[] { familyFilter },
                    "*",
                    "created_at.asc",
                    0,
                    cancellationToken);
            Task<SupabaseChildTicketRecord[]> tickets =
                restClient.SelectManyAsync<SupabaseChildTicketRecord>(
                    "reward_redemptions",
                    new[] { familyFilter },
                    "*",
                    "created_at.desc",
                    0,
                    cancellationToken);
            Task<SupabaseChildLedgerRecord[]> ledger =
                restClient.SelectManyAsync<SupabaseChildLedgerRecord>(
                    "point_ledger",
                    new[] { familyFilter },
                    "*",
                    "created_at.desc",
                    100,
                    cancellationToken);

            await Task.WhenAll(family, children, tasks, rewards, wishlist, tickets, ledger);
            return new SupabaseParentHomeSnapshot
            {
                familyId = familyId,
                family = family.Result ?? new SupabaseFamilyRecord
                {
                    id = familyId,
                    name = "我的家庭",
                },
                children = children.Result,
                tasks = tasks.Result,
                rewards = rewards.Result,
                wishlist = wishlist.Result,
                tickets = tickets.Result,
                ledger = ledger.Result,
            };
        }

        public async Task<SupabaseChildTaskRecord> ReviewTaskAsync(
            SupabaseChildTaskRecord task,
            bool approved,
            int? approvedPoints,
            string feedback,
            string correction,
            string tone,
            string revisionNote,
            CancellationToken cancellationToken)
        {
            if (task == null || string.IsNullOrWhiteSpace(task.id))
            {
                throw new SupabaseDataException("待審任務 ID 不可為空。");
            }
            if (approvedPoints.HasValue && approvedPoints.Value < 0)
            {
                throw new SupabaseDataException("核准點數不可為負數。");
            }

            string approvedJson = approved ? "true" : "false";
            string pointsJson = approvedPoints.HasValue
                ? approvedPoints.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : "null";
            string body = "{\"target_task_id\":" + SupabaseJson.Quote(task.id)
                + ",\"approved\":" + approvedJson
                + ",\"approved_points\":" + pointsJson
                + ",\"feedback\":" + SupabaseJson.NullableString(feedback)
                + ",\"correction\":" + SupabaseJson.NullableString(correction)
                + ",\"tone\":" + SupabaseJson.NullableString(tone)
                + ",\"revision_note\":" + SupabaseJson.NullableString(revisionNote)
                + "}";
            string functionName = string.IsNullOrWhiteSpace(task.adventure_type)
                ? "review_task_completion"
                : "review_adventure_completion";
            string response = await restClient.CallRpcAsync(
                functionName,
                body,
                cancellationToken);
            SupabaseChildTaskRecord reviewedTask;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out reviewedTask,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            return reviewedTask;
        }

        public async Task CreateTaskAsync(
            string familyId,
            SupabaseParentTaskCreateInput input,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (input == null || string.IsNullOrWhiteSpace(input.childProfileId))
            {
                throw new SupabaseDataException("指定孩子不可為空。");
            }

            string name = input.name == null ? string.Empty : input.name.Trim();
            if (name.Length < 1 || name.Length > 120)
            {
                throw new SupabaseDataException("任務名稱長度必須介於 1 到 120 個字元。");
            }
            if (input.points <= 0)
            {
                throw new SupabaseDataException("任務點數必須大於 0。");
            }
            if (input.durationMinutes.HasValue
                && (input.durationMinutes.Value <= 0 || input.durationMinutes.Value > 1440))
            {
                throw new SupabaseDataException("任務時間必須介於 1 到 1440 分鐘。");
            }

            string icon = string.IsNullOrWhiteSpace(input.icon) ? "Star" : input.icon.Trim();
            string category = string.IsNullOrWhiteSpace(input.category)
                ? "life_habit"
                : input.category.Trim();
            string durationJson = input.durationMinutes.HasValue
                ? input.durationMinutes.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : "null";
            string body = "{\"family_id\":" + SupabaseJson.Quote(familyId)
                + ",\"child_profile_id\":" + SupabaseJson.Quote(input.childProfileId)
                + ",\"name\":" + SupabaseJson.Quote(name)
                + ",\"points\":"
                + input.points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ",\"icon\":" + SupabaseJson.Quote(icon)
                + ",\"duration_minutes\":" + durationJson
                + ",\"is_daily\":" + (input.isDaily ? "true" : "false")
                + ",\"due_on\":" + SupabaseJson.NullableString(input.dueOn)
                + ",\"due_time\":" + SupabaseJson.NullableString(input.dueTime)
                + ",\"end_time\":" + SupabaseJson.NullableString(input.endTime)
                + ",\"requires_review_before_next_task\":"
                + (input.requiresReviewBeforeNextTask ? "true" : "false")
                + ",\"category\":" + SupabaseJson.Quote(category)
                + ",\"origin\":\"parent_assigned\"}";
            await restClient.InsertAsync("tasks", body, cancellationToken);
        }

        public async Task<SupabaseParentTaskMutationResult> CreateTaskAndRefreshAsync(
            string familyId,
            SupabaseParentTaskCreateInput input,
            CancellationToken cancellationToken)
        {
            await CreateTaskAsync(familyId, input, cancellationToken);
            SupabaseParentTaskMutationResult result =
                new SupabaseParentTaskMutationResult { Created = true };
            try
            {
                result.RefreshedSnapshot = await LoadAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                result.RefreshError = exception.Message;
            }

            return result;
        }

        public async Task<SupabaseChildRewardRecord> ApproveWishlistAsync(
            string familyId,
            SupabaseChildWishlistRecord wishlist,
            int points,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (wishlist == null || string.IsNullOrWhiteSpace(wishlist.id)
                || string.IsNullOrWhiteSpace(wishlist.child_profile_id))
            {
                throw new SupabaseDataException("待核准願望資料不完整。");
            }
            if (points <= 0)
            {
                throw new SupabaseDataException("願望獎勵點數必須大於 0。");
            }

            string body = "{\"target_family_id\":" + SupabaseJson.Quote(familyId)
                + ",\"target_child_profile_id\":"
                + SupabaseJson.Quote(wishlist.child_profile_id)
                + ",\"target_wishlist_id\":" + SupabaseJson.Quote(wishlist.id)
                + ",\"target_points\":"
                + points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + "}";
            string response = await restClient.CallRpcAsync(
                "approve_wishlist_item",
                body,
                cancellationToken);
            SupabaseChildRewardRecord reward;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out reward,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            return reward;
        }

        public async Task<SupabaseParentRewardMutationResult> ApproveWishlistAndRefreshAsync(
            string familyId,
            SupabaseChildWishlistRecord wishlist,
            int points,
            CancellationToken cancellationToken)
        {
            SupabaseParentRewardMutationResult result =
                new SupabaseParentRewardMutationResult
                {
                    Reward = await ApproveWishlistAsync(
                        familyId,
                        wishlist,
                        points,
                        cancellationToken),
                };
            await RefreshParentMutationAsync(result, cancellationToken);
            return result;
        }

        public async Task<SupabaseParentRewardMutationResult> FulfillTicketAndRefreshAsync(
            string ticketId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(ticketId))
            {
                throw new SupabaseDataException("獎勵券 ID 不可為空。");
            }

            string fulfilledAt = DateTime.UtcNow.ToString(
                "o",
                System.Globalization.CultureInfo.InvariantCulture);
            await restClient.UpdateAsync(
                "reward_redemptions",
                new[] { new SupabaseRestFilter("id", "eq", ticketId) },
                "{\"status\":\"fulfilled\",\"fulfilled_at\":"
                    + SupabaseJson.Quote(fulfilledAt) + "}",
                cancellationToken);
            SupabaseParentRewardMutationResult result =
                new SupabaseParentRewardMutationResult();
            await RefreshParentMutationAsync(result, cancellationToken);
            return result;
        }

        private async Task RefreshParentMutationAsync(
            SupabaseParentRewardMutationResult result,
            CancellationToken cancellationToken)
        {
            try
            {
                result.RefreshedSnapshot = await LoadAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                result.RefreshError = exception.Message;
            }
        }

        public async Task<SupabaseParentTaskReviewResult> ReviewTaskAndRefreshAsync(
            SupabaseChildTaskRecord task,
            bool approved,
            int? approvedPoints,
            string feedback,
            string correction,
            string tone,
            string revisionNote,
            CancellationToken cancellationToken)
        {
            SupabaseParentTaskReviewResult result = new SupabaseParentTaskReviewResult
            {
                Task = await ReviewTaskAsync(
                    task,
                    approved,
                    approvedPoints,
                    feedback,
                    correction,
                    tone,
                    revisionNote,
                    cancellationToken),
            };
            try
            {
                result.RefreshedSnapshot = await LoadAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                result.RefreshError = exception.Message;
            }

            return result;
        }
    }
}
