using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentHomeView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject reviewPanel;
        private GameObject taskListObject;
        private Text statusText;
        private Text summaryText;
        private Text reviewStatus;
        private InputField feedbackInput;
        private InputField revisionInput;
        private Button approveButton;
        private Button reviseButton;
        private SupabaseParentHomeSnapshot latestSnapshot;
        private SupabaseChildTaskRecord activeReviewTask;
        private Func<
            SupabaseChildTaskRecord,
            bool,
            int?,
            string,
            string,
            string,
            string,
            Task<SupabaseParentTaskReviewResult>> reviewTask;

        public HabitHeroParentHomeView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<
                SupabaseChildTaskRecord,
                bool,
                int?,
                string,
                string,
                string,
                string,
                Task<SupabaseParentTaskReviewResult>> reviewTask,
            Action onSignOut)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");

            Dispose();
            latestSnapshot = snapshot;
            this.reviewTask = reviewTask;
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                HabitHeroUiFactory.PanelColor,
                "ParentHomePanel");
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(680f, 720f);
            panelRect.anchoredPosition = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "家長工作台",
                40,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.85f),
                new Vector2(0.92f, 0.95f));
            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                snapshot.family == null ? "我的家庭" : snapshot.family.name,
                21,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.78f),
                new Vector2(0.92f, 0.85f));
            summaryText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                string.Empty,
                18,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.7f),
                new Vector2(0.92f, 0.77f));

            Button signOutButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "登出",
                new Vector2(0.72f, 0.91f),
                new Vector2(0.91f, 0.97f));
            signOutButton.onClick.AddListener(() => onSignOut());

            taskListObject = new GameObject(
                "ParentPendingTaskList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            taskListObject.transform.SetParent(panel.transform, false);
            RectTransform taskListRect = taskListObject.GetComponent<RectTransform>();
            taskListRect.anchorMin = new Vector2(0.08f, 0.25f);
            taskListRect.anchorMax = new Vector2(0.92f, 0.68f);
            taskListRect.offsetMin = Vector2.zero;
            taskListRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = taskListObject.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 10f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;

            RenderSnapshot(snapshot);
            statusText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "點選待審任務即可核准或要求修改。",
                17,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.06f),
                new Vector2(0.92f, 0.2f));
        }

        public void Dispose()
        {
            reviewTask = null;
            latestSnapshot = null;
            activeReviewTask = null;
            taskListObject = null;
            summaryText = null;
            statusText = null;
            CloseReviewPanel();
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null || panel == null) return;
            latestSnapshot = snapshot;
            RenderSnapshot(snapshot);
            SetStatus("家庭資料、待審任務與點數已更新。", false);
        }

        private void RenderSnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            int childCount = snapshot.children == null ? 0 : snapshot.children.Length;
            int pendingCount = 0;
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (task != null && task.status == "pending") pendingCount += 1;
            }

            if (summaryText != null)
            {
                summaryText.text = string.Format(
                    CultureInfo.InvariantCulture,
                    "{0} 位孩子　．　{1} 件待審任務　．　{2} 張待領獎勵券",
                    childCount,
                    pendingCount,
                    snapshot.tickets == null ? 0 : snapshot.tickets.Length);
            }

            if (taskListObject == null) return;
            foreach (Transform child in taskListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleTaskCount = 0;
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (task == null || task.status != "pending" || visibleTaskCount >= 8)
                {
                    continue;
                }

                Button taskButton = HabitHeroUiFactory.CreateButton(
                    taskListObject.transform,
                    font,
                    GetChildName(task.child_profile_id) + "　" + task.name
                        + "　+" + task.points + " 點",
                    Vector2.zero,
                    Vector2.one);
                taskButton.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 58f);
                taskButton.onClick.AddListener(() => OpenReviewPanel(task));
                visibleTaskCount += 1;
            }

            if (visibleTaskCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    taskListObject.transform,
                    font,
                    "目前沒有等待家長確認的任務。",
                    22,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void OpenReviewPanel(SupabaseChildTaskRecord task)
        {
            if (task == null || reviewTask == null) return;
            CloseReviewPanel();
            activeReviewTask = task;
            reviewPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentTaskReviewPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                reviewPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentTaskReviewCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.1f, 0.12f);
            cardRect.anchorMax = new Vector2(0.9f, 0.88f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "任務審核",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.88f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                GetChildName(task.child_profile_id) + "｜" + task.name,
                22,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.78f),
                new Vector2(0.92f, 0.87f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                BuildTaskReport(task),
                17,
                TextAnchor.UpperLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.1f, 0.64f),
                new Vector2(0.9f, 0.76f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "給孩子的回饋（選填）",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.57f),
                new Vector2(0.9f, 0.63f));
            feedbackInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：你有注意到細節，很棒！",
                false,
                new Vector2(0.1f, 0.47f),
                new Vector2(0.9f, 0.56f));
            feedbackInput.contentType = InputField.ContentType.Standard;
            feedbackInput.lineType = InputField.LineType.SingleLine;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "要求修改時的說明",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.4f),
                new Vector2(0.9f, 0.46f));
            revisionInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "需要修改的地方",
                false,
                new Vector2(0.1f, 0.3f),
                new Vector2(0.9f, 0.39f));
            revisionInput.contentType = InputField.ContentType.Standard;
            revisionInput.lineType = InputField.LineType.SingleLine;

            reviewStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "核准會依伺服器規則發放點數。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.23f),
                new Vector2(0.92f, 0.29f));
            approveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "核准完成",
                new Vector2(0.1f, 0.13f),
                new Vector2(0.43f, 0.22f));
            approveButton.onClick.AddListener(() => HandleReviewDecision(true));
            reviseButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "要求修改",
                new Vector2(0.57f, 0.13f),
                new Vector2(0.9f, 0.22f));
            reviseButton.onClick.AddListener(() => HandleReviewDecision(false));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "先不要",
                new Vector2(0.35f, 0.04f),
                new Vector2(0.65f, 0.11f));
            closeButton.onClick.AddListener(CloseReviewPanel);
        }

        private async void HandleReviewDecision(bool approved)
        {
            if (activeReviewTask == null || reviewTask == null) return;
            string feedback = feedbackInput == null ? string.Empty : feedbackInput.text.Trim();
            string revisionNote = revisionInput == null ? string.Empty : revisionInput.text.Trim();
            if (!approved && string.IsNullOrWhiteSpace(revisionNote))
            {
                SetReviewStatus("要求修改時請填寫說明。", true);
                return;
            }

            if (approveButton != null) approveButton.interactable = false;
            if (reviseButton != null) reviseButton.interactable = false;
            SetReviewStatus(approved ? "正在核准任務…" : "正在送回修改…", false);
            try
            {
                SupabaseParentTaskReviewResult result = await reviewTask(
                    activeReviewTask,
                    approved,
                    approved ? activeReviewTask.points : (int?)null,
                    feedback,
                    null,
                    approved ? "encouraging" : "coaching",
                    approved ? null : revisionNote);
                if (result == null || result.Task == null)
                {
                    SetReviewStatus("審核回應無效，請稍後再試。", true);
                    return;
                }

                if (result.RefreshedSnapshot != null)
                {
                    ApplySnapshot(result.RefreshedSnapshot);
                }

                CloseReviewPanel();
                SetStatus(
                    approved
                        ? (string.IsNullOrWhiteSpace(result.RefreshError)
                            ? "任務已核准，點數與紀錄已更新。"
                            : "任務已核准；點數更新稍後會自動重試。")
                        : (string.IsNullOrWhiteSpace(result.RefreshError)
                            ? "已要求孩子修改任務。"
                            : "已送回修改；最新狀態稍後會自動更新。"),
                    false);
            }
            catch (Exception exception)
            {
                SetReviewStatus("審核失敗：" + exception.Message, true);
                if (approveButton != null) approveButton.interactable = true;
                if (reviseButton != null) reviseButton.interactable = true;
            }
        }

        private void CloseReviewPanel()
        {
            if (reviewPanel != null)
            {
                UnityEngine.Object.Destroy(reviewPanel);
                reviewPanel = null;
            }

            activeReviewTask = null;
            feedbackInput = null;
            revisionInput = null;
            approveButton = null;
            reviseButton = null;
            reviewStatus = null;
        }

        private void SetReviewStatus(string message, bool isError)
        {
            if (reviewStatus == null)
            {
                SetStatus(message, isError);
                return;
            }

            reviewStatus.text = message;
            reviewStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private string GetChildName(string childProfileId)
        {
            foreach (SupabaseChildProfileRecord child in
                latestSnapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : latestSnapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childProfileId)
                {
                    return child.display_name;
                }
            }

            return "孩子";
        }

        private static string BuildTaskReport(SupabaseChildTaskRecord task)
        {
            string report = string.Empty;
            if (!string.IsNullOrWhiteSpace(task.quick_report))
            {
                report += "快速回報：" + task.quick_report;
            }
            if (!string.IsNullOrWhiteSpace(task.child_reflection_text))
            {
                if (report.Length > 0) report += "\n";
                report += "完成心得：" + task.child_reflection_text;
            }
            if (!string.IsNullOrWhiteSpace(task.child_mood))
            {
                if (report.Length > 0) report += "\n";
                report += "心情：" + task.child_mood;
            }
            if (task.child_difficulty > 0)
            {
                if (report.Length > 0) report += "\n";
                report += "難度：" + task.child_difficulty;
            }

            return string.IsNullOrWhiteSpace(report) ? "孩子已送出完成回報。" : report;
        }
    }
}
