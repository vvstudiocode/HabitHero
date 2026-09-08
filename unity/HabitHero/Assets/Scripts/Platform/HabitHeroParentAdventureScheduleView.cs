using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentAdventureScheduleView
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
        private readonly HashSet<string> selectedChildIds =
            new HashSet<string>(StringComparer.Ordinal);
        private GameObject panel;
        private GameObject scheduleListObject;
        private GameObject childListObject;
        private Text formTitle;
        private Text selectedChildText;
        private Text categoryText;
        private Text statusText;
        private InputField nameInput;
        private InputField descriptionInput;
        private InputField pointsInput;
        private InputField durationInput;
        private InputField startTimeInput;
        private InputField endTimeInput;
        private InputField weekdaysInput;
        private InputField activeFromInput;
        private InputField activeUntilInput;
        private Toggle requiresTimerToggle;
        private Toggle requiresReviewToggle;
        private Button saveButton;
        private Button disableButton;
        private Text saveButtonLabel;
        private Text disableButtonLabel;
        private SupabaseParentHomeSnapshot snapshot;
        private SupabaseParentAdventureScheduleRecord[] schedules =
            new SupabaseParentAdventureScheduleRecord[0];
        private SupabaseParentAdventureScheduleRecord activeSchedule;
        private int categoryIndex;
        private bool disableConfirm;
        private string pendingScheduleId;
        private Func<Task<SupabaseParentAdventureScheduleRecord[]>> loadSchedules;
        private Func<
            SupabaseParentAdventureScheduleCreateInput,
            Task<string[]>> createSchedule;
        private Func<
            string,
            SupabaseParentAdventureScheduleUpdateInput,
            Task<SupabaseParentAdventureScheduleRecord>> updateSchedule;
        private Func<
            string,
            Task<SupabaseParentAdventureScheduleRecord>> disableSchedule;
        private Action<string, bool> setParentStatus;
        private Action onClosed;

        public HabitHeroParentAdventureScheduleView(
            Transform canvasTransform,
            Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<Task<SupabaseParentAdventureScheduleRecord[]>> loadSchedules,
            Func<SupabaseParentAdventureScheduleCreateInput, Task<string[]>> createSchedule,
            Func<
                string,
                SupabaseParentAdventureScheduleUpdateInput,
                Task<SupabaseParentAdventureScheduleRecord>> updateSchedule,
            Func<string, Task<SupabaseParentAdventureScheduleRecord>> disableSchedule,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (loadSchedules == null) throw new ArgumentNullException("loadSchedules");
            if (createSchedule == null) throw new ArgumentNullException("createSchedule");
            if (updateSchedule == null) throw new ArgumentNullException("updateSchedule");
            if (disableSchedule == null) throw new ArgumentNullException("disableSchedule");

            Dispose();
            this.snapshot = snapshot;
            this.loadSchedules = loadSchedules;
            this.createSchedule = createSchedule;
            this.updateSchedule = updateSchedule;
            this.disableSchedule = disableSchedule;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentAdventureSchedulePanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentAdventureScheduleCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.04f, 0.02f);
            cardRect.anchorMax = new Vector2(0.96f, 0.98f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "每日冒險排程",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.06f, 0.94f),
                new Vector2(0.94f, 0.99f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "讓固定習慣在選定的星期自動出現在孩子的今日冒險。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.06f, 0.9f),
                new Vector2(0.94f, 0.94f));

            scheduleListObject = CreateVerticalList(
                card.transform,
                "ParentAdventureScheduleList",
                new Vector2(0.06f, 0.72f),
                new Vector2(0.94f, 0.88f));
            Button newButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "＋新增排程",
                new Vector2(0.68f, 0.88f),
                new Vector2(0.94f, 0.93f));
            newButton.onClick.AddListener(BeginCreate);

            formTitle = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "新增每日冒險排程",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.06f, 0.675f),
                new Vector2(0.66f, 0.72f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "指定孩子",
                14,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.06f, 0.635f),
                new Vector2(0.3f, 0.675f));
            childListObject = CreateVerticalList(
                card.transform,
                "ParentAdventureScheduleChildList",
                new Vector2(0.3f, 0.625f),
                new Vector2(0.94f, 0.675f));
            selectedChildText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                13,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.06f, 0.6f),
                new Vector2(0.94f, 0.63f));

            nameInput = CreateSmallInput(
                card.transform,
                "冒險名稱，例如：睡前閱讀",
                new Vector2(0.06f, 0.55f),
                new Vector2(0.94f, 0.6f));
            descriptionInput = CreateSmallInput(
                card.transform,
                "說明（選填）",
                new Vector2(0.06f, 0.5f),
                new Vector2(0.94f, 0.55f));
            descriptionInput.lineType = InputField.LineType.MultiLineNewline;

            CreateLabel(card.transform, "點數", 0.46f, 0.5f, 0.06f, 0.18f);
            pointsInput = CreateSmallInput(
                card.transform,
                "20",
                new Vector2(0.18f, 0.46f),
                new Vector2(0.3f, 0.5f));
            CreateLabel(card.transform, "分鐘", 0.46f, 0.5f, 0.32f, 0.43f);
            durationInput = CreateSmallInput(
                card.transform,
                "25",
                new Vector2(0.43f, 0.46f),
                new Vector2(0.55f, 0.5f));
            categoryText = CreateCategoryButton(
                card.transform,
                new Vector2(0.58f, 0.46f),
                new Vector2(0.94f, 0.5f));

            CreateLabel(card.transform, "開始", 0.41f, 0.45f, 0.06f, 0.14f);
            startTimeInput = CreateSmallInput(
                card.transform,
                "18:00",
                new Vector2(0.14f, 0.41f),
                new Vector2(0.36f, 0.45f));
            CreateLabel(card.transform, "結束", 0.41f, 0.45f, 0.39f, 0.47f);
            endTimeInput = CreateSmallInput(
                card.transform,
                "19:00",
                new Vector2(0.47f, 0.41f),
                new Vector2(0.69f, 0.45f));
            weekdaysInput = CreateSmallInput(
                card.transform,
                "星期 1,2,3,4,5",
                new Vector2(0.72f, 0.41f),
                new Vector2(0.94f, 0.45f));

            CreateLabel(card.transform, "開始日", 0.36f, 0.4f, 0.06f, 0.14f);
            activeFromInput = CreateSmallInput(
                card.transform,
                "2026-09-08",
                new Vector2(0.14f, 0.36f),
                new Vector2(0.42f, 0.4f));
            CreateLabel(card.transform, "結束日", 0.36f, 0.4f, 0.45f, 0.53f);
            activeUntilInput = CreateSmallInput(
                card.transform,
                "選填",
                new Vector2(0.53f, 0.36f),
                new Vector2(0.8f, 0.4f));
            Toggle timezoneToggle = CreateOptionToggle(
                card.transform,
                "台北時區",
                "AdventureScheduleTimezoneToggle",
                new Vector2(0.82f, 0.36f),
                new Vector2(0.94f, 0.4f));
            timezoneToggle.isOn = true;
            timezoneToggle.interactable = false;

            requiresTimerToggle = CreateOptionToggle(
                card.transform,
                "需要計時",
                "AdventureScheduleTimerToggle",
                new Vector2(0.06f, 0.31f),
                new Vector2(0.3f, 0.35f));
            requiresReviewToggle = CreateOptionToggle(
                card.transform,
                "需要家長審核",
                "AdventureScheduleReviewToggle",
                new Vector2(0.32f, 0.31f),
                new Vector2(0.62f, 0.35f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "星期：1=一、7=日；可輸入 1,2,3,4,5",
                13,
                TextAnchor.MiddleRight,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.62f, 0.31f),
                new Vector2(0.94f, 0.35f));

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "選取排程可編輯；停用需要再次確認。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.06f, 0.255f),
                new Vector2(0.94f, 0.305f));
            saveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "建立排程",
                new Vector2(0.06f, 0.19f),
                new Vector2(0.37f, 0.245f));
            saveButtonLabel = saveButton.GetComponentInChildren<Text>();
            saveButton.onClick.AddListener(HandleSave);
            disableButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "停用目前排程",
                new Vector2(0.4f, 0.19f),
                new Vector2(0.69f, 0.245f));
            disableButtonLabel = disableButton.GetComponentInChildren<Text>();
            disableButton.onClick.AddListener(HandleDisable);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.72f, 0.19f),
                new Vector2(0.94f, 0.245f));
            closeButton.onClick.AddListener(Close);

            BeginCreate();
            RefreshSchedulesAsync();
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            schedules = new SupabaseParentAdventureScheduleRecord[0];
            activeSchedule = null;
            loadSchedules = null;
            createSchedule = null;
            updateSchedule = null;
            disableSchedule = null;
            setParentStatus = null;
            onClosed = null;
            scheduleListObject = null;
            childListObject = null;
            formTitle = null;
            selectedChildText = null;
            categoryText = null;
            statusText = null;
            nameInput = null;
            descriptionInput = null;
            pointsInput = null;
            durationInput = null;
            startTimeInput = null;
            endTimeInput = null;
            weekdaysInput = null;
            activeFromInput = null;
            activeUntilInput = null;
            requiresTimerToggle = null;
            requiresReviewToggle = null;
            saveButton = null;
            disableButton = null;
            saveButtonLabel = null;
            disableButtonLabel = null;
            selectedChildIds.Clear();
            disableConfirm = false;
            pendingScheduleId = null;
        }

        public bool OpenScheduleNotification(string scheduleId)
        {
            if (panel == null || string.IsNullOrWhiteSpace(scheduleId)) return false;
            pendingScheduleId = scheduleId.Trim();
            return TryOpenPendingSchedule() || loadSchedules != null;
        }

        private async void RefreshSchedulesAsync()
        {
            if (loadSchedules == null) return;
            SetStatus("正在載入每日冒險排程…", false);
            try
            {
                SupabaseParentAdventureScheduleRecord[] loaded =
                    await loadSchedules();
                if (panel == null) return;
                schedules = loaded ?? new SupabaseParentAdventureScheduleRecord[0];
                RenderScheduleList();
                if (!TryOpenPendingSchedule())
                {
                    if (!string.IsNullOrWhiteSpace(pendingScheduleId))
                    {
                        pendingScheduleId = null;
                        SetStatus("通知中的每日排程目前不存在。", true);
                    }
                    else
                    {
                        SetStatus("選取排程可編輯；停用需要再次確認。", false);
                    }
                }
            }
            catch (Exception exception)
            {
                SetStatus("載入每日冒險排程失敗：" + exception.Message, true);
            }
        }

        private bool TryOpenPendingSchedule()
        {
            if (string.IsNullOrWhiteSpace(pendingScheduleId)) return false;
            foreach (SupabaseParentAdventureScheduleRecord schedule in schedules)
            {
                if (schedule == null || schedule.id != pendingScheduleId) continue;
                string scheduleName = schedule.name ?? "每日冒險";
                pendingScheduleId = null;
                SelectSchedule(schedule);
                SetStatus("已從通知開啟「" + scheduleName + "」排程。", false);
                return true;
            }

            return false;
        }

        private void RenderScheduleList()
        {
            if (scheduleListObject == null) return;
            foreach (Transform child in scheduleListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleCount = 0;
            foreach (SupabaseParentAdventureScheduleRecord schedule in schedules)
            {
                if (schedule == null || string.IsNullOrWhiteSpace(schedule.id)
                    || visibleCount >= 5) continue;
                string state = schedule.is_active ? string.Empty : "（已停用）";
                string label = GetChildName(schedule.child_profile_id) + "｜"
                    + schedule.name + "｜星期 " + FormatWeekdays(schedule.weekdays)
                    + state;
                Button scheduleButton = HabitHeroUiFactory.CreateButton(
                    scheduleListObject.transform,
                    font,
                    label,
                    Vector2.zero,
                    Vector2.one);
                scheduleButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 32f);
                scheduleButton.onClick.AddListener(() => SelectSchedule(schedule));
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    scheduleListObject.transform,
                    font,
                    "目前沒有每日排程，點右上角新增。",
                    14,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void BeginCreate()
        {
            activeSchedule = null;
            selectedChildIds.Clear();
            pendingScheduleId = null;
            string firstChildId = FindFirstChildId();
            if (!string.IsNullOrWhiteSpace(firstChildId)) selectedChildIds.Add(firstChildId);
            categoryIndex = 0;
            disableConfirm = false;
            if (formTitle != null) formTitle.text = "新增每日冒險排程";
            if (nameInput != null) nameInput.text = string.Empty;
            if (descriptionInput != null) descriptionInput.text = string.Empty;
            if (pointsInput != null) pointsInput.text = "10";
            if (durationInput != null) durationInput.text = string.Empty;
            if (startTimeInput != null) startTimeInput.text = string.Empty;
            if (endTimeInput != null) endTimeInput.text = string.Empty;
            if (weekdaysInput != null) weekdaysInput.text = "1,2,3,4,5";
            if (activeFromInput != null)
            {
                activeFromInput.text = DateTime.Now.ToString(
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture);
            }
            if (activeUntilInput != null) activeUntilInput.text = string.Empty;
            if (requiresTimerToggle != null) requiresTimerToggle.isOn = false;
            if (requiresReviewToggle != null) requiresReviewToggle.isOn = false;
            if (saveButtonLabel != null) saveButtonLabel.text = "建立排程";
            if (disableButton != null) disableButton.gameObject.SetActive(false);
            RefreshCategoryText();
            RenderChildList();
            RefreshSelectedChildText();
            SetStatus("請設定孩子、星期與執行時段。", false);
        }

        private void SelectSchedule(SupabaseParentAdventureScheduleRecord schedule)
        {
            if (schedule == null) return;
            activeSchedule = schedule;
            selectedChildIds.Clear();
            if (!string.IsNullOrWhiteSpace(schedule.child_profile_id))
            {
                selectedChildIds.Add(schedule.child_profile_id);
            }

            categoryIndex = FindCategoryIndex(schedule.category);
            disableConfirm = false;
            if (formTitle != null) formTitle.text = "編輯每日冒險排程";
            if (nameInput != null) nameInput.text = schedule.name ?? string.Empty;
            if (descriptionInput != null) descriptionInput.text = schedule.description ?? string.Empty;
            if (pointsInput != null) pointsInput.text = schedule.points.ToString(CultureInfo.InvariantCulture);
            if (durationInput != null)
            {
                durationInput.text = schedule.duration_minutes > 0
                    ? schedule.duration_minutes.ToString(CultureInfo.InvariantCulture)
                    : string.Empty;
            }
            if (startTimeInput != null) startTimeInput.text = TrimTime(schedule.start_time);
            if (endTimeInput != null) endTimeInput.text = TrimTime(schedule.end_time);
            if (weekdaysInput != null) weekdaysInput.text = FormatWeekdays(schedule.weekdays);
            if (activeFromInput != null) activeFromInput.text = schedule.active_from ?? string.Empty;
            if (activeUntilInput != null) activeUntilInput.text = schedule.active_until ?? string.Empty;
            if (requiresTimerToggle != null) requiresTimerToggle.isOn = schedule.requires_timer;
            if (requiresReviewToggle != null) requiresReviewToggle.isOn = schedule.requires_review_before_next_task;
            if (saveButtonLabel != null) saveButtonLabel.text = "儲存修改";
            if (disableButton != null) disableButton.gameObject.SetActive(true);
            if (disableButton != null) disableButton.interactable = schedule.is_active;
            if (disableButtonLabel != null) disableButtonLabel.text = "停用目前排程";
            RefreshCategoryText();
            RenderChildList();
            RefreshSelectedChildText();
            SetStatus("正在編輯「" + schedule.name + "」。", false);
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
                    || visibleCount >= 4) continue;
                Toggle childToggle = CreateOptionToggle(
                    childListObject.transform,
                    string.IsNullOrWhiteSpace(child.display_name)
                        ? "孩子"
                        : child.display_name,
                    "AdventureScheduleChildToggle",
                    Vector2.zero,
                    Vector2.one);
                childToggle.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 24f);
                childToggle.isOn = selectedChildIds.Contains(child.id);
                bool isEditingOtherChild = activeSchedule != null
                    && child.id != activeSchedule.child_profile_id;
                childToggle.interactable = !isEditingOtherChild;
                string childId = child.id;
                childToggle.onValueChanged.AddListener(isOn =>
                {
                    if (isOn) selectedChildIds.Add(childId);
                    else selectedChildIds.Remove(childId);
                    RefreshSelectedChildText();
                });
                visibleCount += 1;
            }
        }

        private async void HandleSave()
        {
            if (createSchedule == null || updateSchedule == null) return;
            string name = nameInput == null ? string.Empty : nameInput.text.Trim();
            string description = descriptionInput == null
                ? string.Empty
                : descriptionInput.text.Trim();
            string pointsText = pointsInput == null ? string.Empty : pointsInput.text.Trim();
            string durationText = durationInput == null
                ? string.Empty
                : durationInput.text.Trim();
            if (activeSchedule == null && selectedChildIds.Count == 0)
            {
                SetStatus("請至少選擇一位孩子。", true);
                return;
            }
            if (name.Length < 1 || name.Length > 120)
            {
                SetStatus("請輸入 1 到 120 個字元的排程名稱。", true);
                return;
            }

            int points;
            if (!int.TryParse(pointsText, NumberStyles.Integer, CultureInfo.InvariantCulture, out points)
                || points < 0)
            {
                SetStatus("請輸入 0 或以上的整數點數。", true);
                return;
            }

            int durationMinutes = 0;
            if (!string.IsNullOrWhiteSpace(durationText)
                && (!int.TryParse(durationText, NumberStyles.Integer, CultureInfo.InvariantCulture, out durationMinutes)
                    || durationMinutes < 1
                    || durationMinutes > 1440))
            {
                SetStatus("分鐘必須介於 1 到 1440，或留空。", true);
                return;
            }
            if (requiresTimerToggle != null && requiresTimerToggle.isOn && durationMinutes == 0)
            {
                SetStatus("需要計時時，請先輸入分鐘。", true);
                return;
            }

            int[] weekdays;
            string weekdayError;
            if (!TryParseWeekdays(
                    weekdaysInput == null ? string.Empty : weekdaysInput.text,
                    out weekdays,
                    out weekdayError))
            {
                SetStatus(weekdayError, true);
                return;
            }
            string activeFrom = activeFromInput == null ? string.Empty : activeFromInput.text.Trim();
            if (string.IsNullOrWhiteSpace(activeFrom))
            {
                SetStatus("請輸入開始日期（YYYY-MM-DD）。", true);
                return;
            }

            string startTime = EmptyToNull(startTimeInput == null ? null : startTimeInput.text);
            string endTime = EmptyToNull(endTimeInput == null ? null : endTimeInput.text);
            string activeUntil = EmptyToNull(activeUntilInput == null ? null : activeUntilInput.text);
            if (saveButton != null) saveButton.interactable = false;
            SetStatus(activeSchedule == null ? "正在建立每日冒險排程…" : "正在儲存排程修改…", false);
            try
            {
                if (activeSchedule == null)
                {
                    string[] createdIds = await createSchedule(
                        new SupabaseParentAdventureScheduleCreateInput
                        {
                            childProfileIds = new List<string>(selectedChildIds).ToArray(),
                            name = name,
                            description = EmptyToNull(description),
                            points = points,
                            icon = "Target",
                            category = CategoryValues[categoryIndex],
                            durationMinutes = durationMinutes,
                            startTime = startTime,
                            endTime = endTime,
                            weekdays = weekdays,
                            timezone = "Asia/Taipei",
                            requiresTimer = requiresTimerToggle != null && requiresTimerToggle.isOn,
                            requiresReviewBeforeNextTask = requiresReviewToggle != null && requiresReviewToggle.isOn,
                            activeFrom = activeFrom,
                            activeUntil = activeUntil,
                        });
                    if (createdIds == null || createdIds.Length == 0)
                    {
                        SetStatus("建立排程回應無效，請稍後再試。", true);
                        if (saveButton != null) saveButton.interactable = true;
                        return;
                    }

                    await RefreshSchedulesWithoutStatusAsync();
                    SetStatus("每日冒險排程已建立。", false);
                }
                else
                {
                    SupabaseParentAdventureScheduleRecord updated = await updateSchedule(
                        activeSchedule.id,
                        new SupabaseParentAdventureScheduleUpdateInput
                        {
                            name = name,
                            description = EmptyToNull(description),
                            points = points,
                            icon = string.IsNullOrWhiteSpace(activeSchedule.icon)
                                ? "Target"
                                : activeSchedule.icon,
                            category = CategoryValues[categoryIndex],
                            durationMinutes = durationMinutes,
                            startTime = startTime,
                            endTime = endTime,
                            weekdays = weekdays,
                            timezone = "Asia/Taipei",
                            requiresTimer = requiresTimerToggle != null && requiresTimerToggle.isOn,
                            requiresReviewBeforeNextTask = requiresReviewToggle != null && requiresReviewToggle.isOn,
                            activeFrom = activeFrom,
                            activeUntil = activeUntil,
                            applyMode = "from_tomorrow",
                        });
                    activeSchedule = updated ?? activeSchedule;
                    await RefreshSchedulesWithoutStatusAsync();
                    SetStatus("每日冒險排程已更新，明日起套用新規則。", false);
                }
            }
            catch (Exception exception)
            {
                SetStatus("儲存每日冒險排程失敗：" + exception.Message, true);
            }
            finally
            {
                if (saveButton != null) saveButton.interactable = true;
            }
        }

        private async void HandleDisable()
        {
            if (activeSchedule == null || disableSchedule == null || !activeSchedule.is_active)
            {
                return;
            }
            if (!disableConfirm)
            {
                disableConfirm = true;
                if (disableButtonLabel != null) disableButtonLabel.text = "再次確認停用";
                SetStatus("再次點擊才會停用「" + activeSchedule.name + "」。", true);
                return;
            }

            if (disableButton != null) disableButton.interactable = false;
            SetStatus("正在停用每日冒險排程…", false);
            try
            {
                SupabaseParentAdventureScheduleRecord disabled =
                    await disableSchedule(activeSchedule.id);
                activeSchedule = disabled ?? activeSchedule;
                await RefreshSchedulesWithoutStatusAsync();
                if (disableButtonLabel != null) disableButtonLabel.text = "已停用";
                SetStatus("每日冒險排程已停用。", false);
            }
            catch (Exception exception)
            {
                SetStatus("停用每日冒險排程失敗：" + exception.Message, true);
                if (disableButton != null) disableButton.interactable = true;
            }
        }

        private async Task RefreshSchedulesWithoutStatusAsync()
        {
            if (loadSchedules == null) return;
            SupabaseParentAdventureScheduleRecord[] loaded = await loadSchedules();
            if (panel == null) return;
            schedules = loaded ?? new SupabaseParentAdventureScheduleRecord[0];
            RenderScheduleList();
        }

        private Text CreateCategoryButton(
            Transform parent,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                "分類",
                anchorMin,
                anchorMax);
            Text text = button.GetComponentInChildren<Text>();
            button.onClick.AddListener(CycleCategory);
            return text;
        }

        private void CycleCategory()
        {
            categoryIndex = (categoryIndex + 1) % CategoryValues.Length;
            RefreshCategoryText();
        }

        private void RefreshCategoryText()
        {
            if (categoryText != null) categoryText.text = CategoryLabels[categoryIndex];
        }

        private int FindCategoryIndex(string value)
        {
            for (int index = 0; index < CategoryValues.Length; index += 1)
            {
                if (CategoryValues[index] == value) return index;
            }

            return 0;
        }

        private void RefreshSelectedChildText()
        {
            if (selectedChildText == null) return;
            selectedChildText.text = selectedChildIds.Count == 0
                ? "尚未選擇孩子"
                : "已選擇 " + selectedChildIds.Count + " 位孩子";
        }

        private string FindFirstChildId()
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && !string.IsNullOrWhiteSpace(child.id)) return child.id;
            }

            return null;
        }

        private string GetChildName(string childProfileId)
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childProfileId)
                {
                    return string.IsNullOrWhiteSpace(child.display_name)
                        ? "孩子"
                        : child.display_name;
                }
            }

            return "孩子";
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
            else if (setParentStatus != null)
            {
                setParentStatus(message, isError);
            }
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
        }

        private InputField CreateSmallInput(
            Transform parent,
            string placeholder,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            InputField input = HabitHeroUiFactory.CreateInput(
                parent,
                font,
                placeholder,
                false,
                anchorMin,
                anchorMax);
            input.contentType = InputField.ContentType.Standard;
            input.lineType = InputField.LineType.SingleLine;
            return input;
        }

        private void CreateLabel(
            Transform parent,
            string label,
            float yMin,
            float yMax,
            float xMin,
            float xMax)
        {
            HabitHeroUiFactory.CreateText(
                parent,
                font,
                label,
                13,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(xMin, yMin),
                new Vector2(xMax, yMax));
        }

        private Toggle CreateOptionToggle(
            Transform parent,
            string label,
            string objectName,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject toggleObject = new GameObject(
                objectName,
                typeof(RectTransform),
                typeof(Toggle));
            toggleObject.transform.SetParent(parent, false);
            RectTransform toggleRect = toggleObject.GetComponent<RectTransform>();
            toggleRect.anchorMin = anchorMin;
            toggleRect.anchorMax = anchorMax;
            toggleRect.offsetMin = Vector2.zero;
            toggleRect.offsetMax = Vector2.zero;

            GameObject backgroundObject = new GameObject(
                "Background",
                typeof(RectTransform),
                typeof(Image));
            backgroundObject.transform.SetParent(toggleObject.transform, false);
            RectTransform backgroundRect = backgroundObject.GetComponent<RectTransform>();
            backgroundRect.anchorMin = new Vector2(0f, 0.2f);
            backgroundRect.anchorMax = new Vector2(0f, 0.8f);
            backgroundRect.sizeDelta = new Vector2(24f, 0f);
            backgroundRect.anchoredPosition = new Vector2(12f, 0f);
            Image background = backgroundObject.GetComponent<Image>();
            background.color = new Color(1f, 1f, 1f, 0.18f);

            GameObject checkObject = new GameObject(
                "Checkmark",
                typeof(RectTransform),
                typeof(Image));
            checkObject.transform.SetParent(backgroundObject.transform, false);
            RectTransform checkRect = checkObject.GetComponent<RectTransform>();
            checkRect.anchorMin = new Vector2(0.15f, 0.15f);
            checkRect.anchorMax = new Vector2(0.85f, 0.85f);
            checkRect.offsetMin = Vector2.zero;
            checkRect.offsetMax = Vector2.zero;
            Image check = checkObject.GetComponent<Image>();
            check.color = new Color(0.35f, 0.9f, 0.7f, 1f);

            HabitHeroUiFactory.CreateText(
                toggleObject.transform,
                font,
                label,
                13,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0f),
                new Vector2(1f, 1f));
            Toggle toggle = toggleObject.GetComponent<Toggle>();
            toggle.targetGraphic = background;
            toggle.graphic = check;
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
            layout.spacing = 2f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }

        private static bool TryParseWeekdays(
            string value,
            out int[] weekdays,
            out string error)
        {
            weekdays = new int[0];
            error = null;
            string[] parts = (value ?? string.Empty).Split(
                new[] { ',', '，', ' ' },
                StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 1 || parts.Length > 7)
            {
                error = "請輸入 1 到 7 個星期數字，例如 1,2,3,4,5。";
                return false;
            }

            HashSet<int> seen = new HashSet<int>();
            List<int> parsed = new List<int>();
            foreach (string part in parts)
            {
                int weekday;
                if (!int.TryParse(
                        part.Trim(),
                        NumberStyles.Integer,
                        CultureInfo.InvariantCulture,
                        out weekday)
                    || weekday < 1
                    || weekday > 7
                    || !seen.Add(weekday))
                {
                    error = "星期只能輸入不重複的 1 到 7。";
                    return false;
                }

                parsed.Add(weekday);
            }

            parsed.Sort();
            weekdays = parsed.ToArray();
            return true;
        }

        private static string FormatWeekdays(int[] weekdays)
        {
            if (weekdays == null || weekdays.Length == 0) return "";
            string result = string.Empty;
            for (int index = 0; index < weekdays.Length; index += 1)
            {
                if (index > 0) result += ",";
                result += weekdays[index].ToString(CultureInfo.InvariantCulture);
            }

            return result;
        }

        private static string TrimTime(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            return value.Length >= 5 ? value.Substring(0, 5) : value;
        }

        private static string EmptyToNull(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}
