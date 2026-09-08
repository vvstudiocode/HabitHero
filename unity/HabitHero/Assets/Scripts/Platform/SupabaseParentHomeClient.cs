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

    public sealed class SupabaseParentRewardCreateInput
    {
        public string childProfileId;
        public string name;
        public int points;
        public string icon;
    }

    public sealed class SupabaseParentPointMutationResult
    {
        public int PointsBalance { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseParentChildAccountCreateInput
    {
        public string childProfileId;
        public string childName;
        public string loginName;
        public string password;
        public string gender;
        public string characterId;
    }

    public sealed class SupabaseParentChildAccountMutationResult
    {
        public SupabaseChildProfileRecord Child { get; set; }

        public bool Succeeded { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    [Serializable]
    internal sealed class SupabasePointAdjustmentResponse
    {
        public int points_balance;
    }

    [Serializable]
    internal sealed class SupabaseManagedChildAccountResponse
    {
        public SupabaseChildProfileRecord child;
        public bool success;
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

        public async Task<int> AdjustChildPointsAsync(
            string childProfileId,
            int pointsDelta,
            string note,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(childProfileId))
            {
                throw new SupabaseDataException("孩子 ID 不可為空。");
            }
            if (pointsDelta == 0 || Math.Abs((long)pointsDelta) > 10000)
            {
                throw new SupabaseDataException("點數調整必須介於 -10000 到 10000，且不可為 0。");
            }

            string normalizedNote = note == null ? string.Empty : note.Trim();
            if (normalizedNote.Length < 1 || normalizedNote.Length > 200)
            {
                throw new SupabaseDataException("點數調整原因長度必須介於 1 到 200 個字元。");
            }

            string body = "{\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId)
                + ",\"points_delta\":"
                + pointsDelta.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ",\"adjustment_note\":" + SupabaseJson.Quote(normalizedNote) + "}";
            string response = await restClient.CallRpcAsync(
                "adjust_child_points",
                body,
                cancellationToken);
            SupabasePointAdjustmentResponse parsed;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out parsed,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            return parsed.points_balance;
        }

        public async Task<SupabaseParentPointMutationResult> AdjustChildPointsAndRefreshAsync(
            string childProfileId,
            int pointsDelta,
            string note,
            CancellationToken cancellationToken)
        {
            SupabaseParentPointMutationResult result =
                new SupabaseParentPointMutationResult
                {
                    PointsBalance = await AdjustChildPointsAsync(
                        childProfileId,
                        pointsDelta,
                        note,
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

        public async Task<SupabaseChildProfileRecord> CreateChildAccountAsync(
            string familyId,
            SupabaseParentChildAccountCreateInput input,
            CancellationToken cancellationToken)
        {
            ValidateChildAccountCreate(familyId, input);
            string body = "{\"action\":\"create\",\"familyId\":"
                + SupabaseJson.Quote(familyId)
                + (string.IsNullOrWhiteSpace(input.childProfileId)
                    ? string.Empty
                    : ",\"childProfileId\":" + SupabaseJson.Quote(input.childProfileId))
                + ",\"childName\":" + SupabaseJson.Quote(input.childName.Trim())
                + ",\"loginName\":" + SupabaseJson.Quote(input.loginName.Trim().ToLowerInvariant())
                + ",\"password\":" + SupabaseJson.Quote(input.password)
                + (string.IsNullOrWhiteSpace(input.gender)
                    ? string.Empty
                    : ",\"gender\":" + SupabaseJson.Quote(input.gender.Trim()))
                + (string.IsNullOrWhiteSpace(input.characterId)
                    ? string.Empty
                    : ",\"characterId\":" + SupabaseJson.Quote(input.characterId.Trim()))
                + "}";
            string response = await restClient.InvokeFunctionAsync(
                "manage-child-account",
                body,
                cancellationToken);
            SupabaseManagedChildAccountResponse parsed;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out parsed,
                    out error)
                || parsed.child == null)
            {
                throw new SupabaseDataException(
                    string.IsNullOrWhiteSpace(error)
                        ? "Supabase 沒有回傳孩子帳號資料。"
                        : error);
            }

            return parsed.child;
        }

        public async Task ResetChildPasswordAsync(
            string familyId,
            string childProfileId,
            string password,
            CancellationToken cancellationToken)
        {
            ValidateChildAccountTarget(familyId, childProfileId);
            ValidateChildPassword(password);
            string body = "{\"action\":\"reset-password\",\"familyId\":"
                + SupabaseJson.Quote(familyId)
                + ",\"childProfileId\":" + SupabaseJson.Quote(childProfileId)
                + ",\"password\":" + SupabaseJson.Quote(password) + "}";
            string response = await restClient.InvokeFunctionAsync(
                "manage-child-account",
                body,
                cancellationToken);
            EnsureSuccessfulAccountMutation(response);
        }

        public async Task DeleteChildAccountAsync(
            string familyId,
            string childProfileId,
            CancellationToken cancellationToken)
        {
            ValidateChildAccountTarget(familyId, childProfileId);
            string body = "{\"action\":\"delete\",\"familyId\":"
                + SupabaseJson.Quote(familyId)
                + ",\"childProfileId\":" + SupabaseJson.Quote(childProfileId) + "}";
            string response = await restClient.InvokeFunctionAsync(
                "manage-child-account",
                body,
                cancellationToken);
            EnsureSuccessfulAccountMutation(response);
        }

        public async Task<SupabaseParentChildAccountMutationResult> CreateChildAccountAndRefreshAsync(
            string familyId,
            SupabaseParentChildAccountCreateInput input,
            CancellationToken cancellationToken)
        {
            SupabaseParentChildAccountMutationResult result =
                new SupabaseParentChildAccountMutationResult
                {
                    Child = await CreateChildAccountAsync(
                        familyId,
                        input,
                        cancellationToken),
                    Succeeded = true,
                };
            await RefreshChildAccountMutationAsync(result, cancellationToken);
            return result;
        }

        public async Task<SupabaseParentChildAccountMutationResult> ResetChildPasswordAndRefreshAsync(
            string familyId,
            string childProfileId,
            string password,
            CancellationToken cancellationToken)
        {
            await ResetChildPasswordAsync(
                familyId,
                childProfileId,
                password,
                cancellationToken);
            SupabaseParentChildAccountMutationResult result =
                new SupabaseParentChildAccountMutationResult { Succeeded = true };
            await RefreshChildAccountMutationAsync(result, cancellationToken);
            return result;
        }

        public async Task<SupabaseParentChildAccountMutationResult> DeleteChildAccountAndRefreshAsync(
            string familyId,
            string childProfileId,
            CancellationToken cancellationToken)
        {
            await DeleteChildAccountAsync(
                familyId,
                childProfileId,
                cancellationToken);
            SupabaseParentChildAccountMutationResult result =
                new SupabaseParentChildAccountMutationResult { Succeeded = true };
            await RefreshChildAccountMutationAsync(result, cancellationToken);
            return result;
        }

        public async Task CreateRewardAsync(
            string familyId,
            SupabaseParentRewardCreateInput input,
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
                throw new SupabaseDataException("獎勵名稱長度必須介於 1 到 120 個字元。");
            }
            if (input.points <= 0)
            {
                throw new SupabaseDataException("獎勵點數必須大於 0。");
            }

            string icon = string.IsNullOrWhiteSpace(input.icon) ? "Gift" : input.icon.Trim();
            string body = "{\"family_id\":" + SupabaseJson.Quote(familyId)
                + ",\"child_profile_id\":" + SupabaseJson.Quote(input.childProfileId)
                + ",\"name\":" + SupabaseJson.Quote(name)
                + ",\"points\":"
                + input.points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ",\"icon\":" + SupabaseJson.Quote(icon) + "}";
            await restClient.InsertAsync("rewards", body, cancellationToken);
        }

        public async Task UpdateRewardAsync(
            SupabaseChildRewardRecord reward,
            string name,
            int points,
            CancellationToken cancellationToken)
        {
            if (reward == null || string.IsNullOrWhiteSpace(reward.id))
            {
                throw new SupabaseDataException("獎勵 ID 不可為空。");
            }
            string normalizedName = name == null ? string.Empty : name.Trim();
            if (normalizedName.Length < 1 || normalizedName.Length > 120)
            {
                throw new SupabaseDataException("獎勵名稱長度必須介於 1 到 120 個字元。");
            }
            if (points <= 0)
            {
                throw new SupabaseDataException("獎勵點數必須大於 0。");
            }

            await restClient.UpdateAsync(
                "rewards",
                new[] { new SupabaseRestFilter("id", "eq", reward.id) },
                "{\"name\":" + SupabaseJson.Quote(normalizedName)
                    + ",\"points\":"
                    + points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                    + ",\"icon\":"
                    + SupabaseJson.Quote(string.IsNullOrWhiteSpace(reward.icon) ? "Gift" : reward.icon)
                    + "}",
                cancellationToken);
        }

        public async Task DeleteRewardAsync(
            string rewardId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(rewardId))
            {
                throw new SupabaseDataException("獎勵 ID 不可為空。");
            }

            await restClient.DeleteAsync(
                "rewards",
                new[] { new SupabaseRestFilter("id", "eq", rewardId) },
                cancellationToken);
        }

        public async Task<SupabaseParentRewardMutationResult> CreateRewardAndRefreshAsync(
            string familyId,
            SupabaseParentRewardCreateInput input,
            CancellationToken cancellationToken)
        {
            await CreateRewardAsync(familyId, input, cancellationToken);
            SupabaseParentRewardMutationResult result =
                new SupabaseParentRewardMutationResult
                {
                    Reward = new SupabaseChildRewardRecord
                    {
                        family_id = familyId,
                        child_profile_id = input.childProfileId,
                        name = input.name,
                        points = input.points,
                        icon = input.icon,
                    },
                };
            await RefreshParentMutationAsync(result, cancellationToken);
            return result;
        }

        public async Task<SupabaseParentRewardMutationResult> UpdateRewardAndRefreshAsync(
            SupabaseChildRewardRecord reward,
            string name,
            int points,
            CancellationToken cancellationToken)
        {
            await UpdateRewardAsync(reward, name, points, cancellationToken);
            SupabaseParentRewardMutationResult result =
                new SupabaseParentRewardMutationResult { Reward = reward };
            await RefreshParentMutationAsync(result, cancellationToken);
            return result;
        }

        public async Task<SupabaseParentRewardMutationResult> DeleteRewardAndRefreshAsync(
            string rewardId,
            CancellationToken cancellationToken)
        {
            await DeleteRewardAsync(rewardId, cancellationToken);
            SupabaseParentRewardMutationResult result =
                new SupabaseParentRewardMutationResult();
            await RefreshParentMutationAsync(result, cancellationToken);
            return result;
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

        private static void ValidateChildAccountCreate(
            string familyId,
            SupabaseParentChildAccountCreateInput input)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (input == null)
            {
                throw new SupabaseDataException("孩子帳號資料不可為空。");
            }

            string childName = input.childName == null ? string.Empty : input.childName.Trim();
            if (childName.Length < 1 || childName.Length > 80)
            {
                throw new SupabaseDataException("孩子名稱長度必須介於 1 到 80 個字元。");
            }
            ValidateChildLoginName(input.loginName);
            ValidateChildPassword(input.password);
            if (!string.IsNullOrWhiteSpace(input.childProfileId)) return;

            if (input.gender != "boy" && input.gender != "girl")
            {
                throw new SupabaseDataException("新孩子帳號必須指定性別。");
            }
            if (input.characterId != "character.arthur"
                && input.characterId != "character.elina"
                && input.characterId != "character.sia"
                && input.characterId != "character.elio")
            {
                throw new SupabaseDataException("新孩子帳號的人物設定無效。");
            }
        }

        private static void ValidateChildAccountTarget(
            string familyId,
            string childProfileId)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (string.IsNullOrWhiteSpace(childProfileId))
            {
                throw new SupabaseDataException("孩子帳號 ID 不可為空。");
            }
        }

        private static void ValidateChildLoginName(string loginName)
        {
            string value = loginName == null ? string.Empty : loginName.Trim().ToLowerInvariant();
            if (value.Length < 3 || value.Length > 32)
            {
                throw new SupabaseDataException("孩子帳號名稱必須為 3 到 32 碼。");
            }

            for (int index = 0; index < value.Length; index += 1)
            {
                char character = value[index];
                bool valid = character >= 'a' && character <= 'z'
                    || character >= '0' && character <= '9'
                    || character == '_';
                if (!valid || (index == 0 && character == '_'))
                {
                    throw new SupabaseDataException(
                        "孩子帳號名稱只能使用小寫英文字母、數字與底線，且不可底線開頭。");
                }
            }
        }

        private static void ValidateChildPassword(string password)
        {
            if (string.IsNullOrEmpty(password) || password.Length < 6)
            {
                throw new SupabaseDataException("孩子密碼至少需要 6 碼英數字。");
            }

            foreach (char character in password)
            {
                bool valid = character >= 'a' && character <= 'z'
                    || character >= 'A' && character <= 'Z'
                    || character >= '0' && character <= '9';
                if (!valid)
                {
                    throw new SupabaseDataException("孩子密碼只能使用英文字母與數字。");
                }
            }
        }

        private static void EnsureSuccessfulAccountMutation(string response)
        {
            SupabaseManagedChildAccountResponse parsed;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out parsed,
                    out error)
                || !parsed.success)
            {
                throw new SupabaseDataException(
                    string.IsNullOrWhiteSpace(error)
                        ? "Supabase 沒有確認孩子帳號變更。"
                        : error);
            }
        }

        private async Task RefreshChildAccountMutationAsync(
            SupabaseParentChildAccountMutationResult result,
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
