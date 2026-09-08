using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

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
        public string parent_feedback_text;
        public string parent_correction_text;
        public string feedback_tone;
        public string revision_note;
        public string adventure_type;
        public string adventure_group_id;
        public string occurrence_date;
        public string completion_report_mode;
        public string quick_report;
        public bool requires_timer;
        public string description;
        public string submitted_at;
        public string reviewed_at;
        public string confirmed_at;
        public string confirmed_by;
        public int approved_points;
        public string created_at;
        public string updated_at;
        [NonSerialized]
        public bool pendingSync;
    }

    [Serializable]
    public sealed class SupabaseChildRewardRecord
    {
        public string id;
        public string family_id;
        public string child_profile_id;
        public string name;
        public int points;
        public string icon;
    }

    [Serializable]
    public sealed class SupabaseChildWishlistRecord
    {
        public string id;
        public string family_id;
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

    [Serializable]
    public sealed class SupabaseTaskTimerSessionRecord
    {
        public string id;
        public string family_id;
        public string child_profile_id;
        public string task_id;
        public string status;
        public int accumulated_seconds;
        public string started_at;
        public string last_resumed_at;
        public string paused_at;
        public string completed_at;
        public string created_at;
        public string updated_at;
    }

    [Serializable]
    public sealed class SupabaseChildHomeSnapshot
    {
        public string familyId;
        public SupabaseChildProfileRecord child;
        public SupabaseChildTaskRecord[] tasks;
        public SupabaseChildRewardRecord[] rewards;
        public SupabaseChildWishlistRecord[] wishlist;
        public SupabaseChildTicketRecord[] tickets;
        public SupabaseChildLedgerRecord[] ledger;
        public SupabaseTaskTimerSessionRecord[] timers;
    }

    public sealed class SupabaseTaskCompletionResult
    {
        public string IdempotencyKey { get; set; }

        public bool QueuedForRetry { get; set; }

        public SupabaseChildHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseChildGoalProposalResult
    {
        public SupabaseChildTaskRecord Task { get; set; }

        public SupabaseChildHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseTaskCompletionDraft
    {
        public string quickReport;
        public string reflection;
        public string mood;
        public int? difficulty;
    }

    public sealed class SupabaseChildGoalProposalInput
    {
        public string name;
        public int points;
        public string icon;
        public string category;
        public int? durationMinutes;
        public string dueOn;
        public string dueTime;
        public string endTime;
    }

    public sealed class SupabaseTaskCompletionFlushResult
    {
        public int SucceededCount { get; set; }

        public int PermanentFailureCount { get; set; }

        public int RemainingCount { get; set; }

        public string Error { get; set; }
    }

    public sealed class SupabaseRewardRedemptionResult
    {
        public SupabaseChildTicketRecord Ticket { get; set; }

        public SupabaseChildHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseWishlistMutationResult
    {
        public SupabaseChildHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseChildHomeClient
    {
        private readonly SupabaseRestClient restClient;
        private readonly SupabaseTaskCompletionQueue completionQueue;
        private readonly SupabaseChildHomeSnapshotCache snapshotCache;
        private readonly Func<bool> isNetworkAvailable;

        public SupabaseChildHomeClient(SupabaseRestClient restClient)
            : this(
                restClient,
                new PlayerPrefsSupabaseTaskCompletionQueueStore(),
                new PlayerPrefsSupabaseChildHomeSnapshotStore(),
                IsNetworkAvailable)
        {
        }

        public SupabaseChildHomeClient(
            SupabaseRestClient restClient,
            ISupabaseTaskCompletionQueueStore completionQueueStore,
            Func<bool> isNetworkAvailable)
            : this(
                restClient,
                completionQueueStore,
                new PlayerPrefsSupabaseChildHomeSnapshotStore(),
                isNetworkAvailable)
        {
        }

        public SupabaseChildHomeClient(
            SupabaseRestClient restClient,
            ISupabaseTaskCompletionQueueStore completionQueueStore,
            ISupabaseChildHomeSnapshotStore snapshotStore,
            Func<bool> isNetworkAvailable)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            if (completionQueueStore == null)
            {
                throw new ArgumentNullException("completionQueueStore");
            }
            if (snapshotStore == null)
            {
                throw new ArgumentNullException("snapshotStore");
            }
            if (isNetworkAvailable == null)
            {
                throw new ArgumentNullException("isNetworkAvailable");
            }

            this.restClient = restClient;
            completionQueue = new SupabaseTaskCompletionQueue(completionQueueStore);
            snapshotCache = new SupabaseChildHomeSnapshotCache(snapshotStore);
            this.isNetworkAvailable = isNetworkAvailable;
        }

        public int PendingCompletionCount
        {
            get
            {
                SupabaseSession session = restClient.CurrentSession;
                if (session == null || session.User == null)
                {
                    return 0;
                }

                return completionQueue.Load(session.User.Id).Count;
            }
        }

        public async Task<SupabaseChildHomeSnapshot> LoadAsync(
            CancellationToken cancellationToken)
        {
            SupabaseSession currentSession = restClient.CurrentSession;
            if (!isNetworkAvailable())
            {
                return LoadCachedSnapshotOrThrow(
                    currentSession,
                    new SupabaseDataException("目前沒有網路連線，且無法載入最新孩子資料。"));
            }

            SupabaseSession session;
            try
            {
                session = await restClient.EnsureSessionAsync(cancellationToken);
            }
            catch (SupabaseDataException exception) when (IsRetryable(exception.StatusCode))
            {
                return LoadCachedSnapshotOrThrow(currentSession, exception);
            }
            catch (SupabaseAuthException exception) when (IsRetryable(exception.StatusCode))
            {
                return LoadCachedSnapshotOrThrow(currentSession, exception);
            }

            if (session == null || session.User == null || string.IsNullOrWhiteSpace(session.User.Id))
            {
                throw new SupabaseDataException("孩子帳號的 Supabase session 缺少使用者 ID。");
            }

            try
            {
                return await LoadOnlineAsync(session, cancellationToken);
            }
            catch (SupabaseDataException exception) when (IsRetryable(exception.StatusCode))
            {
                return LoadCachedSnapshotOrThrow(session, exception);
            }
            catch (SupabaseAuthException exception) when (IsRetryable(exception.StatusCode))
            {
                return LoadCachedSnapshotOrThrow(session, exception);
            }
        }

        public async Task<SupabaseChildHomeSnapshot> LoadForParentAsync(
            string familyId,
            string childProfileId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (string.IsNullOrWhiteSpace(childProfileId))
            {
                throw new SupabaseDataException("孩子 ID 不可為空。");
            }

            SupabaseSession currentSession = restClient.CurrentSession;
            if (!isNetworkAvailable())
            {
                return LoadCachedParentSnapshotOrThrow(
                    currentSession,
                    familyId,
                    childProfileId,
                    new SupabaseDataException(
                        "目前沒有網路連線，且無法載入最新的孩子資料。"));
            }

            SupabaseSession session;
            try
            {
                session = await restClient.EnsureSessionAsync(cancellationToken);
            }
            catch (SupabaseDataException exception) when (IsRetryable(exception.StatusCode))
            {
                return LoadCachedParentSnapshotOrThrow(
                    currentSession,
                    familyId,
                    childProfileId,
                    exception);
            }
            catch (SupabaseAuthException exception) when (IsRetryable(exception.StatusCode))
            {
                return LoadCachedParentSnapshotOrThrow(
                    currentSession,
                    familyId,
                    childProfileId,
                    exception);
            }

            if (session == null || session.User == null
                || string.IsNullOrWhiteSpace(session.User.Id))
            {
                throw new SupabaseDataException("家長帳號的 Supabase session 缺少使用者 ID。");
            }

            try
            {
                return await LoadScopedOnlineAsync(
                    session,
                    familyId,
                    childProfileId,
                    null,
                    false,
                    GetParentSnapshotCacheKey(session.User.Id, childProfileId),
                    "找不到指定的孩子資料。",
                    cancellationToken);
            }
            catch (SupabaseDataException exception) when (IsRetryable(exception.StatusCode))
            {
                return LoadCachedParentSnapshotOrThrow(
                    session,
                    familyId,
                    childProfileId,
                    exception);
            }
            catch (SupabaseAuthException exception) when (IsRetryable(exception.StatusCode))
            {
                return LoadCachedParentSnapshotOrThrow(
                    session,
                    familyId,
                    childProfileId,
                    exception);
            }
        }

        public async Task<SupabaseTaskCompletionResult> SubmitTaskCompletionAndRefreshAsync(
            string taskId,
            string quickReport,
            string reflection,
            string mood,
            int? difficulty,
            CancellationToken cancellationToken)
        {
            SupabaseTaskCompletionResult result = await SubmitTaskCompletionAsync(
                taskId,
                quickReport,
                reflection,
                mood,
                difficulty,
                cancellationToken);
            if (result.QueuedForRetry) return result;

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

        private async Task<SupabaseChildHomeSnapshot> LoadOnlineAsync(
            SupabaseSession session,
            CancellationToken cancellationToken)
        {
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

            return await LoadScopedOnlineAsync(
                session,
                members[0].family_id,
                null,
                userId,
                true,
                userId,
                "找不到目前登入的孩子資料。",
                cancellationToken);
        }

        private async Task<SupabaseChildHomeSnapshot> LoadScopedOnlineAsync(
            SupabaseSession session,
            string familyId,
            string targetChildProfileId,
            string profileId,
            bool flushPendingCompletions,
            string cacheKey,
            string childNotFoundMessage,
            CancellationToken cancellationToken)
        {
            List<SupabaseRestFilter> profileFilters =
                new List<SupabaseRestFilter>
                {
                    new SupabaseRestFilter("family_id", "eq", familyId),
                };
            if (!string.IsNullOrWhiteSpace(targetChildProfileId))
            {
                profileFilters.Add(
                    new SupabaseRestFilter("id", "eq", targetChildProfileId));
            }
            if (!string.IsNullOrWhiteSpace(profileId))
            {
                profileFilters.Add(
                    new SupabaseRestFilter("profile_id", "eq", profileId));
            }

            SupabaseChildProfileRecord child =
                await restClient.SelectSingleAsync<SupabaseChildProfileRecord>(
                    "child_profiles",
                    profileFilters,
                    "*",
                    cancellationToken);
            if (child == null || string.IsNullOrWhiteSpace(child.id))
            {
                throw new SupabaseDataException(childNotFoundMessage);
            }
            if (!string.IsNullOrWhiteSpace(targetChildProfileId)
                && child.id != targetChildProfileId)
            {
                throw new SupabaseDataException("Supabase 回傳的孩子資料與要求的 scope 不一致。");
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
            if (flushPendingCompletions)
            {
                await FlushPendingCompletionsAsync(cancellationToken);
            }

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
            Task<SupabaseTaskTimerSessionRecord[]> timers = restClient.SelectManyAsync<SupabaseTaskTimerSessionRecord>(
                "adventure_timer_sessions",
                childFilters,
                "*",
                "updated_at.desc",
                0,
                cancellationToken);

            await Task.WhenAll(tasks, rewards, wishlist, tickets, ledger, timers);
            List<SupabaseTaskCompletionQueueEntry> pendingCompletions =
                flushPendingCompletions
                    ? completionQueue.Load(session.User.Id)
                    : new List<SupabaseTaskCompletionQueueEntry>();
            foreach (SupabaseChildTaskRecord task in tasks.Result)
            {
                foreach (SupabaseTaskCompletionQueueEntry pending in pendingCompletions)
                {
                    if (pending.taskId == task.id)
                    {
                        task.pendingSync = true;
                        break;
                    }
                }
            }
            SupabaseChildHomeSnapshot snapshot = new SupabaseChildHomeSnapshot
            {
                familyId = familyId,
                child = child,
                tasks = tasks.Result,
                rewards = rewards.Result,
                wishlist = wishlist.Result,
                tickets = tickets.Result,
                ledger = ledger.Result,
                timers = timers.Result,
            };
            if (cacheKey == session.User.Id)
            {
                snapshotCache.Save(cacheKey, snapshot);
            }
            else
            {
                snapshotCache.SaveScoped(
                    cacheKey,
                    familyId,
                    child.id,
                    snapshot);
            }
            return snapshot;
        }

        private SupabaseChildHomeSnapshot LoadCachedSnapshotOrThrow(
            SupabaseSession session,
            Exception fallbackException)
        {
            if (session != null && session.User != null
                && !string.IsNullOrWhiteSpace(session.User.Id))
            {
                SupabaseChildHomeSnapshot snapshot;
                if (snapshotCache.TryLoad(session.User.Id, out snapshot))
                {
                    MarkPendingCompletions(session.User.Id, snapshot);
                    return snapshot;
                }
            }

            if (fallbackException != null) throw fallbackException;
            throw new SupabaseDataException("找不到可供離線使用的孩子首頁快照。");
        }

        private SupabaseChildHomeSnapshot LoadCachedParentSnapshotOrThrow(
            SupabaseSession session,
            string familyId,
            string childProfileId,
            Exception fallbackException)
        {
            if (session != null && session.User != null
                && !string.IsNullOrWhiteSpace(session.User.Id))
            {
                string cacheKey = GetParentSnapshotCacheKey(
                    session.User.Id,
                    childProfileId);
                SupabaseChildHomeSnapshot snapshot;
                if (snapshotCache.TryLoadScoped(
                        cacheKey,
                        familyId,
                        childProfileId,
                        out snapshot))
                {
                    MarkPendingCompletions(session.User.Id, snapshot);
                    return snapshot;
                }
            }

            if (fallbackException != null) throw fallbackException;
            throw new SupabaseDataException("找不到可供離線使用的孩子首頁快照。");
        }

        private static string GetParentSnapshotCacheKey(
            string parentUserId,
            string childProfileId)
        {
            return parentUserId + ":child:" + childProfileId;
        }

        private void MarkPendingCompletions(
            string userId,
            SupabaseChildHomeSnapshot snapshot)
        {
            if (snapshot == null || snapshot.tasks == null) return;
            List<SupabaseTaskCompletionQueueEntry> pendingCompletions =
                completionQueue.Load(userId);
            foreach (SupabaseChildTaskRecord task in snapshot.tasks)
            {
                if (task == null) continue;
                task.pendingSync = false;
                foreach (SupabaseTaskCompletionQueueEntry pending in pendingCompletions)
                {
                    if (pending.taskId == task.id)
                    {
                        task.pendingSync = true;
                        break;
                    }
                }
            }
        }

        public Task<SupabaseTaskTimerSessionRecord> StartAdventureTimerAsync(
            string taskId,
            CancellationToken cancellationToken)
        {
            return CallTimerRpcAsync("start_adventure_timer", taskId, cancellationToken);
        }

        public Task<SupabaseTaskTimerSessionRecord> PauseAdventureTimerAsync(
            string taskId,
            CancellationToken cancellationToken)
        {
            return CallTimerRpcAsync("pause_adventure_timer", taskId, cancellationToken);
        }

        public Task<SupabaseTaskTimerSessionRecord> ResumeAdventureTimerAsync(
            string taskId,
            CancellationToken cancellationToken)
        {
            return CallTimerRpcAsync("resume_adventure_timer", taskId, cancellationToken);
        }

        public async Task AbandonAdventureAsync(
            string taskId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(taskId))
            {
                throw new SupabaseDataException("冒險任務 ID 不可為空。");
            }

            await restClient.CallRpcAsync(
                "abandon_child_adventure",
                "{\"target_task_id\":" + SupabaseJson.Quote(taskId) + "}",
                cancellationToken);
        }

        public async Task<SupabaseChildTaskRecord> ProposeChildGoalAsync(
            string familyId,
            string childProfileId,
            SupabaseChildGoalProposalInput input,
            CancellationToken cancellationToken)
        {
            ValidateChildGoalProposal(familyId, childProfileId, input);
            string body = "{\"target_family_id\":" + SupabaseJson.Quote(familyId.Trim())
                + ",\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId.Trim())
                + ",\"goal_name\":" + SupabaseJson.Quote(input.name.Trim())
                + ",\"goal_points\":"
                + input.points.ToString(CultureInfo.InvariantCulture)
                + ",\"goal_icon\":" + SupabaseJson.Quote(input.icon.Trim())
                + ",\"goal_category\":" + SupabaseJson.Quote(input.category.Trim())
                + ",\"goal_duration_minutes\":"
                + (input.durationMinutes.HasValue
                    ? input.durationMinutes.Value.ToString(CultureInfo.InvariantCulture)
                    : "null")
                + ",\"goal_due_on\":"
                + SupabaseJson.NullableString(input.dueOn)
                + ",\"goal_due_time\":"
                + SupabaseJson.NullableString(input.dueTime)
                + ",\"goal_end_time\":"
                + SupabaseJson.NullableString(input.endTime)
                + "}";
            string response = await restClient.CallRpcAsync(
                "propose_child_goal",
                body,
                cancellationToken);
            SupabaseChildTaskRecord task;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out task,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            return task;
        }

        public async Task<SupabaseChildGoalProposalResult> ProposeChildGoalAndRefreshAsync(
            string familyId,
            string childProfileId,
            SupabaseChildGoalProposalInput input,
            CancellationToken cancellationToken)
        {
            SupabaseChildTaskRecord task = await ProposeChildGoalAsync(
                familyId,
                childProfileId,
                input,
                cancellationToken);
            SupabaseChildGoalProposalResult result = new SupabaseChildGoalProposalResult
            {
                Task = task,
                RefreshedSnapshot = null,
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

        public async Task<SupabaseChildHomeSnapshot> AbandonAdventureAndRefreshAsync(
            string taskId,
            CancellationToken cancellationToken)
        {
            await AbandonAdventureAsync(taskId, cancellationToken);
            return await LoadAsync(cancellationToken);
        }

        public async Task<SupabaseChildTicketRecord> RedeemRewardAsync(
            string rewardId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(rewardId))
            {
                throw new SupabaseDataException("獎勵 ID 不可為空。");
            }

            string response = await restClient.CallRpcAsync(
                "redeem_reward",
                "{\"target_reward_id\":" + SupabaseJson.Quote(rewardId) + "}",
                cancellationToken);
            SupabaseChildTicketRecord ticket;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out ticket,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            return ticket;
        }

        public async Task<SupabaseRewardRedemptionResult> RedeemRewardAndRefreshAsync(
            string rewardId,
            CancellationToken cancellationToken)
        {
            SupabaseRewardRedemptionResult result = new SupabaseRewardRedemptionResult
            {
                Ticket = await RedeemRewardAsync(rewardId, cancellationToken),
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

        public async Task AddWishlistItemAsync(
            string familyId,
            string childProfileId,
            string name,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (string.IsNullOrWhiteSpace(childProfileId))
            {
                throw new SupabaseDataException("孩子 ID 不可為空。");
            }
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new SupabaseDataException("願望名稱不可為空。");
            }

            string body = "{\"family_id\":" + SupabaseJson.Quote(familyId)
                + ",\"child_profile_id\":" + SupabaseJson.Quote(childProfileId)
                + ",\"name\":" + SupabaseJson.Quote(name.Trim()) + "}";
            await restClient.InsertAsync(
                "wishlist_items",
                body,
                cancellationToken);
        }

        public Task DeleteWishlistItemAsync(
            string wishlistId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(wishlistId))
            {
                throw new SupabaseDataException("願望 ID 不可為空。");
            }

            return restClient.DeleteAsync(
                "wishlist_items",
                new[] { new SupabaseRestFilter("id", "eq", wishlistId) },
                cancellationToken);
        }

        public async Task<SupabaseWishlistMutationResult> AddWishlistItemAndRefreshAsync(
            string familyId,
            string childProfileId,
            string name,
            CancellationToken cancellationToken)
        {
            await AddWishlistItemAsync(
                familyId,
                childProfileId,
                name,
                cancellationToken);
            return await RefreshAfterWishlistMutationAsync(cancellationToken);
        }

        public async Task<SupabaseWishlistMutationResult> DeleteWishlistItemAndRefreshAsync(
            string wishlistId,
            CancellationToken cancellationToken)
        {
            await DeleteWishlistItemAsync(wishlistId, cancellationToken);
            return await RefreshAfterWishlistMutationAsync(cancellationToken);
        }

        private async Task<SupabaseWishlistMutationResult> RefreshAfterWishlistMutationAsync(
            CancellationToken cancellationToken)
        {
            SupabaseWishlistMutationResult result =
                new SupabaseWishlistMutationResult();
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

        public async Task SubmitTaskReflectionAsync(
            string taskId,
            string reflection,
            string mood,
            int? difficulty,
            CancellationToken cancellationToken)
        {
            await SubmitTaskCompletionAsync(
                taskId,
                null,
                reflection,
                mood,
                difficulty,
                cancellationToken);
        }

        public async Task<SupabaseTaskCompletionResult> SubmitTaskCompletionAsync(
            string taskId,
            string quickReport,
            string reflection,
            string mood,
            int? difficulty,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(taskId))
            {
                throw new SupabaseDataException("任務 ID 不可為空。");
            }

            SupabaseSession session = restClient.CurrentSession;
            if (session == null || session.User == null
                || string.IsNullOrWhiteSpace(session.User.Id))
            {
                session = await restClient.EnsureSessionAsync(cancellationToken);
            }

            if (session == null || session.User == null
                || string.IsNullOrWhiteSpace(session.User.Id))
            {
                throw new SupabaseDataException("Supabase session 缺少使用者 ID。");
            }

            SupabaseTaskCompletionQueueEntry entry = new SupabaseTaskCompletionQueueEntry
            {
                ownerUserId = session.User.Id,
                taskId = taskId,
                idempotencyKey = Guid.NewGuid().ToString(),
                quickReport = quickReport,
                reflection = reflection,
                mood = mood,
                difficulty = difficulty.GetValueOrDefault(),
                hasDifficulty = difficulty.HasValue,
                queuedAt = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture),
            };

            if (!isNetworkAvailable())
            {
                completionQueue.Enqueue(entry);
                return QueuedResult(entry.idempotencyKey);
            }

            try
            {
                await SendTaskCompletionAsync(entry, cancellationToken);
                completionQueue.Remove(entry.ownerUserId, entry.idempotencyKey);
                return SentResult(entry.idempotencyKey);
            }
            catch (SupabaseDataException exception) when (IsRetryable(exception.StatusCode))
            {
                completionQueue.Enqueue(entry);
                return QueuedResult(entry.idempotencyKey);
            }
            catch (SupabaseAuthException exception) when (IsRetryable(exception.StatusCode))
            {
                completionQueue.Enqueue(entry);
                return QueuedResult(entry.idempotencyKey);
            }
        }

        public async Task<SupabaseTaskCompletionFlushResult> FlushPendingCompletionsAsync(
            CancellationToken cancellationToken)
        {
            SupabaseTaskCompletionFlushResult result =
                new SupabaseTaskCompletionFlushResult();
            if (!isNetworkAvailable())
            {
                result.RemainingCount = PendingCompletionCount;
                return result;
            }

            SupabaseSession session;
            try
            {
                session = await restClient.EnsureSessionAsync(cancellationToken);
            }
            catch (Exception exception)
            {
                result.Error = exception.Message;
                result.RemainingCount = PendingCompletionCount;
                return result;
            }

            if (session == null || session.User == null
                || string.IsNullOrWhiteSpace(session.User.Id))
            {
                result.Error = "Supabase session 缺少使用者 ID。";
                return result;
            }

            List<SupabaseTaskCompletionQueueEntry> entries =
                completionQueue.Load(session.User.Id);
            foreach (SupabaseTaskCompletionQueueEntry entry in entries)
            {
                try
                {
                    await SendTaskCompletionAsync(entry, cancellationToken);
                    completionQueue.Remove(entry.ownerUserId, entry.idempotencyKey);
                    result.SucceededCount += 1;
                }
                catch (SupabaseDataException exception)
                {
                    result.Error = exception.Message;
                    if (IsRetryable(exception.StatusCode)) break;
                    completionQueue.Remove(entry.ownerUserId, entry.idempotencyKey);
                    result.PermanentFailureCount += 1;
                }
                catch (SupabaseAuthException exception)
                {
                    result.Error = exception.Message;
                    if (IsRetryable(exception.StatusCode)) break;
                    completionQueue.Remove(entry.ownerUserId, entry.idempotencyKey);
                    result.PermanentFailureCount += 1;
                }
            }

            result.RemainingCount = completionQueue.Load(session.User.Id).Count;
            return result;
        }

        private async Task SendTaskCompletionAsync(
            SupabaseTaskCompletionQueueEntry entry,
            CancellationToken cancellationToken)
        {
            string difficultyJson = entry.hasDifficulty
                ? entry.difficulty.ToString(CultureInfo.InvariantCulture)
                : "null";
            string body = "{\"target_task_id\":" + SupabaseJson.Quote(entry.taskId)
                + ",\"idempotency_key\":" + SupabaseJson.Quote(entry.idempotencyKey)
                + ",\"quick_report\":" + SupabaseJson.NullableString(entry.quickReport)
                + ",\"reflection\":" + SupabaseJson.NullableString(entry.reflection)
                + ",\"mood\":" + SupabaseJson.NullableString(entry.mood)
                + ",\"difficulty\":" + difficultyJson + "}";
            await restClient.CallRpcAsync(
                "submit_adventure_completion",
                body,
                cancellationToken);
        }

        private async Task<SupabaseTaskTimerSessionRecord> CallTimerRpcAsync(
            string functionName,
            string taskId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(taskId))
            {
                throw new SupabaseDataException("計時任務 ID 不可為空。");
            }

            string body = "{\"target_task_id\":" + SupabaseJson.Quote(taskId) + "}";
            string response = await restClient.CallRpcAsync(
                functionName,
                body,
                cancellationToken);
            SupabaseTaskTimerSessionRecord session;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out session,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            return session;
        }

        private static SupabaseTaskCompletionResult SentResult(string idempotencyKey)
        {
            return new SupabaseTaskCompletionResult
            {
                IdempotencyKey = idempotencyKey,
                QueuedForRetry = false,
            };
        }

        private static SupabaseTaskCompletionResult QueuedResult(string idempotencyKey)
        {
            return new SupabaseTaskCompletionResult
            {
                IdempotencyKey = idempotencyKey,
                QueuedForRetry = true,
            };
        }

        private static bool IsRetryable(long statusCode)
        {
            return statusCode == 0
                || statusCode == 408
                || statusCode == 429
                || statusCode >= 500;
        }

        private static void ValidateChildGoalProposal(
            string familyId,
            string childProfileId,
            SupabaseChildGoalProposalInput input)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (string.IsNullOrWhiteSpace(childProfileId))
            {
                throw new SupabaseDataException("孩子 ID 不可為空。");
            }
            if (input == null)
            {
                throw new SupabaseDataException("一般冒險資料不可為空。");
            }

            string name = input.name == null ? string.Empty : input.name.Trim();
            if (name.Length < 1 || name.Length > 120)
            {
                throw new SupabaseDataException("冒險名稱長度必須介於 1 到 120 個字元。");
            }
            if (input.points <= 0)
            {
                throw new SupabaseDataException("冒險點數必須大於零。");
            }
            if (string.IsNullOrWhiteSpace(input.icon)
                || input.icon.Trim().Length > 32)
            {
                throw new SupabaseDataException("冒險圖示無效。");
            }
            if (!IsChildGoalCategory(input.category))
            {
                throw new SupabaseDataException("冒險分類無效。");
            }
            if (input.durationMinutes.HasValue
                && (input.durationMinutes.Value < 1
                    || input.durationMinutes.Value > 1440))
            {
                throw new SupabaseDataException("冒險時間必須介於 1 到 1440 分鐘。");
            }
            TimeSpan dueTime;
            TimeSpan endTime;
            if (!TryParseTime(input.dueTime, out dueTime)
                || !TryParseTime(input.endTime, out endTime)
                || endTime <= dueTime)
            {
                throw new SupabaseDataException("一般冒險的時間範圍無效。");
            }
            if (!string.IsNullOrWhiteSpace(input.dueOn)
                && !DateTime.TryParseExact(
                    input.dueOn.Trim(),
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out _))
            {
                throw new SupabaseDataException("冒險日期格式無效。");
            }
        }

        private static bool IsChildGoalCategory(string category)
        {
            switch (category == null ? string.Empty : category.Trim())
            {
                case "life_habit":
                case "learning":
                case "health":
                case "relationship":
                case "family_contribution":
                case "creativity":
                    return true;
                default:
                    return false;
            }
        }

        private static bool TryParseTime(string value, out TimeSpan parsed)
        {
            return TimeSpan.TryParseExact(
                value == null ? string.Empty : value.Trim(),
                new[] { "hh\\:mm", "h\\:mm" },
                CultureInfo.InvariantCulture,
                out parsed)
                && parsed >= TimeSpan.Zero
                && parsed < TimeSpan.FromDays(1);
        }

        private static bool IsNetworkAvailable()
        {
            return Application.internetReachability != NetworkReachability.NotReachable;
        }

    }
}
