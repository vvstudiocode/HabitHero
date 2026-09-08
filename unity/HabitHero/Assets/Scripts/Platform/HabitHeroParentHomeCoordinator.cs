using System;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;

namespace HabitHero.App
{
    public sealed class HabitHeroParentHomeCoordinator
    {
        private readonly SupabaseParentHomeClient client;
        private readonly SupabaseChildGameClient gameClient;
        private readonly SupabaseChildCoopAdventureClient coopAdventureClient;
        private readonly Transform canvasTransform;
        private readonly Font font;
        private readonly string gameAssetBaseUrl;
        private readonly Action openNotificationSettings;
        private readonly Func<CancellationToken, Task> deleteParentAccount;
        private readonly Func<string, string, CancellationToken, Task>
            updateParentPassword;
        private HabitHeroParentHomeView view;
        private string activeFamilyId;
        private string priceChildProfileId;

        public HabitHeroParentHomeCoordinator(
            SupabaseParentHomeClient client,
            SupabaseChildGameClient gameClient,
            SupabaseChildCoopAdventureClient coopAdventureClient,
            Transform canvasTransform,
            Font font,
            string gameAssetBaseUrl = null,
            Action openNotificationSettings = null,
            Func<CancellationToken, Task> deleteParentAccount = null,
            Func<string, string, CancellationToken, Task> updateParentPassword = null)
        {
            if (client == null) throw new ArgumentNullException("client");
            if (gameClient == null) throw new ArgumentNullException("gameClient");
            if (coopAdventureClient == null)
            {
                throw new ArgumentNullException("coopAdventureClient");
            }
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.client = client;
            this.gameClient = gameClient;
            this.coopAdventureClient = coopAdventureClient;
            this.canvasTransform = canvasTransform;
            this.font = font;
            this.gameAssetBaseUrl = gameAssetBaseUrl == null
                ? string.Empty
                : gameAssetBaseUrl.Trim();
            this.openNotificationSettings = openNotificationSettings;
            this.deleteParentAccount = deleteParentAccount;
            this.updateParentPassword = updateParentPassword;
        }

        public string ActiveFamilyId { get { return activeFamilyId; } }

        public bool IsShowing { get { return view != null; } }

        public bool OpenNotificationTarget(HabitHeroNotificationTarget target)
        {
            if (target == null || view == null || string.IsNullOrWhiteSpace(target.TaskId))
            {
                return false;
            }

            return view.OpenTaskNotification(target.TaskId, target.Event);
        }

