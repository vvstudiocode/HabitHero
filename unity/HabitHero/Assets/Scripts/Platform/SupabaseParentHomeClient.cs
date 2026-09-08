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
