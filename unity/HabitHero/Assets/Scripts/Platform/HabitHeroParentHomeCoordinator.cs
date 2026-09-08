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
        private readonly Transform canvasTransform;
        private readonly Font font;
        private readonly Action openNotificationSettings;
        private HabitHeroParentHomeView view;
        private string activeFamilyId;

        public HabitHeroParentHomeCoordinator(
            SupabaseParentHomeClient client,
            Transform canvasTransform,
            Font font,
            Action openNotificationSettings = null)
        {
            if (client == null) throw new ArgumentNullException("client");
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.client = client;
            this.canvasTransform = canvasTransform;
            this.font = font;
            this.openNotificationSettings = openNotificationSettings;
        }

        public string ActiveFamilyId { get { return activeFamilyId; } }

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
                activeFamilyId = snapshot.familyId;
                snapshot.taskTemplates = await client.LoadTaskTemplatesAsync(
                    snapshot.familyId,
                    cancellationToken);
                if (view == null)
                {
                    view = new HabitHeroParentHomeView(canvasTransform, font);
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
                    (childProfileId) => client.DeleteChildAccountAndRefreshAsync(
                        snapshot.familyId,
                        childProfileId,
                        cancellationToken),
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

        public void Dispose()
        {
            activeFamilyId = null;
            if (view == null) return;
            view.Dispose();
            view = null;
        }
    }
}
