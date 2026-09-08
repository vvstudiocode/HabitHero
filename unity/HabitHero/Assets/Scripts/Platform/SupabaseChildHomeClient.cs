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
        public string adventure_type;
        public string completion_report_mode;
        public string quick_report;
        public bool requires_timer;
        public string description;
        public string submitted_at;
        public string reviewed_at;
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
    }

    public sealed class SupabaseTaskCompletionDraft
    {
        public string quickReport;
        public string reflection;
        public string mood;
        public int? difficulty;
    }

    public sealed class SupabaseTaskCompletionFlushResult
    {
        public int SucceededCount { get; set; }

        public int PermanentFailureCount { get; set; }

        public int RemainingCount { get; set; }

        public string Error { get; set; }
    }

    public sealed class SupabaseChildHomeClient
    {
        private readonly SupabaseRestClient restClient;
        private readonly SupabaseTaskCompletionQueue completionQueue;
        private readonly Func<bool> isNetworkAvailable;

        public SupabaseChildHomeClient(SupabaseRestClient restClient)
            : this(
                restClient,
                new PlayerPrefsSupabaseTaskCompletionQueueStore(),
                IsNetworkAvailable)
        {
        }

        public SupabaseChildHomeClient(
            SupabaseRestClient restClient,
            ISupabaseTaskCompletionQueueStore completionQueueStore,
            Func<bool> isNetworkAvailable)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            if (completionQueueStore == null)
            {
                throw new ArgumentNullException("completionQueueStore");
            }
            if (isNetworkAvailable == null)
            {
                throw new ArgumentNullException("isNetworkAvailable");
            }

            this.restClient = restClient;
            completionQueue = new SupabaseTaskCompletionQueue(completionQueueStore);
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
            await FlushPendingCompletionsAsync(cancellationToken);
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
                completionQueue.Load(userId);
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
            return new SupabaseChildHomeSnapshot
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

        private static bool IsNetworkAvailable()
        {
            return Application.internetReachability != NetworkReachability.NotReachable;
        }

    }
}
