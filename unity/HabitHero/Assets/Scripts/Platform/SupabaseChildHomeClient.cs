using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseFamilyMemberRecord
    {
        public string id;
        public string family_id;
        public string profile_id;
        public string role;
    }

    [Serializable]
    public sealed class SupabaseChildProfileRecord
    {
        public string id;
        public string family_id;
        public string profile_id;
        public string login_name;
        public string display_name;
        public string gender;
        public string character_id;
        public string joined_at;
        public int points_balance;
    }

    [Serializable]
    public sealed class SupabaseChildTaskRecord
    {
        public string id;
        public string family_id;
        public string child_profile_id;
        public string name;
        public int points;
        public string status;
        public string icon;
        public int duration_minutes;
        public bool is_daily;
        public string due_on;
        public string due_time;
        public string end_time;
        public bool requires_review_before_next_task;
        public string category;
        public string origin;
        public string child_reflection_text;
        public string child_mood;
        public int child_difficulty;
        public string submitted_at;
        public string reviewed_at;
        public int approved_points;
        public string created_at;
        public string updated_at;
    }

    [Serializable]
    public sealed class SupabaseChildRewardRecord
    {
        public string id;
        public string child_profile_id;
        public string name;
        public int points;
        public string icon;
    }

    [Serializable]
    public sealed class SupabaseChildWishlistRecord
    {
        public string id;
        public string child_profile_id;
        public string name;
    }

    [Serializable]
    public sealed class SupabaseChildTicketRecord
    {
        public string id;
        public string child_profile_id;
        public string reward_id;
        public string reward_name;
        public string reward_icon;
        public int points_cost;
        public string status;
        public string created_at;
    }

    [Serializable]
    public sealed class SupabaseChildLedgerRecord
    {
        public string id;
        public string child_profile_id;
        public string task_id;
        public int points_delta;
        public string entry_type;
        public string note;
        public string created_at;
    }

    public sealed class SupabaseChildHomeSnapshot
    {
        public string familyId;
        public SupabaseChildProfileRecord child;
        public SupabaseChildTaskRecord[] tasks;
        public SupabaseChildRewardRecord[] rewards;
        public SupabaseChildWishlistRecord[] wishlist;
        public SupabaseChildTicketRecord[] tickets;
        public SupabaseChildLedgerRecord[] ledger;
    }

    public sealed class SupabaseChildHomeClient
    {
        private readonly SupabaseRestClient restClient;

        public SupabaseChildHomeClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<SupabaseChildHomeSnapshot> LoadAsync(
            CancellationToken cancellationToken)
        {
            SupabaseSession session = await restClient.EnsureSessionAsync(cancellationToken);
            if (session == null || session.User == null || string.IsNullOrWhiteSpace(session.User.Id))
            {
                throw new SupabaseDataException("孩子帳號的 Supabase session 缺少使用者 ID。");
            }

            string userId = session.User.Id;
            SupabaseFamilyMemberRecord[] members = await restClient.SelectManyAsync<SupabaseFamilyMemberRecord>(
                "family_members",
                new[] { new SupabaseRestFilter("profile_id", "eq", userId) },
                "*",
                null,
                0,
                cancellationToken);
            if (members.Length == 0 || string.IsNullOrWhiteSpace(members[0].family_id))
            {
                throw new SupabaseDataException("此孩子帳號尚未加入家庭。");
            }

            string familyId = members[0].family_id;
            SupabaseChildProfileRecord child = await restClient.SelectSingleAsync<SupabaseChildProfileRecord>(
                "child_profiles",
                new[]
                {
                    new SupabaseRestFilter("family_id", "eq", familyId),
                    new SupabaseRestFilter("profile_id", "eq", userId),
                },
                "*",
                cancellationToken);
            if (child == null || string.IsNullOrWhiteSpace(child.id))
            {
                throw new SupabaseDataException("找不到目前登入的孩子資料。");
            }

            await restClient.CallRpcAsync(
                "ensure_daily_adventure_occurrences",
                "{\"target_child_profile_id\":" + SupabaseJson.Quote(child.id) + "}",
                cancellationToken);

            SupabaseRestFilter[] childFilters =
            {
                new SupabaseRestFilter("family_id", "eq", familyId),
                new SupabaseRestFilter("child_profile_id", "eq", child.id),
            };
            Task<SupabaseChildTaskRecord[]> tasks = restClient.SelectManyAsync<SupabaseChildTaskRecord>(
                "tasks",
                childFilters,
                "*",
                "created_at.asc",
                0,
                cancellationToken);
            Task<SupabaseChildRewardRecord[]> rewards = restClient.SelectManyAsync<SupabaseChildRewardRecord>(
                "rewards",
                childFilters,
                "*",
                "sort_order.asc",
                0,
                cancellationToken);
            Task<SupabaseChildWishlistRecord[]> wishlist = restClient.SelectManyAsync<SupabaseChildWishlistRecord>(
                "wishlist_items",
                childFilters,
                "*",
                "created_at.asc",
                0,
                cancellationToken);
            Task<SupabaseChildTicketRecord[]> tickets = restClient.SelectManyAsync<SupabaseChildTicketRecord>(
                "reward_redemptions",
                childFilters,
                "*",
                "created_at.desc",
                0,
                cancellationToken);
            Task<SupabaseChildLedgerRecord[]> ledger = restClient.SelectManyAsync<SupabaseChildLedgerRecord>(
                "point_ledger",
                childFilters,
                "*",
                "created_at.desc",
                100,
                cancellationToken);

            await Task.WhenAll(tasks, rewards, wishlist, tickets, ledger);
            return new SupabaseChildHomeSnapshot
            {
                familyId = familyId,
                child = child,
                tasks = tasks.Result,
                rewards = rewards.Result,
                wishlist = wishlist.Result,
                tickets = tickets.Result,
                ledger = ledger.Result,
            };
        }

        public Task SubmitTaskReflectionAsync(
            string taskId,
            string reflection,
            string mood,
            int? difficulty,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(taskId))
            {
                throw new SupabaseDataException("任務 ID 不可為空。");
            }

            string difficultyJson = difficulty.HasValue
                ? difficulty.Value.ToString(CultureInfo.InvariantCulture)
                : "null";
            string body = "{\"target_task_id\":" + SupabaseJson.Quote(taskId)
                + ",\"reflection\":" + SupabaseJson.Quote(reflection ?? string.Empty)
                + ",\"mood\":" + SupabaseJson.NullableString(mood)
                + ",\"difficulty\":" + difficultyJson + "}";
            return SubmitTaskReflectionInternalAsync(body, cancellationToken);
        }

        private async Task SubmitTaskReflectionInternalAsync(
            string body,
            CancellationToken cancellationToken)
        {
            await restClient.CallRpcAsync("submit_task_reflection", body, cancellationToken);
        }

    }
}
