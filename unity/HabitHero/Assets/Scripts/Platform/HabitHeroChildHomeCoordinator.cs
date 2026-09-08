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
                    (task) => SubmitTaskAsync(task, cancellationToken),
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

        private async Task SubmitTaskAsync(
            SupabaseChildTaskRecord task,
            CancellationToken cancellationToken)
        {
            if (task == null) throw new ArgumentNullException("task");

            string reportMode = task.completion_report_mode;
            string quickReport = reportMode == "quick" ? "smooth" : null;
            string reflection = reportMode == "reflection" ? "在 Unity 完成任務" : null;
            string mood = reportMode == "reflection" ? "happy" : null;
            int? difficulty = reportMode == "reflection" ? 3 : (int?)null;
            await client.SubmitTaskCompletionAsync(
                task.id,
                quickReport,
                reflection,
                mood,
                difficulty,
                cancellationToken);
        }

        public void Dispose()
        {
            if (view == null) return;
            view.Dispose();
            view = null;
        }
    }
}