        public async Task<bool> TryShowAsync(
            SupabaseSession session,
            CancellationToken cancellationToken,
            Action<string, bool> setStatus,
            Action onSignOut,
            Func<string, string, Task<bool>> enterChildMode,
            Action hideLogin,
            Action showLogin)
        {
            if (session == null || session.User == null) return false;

            setStatus("正在載入家庭資料…", false);
            try
            {
                SupabaseParentHomeSnapshot snapshot =
                    await client.LoadAsync(cancellationToken);
                snapshot.parentConsent = await client.LoadParentConsentAsync(
                    snapshot.familyId,
                    session.User.Id,
                    cancellationToken);
                activeFamilyId = snapshot.familyId;
                priceChildProfileId = snapshot.children != null && snapshot.children.Length > 0
                    && snapshot.children[0] != null
                    ? snapshot.children[0].id
                    : null;
                snapshot.taskTemplates = await client.LoadTaskTemplatesAsync(
                    snapshot.familyId,
                    cancellationToken);
                if (view == null)
                {
                    view = new HabitHeroParentHomeView(
                        canvasTransform,
                        font,
                        gameAssetBaseUrl);
                }

                view.Show(
                    snapshot,
                    (task, approved, approvedPoints, feedback, correction, tone, revisionNote) =>
                        ReviewTaskAsync(
                            task,
                            approved,
                            approvedPoints,
                            feedback,
                            correction,
                            tone,
                            revisionNote,
                            cancellationToken),
                    (taskIds) => client.BatchReviewDailyAdventuresAndRefreshAsync(
                        taskIds,
                        cancellationToken),
                    (taskId) => RevokeTaskApprovalAsync(
                        taskId,
                        cancellationToken),
                    (task, name, points, category) => ConfirmChildGoalAsync(
                        task,
                        name,
                        points,
                        category,
                        cancellationToken),
                    (task, revisionNote) => ReturnChildGoalAsync(
                        task,
                        revisionNote,
                        cancellationToken),
                    (wishlist, points) => client.ApproveWishlistAndRefreshAsync(
                        snapshot.familyId,
                        wishlist,
                        points,
                        cancellationToken),
                    (ticketId) => client.FulfillTicketAndRefreshAsync(
                        ticketId,
                        cancellationToken),
                    (input) => client.CreateTaskAndRefreshAsync(
                        snapshot.familyId,
                        input,
                        cancellationToken),
                    (taskId, input) => client.UpdateTaskAndRefreshAsync(
                        snapshot.familyId,
                        taskId,
                        input,
                        cancellationToken),
                    (taskId) => client.DeleteTaskAndRefreshAsync(
                        snapshot.familyId,
                        taskId,
                        cancellationToken),
                    (input) => client.CreateTaskTemplateAndRefreshAsync(
                        snapshot.familyId,
                        input,
                        cancellationToken),
                    (templateId, input) => client.UpdateTaskTemplateAndRefreshAsync(
                        snapshot.familyId,
                        templateId,
                        input,
                        cancellationToken),
                    (templateId) => client.DeleteTaskTemplateAndRefreshAsync(
                        snapshot.familyId,
                        templateId,
                        cancellationToken),
                    (input) => client.CreateGeneralAdventureAndRefreshAsync(
                        snapshot.familyId,
                        input,
                        cancellationToken),
                    (childProfileId, title) =>
                        client.UpdateGeneralAdventureTitleAndRefreshAsync(
                            snapshot.familyId,
                            childProfileId,
                            title,
                            cancellationToken),
                    () => client.LoadAdventureSchedulesAsync(
                        snapshot.familyId,
                        cancellationToken),
                    (input) => client.CreateAdventureScheduleAsync(
                        snapshot.familyId,
                        input,
                        cancellationToken),
                    (scheduleId, input) => client.UpdateAdventureScheduleAsync(
                        scheduleId,
                        input,
                        cancellationToken),
                    (scheduleId) => client.DisableAdventureScheduleAsync(
                        scheduleId,
                        cancellationToken),
                    (input) => client.CreateRewardAndRefreshAsync(
                        snapshot.familyId,
                        input,
                        cancellationToken),
                    (reward, name, points) => client.UpdateRewardAndRefreshAsync(
                        reward,
                        name,
                        points,
                        cancellationToken),
                    (rewardId) => client.DeleteRewardAndRefreshAsync(
                        rewardId,
                        cancellationToken),
                    (childProfileId, pointsDelta, note) =>
                        client.AdjustChildPointsAndRefreshAsync(
                            childProfileId,
                            pointsDelta,
                            note,
                            cancellationToken),
                    (input) => client.CreateChildAccountAndRefreshAsync(
                        snapshot.familyId,
                        input,
                        cancellationToken),
                    (childProfileId, password) => client.ResetChildPasswordAndRefreshAsync(
                        snapshot.familyId,
                        childProfileId,
                        password,
                        cancellationToken),
                    (childProfileId, name) => client.UpdateChildDisplayNameAndRefreshAsync(
                        snapshot.familyId,
                        childProfileId,
                        name,
                        cancellationToken),
                    (childProfileId) => client.DeleteChildAccountAndRefreshAsync(
                        snapshot.familyId,
                        childProfileId,
                        cancellationToken),
                    () => LoadGameStoreAsync(cancellationToken),
                    (catalogItemId, scrollPrice) => SetGamePriceAndRefreshAsync(
                        catalogItemId,
                        scrollPrice,
                        cancellationToken),
                    (catalogItemId) => ResetGamePriceAndRefreshAsync(
                        catalogItemId,
                        cancellationToken),
                    (worldOwnerChildProfileId) => coopAdventureClient.ListAsync(
                        worldOwnerChildProfileId,
                        cancellationToken),
                    (adventureId) => coopAdventureClient.LoadStateAsync(
                        adventureId,
                        cancellationToken),
                    (participantId, input) => coopAdventureClient.ReviewCompletionAsync(
                        participantId,
                        input,
                        cancellationToken),
                    (consentVersion) => client.RecordParentConsentAsync(
                        snapshot.familyId,
                        consentVersion,
                        cancellationToken),
                    updateParentPassword == null
                        ? null
                        : (currentPassword, newPassword) => updateParentPassword(
                            currentPassword,
                            newPassword,
                            cancellationToken),
                    deleteParentAccount == null
                        ? null
                        : () => deleteParentAccount(cancellationToken),
                    enterChildMode == null
                        ? null
                        : (childProfileId) => enterChildMode(
                            snapshot.familyId,
                            childProfileId),
                    onSignOut,
                    openNotificationSettings);
                hideLogin();
                return true;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                showLogin();
                setStatus("載入家庭資料失敗：" + exception.Message, true);
                return false;
            }
        }

