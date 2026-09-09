using System;
using System.Collections.Generic;
using System.Globalization;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildGrowthSummary
    {
        public int TotalGoals { get; set; }
        public int CompletedGoals { get; set; }
        public int PendingReviews { get; set; }
        public int RevisionRequests { get; set; }
        public int FeedbackCount { get; set; }
        public int CorrectionCount { get; set; }
        public int EarnedPoints { get; set; }
        public Dictionary<string, int> CategoryCounts { get; private set; }

        public int CompletionRate
        {
            get
            {
                return TotalGoals == 0
                    ? 0
                    : Mathf.RoundToInt(CompletedGoals * 100f / TotalGoals);
            }
        }

        public HabitHeroChildGrowthSummary()
        {
            CategoryCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        }
    }

    public static class HabitHeroChildGrowthStats
    {
        private static readonly string[] TrackedStatuses =
        {
            "todo",
            "pending",
            "revision_requested",
            "completed",
        };

        public static HabitHeroChildGrowthSummary Calculate(
            SupabaseChildHomeSnapshot snapshot)
        {
            HabitHeroChildGrowthSummary summary =
                new HabitHeroChildGrowthSummary();
            if (snapshot == null) return summary;

            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (task == null || !IsTrackedStatus(task.status)) continue;

                summary.TotalGoals += 1;
                if (task.status == "completed") summary.CompletedGoals += 1;
                if (task.status == "pending") summary.PendingReviews += 1;
                if (task.status == "revision_requested")
                {
                    summary.RevisionRequests += 1;
                }
                if (!string.IsNullOrWhiteSpace(task.parent_feedback_text))
                {
                    summary.FeedbackCount += 1;
                }
                if (!string.IsNullOrWhiteSpace(task.parent_correction_text)
                    || !string.IsNullOrWhiteSpace(task.revision_note))
                {
                    summary.CorrectionCount += 1;
                }

                string category = string.IsNullOrWhiteSpace(task.category)
                    ? "life_habit"
                    : task.category.Trim();
                int categoryCount;
                if (!summary.CategoryCounts.TryGetValue(category, out categoryCount))
                {
                    categoryCount = 0;
                }
                summary.CategoryCounts[category] = categoryCount + 1;
            }

            foreach (SupabaseChildLedgerRecord entry in
                snapshot.ledger ?? new SupabaseChildLedgerRecord[0])
            {
                if (entry == null
                    || entry.entry_type != "task_approved"
                    || entry.points_delta <= 0)
                {
                    continue;
                }

                summary.EarnedPoints += entry.points_delta;
            }

            return summary;
        }

        private static bool IsTrackedStatus(string status)
        {
            for (int index = 0; index < TrackedStatuses.Length; index += 1)
            {
                if (TrackedStatuses[index] == status) return true;
            }

            return false;
        }
    }

    public sealed class HabitHeroChildGrowthView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject categoryListObject;
        private GameObject taskListObject;
        private Text summaryText;
        private Text statusText;
        private SupabaseChildHomeSnapshot snapshot;
        private Action onClosed;

        private static readonly Dictionary<string, string> CategoryLabels =
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                { "life_habit", "生活自理" },
                { "learning", "學習成長" },
                { "health", "健康體能" },
                { "relationship", "人際情緒" },
                { "family_contribution", "家庭貢獻" },
                { "creativity", "創造探索" },
            };

        public HabitHeroChildGrowthView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null)
            {
                throw new ArgumentNullException("canvasTransform");
            }
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(SupabaseChildHomeSnapshot snapshot, Action onClosed)
        {
            if (snapshot == null || snapshot.child == null)
            {
                throw new ArgumentNullException("snapshot");
            }

            Dispose();
            this.snapshot = snapshot;
            this.onClosed = onClosed;
            BuildPanel();
            Render();
        }

        public void ApplySnapshot(SupabaseChildHomeSnapshot snapshot)
        {
            if (snapshot == null || snapshot.child == null || panel == null)
            {
                return;
            }

            this.snapshot = snapshot;
            Render();
        }

        public void Dispose()
        {
            snapshot = null;
            onClosed = null;
            categoryListObject = null;
            taskListObject = null;
            summaryText = null;
            statusText = null;
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }
        }

        private void BuildPanel()
        {
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ChildGrowthPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildGrowthCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.06f, 0.06f);
            cardRect.anchorMax = new Vector2(0.94f, 0.94f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "我的成長紀錄",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.9f),
                new Vector2(0.92f, 0.97f));
            summaryText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                17,
                TextAnchor.UpperLeft,
                Color.white,
                new Vector2(0.08f, 0.69f),
                new Vector2(0.92f, 0.89f));

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "分類統計",
                19,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.63f),
                new Vector2(0.92f, 0.69f));
            categoryListObject = CreateList(
                card.transform,
                "ChildGrowthCategoryList",
                new Vector2(0.08f, 0.39f),
                new Vector2(0.92f, 0.63f));

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "最近的冒險",
                19,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.34f),
                new Vector2(0.92f, 0.39f));
            taskListObject = CreateList(
                card.transform,
                "ChildGrowthTaskList",
                new Vector2(0.08f, 0.13f),
                new Vector2(0.92f, 0.34f));

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "成長紀錄使用目前已同步的任務與點數資料。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.08f),
                new Vector2(0.92f, 0.13f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.015f),
                new Vector2(0.65f, 0.075f));
            closeButton.onClick.AddListener(Close);
        }

        private void Render()
        {
            if (snapshot == null || snapshot.child == null) return;
            HabitHeroChildGrowthSummary summary =
                HabitHeroChildGrowthStats.Calculate(snapshot);
            if (summaryText != null)
            {
                summaryText.text =
                    "完成率：" + summary.CompletionRate.ToString(
                        CultureInfo.InvariantCulture) + "%\n"
                    + "已完成：" + summary.CompletedGoals.ToString(
                        CultureInfo.InvariantCulture) + " / "
                    + summary.TotalGoals.ToString(CultureInfo.InvariantCulture)
                    + "　待審核：" + summary.PendingReviews.ToString(
                        CultureInfo.InvariantCulture) + "\n"
                    + "需要補充：" + summary.RevisionRequests.ToString(
                        CultureInfo.InvariantCulture) + "　已獲得點數："
                    + summary.EarnedPoints.ToString(CultureInfo.InvariantCulture)
                    + "\n家長回饋：" + summary.FeedbackCount.ToString(
                        CultureInfo.InvariantCulture) + "　補充要求："
                    + summary.CorrectionCount.ToString(CultureInfo.InvariantCulture);
            }

            RenderCategories(summary);
            RenderTasks();
        }

        private void RenderCategories(HabitHeroChildGrowthSummary summary)
        {
            if (categoryListObject == null) return;
            ClearList(categoryListObject);
            string[] categories =
            {
                "life_habit",
                "learning",
                "health",
                "relationship",
                "family_contribution",
                "creativity",
            };
            int visibleCount = 0;
            for (int index = 0; index < categories.Length; index += 1)
            {
                int count;
                if (!summary.CategoryCounts.TryGetValue(categories[index], out count))
                {
                    count = 0;
                }
                string label;
                if (!CategoryLabels.TryGetValue(categories[index], out label))
                {
                    label = categories[index];
                }
                Text text = HabitHeroUiFactory.CreateText(
                    categoryListObject.transform,
                    font,
                    label + "：" + count.ToString(CultureInfo.InvariantCulture) + " 個",
                    16,
                    TextAnchor.MiddleLeft,
                    new Color(0.86f, 0.91f, 0.97f, 1f),
                    Vector2.zero,
                    Vector2.one);
                text.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 32f);
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                CreateEmptyMessage(categoryListObject.transform, "目前沒有分類資料。");
            }
        }

        private void RenderTasks()
        {
            if (taskListObject == null) return;
            ClearList(taskListObject);
            int visibleCount = 0;
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (task == null || !IsTrackedStatus(task.status) || visibleCount >= 5)
                {
                    continue;
                }

                string status = GetStatusLabel(task.status);
                string points = (task.status == "completed"
                    ? task.approved_points
                    : task.points).ToString(CultureInfo.InvariantCulture);
                Text text = HabitHeroUiFactory.CreateText(
                    taskListObject.transform,
                    font,
                    task.name + "　" + status + "　" + points + " 點",
                    15,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                text.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 36f);
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                CreateEmptyMessage(taskListObject.transform, "目前沒有可顯示的冒險。");
            }
        }

        private static bool IsTrackedStatus(string status)
        {
            return status == "todo"
                || status == "pending"
                || status == "revision_requested"
                || status == "completed";
        }

        private static string GetStatusLabel(string status)
        {
            if (status == "completed") return "已完成";
            if (status == "pending") return "待審核";
            if (status == "revision_requested") return "需補充";
            return "尚未開始";
        }

        private GameObject CreateList(
            Transform parent,
            string name,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject list = new GameObject(
                name,
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            list.transform.SetParent(parent, false);
            RectTransform rect = list.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = list.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 3f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }

        private static void ClearList(GameObject list)
        {
            foreach (Transform child in list.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }
        }

        private void CreateEmptyMessage(Transform parent, string message)
        {
            Text text = HabitHeroUiFactory.CreateText(
                parent,
                font,
                message,
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                Vector2.zero,
                Vector2.one);
            text.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 32f);
        }

        private void Close()
        {
            Action callback = onClosed;
            Dispose();
            if (callback != null) callback();
        }
    }
}
