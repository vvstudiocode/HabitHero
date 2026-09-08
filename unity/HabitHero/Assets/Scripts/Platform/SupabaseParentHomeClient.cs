using System;
using System.Collections.Generic;
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
        public SupabaseParentConsentRecord parentConsent;
        public SupabaseChildProfileRecord[] children;
        public SupabaseParentAdventureGroupRecord[] adventureGroups;
        public SupabaseParentTaskTemplateRecord[] taskTemplates;
        public SupabaseChildTaskRecord[] tasks;
        public SupabaseChildRewardRecord[] rewards;
        public SupabaseChildWishlistRecord[] wishlist;
        public SupabaseChildTicketRecord[] tickets;
        public SupabaseChildLedgerRecord[] ledger;
    }

    [Serializable]
    public sealed class SupabaseParentConsentRecord
    {
        public string id;
        public string family_id;
        public string parent_profile_id;
        public string consent_type;
        public string consent_version;
        public string consented_at;
    }

    [Serializable]
    public sealed class SupabaseParentAdventureGroupRecord
    {
        public string id;
        public string family_id;
        public string child_profile_id;
        public string title;
        public string status;
        public string created_at;
        public string updated_at;
    }

    [Serializable]
    public sealed class SupabaseParentTaskTemplateRecord
    {
        public string id;
        public string family_id;
        public string name;
        public int points;
        public int duration_minutes;
        public string icon;
        public int sort_order;
        public string category;
        public string suggested_evidence;
        public string due_time;
        public string end_time;
        public bool requires_review_before_next_task;
        public string created_at;
        public string updated_at;
    }

    public sealed class SupabaseParentTaskReviewResult
    {
        public SupabaseChildTaskRecord Task { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    [Serializable]
    public sealed class SupabaseTaskApprovalReversalRecord
    {
        public string task_id;
        public int points_reversed;
        public long scroll_reversed;
        public string message;
    }

    public sealed class SupabaseParentTaskApprovalReversalResult
    {
        public SupabaseTaskApprovalReversalRecord Reversal { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    [Serializable]
    public sealed class SupabaseParentBatchReviewEntry
    {
        public string task_id;
        public bool success;
        public string status;
        public string error;
    }

    [Serializable]
    public sealed class SupabaseParentBatchReviewRpcResult
    {
        public SupabaseParentBatchReviewEntry[] results;
        public string[] failed_task_ids;
    }

    public sealed class SupabaseParentBatchReviewResult
    {
        public string[] FailedTaskIds { get; set; }

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
        public string origin;
        public bool requiresReviewBeforeNextTask;
    }

    public sealed class SupabaseParentTaskUpdateInput
    {
        public string name;
        public int points;
        public string icon;
        public int? durationMinutes;
        public bool isDaily;
        public string dueOn;
        public string dueTime;
        public string endTime;
        public string category;
    }

    public sealed class SupabaseParentTaskTemplateCreateInput
    {
        public string name;
        public int points;
        public string icon;
        public int? durationMinutes;
        public string category;
        public string suggestedEvidence;
        public string dueTime;
        public string endTime;
        public bool requiresReviewBeforeNextTask;
    }

    public sealed class SupabaseParentTaskTemplateUpdateInput
    {
        public string name;
        public int points;
        public string icon;
        public int? durationMinutes;
        public string category;
        public string suggestedEvidence;
        public string dueTime;
        public string endTime;
        public bool requiresReviewBeforeNextTask;
    }

    public sealed class SupabaseParentGeneralAdventureCreateInput
    {
        public string[] childProfileIds;
        public string name;
        public string description;
        public int points;
        public string icon;
        public string category;
        public int? durationMinutes;
        public string dueOn;
        public string startTime;
        public string endTime;
        public string reportMode;
        public bool requiresTimer;
        public bool requiresReviewBeforeNextTask;
    }

    [Serializable]
    public sealed class SupabaseParentAdventureScheduleRecord
    {
        public string id;
        public string family_id;
        public string child_profile_id;
        public string name;
        public string description;
        public int points;
        public string icon;
        public string category;
        public int duration_minutes;
        public string start_time;
        public string end_time;
        public int[] weekdays;
        public string timezone;
        public bool requires_timer;
        public bool requires_review_before_next_task;
        public string active_from;
        public string active_until;
        public bool is_active;
        public string created_at;
        public string updated_at;
    }

    public sealed class SupabaseParentAdventureScheduleCreateInput
    {
        public string[] childProfileIds;
        public string name;
        public string description;
        public int points;
        public string icon;
        public string category;
        public int durationMinutes;
        public string startTime;
        public string endTime;
        public int[] weekdays;
        public string timezone;
        public bool requiresTimer;
        public bool requiresReviewBeforeNextTask;
        public string activeFrom;
        public string activeUntil;
    }

    public sealed class SupabaseParentAdventureScheduleUpdateInput
    {
        public string name;
        public string description;
        public int points;
        public string icon;
        public string category;
        public int durationMinutes;
        public string startTime;
        public string endTime;
        public int[] weekdays;
        public string timezone;
        public bool requiresTimer;
        public bool requiresReviewBeforeNextTask;
        public string activeFrom;
        public string activeUntil;
        public string applyMode;
    }

    public sealed class SupabaseParentTaskMutationResult
    {
        public bool Created { get; set; }

        public bool Updated { get; set; }

        public bool Deleted { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseParentTaskTemplateMutationResult
    {
        public bool Created { get; set; }

        public bool Updated { get; set; }

        public bool Deleted { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseParentAdventureMutationResult
    {
        public string[] TaskIds { get; set; }

        public SupabaseParentHomeSnapshot RefreshedSnapshot { get; set; }

        public string RefreshError { get; set; }
    }

    public sealed class SupabaseParentAdventureTitleMutationResult
    {
        public SupabaseParentAdventureGroupRecord Group { get; set; }

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
                string ensuredFamilyResponse = await restClient.CallRpcAsync(
                    "ensure_parent_family",
                    "{}",
                    cancellationToken);
                string ensuredFamilyId = ParseRpcString(ensuredFamilyResponse);
                if (string.IsNullOrWhiteSpace(ensuredFamilyId))
                {
                    throw new SupabaseDataException("此家長帳號尚未加入家庭。");
                }

                members = new[]
                {
                    new SupabaseFamilyMemberRecord
                    {
                        id = ensuredFamilyId + ":parent",
                        family_id = ensuredFamilyId,
                        profile_id = session.User.Id,
                        role = "parent",
                    },
                };
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
            Task<SupabaseParentAdventureGroupRecord[]> adventureGroups =
                restClient.SelectManyAsync<SupabaseParentAdventureGroupRecord>(
                    "adventure_groups",
                    new[] { familyFilter },
                    "*",
                    "updated_at.desc",
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

            await Task.WhenAll(
                family,
                children,
                adventureGroups,
                tasks,
                rewards,
                wishlist,
                tickets,
                ledger);
            return new SupabaseParentHomeSnapshot
            {
                familyId = familyId,
                family = family.Result ?? new SupabaseFamilyRecord
                {
                    id = familyId,
                    name = "我的家庭",
                },
                children = children.Result,
                adventureGroups = adventureGroups.Result,
                tasks = tasks.Result,
                rewards = rewards.Result,
                wishlist = wishlist.Result,
                tickets = tickets.Result,
                ledger = ledger.Result,
            };
        }

        public async Task<SupabaseParentTaskTemplateRecord[]> LoadTaskTemplatesAsync(
            string familyId,
            CancellationToken cancellationToken)
        {
            ValidateFamilyId(familyId);
            return await restClient.SelectManyAsync<SupabaseParentTaskTemplateRecord>(
                "task_templates",
                new[] { new SupabaseRestFilter("family_id", "eq", familyId) },
                "*",
                "sort_order.asc",
                0,
                cancellationToken);
        }

        public async Task<SupabaseParentConsentRecord> LoadParentConsentAsync(
            string familyId,
            string parentProfileId,
            CancellationToken cancellationToken)
        {
            ValidateFamilyId(familyId);
            if (string.IsNullOrWhiteSpace(parentProfileId))
            {
                throw new SupabaseDataException("家長帳號 ID 不可為空。");
            }

            return await restClient.SelectSingleAsync<SupabaseParentConsentRecord>(
                "parent_consents",
                new[]
                {
                    new SupabaseRestFilter("family_id", "eq", familyId),
                    new SupabaseRestFilter("parent_profile_id", "eq", parentProfileId),
                    new SupabaseRestFilter("consent_type", "eq", "parental"),
                },
                "*",
                cancellationToken);
        }

        public async Task<SupabaseParentConsentRecord> RecordParentConsentAsync(
            string familyId,
            string consentVersion,
            CancellationToken cancellationToken)
        {
            ValidateFamilyId(familyId);
            if (string.IsNullOrWhiteSpace(consentVersion)
                || consentVersion.Trim().Length > 40)
            {
                throw new SupabaseDataException("家長同意版本不可為空或超過 40 個字元。");
            }

            string response = await restClient.CallRpcAsync(
                "record_parent_consent",
                "{\"target_family_id\":"
                    + SupabaseJson.Quote(familyId.Trim())
                    + ",\"consent_version\":"
                    + SupabaseJson.Quote(consentVersion.Trim())
                    + "}",
                cancellationToken);
            SupabaseParentConsentRecord consent;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out consent,
                    out error)
                || consent == null
                || string.IsNullOrWhiteSpace(consent.consent_version))
            {
                throw new SupabaseDataException(
                    string.IsNullOrWhiteSpace(error)
                        ? "Supabase 沒有回傳家長同意紀錄。"
                        : error);
            }

            return consent;
        }

        public async Task DeleteParentAccountAsync(
            CancellationToken cancellationToken)
        {
            string response = await restClient.InvokeFunctionAsync(
                "manage-account",
                "{\"action\":\"delete\"}",
                cancellationToken);
            EnsureSuccessfulAccountMutation(response);
        }

        public async Task<SupabaseChildProfileRecord> UpdateChildDisplayNameAsync(
            string familyId,
            string childProfileId,
            string displayName,
            CancellationToken cancellationToken)
        {
            ValidateChildAccountTarget(familyId, childProfileId);
            string normalizedName = displayName == null ? string.Empty : displayName.Trim();
            if (normalizedName.Length < 1 || normalizedName.Length > 80)
            {
                throw new SupabaseDataException("孩子名稱長度必須介於 1 到 80 個字元。");
            }

            SupabaseChildProfileRecord child =
                await restClient.SelectSingleAsync<SupabaseChildProfileRecord>(
                    "child_profiles",
                    new[]
                    {
                        new SupabaseRestFilter("family_id", "eq", familyId),
                        new SupabaseRestFilter("id", "eq", childProfileId),
                    },
                    "*",
                    cancellationToken);
            if (child == null || string.IsNullOrWhiteSpace(child.id))
            {
                throw new SupabaseDataException("找不到要更新的孩子資料。");
            }

            string body = "{\"display_name\":"
                + SupabaseJson.Quote(normalizedName) + "}";
            await restClient.UpdateAsync(
                "child_profiles",
                new[]
                {
                    new SupabaseRestFilter("family_id", "eq", familyId),
                    new SupabaseRestFilter("id", "eq", childProfileId),
                },
                body,
                cancellationToken);
            if (!string.IsNullOrWhiteSpace(child.profile_id))
            {
                await restClient.UpdateAsync(
                    "profiles",
                    new[]
                    {
                        new SupabaseRestFilter("id", "eq", child.profile_id),
                    },
                    body,
                    cancellationToken);
            }

            child.display_name = normalizedName;
            return child;
        }

        public async Task<SupabaseParentChildAccountMutationResult>
            UpdateChildDisplayNameAndRefreshAsync(
                string familyId,
                string childProfileId,
                string displayName,
                CancellationToken cancellationToken)
        {
            SupabaseParentChildAccountMutationResult result =
                new SupabaseParentChildAccountMutationResult
                {
                    Child = await UpdateChildDisplayNameAsync(
                        familyId,
                        childProfileId,
                        displayName,
                        cancellationToken),
                    Succeeded = true,
                };
            await RefreshChildAccountMutationAsync(result, cancellationToken);
            return result;
        }

        public async Task CreateTaskTemplateAsync(
            string familyId,
            SupabaseParentTaskTemplateCreateInput input,
            CancellationToken cancellationToken)
        {
            ValidateTaskTemplateCreate(familyId, input);
            await restClient.InsertAsync(
                "task_templates",
                BuildTaskTemplateCreateBody(familyId, input),
                cancellationToken);
        }

        public async Task UpdateTaskTemplateAsync(
            string familyId,
            string templateId,
            SupabaseParentTaskTemplateUpdateInput input,
            CancellationToken cancellationToken)
        {
            ValidateTaskTemplateUpdate(familyId, templateId, input);
            await restClient.UpdateAsync(
                "task_templates",
                new[]
                {
                    new SupabaseRestFilter("family_id", "eq", familyId),
                    new SupabaseRestFilter("id", "eq", templateId),
                },
                BuildTaskTemplateUpdateBody(input),
                cancellationToken);
        }

        public async Task DeleteTaskTemplateAsync(
            string familyId,
            string templateId,
            CancellationToken cancellationToken)
        {
            ValidateFamilyId(familyId);
            if (string.IsNullOrWhiteSpace(templateId))
            {
                throw new SupabaseDataException("任務模板 ID 不可為空。");
            }

            await restClient.DeleteAsync(
                "task_templates",
                new[]
                {
                    new SupabaseRestFilter("family_id", "eq", familyId),
                    new SupabaseRestFilter("id", "eq", templateId),
                },
                cancellationToken);
        }

        public async Task<SupabaseParentTaskTemplateMutationResult>
            CreateTaskTemplateAndRefreshAsync(
                string familyId,
                SupabaseParentTaskTemplateCreateInput input,
                CancellationToken cancellationToken)
        {
            await CreateTaskTemplateAsync(familyId, input, cancellationToken);
            return await RefreshTaskTemplateMutationAsync(
                new SupabaseParentTaskTemplateMutationResult { Created = true },
                cancellationToken);
        }

        public async Task<SupabaseParentTaskTemplateMutationResult>
            UpdateTaskTemplateAndRefreshAsync(
                string familyId,
                string templateId,
                SupabaseParentTaskTemplateUpdateInput input,
                CancellationToken cancellationToken)
        {
            await UpdateTaskTemplateAsync(
                familyId,
                templateId,
                input,
                cancellationToken);
            return await RefreshTaskTemplateMutationAsync(
                new SupabaseParentTaskTemplateMutationResult { Updated = true },
                cancellationToken);
        }

        public async Task<SupabaseParentTaskTemplateMutationResult>
            DeleteTaskTemplateAndRefreshAsync(
                string familyId,
                string templateId,
                CancellationToken cancellationToken)
        {
            await DeleteTaskTemplateAsync(familyId, templateId, cancellationToken);
            return await RefreshTaskTemplateMutationAsync(
                new SupabaseParentTaskTemplateMutationResult { Deleted = true },
                cancellationToken);
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

        public async Task<SupabaseParentBatchReviewRpcResult>
            BatchReviewDailyAdventuresAsync(
                string[] taskIds,
                CancellationToken cancellationToken)
        {
            if (taskIds == null || taskIds.Length == 0)
            {
                throw new SupabaseDataException("至少要選擇一個每日冒險。");
            }

            List<string> normalizedTaskIds = new List<string>();
            HashSet<string> normalizedIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (string taskId in taskIds)
            {
                string normalizedTaskId = taskId == null ? string.Empty : taskId.Trim();
                if (normalizedTaskId.Length == 0 || !normalizedIds.Add(normalizedTaskId))
                {
                    throw new SupabaseDataException("每日冒險 ID 不可為空或重複。");
                }

                normalizedTaskIds.Add(normalizedTaskId);
            }

            string response = await restClient.CallRpcAsync(
                "batch_review_daily_adventures",
                "{\"target_task_ids\":"
                    + BuildStringArrayJson(normalizedTaskIds.ToArray())
                    + "}",
                cancellationToken);
            SupabaseParentBatchReviewRpcResult rpcResult;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out rpcResult,
                    out error)
                || rpcResult == null)
            {
                throw new SupabaseDataException(
                    string.IsNullOrWhiteSpace(error)
                        ? "Supabase 沒有回傳每日冒險批次審核結果。"
                        : error);
            }

            return rpcResult;
        }

        public async Task<SupabaseParentBatchReviewResult>
            BatchReviewDailyAdventuresAndRefreshAsync(
                string[] taskIds,
                CancellationToken cancellationToken)
        {
            SupabaseParentBatchReviewRpcResult rpcResult =
                await BatchReviewDailyAdventuresAsync(taskIds, cancellationToken);
            SupabaseParentBatchReviewResult result =
                new SupabaseParentBatchReviewResult
                {
                    FailedTaskIds = rpcResult.failed_task_ids
                        ?? new string[0],
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

        public async Task<SupabaseTaskApprovalReversalRecord> RevokeTaskApprovalAsync(
            string taskId,
            CancellationToken cancellationToken)
        {
            string normalizedTaskId = taskId == null ? string.Empty : taskId.Trim();
            if (normalizedTaskId.Length == 0)
            {
                throw new SupabaseDataException("任務 ID 不可為空。");
            }

            string response = await restClient.CallRpcAsync(
                "revoke_task_approval",
                "{\"target_task_id\":"
                    + SupabaseJson.Quote(normalizedTaskId)
                    + "}",
                cancellationToken);
            SupabaseTaskApprovalReversalRecord reversal;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out reversal,
                    out error)
                || reversal == null
                || string.IsNullOrWhiteSpace(reversal.task_id))
            {
                throw new SupabaseDataException(
                    string.IsNullOrWhiteSpace(error)
                        ? "Supabase 沒有回傳撤銷核准結果。"
                        : error);
            }

            return reversal;
        }

        public async Task<SupabaseChildTaskRecord> ConfirmChildGoalAsync(
            string taskId,
            string confirmedName,
            int confirmedPoints,
            string confirmedCategory,
            CancellationToken cancellationToken)
        {
            string normalizedTaskId = taskId == null ? string.Empty : taskId.Trim();
            string normalizedName = confirmedName == null
                ? string.Empty
                : confirmedName.Trim();
            string normalizedCategory = confirmedCategory == null
                ? string.Empty
                : confirmedCategory.Trim();
            if (normalizedTaskId.Length == 0)
            {
                throw new SupabaseDataException("目標 ID 不可為空。");
            }
            if (normalizedName.Length < 1 || normalizedName.Length > 120)
            {
                throw new SupabaseDataException("目標名稱長度必須介於 1 到 120 個字元。");
            }
            if (confirmedPoints < 0)
            {
                throw new SupabaseDataException("目標點數不可為負數。");
            }
            if (!IsAdventureCategory(normalizedCategory))
            {
                throw new SupabaseDataException("目標分類無效。");
            }

            string body = "{\"target_task_id\":" + SupabaseJson.Quote(normalizedTaskId)
                + ",\"confirmed_name\":" + SupabaseJson.Quote(normalizedName)
                + ",\"confirmed_points\":" + confirmedPoints.ToString(
                    System.Globalization.CultureInfo.InvariantCulture)
                + ",\"confirmed_category\":" + SupabaseJson.Quote(normalizedCategory)
                + "}";
            string response = await restClient.CallRpcAsync(
                "confirm_child_goal",
                body,
                cancellationToken);
            SupabaseChildTaskRecord confirmedTask;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out confirmedTask,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            return confirmedTask;
        }

        public async Task<SupabaseChildTaskRecord> ReturnChildGoalAsync(
            string taskId,
            string revisionNote,
            CancellationToken cancellationToken)
        {
            string normalizedTaskId = taskId == null ? string.Empty : taskId.Trim();
            string normalizedNote = revisionNote == null ? string.Empty : revisionNote.Trim();
            if (normalizedTaskId.Length == 0)
            {
                throw new SupabaseDataException("目標 ID 不可為空。");
            }
            if (normalizedNote.Length < 1 || normalizedNote.Length > 1000)
            {
                throw new SupabaseDataException("修改說明長度必須介於 1 到 1000 個字元。");
            }

            string body = "{\"target_task_id\":" + SupabaseJson.Quote(normalizedTaskId)
                + ",\"target_revision_note\":" + SupabaseJson.Quote(normalizedNote)
                + "}";
            string response = await restClient.CallRpcAsync(
                "return_child_goal",
                body,
                cancellationToken);
            SupabaseChildTaskRecord returnedTask;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out returnedTask,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            return returnedTask;
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
                + ",\"origin\":" + SupabaseJson.Quote(
                    string.IsNullOrWhiteSpace(input.origin)
                        ? "parent_assigned"
                        : input.origin.Trim())
                + "}";
            await restClient.InsertAsync("tasks", body, cancellationToken);
        }

        public async Task UpdateTaskAsync(
            string familyId,
            string taskId,
            SupabaseParentTaskUpdateInput input,
            CancellationToken cancellationToken)
        {
            ValidateTaskUpdate(familyId, taskId, input);
            await restClient.UpdateAsync(
                "tasks",
                new[]
                {
                    new SupabaseRestFilter("family_id", "eq", familyId),
                    new SupabaseRestFilter("id", "eq", taskId),
                },
                BuildTaskUpdateBody(input),
                cancellationToken);
        }

        public async Task DeleteTaskAsync(
            string familyId,
            string taskId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (string.IsNullOrWhiteSpace(taskId))
            {
                throw new SupabaseDataException("任務 ID 不可為空。");
            }

            await restClient.DeleteAsync(
                "tasks",
                new[]
                {
                    new SupabaseRestFilter("family_id", "eq", familyId),
                    new SupabaseRestFilter("id", "eq", taskId),
                },
                cancellationToken);
        }

        public async Task<SupabaseParentTaskMutationResult> UpdateTaskAndRefreshAsync(
            string familyId,
            string taskId,
            SupabaseParentTaskUpdateInput input,
            CancellationToken cancellationToken)
        {
            await UpdateTaskAsync(familyId, taskId, input, cancellationToken);
            return await RefreshTaskMutationAsync(
                new SupabaseParentTaskMutationResult { Updated = true },
                cancellationToken);
        }

        public async Task<SupabaseParentTaskMutationResult> DeleteTaskAndRefreshAsync(
            string familyId,
            string taskId,
            CancellationToken cancellationToken)
        {
            await DeleteTaskAsync(familyId, taskId, cancellationToken);
            return await RefreshTaskMutationAsync(
                new SupabaseParentTaskMutationResult { Deleted = true },
                cancellationToken);
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

        public async Task<string[]> CreateGeneralAdventureAsync(
            string familyId,
            SupabaseParentGeneralAdventureCreateInput input,
            CancellationToken cancellationToken)
        {
            ValidateGeneralAdventureCreate(familyId, input);
            List<string> taskIds = new List<string>();
            foreach (string childProfileId in input.childProfileIds)
            {
                string body = BuildGeneralAdventureBody(
                    familyId,
                    childProfileId,
                    input);
                string response = await restClient.CallRpcAsync(
                    "create_general_adventure",
                    body,
                    cancellationToken);
                SupabaseChildTaskRecord task;
                string error;
                if (!SupabaseJsonObjectParser.TryParseObject(
                        response,
                        out task,
                        out error)
                    || task == null
                    || string.IsNullOrWhiteSpace(task.id))
                {
                    throw new SupabaseDataException(
                        string.IsNullOrWhiteSpace(error)
                            ? "Supabase 沒有回傳一般冒險資料。"
                            : error);
                }

                taskIds.Add(task.id);
            }

            return taskIds.ToArray();
        }

        public async Task<SupabaseParentAdventureGroupRecord>
            UpdateGeneralAdventureTitleAsync(
                string childProfileId,
                string title,
                CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(childProfileId))
            {
                throw new SupabaseDataException("孩子 ID 不可為空。");
            }
            string normalizedTitle = title == null ? string.Empty : title.Trim();
            if (normalizedTitle.Length < 1 || normalizedTitle.Length > 120)
            {
                throw new SupabaseDataException("冒險標題長度必須介於 1 到 120 個字元。");
            }

            string response = await restClient.CallRpcAsync(
                "update_general_adventure_title",
                "{\"target_child_profile_id\":"
                    + SupabaseJson.Quote(childProfileId.Trim())
                    + ",\"new_title\":"
                    + SupabaseJson.Quote(normalizedTitle)
                    + "}",
                cancellationToken);
            SupabaseParentAdventureGroupRecord group;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out group,
                    out error)
                || group == null
                || string.IsNullOrWhiteSpace(group.id))
            {
                throw new SupabaseDataException(
                    string.IsNullOrWhiteSpace(error)
                        ? "Supabase 沒有回傳一般冒險群組資料。"
                        : error);
            }

            return group;
        }

        public async Task<SupabaseParentAdventureMutationResult>
            CreateGeneralAdventureAndRefreshAsync(
                string familyId,
                SupabaseParentGeneralAdventureCreateInput input,
                CancellationToken cancellationToken)
        {
            SupabaseParentAdventureMutationResult result =
                new SupabaseParentAdventureMutationResult
                {
                    TaskIds = await CreateGeneralAdventureAsync(
                        familyId,
                        input,
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

        public async Task<SupabaseParentAdventureTitleMutationResult>
            UpdateGeneralAdventureTitleAndRefreshAsync(
                string familyId,
                string childProfileId,
                string title,
                CancellationToken cancellationToken)
        {
            ValidateFamilyId(familyId);
            SupabaseParentAdventureTitleMutationResult result =
                new SupabaseParentAdventureTitleMutationResult
                {
                    Group = await UpdateGeneralAdventureTitleAsync(
                        childProfileId,
                        title,
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

        public async Task<SupabaseParentAdventureScheduleRecord[]>
            LoadAdventureSchedulesAsync(
                string familyId,
                CancellationToken cancellationToken)
        {
            ValidateFamilyId(familyId);
            return await restClient.SelectManyAsync<SupabaseParentAdventureScheduleRecord>(
                "task_schedules",
                new[] { new SupabaseRestFilter("family_id", "eq", familyId) },
                "*",
                "active_from.desc",
                0,
                cancellationToken);
        }

        public async Task<string[]> CreateAdventureScheduleAsync(
            string familyId,
            SupabaseParentAdventureScheduleCreateInput input,
            CancellationToken cancellationToken)
        {
            ValidateAdventureScheduleCreate(familyId, input);
            List<string> scheduleIds = new List<string>();
            foreach (string childProfileId in input.childProfileIds)
            {
                string response = await restClient.CallRpcAsync(
                    "create_adventure_schedule",
                    BuildCreateAdventureScheduleBody(
                        familyId,
                        childProfileId,
                        input),
                    cancellationToken);
                SupabaseParentAdventureScheduleRecord schedule =
                    ParseAdventureSchedule(response);
                if (string.IsNullOrWhiteSpace(schedule.id))
                {
                    throw new SupabaseDataException(
                        "Supabase 沒有回傳每日冒險排程 ID。");
                }

                scheduleIds.Add(schedule.id);
                await restClient.CallRpcAsync(
                    "ensure_daily_adventure_occurrences",
                    "{\"target_child_profile_id\":"
                        + SupabaseJson.Quote(childProfileId) + "}",
                    cancellationToken);
            }

            return scheduleIds.ToArray();
        }

        public async Task<SupabaseParentAdventureScheduleRecord>
            UpdateAdventureScheduleAsync(
                string scheduleId,
                SupabaseParentAdventureScheduleUpdateInput input,
                CancellationToken cancellationToken)
        {
            ValidateAdventureScheduleUpdate(scheduleId, input);
            string response = await restClient.CallRpcAsync(
                "update_adventure_schedule",
                BuildUpdateAdventureScheduleBody(scheduleId, input),
                cancellationToken);
            return ParseAdventureSchedule(response);
        }

        public async Task<SupabaseParentAdventureScheduleRecord>
            DisableAdventureScheduleAsync(
                string scheduleId,
                CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(scheduleId))
            {
                throw new SupabaseDataException("每日冒險排程 ID 不可為空。");
            }

            string response = await restClient.CallRpcAsync(
                "disable_adventure_schedule",
                "{\"target_schedule_id\":"
                    + SupabaseJson.Quote(scheduleId.Trim()) + "}",
                cancellationToken);
            return ParseAdventureSchedule(response);
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

        private static void ValidateFamilyId(string familyId)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
        }

        private static void ValidateAdventureScheduleCreate(
            string familyId,
            SupabaseParentAdventureScheduleCreateInput input)
        {
            ValidateFamilyId(familyId);
            if (input == null || input.childProfileIds == null
                || input.childProfileIds.Length == 0)
            {
                throw new SupabaseDataException("至少要指定一位孩子建立每日冒險排程。");
            }

            HashSet<string> childIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (string childProfileId in input.childProfileIds)
            {
                if (string.IsNullOrWhiteSpace(childProfileId)
                    || !childIds.Add(childProfileId))
                {
                    throw new SupabaseDataException("指定的孩子資料不可重複或為空。");
                }
            }

            ValidateAdventureScheduleFields(
                input.name,
                input.description,
                input.points,
                input.icon,
                input.category,
                input.durationMinutes,
                input.startTime,
                input.endTime,
                input.weekdays,
                input.timezone,
                input.requiresTimer,
                input.activeFrom,
                input.activeUntil);
        }

        private static void ValidateAdventureScheduleUpdate(
            string scheduleId,
            SupabaseParentAdventureScheduleUpdateInput input)
        {
            if (string.IsNullOrWhiteSpace(scheduleId))
            {
                throw new SupabaseDataException("每日冒險排程 ID 不可為空。");
            }
            if (input == null)
            {
                throw new SupabaseDataException("每日冒險排程更新資料不可為空。");
            }

            string applyMode = string.IsNullOrWhiteSpace(input.applyMode)
                ? "from_tomorrow"
                : input.applyMode.Trim();
            if (applyMode != "today_unfinished"
                && applyMode != "from_tomorrow"
                && applyMode != "today_and_future")
            {
                throw new SupabaseDataException("每日冒險排程更新範圍無效。");
            }

            ValidateAdventureScheduleFields(
                input.name,
                input.description,
                input.points,
                input.icon,
                input.category,
                input.durationMinutes,
                input.startTime,
                input.endTime,
                input.weekdays,
                input.timezone,
                input.requiresTimer,
                input.activeFrom,
                input.activeUntil);
        }

        private static void ValidateAdventureScheduleFields(
            string name,
            string description,
            int points,
            string icon,
            string category,
            int durationMinutes,
            string startTime,
            string endTime,
            int[] weekdays,
            string timezone,
            bool requiresTimer,
            string activeFrom,
            string activeUntil)
        {
            string normalizedName = name == null ? string.Empty : name.Trim();
            if (normalizedName.Length < 1 || normalizedName.Length > 120)
            {
                throw new SupabaseDataException(
                    "每日冒險排程名稱長度必須介於 1 到 120 個字元。");
            }

            string normalizedDescription = string.IsNullOrWhiteSpace(description)
                ? string.Empty
                : description.Trim();
            if (normalizedDescription.Length > 2000)
            {
                throw new SupabaseDataException("每日冒險排程說明不可超過 2000 個字元。");
            }

            if (points < 0)
            {
                throw new SupabaseDataException("每日冒險排程點數不可為負數。");
            }

            string normalizedIcon = string.IsNullOrWhiteSpace(icon)
                ? "Target"
                : icon.Trim();
            if (normalizedIcon.Length < 1 || normalizedIcon.Length > 32)
            {
                throw new SupabaseDataException("每日冒險排程圖示設定無效。");
            }
            if (!IsAdventureCategory(category))
            {
                throw new SupabaseDataException("每日冒險排程分類設定無效。");
            }
            if (durationMinutes < 0 || durationMinutes > 1440)
            {
                throw new SupabaseDataException("每日冒險排程時間必須介於 1 到 1440 分鐘，或留空。");
            }
            if (requiresTimer && durationMinutes == 0)
            {
                throw new SupabaseDataException("需要計時的每日冒險排程必須設定時間。");
            }

            ValidateOptionalTime(startTime);
            ValidateOptionalTime(endTime);
            if (!string.IsNullOrWhiteSpace(startTime)
                && !string.IsNullOrWhiteSpace(endTime))
            {
                TimeSpan start;
                TimeSpan end;
                bool validStart = TimeSpan.TryParse(
                    startTime.Trim(),
                    System.Globalization.CultureInfo.InvariantCulture,
                    out start);
                bool validEnd = TimeSpan.TryParse(
                    endTime.Trim(),
                    System.Globalization.CultureInfo.InvariantCulture,
                    out end);
                if (validStart && validEnd && end <= start)
                {
                    throw new SupabaseDataException("每日冒險排程執行時段無效。");
                }
            }

            if (weekdays == null || weekdays.Length < 1 || weekdays.Length > 7)
            {
                throw new SupabaseDataException("每日冒險排程至少要選擇一天。");
            }
            HashSet<int> weekdaySet = new HashSet<int>();
            foreach (int weekday in weekdays)
            {
                if (weekday < 1 || weekday > 7 || !weekdaySet.Add(weekday))
                {
                    throw new SupabaseDataException("每日冒險排程星期設定無效。");
                }
            }

            string normalizedTimezone = NormalizeTimezone(timezone);
            if (normalizedTimezone != "Asia/Taipei")
            {
                throw new SupabaseDataException("目前只支援 Asia/Taipei 時區。");
            }

            DateTime activeFromDate = ParseScheduleDate(activeFrom, "開始日期");
            if (!string.IsNullOrWhiteSpace(activeUntil))
            {
                DateTime activeUntilDate = ParseScheduleDate(activeUntil, "結束日期");
                if (activeUntilDate < activeFromDate)
                {
                    throw new SupabaseDataException("每日冒險排程結束日期不可早於開始日期。");
                }
            }
        }

        private static void ValidateOptionalTime(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            TimeSpan parsed;
            if (!TimeSpan.TryParse(
                    value.Trim(),
                    System.Globalization.CultureInfo.InvariantCulture,
                    out parsed)
                || parsed < TimeSpan.Zero
                || parsed >= TimeSpan.FromDays(1))
            {
                throw new SupabaseDataException("每日冒險排程時間格式無效。");
            }
        }

        private static DateTime ParseScheduleDate(string value, string label)
        {
            DateTime parsed;
            if (!DateTime.TryParseExact(
                    value == null ? string.Empty : value.Trim(),
                    "yyyy-MM-dd",
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None,
                    out parsed))
            {
                throw new SupabaseDataException("每日冒險排程" + label + "格式無效。");
            }

            return parsed.Date;
        }

        private static string NormalizeTimezone(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "Asia/Taipei" : value.Trim();
        }

        private static string BuildCreateAdventureScheduleBody(
            string familyId,
            string childProfileId,
            SupabaseParentAdventureScheduleCreateInput input)
        {
            return "{\"target_family_id\":" + SupabaseJson.Quote(familyId.Trim())
                + ",\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId.Trim())
                + BuildAdventureScheduleFields(
                    input.name,
                    input.description,
                    input.points,
                    input.icon,
                    input.category,
                    input.durationMinutes,
                    input.startTime,
                    input.endTime,
                    input.weekdays,
                    input.timezone,
                    input.requiresTimer,
                    input.requiresReviewBeforeNextTask,
                    input.activeFrom,
                    input.activeUntil)
                + "}";
        }

        private static string BuildUpdateAdventureScheduleBody(
            string scheduleId,
            SupabaseParentAdventureScheduleUpdateInput input)
        {
            string applyMode = string.IsNullOrWhiteSpace(input.applyMode)
                ? "from_tomorrow"
                : input.applyMode.Trim();
            return "{\"target_schedule_id\":"
                + SupabaseJson.Quote(scheduleId.Trim())
                + BuildAdventureScheduleFields(
                    input.name,
                    input.description,
                    input.points,
                    input.icon,
                    input.category,
                    input.durationMinutes,
                    input.startTime,
                    input.endTime,
                    input.weekdays,
                    input.timezone,
                    input.requiresTimer,
                    input.requiresReviewBeforeNextTask,
                    input.activeFrom,
                    input.activeUntil)
                + ",\"update_scope\":" + SupabaseJson.Quote(applyMode)
                + "}";
        }

        private static string BuildAdventureScheduleFields(
            string name,
            string description,
            int points,
            string icon,
            string category,
            int durationMinutes,
            string startTime,
            string endTime,
            int[] weekdays,
            string timezone,
            bool requiresTimer,
            bool requiresReviewBeforeNextTask,
            string activeFrom,
            string activeUntil)
        {
            string normalizedDescription = NormalizeOptional(description);
            string normalizedIcon = string.IsNullOrWhiteSpace(icon)
                ? "Target"
                : icon.Trim();
            string normalizedCategory = category == null ? string.Empty : category.Trim();
            string normalizedTimezone = NormalizeTimezone(timezone);
            string durationJson = durationMinutes == 0
                ? "null"
                : durationMinutes.ToString(System.Globalization.CultureInfo.InvariantCulture);
            return ",\"schedule_name\":" + SupabaseJson.Quote(name.Trim())
                + ",\"schedule_description\":"
                + SupabaseJson.NullableString(normalizedDescription)
                + ",\"schedule_points\":"
                + points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ",\"schedule_icon\":" + SupabaseJson.Quote(normalizedIcon)
                + ",\"schedule_category\":"
                + SupabaseJson.Quote(normalizedCategory)
                + ",\"schedule_duration_minutes\":" + durationJson
                + ",\"schedule_start_time\":"
                + SupabaseJson.NullableString(NormalizeOptional(startTime))
                + ",\"schedule_end_time\":"
                + SupabaseJson.NullableString(NormalizeOptional(endTime))
                + ",\"schedule_weekdays\":"
                + BuildIntegerArrayJson(weekdays)
                + ",\"schedule_timezone\":"
                + SupabaseJson.Quote(normalizedTimezone)
                + ",\"schedule_requires_timer\":"
                + (requiresTimer ? "true" : "false")
                + ",\"schedule_requires_review_before_next_task\":"
                + (requiresReviewBeforeNextTask ? "true" : "false")
                + ",\"schedule_active_from\":"
                + SupabaseJson.Quote(activeFrom.Trim())
                + ",\"schedule_active_until\":"
                + SupabaseJson.NullableString(NormalizeOptional(activeUntil));
        }

        private static string BuildIntegerArrayJson(int[] values)
        {
            string json = "[";
            for (int index = 0; index < values.Length; index += 1)
            {
                if (index > 0) json += ",";
                json += values[index].ToString(
                    System.Globalization.CultureInfo.InvariantCulture);
            }

            return json + "]";
        }

        private static string BuildStringArrayJson(string[] values)
        {
            string json = "[";
            for (int index = 0; index < values.Length; index += 1)
            {
                if (index > 0) json += ",";
                json += SupabaseJson.Quote(values[index]);
            }

            return json + "]";
        }

        private static SupabaseParentAdventureScheduleRecord ParseAdventureSchedule(
            string response)
        {
            SupabaseParentAdventureScheduleRecord schedule;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out schedule,
                    out error))
            {
                throw new SupabaseDataException(
                    string.IsNullOrWhiteSpace(error)
                        ? "Supabase 沒有回傳每日冒險排程資料。"
                        : error);
            }

            return schedule;
        }

        private static void ValidateGeneralAdventureCreate(
            string familyId,
            SupabaseParentGeneralAdventureCreateInput input)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (input == null || input.childProfileIds == null
                || input.childProfileIds.Length == 0)
            {
                throw new SupabaseDataException("至少要指定一位孩子。");
            }

            HashSet<string> childIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (string childProfileId in input.childProfileIds)
            {
                if (string.IsNullOrWhiteSpace(childProfileId)
                    || !childIds.Add(childProfileId))
                {
                    throw new SupabaseDataException("指定的孩子資料不可重複或為空。");
                }
            }

            string name = input.name == null ? string.Empty : input.name.Trim();
            if (name.Length < 1 || name.Length > 120)
            {
                throw new SupabaseDataException("冒險名稱長度必須介於 1 到 120 個字元。");
            }

            string description = string.IsNullOrWhiteSpace(input.description)
                ? string.Empty
                : input.description.Trim();
            if (description.Length > 2000)
            {
                throw new SupabaseDataException("冒險說明不可超過 2000 個字元。");
            }
            string icon = string.IsNullOrWhiteSpace(input.icon)
                ? "Target"
                : input.icon.Trim();
            if (icon.Length < 1 || icon.Length > 32)
            {
                throw new SupabaseDataException("冒險圖示設定無效。");
            }
            if (!IsAdventureCategory(input.category))
            {
                throw new SupabaseDataException("冒險分類設定無效。");
            }
            if (input.points < 0)
            {
                throw new SupabaseDataException("冒險點數不可為負數。");
            }
            if (input.reportMode != "quick" && input.reportMode != "reflection")
            {
                throw new SupabaseDataException("一般冒險必須使用快速或心得回報。");
            }
            if (input.durationMinutes.HasValue
                && (input.durationMinutes.Value < 1
                    || input.durationMinutes.Value > 1440))
            {
                throw new SupabaseDataException("冒險時間必須介於 1 到 1440 分鐘。");
            }
            if (input.requiresTimer && !input.durationMinutes.HasValue)
            {
                throw new SupabaseDataException("需要計時的冒險必須設定時間。");
            }
        }

        private static bool IsAdventureCategory(string category)
        {
            return category == "life_habit"
                || category == "learning"
                || category == "health"
                || category == "relationship"
                || category == "family_contribution"
                || category == "creativity";
        }

        private static bool IsSuggestedEvidence(string suggestedEvidence)
        {
            return suggestedEvidence == "reflection"
                || suggestedEvidence == "checklist"
                || suggestedEvidence == "parent_observation";
        }

        private static void ValidateTaskTemplateCreate(
            string familyId,
            SupabaseParentTaskTemplateCreateInput input)
        {
            ValidateFamilyId(familyId);
            if (input == null)
            {
                throw new SupabaseDataException("任務模板資料不可為空。");
            }

            string name = input.name == null ? string.Empty : input.name.Trim();
            if (name.Length < 1 || name.Length > 120)
            {
                throw new SupabaseDataException("任務模板名稱長度必須介於 1 到 120 個字元。");
            }
            if (input.points <= 0)
            {
                throw new SupabaseDataException("任務模板點數必須大於 0。");
            }
            if (input.durationMinutes.HasValue
                && (input.durationMinutes.Value <= 0 || input.durationMinutes.Value > 1440))
            {
                throw new SupabaseDataException("任務模板時間必須介於 1 到 1440 分鐘。");
            }

            string icon = string.IsNullOrWhiteSpace(input.icon) ? "Star" : input.icon.Trim();
            if (icon.Length < 1 || icon.Length > 32)
            {
                throw new SupabaseDataException("任務模板圖示設定無效。");
            }

            string category = string.IsNullOrWhiteSpace(input.category)
                ? "life_habit"
                : input.category.Trim();
            if (!IsAdventureCategory(category))
            {
                throw new SupabaseDataException("任務模板分類設定無效。");
            }

            string suggestedEvidence = string.IsNullOrWhiteSpace(input.suggestedEvidence)
                ? "reflection"
                : input.suggestedEvidence.Trim();
            if (!IsSuggestedEvidence(suggestedEvidence))
            {
                throw new SupabaseDataException("任務模板回報方式設定無效。");
            }
        }

        private static void ValidateTaskTemplateUpdate(
            string familyId,
            string templateId,
            SupabaseParentTaskTemplateUpdateInput input)
        {
            ValidateFamilyId(familyId);
            if (string.IsNullOrWhiteSpace(templateId))
            {
                throw new SupabaseDataException("任務模板 ID 不可為空。");
            }
            if (input == null)
            {
                throw new SupabaseDataException("任務模板更新資料不可為空。");
            }

            ValidateTaskTemplateCreate(
                familyId,
                new SupabaseParentTaskTemplateCreateInput
                {
                    name = input.name,
                    points = input.points,
                    icon = input.icon,
                    durationMinutes = input.durationMinutes,
                    category = input.category,
                    suggestedEvidence = input.suggestedEvidence,
                    dueTime = input.dueTime,
                    endTime = input.endTime,
                    requiresReviewBeforeNextTask = input.requiresReviewBeforeNextTask,
                });
        }

        private static string BuildTaskTemplateCreateBody(
            string familyId,
            SupabaseParentTaskTemplateCreateInput input)
        {
            string name = input.name.Trim();
            string icon = string.IsNullOrWhiteSpace(input.icon) ? "Star" : input.icon.Trim();
            string category = string.IsNullOrWhiteSpace(input.category)
                ? "life_habit"
                : input.category.Trim();
            string suggestedEvidence = string.IsNullOrWhiteSpace(input.suggestedEvidence)
                ? "reflection"
                : input.suggestedEvidence.Trim();
            string durationJson = input.durationMinutes.HasValue
                ? input.durationMinutes.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : "null";
            return "{\"family_id\":" + SupabaseJson.Quote(familyId.Trim())
                + ",\"name\":" + SupabaseJson.Quote(name)
                + ",\"points\":"
                + input.points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ",\"icon\":" + SupabaseJson.Quote(icon)
                + ",\"duration_minutes\":" + durationJson
                + ",\"category\":" + SupabaseJson.Quote(category)
                + ",\"suggested_evidence\":" + SupabaseJson.Quote(suggestedEvidence)
                + ",\"due_time\":"
                + SupabaseJson.NullableString(NormalizeOptional(input.dueTime))
                + ",\"end_time\":"
                + SupabaseJson.NullableString(NormalizeOptional(input.endTime))
                + ",\"requires_review_before_next_task\":"
                + (input.requiresReviewBeforeNextTask ? "true" : "false")
                + "}";
        }

        private static string BuildTaskTemplateUpdateBody(
            SupabaseParentTaskTemplateUpdateInput input)
        {
            string icon = string.IsNullOrWhiteSpace(input.icon) ? "Star" : input.icon.Trim();
            string category = string.IsNullOrWhiteSpace(input.category)
                ? "life_habit"
                : input.category.Trim();
            string suggestedEvidence = string.IsNullOrWhiteSpace(input.suggestedEvidence)
                ? "reflection"
                : input.suggestedEvidence.Trim();
            string durationJson = input.durationMinutes.HasValue
                ? input.durationMinutes.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : "null";
            return "{\"name\":" + SupabaseJson.Quote(input.name.Trim())
                + ",\"points\":"
                + input.points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ",\"icon\":" + SupabaseJson.Quote(icon)
                + ",\"duration_minutes\":" + durationJson
                + ",\"category\":" + SupabaseJson.Quote(category)
                + ",\"suggested_evidence\":" + SupabaseJson.Quote(suggestedEvidence)
                + ",\"due_time\":"
                + SupabaseJson.NullableString(NormalizeOptional(input.dueTime))
                + ",\"end_time\":"
                + SupabaseJson.NullableString(NormalizeOptional(input.endTime))
                + ",\"requires_review_before_next_task\":"
                + (input.requiresReviewBeforeNextTask ? "true" : "false")
                + "}";
        }

        private static void ValidateTaskUpdate(
            string familyId,
            string taskId,
            SupabaseParentTaskUpdateInput input)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            if (string.IsNullOrWhiteSpace(taskId))
            {
                throw new SupabaseDataException("任務 ID 不可為空。");
            }
            if (input == null)
            {
                throw new SupabaseDataException("任務更新資料不可為空。");
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
        }

        private static string BuildTaskUpdateBody(SupabaseParentTaskUpdateInput input)
        {
            string icon = string.IsNullOrWhiteSpace(input.icon) ? "Star" : input.icon.Trim();
            string category = string.IsNullOrWhiteSpace(input.category)
                ? "life_habit"
                : input.category.Trim();
            string durationJson = input.durationMinutes.HasValue
                ? input.durationMinutes.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : "null";
            return "{\"name\":" + SupabaseJson.Quote(input.name.Trim())
                + ",\"points\":"
                + input.points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ",\"icon\":" + SupabaseJson.Quote(icon)
                + ",\"duration_minutes\":" + durationJson
                + ",\"is_daily\":" + (input.isDaily ? "true" : "false")
                + ",\"due_on\":" + SupabaseJson.NullableString(NormalizeOptional(input.dueOn))
                + ",\"due_time\":" + SupabaseJson.NullableString(NormalizeOptional(input.dueTime))
                + ",\"end_time\":" + SupabaseJson.NullableString(NormalizeOptional(input.endTime))
                + ",\"category\":" + SupabaseJson.Quote(category) + "}";
        }

        private async Task<SupabaseParentTaskMutationResult> RefreshTaskMutationAsync(
            SupabaseParentTaskMutationResult result,
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

            return result;
        }

        private async Task<SupabaseParentTaskTemplateMutationResult>
            RefreshTaskTemplateMutationAsync(
                SupabaseParentTaskTemplateMutationResult result,
                CancellationToken cancellationToken)
        {
            try
            {
                result.RefreshedSnapshot = await LoadAsync(cancellationToken);
                result.RefreshedSnapshot.taskTemplates =
                    await LoadTaskTemplatesAsync(
                        result.RefreshedSnapshot.familyId,
                        cancellationToken);
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

        private static string BuildGeneralAdventureBody(
            string familyId,
            string childProfileId,
            SupabaseParentGeneralAdventureCreateInput input)
        {
            string name = input.name.Trim();
            string description = string.IsNullOrWhiteSpace(input.description)
                ? null
                : input.description.Trim();
            string icon = string.IsNullOrWhiteSpace(input.icon)
                ? "Target"
                : input.icon.Trim();
            string durationJson = input.durationMinutes.HasValue
                ? input.durationMinutes.Value.ToString(
                    System.Globalization.CultureInfo.InvariantCulture)
                : "null";
            string dueOn = NormalizeOptional(input.dueOn);
            string startTime = NormalizeOptional(input.startTime);
            string endTime = NormalizeOptional(input.endTime);
            return "{\"target_family_id\":" + SupabaseJson.Quote(familyId)
                + ",\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId)
                + ",\"adventure_name\":" + SupabaseJson.Quote(name)
                + ",\"adventure_description\":"
                + SupabaseJson.NullableString(description)
                + ",\"adventure_points\":"
                + input.points.ToString(System.Globalization.CultureInfo.InvariantCulture)
                + ",\"adventure_icon\":" + SupabaseJson.Quote(icon)
                + ",\"adventure_category\":"
                + SupabaseJson.Quote(input.category)
                + ",\"adventure_duration_minutes\":" + durationJson
                + ",\"adventure_due_on\":"
                + SupabaseJson.NullableString(dueOn)
                + ",\"adventure_start_time\":"
                + SupabaseJson.NullableString(startTime)
                + ",\"adventure_end_time\":"
                + SupabaseJson.NullableString(endTime)
                + ",\"adventure_completion_report_mode\":"
                + SupabaseJson.Quote(input.reportMode)
                + ",\"adventure_requires_timer\":"
                + (input.requiresTimer ? "true" : "false")
                + ",\"adventure_requires_review_before_next_task\":"
                + (input.requiresReviewBeforeNextTask ? "true" : "false")
                + "}";
        }

        private static string NormalizeOptional(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static string ParseRpcString(string response)
        {
            string value = response == null ? string.Empty : response.Trim();
            if (value.Length >= 2 && value[0] == '"' && value[value.Length - 1] == '"')
            {
                value = value.Substring(1, value.Length - 2)
                    .Replace("\\\"", "\"")
                    .Replace("\\\\", "\\");
            }

            return value.Trim();
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

        public async Task<SupabaseParentTaskApprovalReversalResult>
            RevokeTaskApprovalAndRefreshAsync(
                string taskId,
                CancellationToken cancellationToken)
        {
            SupabaseParentTaskApprovalReversalResult result =
                new SupabaseParentTaskApprovalReversalResult
                {
                    Reversal = await RevokeTaskApprovalAsync(
                        taskId,
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

        public async Task<SupabaseParentTaskReviewResult> ConfirmChildGoalAndRefreshAsync(
            SupabaseChildTaskRecord task,
            string confirmedName,
            int confirmedPoints,
            string confirmedCategory,
            CancellationToken cancellationToken)
        {
            SupabaseParentTaskReviewResult result = new SupabaseParentTaskReviewResult
            {
                Task = await ConfirmChildGoalAsync(
                    task == null ? null : task.id,
                    confirmedName,
                    confirmedPoints,
                    confirmedCategory,
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

        public async Task<SupabaseParentTaskReviewResult> ReturnChildGoalAndRefreshAsync(
            SupabaseChildTaskRecord task,
            string revisionNote,
            CancellationToken cancellationToken)
        {
            SupabaseParentTaskReviewResult result = new SupabaseParentTaskReviewResult
            {
                Task = await ReturnChildGoalAsync(
                    task == null ? null : task.id,
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