        private async Task<SupabaseParentTaskReviewResult> ReviewTaskAsync(
            SupabaseChildTaskRecord task,
            bool approved,
            int? approvedPoints,
            string feedback,
            string correction,
            string tone,
            string revisionNote,
            CancellationToken cancellationToken)
        {
            SupabaseParentTaskReviewResult result =
                await client.ReviewTaskAndRefreshAsync(
                    task,
                    approved,
                    approvedPoints,
                    feedback,
                    correction,
                    tone,
                    revisionNote,
                    cancellationToken);
            if (result.RefreshedSnapshot != null && view != null)
            {
                view.ApplySnapshot(result.RefreshedSnapshot);
            }

            return result;
        }

        private async Task<SupabaseParentTaskApprovalReversalResult>
            RevokeTaskApprovalAsync(
                string taskId,
                CancellationToken cancellationToken)
        {
            SupabaseParentTaskApprovalReversalResult result =
                await client.RevokeTaskApprovalAndRefreshAsync(
                    taskId,
                    cancellationToken);
            if (result.RefreshedSnapshot != null && view != null)
            {
                view.ApplySnapshot(result.RefreshedSnapshot);
            }

            return result;
        }

        private async Task<SupabaseParentTaskReviewResult> ConfirmChildGoalAsync(
            SupabaseChildTaskRecord task,
            string confirmedName,
            int confirmedPoints,
            string confirmedCategory,
            CancellationToken cancellationToken)
        {
            SupabaseParentTaskReviewResult result =
                await client.ConfirmChildGoalAndRefreshAsync(
                    task,
                    confirmedName,
                    confirmedPoints,
                    confirmedCategory,
                    cancellationToken);
            if (result.RefreshedSnapshot != null && view != null)
            {
                view.ApplySnapshot(result.RefreshedSnapshot);
            }
            return result;
        }

        private async Task<SupabaseParentTaskReviewResult> ReturnChildGoalAsync(
            SupabaseChildTaskRecord task,
            string revisionNote,
            CancellationToken cancellationToken)
        {
            SupabaseParentTaskReviewResult result =
                await client.ReturnChildGoalAndRefreshAsync(
                    task,
                    revisionNote,
                    cancellationToken);
            if (result.RefreshedSnapshot != null && view != null)
            {
                view.ApplySnapshot(result.RefreshedSnapshot);
            }
            return result;
        }

        public void Dispose()
        {
            activeFamilyId = null;
            priceChildProfileId = null;
            if (view == null) return;
            view.Dispose();
            view = null;
        }

        private async Task<SupabaseChildGameData> LoadGameStoreAsync(
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(activeFamilyId)
                || string.IsNullOrWhiteSpace(priceChildProfileId))
            {
                throw new SupabaseDataException("目前沒有可管理商店的孩子資料。");
            }
            return await gameClient.LoadAsync(
                activeFamilyId,
                priceChildProfileId,
                cancellationToken);
        }

        private async Task<SupabaseChildGameData> SetGamePriceAndRefreshAsync(
            string catalogItemId,
            int scrollPrice,
            CancellationToken cancellationToken)
        {
            await gameClient.SetFamilyGameItemPriceAsync(
                catalogItemId,
                scrollPrice,
                cancellationToken);
            return await LoadGameStoreAsync(cancellationToken);
        }

        private async Task<SupabaseChildGameData> ResetGamePriceAndRefreshAsync(
            string catalogItemId,
            CancellationToken cancellationToken)
        {
            await gameClient.ResetFamilyGameItemPriceAsync(
                catalogItemId,
                cancellationToken);
            return await LoadGameStoreAsync(cancellationToken);
        }
    }
}
