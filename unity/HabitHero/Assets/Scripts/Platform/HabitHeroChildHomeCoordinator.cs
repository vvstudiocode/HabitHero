using System;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;

namespace HabitHero.App
{
    public sealed class HabitHeroChildHomeCoordinator
    {
        private const string ChildEmailDomain = "@children.habithero.local";

        private readonly SupabaseChildHomeClient client;
        private readonly Transform canvasTransform;
        private readonly Font font;
        private HabitHeroChildHomeView view;

        public HabitHeroChildHomeCoordinator(
            SupabaseChildHomeClient client,
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
            string email = session == null || session.User == null ? string.Empty : session.User.Email;
            bool isChildSession = !string.IsNullOrWhiteSpace(email)
                && email.EndsWith(ChildEmailDomain, StringComparison.OrdinalIgnoreCase);
            if (!isChildSession) return false;

            setStatus("正在載入今日任務…", false);
            try
            {
                SupabaseChildHomeSnapshot snapshot = await client.LoadAsync(cancellationToken);
                if (view == null) view = new HabitHeroChildHomeView(canvasTransform, font);
                view.Show(
                    snapshot,
                    (task, draft) => SubmitTaskAsync(task, draft, cancellationToken),
                    (taskId) => client.StartAdventureTimerAsync(taskId, cancellationToken),
                    (taskId) => client.PauseAdventureTimerAsync(taskId, cancellationToken),
                    (taskId) => client.ResumeAdventureTimerAsync(taskId, cancellationToken),
                    (rewardId) => client.RedeemRewardAndRefreshAsync(rewardId, cancellationToken),
                    (name) => client.AddWishlistItemAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        name,
                        cancellationToken),
                    (wishlistId) => client.DeleteWishlistItemAndRefreshAsync(
                        wishlistId,
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
                setStatus("載入孩子資料失敗：" + exception.Message, true);
                return false;
            }
        }

        private async Task<SupabaseTaskCompletionResult> SubmitTaskAsync(
            SupabaseChildTaskRecord task,
            SupabaseTaskCompletionDraft draft,
            CancellationToken cancellationToken)
        {
            if (task == null) throw new ArgumentNullException("task");
            if (draft == null) draft = new SupabaseTaskCompletionDraft();
            SupabaseTaskCompletionResult result = await client.SubmitTaskCompletionAndRefreshAsync(
                task.id,
                draft.quickReport,
                draft.reflection,
                draft.mood,
                draft.difficulty,
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
