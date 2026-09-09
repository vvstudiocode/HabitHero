using System;
using System.Collections.Generic;
using System.Globalization;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentGrowthView
    {
        private static readonly string[] CategoryValues =
        {
            "life_habit",
            "learning",
            "health",
            "relationship",
            "family_contribution",
            "creativity",
        };

        private static readonly string[] CategoryLabels =
        {
            "生活自理",
            "學習成長",
            "健康體能",
            "人際情緒",
            "家庭貢獻",
            "創造探索",
        };

        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject childListObject;
        private GameObject detailObject;
        private Text selectedChildText;
        private Text statusText;
        private SupabaseParentHomeSnapshot snapshot;
        private string selectedChildId;
        private GrowthPeriod period = GrowthPeriod.Week;
        private Action onClosed;

        private enum GrowthPeriod
        {
            Day,
            Week,
            Month,
        }

        private sealed class CategoryStats
        {
            public int planned;
            public int completed;
            public int pending;
            public int revisionRequested;
            public int todo;
        }

        private sealed class GrowthStats
        {
            public int planned;
            public int completed;
            public int pending;
            public int revisionRequested;
            public int todo;
            public Dictionary<string, CategoryStats> categories =
                new Dictionary<string, CategoryStats>(StringComparer.Ordinal);

            public int CompletionRate
            {
                get
                {
                    return planned == 0
                        ? 0
                        : Mathf.RoundToInt(completed * 100f / planned);
                }
            }
        }

        public HabitHeroParentGrowthView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null)
            {
                throw new ArgumentNullException("canvasTransform");
            }
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            string selectedChildId,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");

            Dispose();
            this.snapshot = snapshot;
            this.selectedChildId = selectedChildId;
            this.onClosed = onClosed;
            if (FindChild(this.selectedChildId) == null)
            {
                this.selectedChildId = FindFirstChildId();
            }

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentGrowthPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentGrowthCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.06f, 0.04f);
            cardRect.anchorMax = new Vector2(0.94f, 0.96f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "家庭成長紀錄",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.91f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "依照同一份 Supabase 任務資料查看孩子的完成進度。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.86f),
                new Vector2(0.92f, 0.91f));

            CreatePeriodButton(card.transform, "今日", GrowthPeriod.Day, 0.08f, 0.27f);
            CreatePeriodButton(card.transform, "本週", GrowthPeriod.Week, 0.29f, 0.48f);
            CreatePeriodButton(card.transform, "本月", GrowthPeriod.Month, 0.5f, 0.69f);
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                13,
                TextAnchor.MiddleRight,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.7f, 0.86f),
                new Vector2(0.92f, 0.91f));

            childListObject = CreateVerticalList(
                card.transform,
                "ParentGrowthChildList",
                new Vector2(0.08f, 0.63f),
                new Vector2(0.92f, 0.77f));
            selectedChildText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.57f),
                new Vector2(0.92f, 0.62f));
            detailObject = new GameObject(
                "ParentGrowthDetail",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            detailObject.transform.SetParent(card.transform, false);
            RectTransform detailRect = detailObject.GetComponent<RectTransform>();
            detailRect.anchorMin = new Vector2(0.08f, 0.17f);
            detailRect.anchorMax = new Vector2(0.92f, 0.55f);
            detailRect.offsetMin = Vector2.zero;
            detailRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup detailLayout = detailObject.GetComponent<VerticalLayoutGroup>();
            detailLayout.spacing = 5f;
            detailLayout.childControlWidth = true;
            detailLayout.childControlHeight = true;
            detailLayout.childForceExpandWidth = true;
            detailLayout.childForceExpandHeight = false;

            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.06f),
                new Vector2(0.65f, 0.14f));
            closeButton.onClick.AddListener(Close);

            Render();
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null || panel == null) return;
            this.snapshot = snapshot;
            if (FindChild(selectedChildId) == null)
            {
                selectedChildId = FindFirstChildId();
            }
            Render();
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            selectedChildId = null;
            onClosed = null;
            childListObject = null;
            detailObject = null;
            selectedChildText = null;
            statusText = null;
        }

        private void CreatePeriodButton(
            Transform parent,
            string label,
            GrowthPeriod targetPeriod,
            float minX,
            float maxX)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                new Vector2(minX, 0.79f),
                new Vector2(maxX, 0.85f));
            button.onClick.AddListener(() =>
            {
                period = targetPeriod;
                Render();
            });
        }

        private void Render()
        {
            RenderPeriodLabel();
            RenderChildList();
            RenderDetails();
        }

        private void RenderPeriodLabel()
        {
            if (statusText == null) return;
            GrowthDateRange range = GetDateRange(period);
            statusText.text = range.startDate == range.endDate
                ? range.startDate
                : range.startDate + " ～ " + range.throughDate;
        }

        private void RenderChildList()
        {
            if (childListObject == null) return;
            foreach (Transform child in childListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleCount = 0;
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child == null || string.IsNullOrWhiteSpace(child.id)
                    || visibleCount >= 5)
                {
                    continue;
                }

                SupabaseChildProfileRecord capturedChild = child;
                GrowthStats stats = BuildStats(child.id);
                Button childButton = HabitHeroUiFactory.CreateButton(
                    childListObject.transform,
                    font,
                    (child.id == selectedChildId ? "✓ " : "")
                        + GetChildName(child.id)
                        + "　"
                        + stats.completed.ToString(CultureInfo.InvariantCulture)
                        + "/"
                        + stats.planned.ToString(CultureInfo.InvariantCulture)
                        + "　"
                        + stats.CompletionRate.ToString(CultureInfo.InvariantCulture)
                        + "%",
                    Vector2.zero,
                    Vector2.one);
                childButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 34f);
                childButton.onClick.AddListener(() =>
                {
                    selectedChildId = capturedChild.id;
                    Render();
                });
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    childListObject.transform,
                    font,
                    "目前沒有可顯示的孩子成長紀錄。",
                    17,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void RenderDetails()
        {
            if (detailObject == null) return;
            foreach (Transform child in detailObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            SupabaseChildProfileRecord selectedChild = FindChild(selectedChildId);
            if (selectedChildText != null)
            {
                selectedChildText.text = selectedChild == null
                    ? "請選擇孩子"
                    : GetChildName(selectedChild.id) + "的進度詳情";
            }
            if (selectedChild == null)
            {
                return;
            }

            GrowthStats stats = BuildStats(selectedChild.id);
            AddDetailText(
                "完成 " + stats.completed + " / " + stats.planned
                    + "　完成率 " + stats.CompletionRate + "%"
                    + "　待審 " + stats.pending
                    + "　需補充 " + stats.revisionRequested
                    + "　尚未開始 " + stats.todo,
                17,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                34f);

            for (int index = 0; index < CategoryValues.Length; index += 1)
            {
                CategoryStats category = stats.categories[CategoryValues[index]];
                string text = CategoryLabels[index]
                    + "　完成 " + category.completed + "/" + category.planned
                    + "　待審 " + category.pending
                    + "　需補充 " + category.revisionRequested;
                AddDetailText(
                    text,
                    13,
                    TextAnchor.MiddleLeft,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    26f);
            }
        }

        private void AddDetailText(
            string text,
            int size,
            TextAnchor alignment,
            Color color,
            float height)
        {
            Text detailText = HabitHeroUiFactory.CreateText(
                detailObject.transform,
                font,
                text,
                size,
                alignment,
                color,
                Vector2.zero,
                Vector2.one);
            detailText.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, height);
        }

        private GrowthStats BuildStats(string childId)
        {
            GrowthStats stats = new GrowthStats();
            foreach (string category in CategoryValues)
            {
                stats.categories[category] = new CategoryStats();
            }

            GrowthDateRange range = GetDateRange(period);
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (task == null || task.child_profile_id != childId
                    || !IsTrackedStatus(task.status))
                {
                    continue;
                }

                string taskDate = GetTaskDate(task);
                if (string.IsNullOrWhiteSpace(taskDate)
                    || string.CompareOrdinal(taskDate, range.startDate) < 0
                    || string.CompareOrdinal(taskDate, range.endDate) > 0
                    || string.CompareOrdinal(taskDate, range.throughDate) > 0)
                {
                    continue;
                }

                stats.planned += 1;
                CategoryStats categoryStats = stats.categories.ContainsKey(task.category)
                    ? stats.categories[task.category]
                    : stats.categories["life_habit"];
                categoryStats.planned += 1;
                if (task.status == "completed")
                {
                    stats.completed += 1;
                    categoryStats.completed += 1;
                }
                else if (task.status == "pending")
                {
                    stats.pending += 1;
                    categoryStats.pending += 1;
                }
                else if (task.status == "revision_requested")
                {
                    stats.revisionRequested += 1;
                    categoryStats.revisionRequested += 1;
                }
                else
                {
                    stats.todo += 1;
                    categoryStats.todo += 1;
                }
            }

            return stats;
        }

        private static bool IsTrackedStatus(string status)
        {
            return status == "todo"
                || status == "pending"
                || status == "revision_requested"
                || status == "completed";
        }

        private static string GetTaskDate(SupabaseChildTaskRecord task)
        {
            string scheduledDate = FirstDatePart(task.occurrence_date);
            if (!string.IsNullOrWhiteSpace(scheduledDate)) return scheduledDate;
            scheduledDate = FirstDatePart(task.due_on);
            if (!string.IsNullOrWhiteSpace(scheduledDate)) return scheduledDate;

            string[] activityTimestamps =
            {
                task.submitted_at,
                task.reviewed_at,
                task.updated_at,
                task.created_at,
            };
            foreach (string timestamp in activityTimestamps)
            {
                if (string.IsNullOrWhiteSpace(timestamp)) continue;
                DateTimeOffset parsed;
                if (DateTimeOffset.TryParse(
                        timestamp,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal,
                        out parsed))
                {
                    return parsed.ToUniversalTime().AddHours(8).ToString(
                        "yyyy-MM-dd",
                        CultureInfo.InvariantCulture);
                }
            }

            return null;
        }

        private static string FirstDatePart(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            string trimmed = value.Trim();
            return trimmed.Length >= 10 ? trimmed.Substring(0, 10) : trimmed;
        }

        private static GrowthDateRange GetDateRange(GrowthPeriod period)
        {
            DateTime today = DateTime.UtcNow.AddHours(8).Date;
            string todayKey = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            DateTime start = today;
            DateTime end = today;
            if (period == GrowthPeriod.Week)
            {
                int mondayOffset = ((int)today.DayOfWeek + 6) % 7;
                start = today.AddDays(-mondayOffset);
                end = start.AddDays(6);
            }
            else if (period == GrowthPeriod.Month)
            {
                start = new DateTime(today.Year, today.Month, 1);
                end = start.AddMonths(1).AddDays(-1);
            }

            string endKey = end.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            string throughDate = string.CompareOrdinal(endKey, todayKey) < 0
                ? endKey
                : todayKey;
            return new GrowthDateRange
            {
                startDate = start.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                endDate = endKey,
                throughDate = throughDate,
            };
        }

        private struct GrowthDateRange
        {
            public string startDate;
            public string endDate;
            public string throughDate;
        }

        private SupabaseChildProfileRecord FindChild(string childId)
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childId) return child;
            }
            return null;
        }

        private string FindFirstChildId()
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && !string.IsNullOrWhiteSpace(child.id))
                {
                    return child.id;
                }
            }
            return null;
        }

        private string GetChildName(string childId)
        {
            SupabaseChildProfileRecord child = FindChild(childId);
            return child == null || string.IsNullOrWhiteSpace(child.display_name)
                ? "孩子"
                : child.display_name;
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
        }

        private static GameObject CreateVerticalList(
            Transform parent,
            string name,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject listObject = new GameObject(
                name,
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            listObject.transform.SetParent(parent, false);
            RectTransform listRect = listObject.GetComponent<RectTransform>();
            listRect.anchorMin = anchorMin;
            listRect.anchorMax = anchorMax;
            listRect.offsetMin = Vector2.zero;
            listRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = listObject.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 5f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return listObject;
        }
    }
}
