using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentTaskManagementView
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
            "生活習慣",
            "學習",
            "健康",
            "關係",
            "家庭貢獻",
            "創意",
        };

        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject taskListObject;
        private Text formTitle;
        private Text selectedTaskText;
        private Text categoryText;
        private Text statusText;
        private InputField nameInput;
        private InputField pointsInput;
        private InputField durationInput;
        private InputField dueOnInput;
        private InputField dueTimeInput;
        private InputField endTimeInput;
        private Toggle dailyToggle;
        private Button categoryButton;
        private Button saveButton;
        private Button deleteButton;
        private Text deleteButtonLabel;
        private SupabaseParentHomeSnapshot snapshot;
        private SupabaseChildTaskRecord activeTask;
        private int categoryIndex;
        private bool deleteConfirm;
        private Func<
            string,
            SupabaseParentTaskUpdateInput,
            Task<SupabaseParentTaskMutationResult>> updateTask;
        private Func<string, Task<SupabaseParentTaskMutationResult>> deleteTask;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClosed;

        public HabitHeroParentTaskManagementView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<
                string,
                SupabaseParentTaskUpdateInput,
                Task<SupabaseParentTaskMutationResult>> updateTask,
            Func<string, Task<SupabaseParentTaskMutationResult>> deleteTask,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (updateTask == null) throw new ArgumentNullException("updateTask");
            if (deleteTask == null) throw new ArgumentNullException("deleteTask");

            Dispose();
            this.snapshot = snapshot;
            this.updateTask = updateTask;
            this.deleteTask = deleteTask;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentTaskManagementPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentTaskManagementCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.04f, 0.02f);
            cardRect.anchorMax = new Vector2(0.96f, 0.98f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "任務管理",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.06f, 0.94f),
                new Vector2(0.94f, 0.99f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "可編輯待執行任務；待審核與已完成紀錄只保留檢視。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.06f, 0.9f),
                new Vector2(0.94f, 0.94f));

            taskListObject = CreateVerticalList(
                card.transform,
                "ParentTaskManagementList",
                new Vector2(0.06f, 0.72f),
                new Vector2(0.94f, 0.89f));
            formTitle = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "選取任務",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.06f, 0.675f),
                new Vector2(0.94f, 0.72f));
            selectedTaskText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "",
                13,
                TextAnchor.MiddleLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.06f, 0.64f),
                new Vector2(0.94f, 0.675f));

            nameInput = CreateSmallInput(
                card.transform,
                "任務名稱",
                new Vector2(0.06f, 0.57f),
                new Vector2(0.94f, 0.635f));
            CreateLabel(card.transform, "點數", 0.52f, 0.57f, 0.06f, 0.15f);
            pointsInput = CreateSmallInput(
                card.transform,
                "10",
                new Vector2(0.15f, 0.52f),
                new Vector2(0.32f, 0.57f));
            CreateLabel(card.transform, "分鐘", 0.52f, 0.57f, 0.34f, 0.43f);
            durationInput = CreateSmallInput(
                card.transform,
                "選填",
                new Vector2(0.43f, 0.52f),
                new Vector2(0.58f, 0.57f));
            categoryButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "生活習慣",
                new Vector2(0.61f, 0.52f),
                new Vector2(0.94f, 0.57f));
            categoryText = categoryButton.GetComponentInChildren<Text>();
            categoryButton.onClick.AddListener(CycleCategory);

            CreateLabel(card.transform, "日期", 0.47f, 0.52f, 0.06f, 0.15f);
            dueOnInput = CreateSmallInput(
                card.transform,
                "YYYY-MM-DD",
                new Vector2(0.15f, 0.47f),
                new Vector2(0.4f, 0.52f));
            CreateLabel(card.transform, "開始", 0.47f, 0.52f, 0.42f, 0.51f);
            dueTimeInput = CreateSmallInput(
                card.transform,
                "18:00",
                new Vector2(0.51f, 0.47f),
                new Vector2(0.69f, 0.52f));
            CreateLabel(card.transform, "結束", 0.47f, 0.52f, 0.71f, 0.8f);
            endTimeInput = CreateSmallInput(
                card.transform,
                "19:00",
                new Vector2(0.8f, 0.47f),
                new Vector2(0.94f, 0.52f));

            dailyToggle = CreateOptionToggle(
                card.transform,
                "每天顯示在孩子的今日任務",
                new Vector2(0.06f, 0.39f),
                new Vector2(0.94f, 0.46f));
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "選取任務後可修改內容。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.06f, 0.32f),
                new Vector2(0.94f, 0.39f));
            saveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "儲存修改",
                new Vector2(0.06f, 0.23f),
                new Vector2(0.48f, 0.31f));
            saveButton.onClick.AddListener(HandleSave);
            deleteButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "刪除任務",
                new Vector2(0.52f, 0.23f),
                new Vector2(0.94f, 0.31f));
            deleteButtonLabel = deleteButton.GetComponentInChildren<Text>();
            deleteButton.onClick.AddListener(HandleDelete);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.09f),
                new Vector2(0.65f, 0.18f));
            closeButton.onClick.AddListener(Close);

            ConfigureInputs();
            RenderTaskList();
            ClearSelection();
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null || panel == null) return;
            this.snapshot = snapshot;
            if (activeTask != null)
            {
                activeTask = FindTask(activeTask.id);
            }
            RenderTaskList();
            if (activeTask == null) ClearSelection();
            else PopulateForm(activeTask);
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            activeTask = null;
            updateTask = null;
            deleteTask = null;
            applySnapshot = null;
            setParentStatus = null;
            onClosed = null;
            taskListObject = null;
            formTitle = null;
            selectedTaskText = null;
            categoryText = null;
            statusText = null;
            nameInput = null;
            pointsInput = null;
            durationInput = null;
            dueOnInput = null;
            dueTimeInput = null;
            endTimeInput = null;
            dailyToggle = null;
            categoryButton = null;
            saveButton = null;
            deleteButton = null;
            deleteButtonLabel = null;
            deleteConfirm = false;
        }

        private void ConfigureInputs()
        {
            nameInput.contentType = InputField.ContentType.Standard;
            pointsInput.contentType = InputField.ContentType.IntegerNumber;
            durationInput.contentType = InputField.ContentType.IntegerNumber;
            dueOnInput.contentType = InputField.ContentType.Standard;
            dueTimeInput.contentType = InputField.ContentType.Standard;
            endTimeInput.contentType = InputField.ContentType.Standard;
            nameInput.lineType = InputField.LineType.SingleLine;
            pointsInput.lineType = InputField.LineType.SingleLine;
            durationInput.lineType = InputField.LineType.SingleLine;
            dueOnInput.lineType = InputField.LineType.SingleLine;
            dueTimeInput.lineType = InputField.LineType.SingleLine;
            endTimeInput.lineType = InputField.LineType.SingleLine;
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
                if (task == null || visibleCount >= 10) continue;
                Button taskButton = HabitHeroUiFactory.CreateButton(
                    taskListObject.transform,
                    font,
                    GetChildName(task.child_profile_id) + "｜" + task.name
                        + "｜" + GetStatusLabel(task.status),
                    Vector2.zero,
                    Vector2.one);
                taskButton.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 38f);
                taskButton.onClick.AddListener(() => SelectTask(task));
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    taskListObject.transform,
                    font,
                    "目前沒有可管理的任務。",
                    17,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void SelectTask(SupabaseChildTaskRecord task)
        {
            if (task == null) return;
            activeTask = task;
            deleteConfirm = false;
            PopulateForm(task);
            SetStatus(
                CanManageTask(task)
                    ? "可修改或刪除這個任務。"
                    : "這個任務狀態只可檢視，不能修改或刪除。",
                !CanManageTask(task));
        }

        private void PopulateForm(SupabaseChildTaskRecord task)
        {
            if (formTitle != null) formTitle.text = "編輯任務";
            if (selectedTaskText != null)
            {
                selectedTaskText.text = GetChildName(task.child_profile_id)
                    + "｜狀態：" + GetStatusLabel(task.status);
            }
            if (nameInput != null) nameInput.text = task.name ?? string.Empty;
            if (pointsInput != null) pointsInput.text = task.points.ToString(CultureInfo.InvariantCulture);
            if (durationInput != null)
            {
                durationInput.text = task.duration_minutes > 0
                    ? task.duration_minutes.ToString(CultureInfo.InvariantCulture)
                    : string.Empty;
            }
            if (dueOnInput != null) dueOnInput.text = task.due_on ?? string.Empty;
            if (dueTimeInput != null) dueTimeInput.text = TrimTime(task.due_time);
            if (endTimeInput != null) endTimeInput.text = TrimTime(task.end_time);
            categoryIndex = FindCategoryIndex(task.category);
            if (categoryText != null) categoryText.text = CategoryLabels[categoryIndex];
            if (dailyToggle != null) dailyToggle.isOn = task.is_daily;
            bool canManage = CanManageTask(task);
            if (saveButton != null) saveButton.interactable = canManage;
            if (deleteButton != null) deleteButton.interactable = canManage;
            if (deleteButtonLabel != null) deleteButtonLabel.text = "刪除任務";
        }

        private void ClearSelection()
        {
            activeTask = null;
            deleteConfirm = false;
            if (formTitle != null) formTitle.text = "選取任務";
            if (selectedTaskText != null) selectedTaskText.text = "";
            if (nameInput != null) nameInput.text = string.Empty;
            if (pointsInput != null) pointsInput.text = string.Empty;
            if (durationInput != null) durationInput.text = string.Empty;
            if (dueOnInput != null) dueOnInput.text = string.Empty;
            if (dueTimeInput != null) dueTimeInput.text = string.Empty;
            if (endTimeInput != null) endTimeInput.text = string.Empty;
            if (dailyToggle != null) dailyToggle.isOn = false;
            if (saveButton != null) saveButton.interactable = false;
            if (deleteButton != null) deleteButton.interactable = false;
            if (deleteButtonLabel != null) deleteButtonLabel.text = "刪除任務";
            SetStatus("選取任務後可修改內容。", false);
        }

        private async void HandleSave()
        {
            if (activeTask == null || updateTask == null || !CanManageTask(activeTask)) return;
            string name = nameInput == null ? string.Empty : nameInput.text.Trim();
            string pointsText = pointsInput == null ? string.Empty : pointsInput.text.Trim();
            string durationText = durationInput == null ? string.Empty : durationInput.text.Trim();
            int points;
            if (name.Length < 1 || name.Length > 120)
            {
                SetStatus("請輸入 1 到 120 個字元的任務名稱。", true);
                return;
            }
            if (!int.TryParse(pointsText, NumberStyles.Integer, CultureInfo.InvariantCulture, out points)
                || points <= 0)
            {
                SetStatus("請輸入大於 0 的整數點數。", true);
                return;
            }

            int duration;
            int? durationMinutes = null;
            if (!string.IsNullOrWhiteSpace(durationText))
            {
                if (!int.TryParse(durationText, NumberStyles.Integer, CultureInfo.InvariantCulture, out duration)
                    || duration < 1 || duration > 1440)
                {
                    SetStatus("分鐘必須介於 1 到 1440，或留空。", true);
                    return;
                }
                durationMinutes = duration;
            }

            string dueTime = EmptyToNull(dueTimeInput == null ? null : dueTimeInput.text);
            string endTime = EmptyToNull(endTimeInput == null ? null : endTimeInput.text);
            if (!AreTimesValid(dueTime, endTime))
            {
                SetStatus("結束時間必須晚於開始時間。", true);
                return;
            }

            if (saveButton != null) saveButton.interactable = false;
            if (deleteButton != null) deleteButton.interactable = false;
            SetStatus("正在儲存任務修改…", false);
            try
            {
                SupabaseParentTaskMutationResult result = await updateTask(
                    activeTask.id,
                    new SupabaseParentTaskUpdateInput
                    {
                        name = name,
                        points = points,
                        icon = string.IsNullOrWhiteSpace(activeTask.icon) ? "Star" : activeTask.icon,
                        durationMinutes = durationMinutes,
                        isDaily = dailyToggle != null && dailyToggle.isOn,
                        dueOn = EmptyToNull(dueOnInput == null ? null : dueOnInput.text),
                        dueTime = dueTime,
                        endTime = endTime,
                        category = CategoryValues[categoryIndex],
                    });
                if (result == null || !result.Updated)
                {
                    SetStatus("更新任務回應無效，請稍後再試。", true);
                    return;
                }
                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                SetStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "任務已更新。"
                        : "任務已更新；最新清單稍後會自動更新。",
                    false);
            }
            catch (Exception exception)
            {
                SetStatus("更新任務失敗：" + exception.Message, true);
            }
            finally
            {
                if (activeTask != null && CanManageTask(activeTask))
                {
                    if (saveButton != null) saveButton.interactable = true;
                    if (deleteButton != null) deleteButton.interactable = true;
                }
            }
        }

        private async void HandleDelete()
        {
            if (activeTask == null || deleteTask == null || !CanManageTask(activeTask)) return;
            if (!deleteConfirm)
            {
                deleteConfirm = true;
                if (deleteButtonLabel != null) deleteButtonLabel.text = "再次確認刪除";
                SetStatus("再次點擊才會刪除「" + activeTask.name + "」。", true);
                return;
            }

            if (deleteButton != null) deleteButton.interactable = false;
            if (saveButton != null) saveButton.interactable = false;
            SetStatus("正在刪除任務…", false);
            try
            {
                SupabaseParentTaskMutationResult result = await deleteTask(activeTask.id);
                if (result == null || !result.Deleted)
                {
                    SetStatus("刪除任務回應無效，請稍後再試。", true);
                    return;
                }
                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                Action<string, bool> parentStatus = setParentStatus;
                string message = string.IsNullOrWhiteSpace(result.RefreshError)
                    ? "任務已刪除。"
                    : "任務已刪除；最新清單稍後會自動更新。";
                if (parentStatus != null) parentStatus(message, false);
                Close();
            }
            catch (Exception exception)
            {
                SetStatus("刪除任務失敗：" + exception.Message, true);
                if (deleteButton != null) deleteButton.interactable = true;
                if (saveButton != null) saveButton.interactable = true;
            }
        }

        private void CycleCategory()
        {
            categoryIndex = (categoryIndex + 1) % CategoryValues.Length;
            if (categoryText != null) categoryText.text = CategoryLabels[categoryIndex];
        }

        private void Close()
        {
            if (onClosed != null) onClosed();
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null)
            {
                if (setParentStatus != null) setParentStatus(message, isError);
                return;
            }
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
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

        private string GetChildName(string childId)
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childId)
                {
                    return string.IsNullOrWhiteSpace(child.display_name)
                        ? "孩子"
                        : child.display_name;
                }
            }
            return "孩子";
        }

        private static bool CanManageTask(SupabaseChildTaskRecord task)
        {
            return task != null
                && (task.status == "todo" || task.status == "revision_requested");
        }

        private static string GetStatusLabel(string status)
        {
            switch (status)
            {
                case "todo": return "待執行";
                case "revision_requested": return "需要修改";
                case "pending": return "待審核";
                case "completed": return "已完成";
                case "cancelled": return "已取消";
                default: return string.IsNullOrWhiteSpace(status) ? "未設定" : status;
            }
        }

        private static int FindCategoryIndex(string category)
        {
            for (int index = 0; index < CategoryValues.Length; index += 1)
            {
                if (CategoryValues[index] == category) return index;
            }
            return 0;
        }

        private static string TrimTime(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            string trimmed = value.Trim();
            return trimmed.Length >= 5 ? trimmed.Substring(0, 5) : trimmed;
        }

        private static string EmptyToNull(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static bool AreTimesValid(string startTime, string endTime)
        {
            if (string.IsNullOrWhiteSpace(startTime) || string.IsNullOrWhiteSpace(endTime))
            {
                return true;
            }
            TimeSpan start;
            TimeSpan end;
            return TimeSpan.TryParse(startTime, CultureInfo.InvariantCulture, out start)
                && TimeSpan.TryParse(endTime, CultureInfo.InvariantCulture, out end)
                && end > start;
        }

        private InputField CreateSmallInput(
            Transform parent,
            string placeholder,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            return HabitHeroUiFactory.CreateInput(
                parent,
                font,
                placeholder,
                false,
                anchorMin,
                anchorMax);
        }

        private void CreateLabel(
            Transform parent,
            string label,
            float minY,
            float maxY,
            float minX,
            float maxX)
        {
            HabitHeroUiFactory.CreateText(
                parent,
                font,
                label,
                14,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(minX, minY),
                new Vector2(maxX, maxY));
        }

        private Toggle CreateOptionToggle(
            Transform parent,
            string label,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            Toggle toggle = HabitHeroUiFactory.CreateToggle(parent, font, anchorMin, anchorMax);
            Text toggleText = toggle.GetComponentInChildren<Text>();
            if (toggleText != null) toggleText.text = label;
            return toggle;
        }

        private GameObject CreateVerticalList(
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
            layout.spacing = 5f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }
    }
}
