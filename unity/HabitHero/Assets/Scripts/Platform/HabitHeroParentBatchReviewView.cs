using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentBatchReviewView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject taskListObject;
        private Text selectedText;
        private Text statusText;
        private Button reviewButton;
        private SupabaseParentHomeSnapshot snapshot;
        private readonly HashSet<string> selectedTaskIds =
            new HashSet<string>(StringComparer.Ordinal);
        private Func<string[], Task<SupabaseParentBatchReviewResult>> reviewDailyAdventures;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClosed;

        public HabitHeroParentBatchReviewView(Transform canvasTransform, Font font)
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
            Func<string[], Task<SupabaseParentBatchReviewResult>> reviewDailyAdventures,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (reviewDailyAdventures == null)
            {
                throw new ArgumentNullException("reviewDailyAdventures");
            }

            Dispose();
            this.snapshot = snapshot;
            this.reviewDailyAdventures = reviewDailyAdventures;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentBatchReviewPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentBatchReviewCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.08f);
            cardRect.anchorMax = new Vector2(0.92f, 0.92f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "每日冒險批次核准",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.9f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "只會列出已回報、等待家長核准的每日冒險；成功項目才會由伺服器發放點數。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.83f),
                new Vector2(0.92f, 0.9f));
            selectedText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                16,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.77f),
                new Vector2(0.92f, 0.83f));
            taskListObject = CreateVerticalList(
                card.transform,
                "ParentBatchReviewTaskList",
                new Vector2(0.08f, 0.31f),
                new Vector2(0.92f, 0.76f));
            reviewButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "批次核准選取項目",
                new Vector2(0.08f, 0.22f),
                new Vector2(0.92f, 0.29f));
            reviewButton.onClick.AddListener(HandleReviewClicked);
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.14f),
                new Vector2(0.92f, 0.21f));
            Button selectAllButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "全選每日待審",
                new Vector2(0.08f, 0.06f),
                new Vector2(0.42f, 0.12f));
            selectAllButton.onClick.AddListener(SelectAll);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.58f, 0.06f),
                new Vector2(0.92f, 0.12f));
            closeButton.onClick.AddListener(Close);

            RenderTaskList();
            SetStatus("請勾選要一起核准的每日冒險。", false);
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null || panel == null) return;
            this.snapshot = snapshot;
            RemoveUnavailableSelections();
            RenderTaskList();
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            selectedTaskIds.Clear();
            reviewDailyAdventures = null;
            applySnapshot = null;
            setParentStatus = null;
            onClosed = null;
            taskListObject = null;
            selectedText = null;
            statusText = null;
            reviewButton = null;
        }

        private void RenderTaskList()
        {
            if (taskListObject == null) return;
            foreach (Transform child in taskListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleCount = 0;
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (!IsReviewable(task) || visibleCount >= 12) continue;
                string taskId = task.id;
                Button taskButton = HabitHeroUiFactory.CreateButton(
                    taskListObject.transform,
                    font,
                    BuildTaskLabel(task),
                    Vector2.zero,
                    Vector2.one);
                taskButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 42f);
                taskButton.onClick.AddListener(() => ToggleTask(taskId, taskButton));
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    taskListObject.transform,
                    font,
                    "目前沒有可批次核准的每日冒險。",
                    19,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }

            UpdateSelectionState();
        }

        private void ToggleTask(string taskId, Button button)
        {
            if (string.IsNullOrWhiteSpace(taskId)) return;
            if (!selectedTaskIds.Add(taskId))
            {
                selectedTaskIds.Remove(taskId);
            }

            if (button != null)
            {
                Text label = button.GetComponentInChildren<Text>();
                SupabaseChildTaskRecord task = FindTask(taskId);
                if (label != null && task != null) label.text = BuildTaskLabel(task);
            }
            UpdateSelectionState();
        }

        private void SelectAll()
        {
            selectedTaskIds.Clear();
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (IsReviewable(task)) selectedTaskIds.Add(task.id);
            }
            RenderTaskList();
            SetStatus("已選取全部每日待審項目。", false);
        }

        private async void HandleReviewClicked()
        {
            RemoveUnavailableSelections();
            if (selectedTaskIds.Count == 0 || reviewDailyAdventures == null)
            {
                SetStatus("請至少選擇一個每日冒險。", true);
                return;
            }

            if (reviewButton != null) reviewButton.interactable = false;
            SetStatus("正在批次核准，請等待伺服器回應…", false);
            try
            {
                SupabaseParentBatchReviewResult result =
                    await reviewDailyAdventures(ToArray(selectedTaskIds));
                if (result == null)
                {
                    throw new SupabaseDataException("批次核准回應無效。");
                }

                selectedTaskIds.Clear();
                foreach (string failedTaskId in
                    result.FailedTaskIds ?? new string[0])
                {
                    if (!string.IsNullOrWhiteSpace(failedTaskId))
                    {
                        selectedTaskIds.Add(failedTaskId);
                    }
                }
                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                else
                {
                    RenderTaskList();
                }

                int failedCount = selectedTaskIds.Count;
                if (failedCount > 0)
                {
                    SetStatus(
                        "有 " + failedCount
                            + " 筆核准失敗，請逐筆重試；未成功項目不會發放點數。",
                        true);
                }
                else
                {
                    SetStatus(
                        string.IsNullOrWhiteSpace(result.RefreshError)
                            ? "批次核准完成，點數與紀錄已更新。"
                            : "批次核准完成；最新清單稍後會自動更新。",
                        false);
                }
            }
            catch (Exception exception)
            {
                SetStatus("批次核准失敗：" + exception.Message, true);
            }
            finally
            {
                if (reviewButton != null) reviewButton.interactable = true;
            }
        }

        private void UpdateSelectionState()
        {
            int selectedCount = selectedTaskIds.Count;
            if (selectedText != null)
            {
                selectedText.text = "已選取 " + selectedCount + " 筆";
            }
            if (reviewButton != null)
            {
                reviewButton.interactable = selectedCount > 0;
            }
        }

        private void RemoveUnavailableSelections()
        {
            List<string> unavailable = new List<string>();
            foreach (string taskId in selectedTaskIds)
            {
                SupabaseChildTaskRecord task = FindTask(taskId);
                if (!IsReviewable(task)) unavailable.Add(taskId);
            }
            foreach (string taskId in unavailable) selectedTaskIds.Remove(taskId);
        }

        private SupabaseChildTaskRecord FindTask(string taskId)
        {
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (task != null && task.id == taskId) return task;
            }
            return null;
        }

        private static bool IsReviewable(SupabaseChildTaskRecord task)
        {
            return task != null
                && !string.IsNullOrWhiteSpace(task.id)
                && task.status == "pending"
                && (task.is_daily || task.adventure_type == "daily");
        }

        private string BuildTaskLabel(SupabaseChildTaskRecord task)
        {
            string prefix = IsSelected(task.id) ? "[✓] " : "[　] ";
            string date = string.IsNullOrWhiteSpace(task.occurrence_date)
                ? task.due_on
                : task.occurrence_date;
            return prefix + (string.IsNullOrWhiteSpace(date) ? "今日" : date)
                + "｜" + task.name + "｜+" + task.points + " 點";
        }

        private bool IsSelected(string taskId)
        {
            return selectedTaskIds.Contains(taskId);
        }

        private static string[] ToArray(HashSet<string> values)
        {
            string[] result = new string[values.Count];
            values.CopyTo(result);
            return result;
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText != null)
            {
                statusText.text = message;
                statusText.color = isError
                    ? new Color(1f, 0.52f, 0.52f, 1f)
                    : new Color(0.84f, 0.89f, 0.96f, 1f);
            }
            if (setParentStatus != null && isError)
            {
                setParentStatus(message, true);
            }
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
            layout.spacing = 8f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return listObject;
        }
    }
}
