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
        private HabitHeroParentHomeView view;

        public HabitHeroParentHomeCoordinator(
            SupabaseParentHomeClient client,
            Transform canvasTransform,
            Font font)
        {
            if (client == null) throw new ArgumentNullException("client");
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.client = client;
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public async Task<bool> TryShowAsync(
            SupabaseSession session,
            CancellationToken cancellationToken,
            Action<string, bool> setStatus,
            Action onSignOut,
            Action hideLogin,
            Action showLogin)
        {
            if (session == null || session.User == null) return false;

            setStatus("正在載入家庭資料…", false);
            try
            {
                SupabaseParentHomeSnapshot snapshot =
                    await client.LoadAsync(cancellationToken);
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
                    onSignOut);
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
            if (view == null) return;
            view.Dispose();
            view = null;
        }
    }
}
