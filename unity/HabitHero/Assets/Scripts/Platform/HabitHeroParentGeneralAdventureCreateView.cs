using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentGeneralAdventureCreateView
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
        private InputField nameInput;
        private InputField descriptionInput;
        private InputField pointsInput;
        private InputField durationInput;
        private InputField dueOnInput;
        private InputField startTimeInput;
        private InputField endTimeInput;
        private Button categoryButton;
        private Toggle quickReportToggle;
        private Toggle reflectionReportToggle;
        private Toggle requiresTimerToggle;
        private Toggle requiresReviewToggle;
        private Text selectedChildText;
        private Text statusText;
        private Text categoryText;
        private Button createButton;
        private SupabaseParentHomeSnapshot snapshot;
        private int categoryIndex;
        private Func<
            SupabaseParentGeneralAdventureCreateInput,
            Task<SupabaseParentAdventureMutationResult>> createAdventure;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClosed;

        public HabitHeroParentGeneralAdventureCreateView(
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
            Func<
                SupabaseParentGeneralAdventureCreateInput,
                Task<SupabaseParentAdventureMutationResult>> createAdventure,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (createAdventure == null) throw new ArgumentNullException("createAdventure");

            Dispose();
            this.snapshot = snapshot;
            this.createAdventure = createAdventure;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;
            selectedChildIds.Clear();
            categoryIndex = 0;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentGeneralAdventurePanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentGeneralAdventureCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.06f, 0.02f);
            cardRect.anchorMax = new Vector2(0.94f, 0.98f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "建立一般冒險",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.92f),
                new Vector2(0.92f, 0.98f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "冒險會透過同一個 Supabase 家庭資料同步給選取的孩子。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.87f),
                new Vector2(0.92f, 0.92f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "指定孩子（可複選）",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.81f),
                new Vector2(0.92f, 0.86f));

            GameObject childList = CreateVerticalList(
                card.transform,
                "ParentGeneralAdventureChildList",
                new Vector2(0.08f, 0.7f),
                new Vector2(0.92f, 0.81f));
            int childIndex = 0;
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child == null || string.IsNullOrWhiteSpace(child.id)
                    || childIndex >= 4) continue;
                Toggle childToggle = CreateOptionToggle(
                    childList.transform,
                    string.IsNullOrWhiteSpace(child.display_name)
                        ? "孩子"
                        : child.display_name,
                    "GeneralAdventureChildToggle");
                childToggle.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 32f);
                string childId = child.id;
                childToggle.isOn = childIndex == 0;
                if (childToggle.isOn) selectedChildIds.Add(childId);
                childToggle.onValueChanged.AddListener(isOn =>
                {
                    if (isOn) selectedChildIds.Add(childId);
                    else selectedChildIds.Remove(childId);
                    RefreshSelectedChildText();
                });
                childIndex += 1;
            }
            if (childIndex == 0)
            {
                HabitHeroUiFactory.CreateText(
                    childList.transform,
                    font,
                    "目前沒有可指定的孩子。",
                    16,
                    TextAnchor.MiddleCenter,
                    new Color(1f, 0.65f, 0.65f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }

            selectedChildText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                14,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.66f),
                new Vector2(0.92f, 0.7f));
            RefreshSelectedChildText();

            CreateLabel(card.transform, "冒險名稱", 0.61f, 0.66f);
            nameInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：閱讀一個章節",
                false,
                new Vector2(0.08f, 0.55f),
                new Vector2(0.92f, 0.61f));
            nameInput.contentType = InputField.ContentType.Standard;
            nameInput.lineType = InputField.LineType.SingleLine;

            CreateLabel(card.transform, "冒險說明（選填）", 0.51f, 0.55f);
            descriptionInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "告訴孩子這次冒險要完成什麼",
                false,
                new Vector2(0.08f, 0.43f),
                new Vector2(0.92f, 0.51f));
            descriptionInput.contentType = InputField.ContentType.Standard;
            descriptionInput.lineType = InputField.LineType.MultiLineNewline;

            CreateLabel(card.transform, "點數", 0.38f, 0.43f, 0.08f, 0.32f);
            pointsInput = CreateSmallInput(
                card.transform,
                "例如：20",
                new Vector2(0.08f, 0.32f),
                new Vector2(0.32f, 0.38f));
            pointsInput.contentType = InputField.ContentType.IntegerNumber;
            pointsInput.text = "10";

            CreateLabel(card.transform, "時間分鐘（選填）", 0.38f, 0.43f, 0.36f, 0.6f);
            durationInput = CreateSmallInput(
                card.transform,
                "例如：25",
                new Vector2(0.36f, 0.32f),
                new Vector2(0.6f, 0.38f));
            durationInput.contentType = InputField.ContentType.IntegerNumber;

            CreateLabel(card.transform, "分類", 0.38f, 0.43f, 0.64f, 0.92f);
            categoryButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                string.Empty,
                new Vector2(0.64f, 0.32f),
                new Vector2(0.92f, 0.38f));
            categoryText = categoryButton.GetComponentInChildren<Text>();
            RefreshCategoryText();
            categoryButton.onClick.AddListener(CycleCategory);

            CreateLabel(card.transform, "截止日期／開始／結束（選填）", 0.28f, 0.32f);
            dueOnInput = CreateSmallInput(
                card.transform,
                "2026-09-08",
                new Vector2(0.08f, 0.22f),
                new Vector2(0.36f, 0.28f));
            startTimeInput = CreateSmallInput(
                card.transform,
                "18:00",
                new Vector2(0.38f, 0.22f),
                new Vector2(0.64f, 0.28f));
            endTimeInput = CreateSmallInput(
                card.transform,
                "19:00",
                new Vector2(0.66f, 0.22f),
                new Vector2(0.92f, 0.28f));
            dueOnInput.contentType = InputField.ContentType.Standard;
            startTimeInput.contentType = InputField.ContentType.Standard;
            endTimeInput.contentType = InputField.ContentType.Standard;

            quickReportToggle = CreateOptionToggle(
                card.transform,
                "快速回報",
                "GeneralAdventureQuickReportToggle",
                new Vector2(0.08f, 0.15f),
                new Vector2(0.28f, 0.21f));
            reflectionReportToggle = CreateOptionToggle(
                card.transform,
                "心得回報",
                "GeneralAdventureReflectionToggle",
                new Vector2(0.29f, 0.15f),
                new Vector2(0.51f, 0.21f));
            quickReportToggle.isOn = true;
            reflectionReportToggle.isOn = false;
            quickReportToggle.onValueChanged.AddListener(isOn =>
            {
                if (isOn) reflectionReportToggle.isOn = false;
                if (!quickReportToggle.isOn && !reflectionReportToggle.isOn)
                {
                    quickReportToggle.isOn = true;
                }
            });
            reflectionReportToggle.onValueChanged.AddListener(isOn =>
            {
                if (isOn) quickReportToggle.isOn = false;
                if (!quickReportToggle.isOn && !reflectionReportToggle.isOn)
                {
                    reflectionReportToggle.isOn = true;
                }
            });
            requiresTimerToggle = CreateOptionToggle(
                card.transform,
                "需要計時",
                "GeneralAdventureTimerToggle",
                new Vector2(0.53f, 0.15f),
                new Vector2(0.72f, 0.21f));
            requiresReviewToggle = CreateOptionToggle(
                card.transform,
                "需要家長審核",
                "GeneralAdventureReviewToggle",
                new Vector2(0.74f, 0.15f),
                new Vector2(0.92f, 0.21f));

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "建立後會重新整理家庭資料。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.1f),
                new Vector2(0.92f, 0.14f));
            createButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "建立冒險",
                new Vector2(0.1f, 0.04f),
                new Vector2(0.43f, 0.095f));
            createButton.onClick.AddListener(HandleCreate);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "取消",
                new Vector2(0.57f, 0.04f),
                new Vector2(0.9f, 0.095f));
            closeButton.onClick.AddListener(Close);
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            createAdventure = null;
            applySnapshot = null;
            setParentStatus = null;
            onClosed = null;
            nameInput = null;
            descriptionInput = null;
            pointsInput = null;
            durationInput = null;
            dueOnInput = null;
            startTimeInput = null;
            endTimeInput = null;
            categoryButton = null;
            quickReportToggle = null;
            reflectionReportToggle = null;
            requiresTimerToggle = null;
            requiresReviewToggle = null;
            selectedChildText = null;
            statusText = null;
            categoryText = null;
            createButton = null;
            selectedChildIds.Clear();
        }

        private async void HandleCreate()
        {
            if (createAdventure == null) return;
            string name = nameInput == null ? string.Empty : nameInput.text.Trim();
            string description = descriptionInput == null
                ? string.Empty
                : descriptionInput.text.Trim();
            string pointsText = pointsInput == null ? string.Empty : pointsInput.text.Trim();
            string durationText = durationInput == null
                ? string.Empty
                : durationInput.text.Trim();
            if (selectedChildIds.Count == 0)
            {
                SetStatus("請至少選擇一位孩子。", true);
                return;
            }
            if (name.Length < 1 || name.Length > 120)
            {
                SetStatus("請輸入 1 到 120 個字元的冒險名稱。", true);
                return;
            }
            if (description.Length > 2000)
            {
                SetStatus("冒險說明不可超過 2000 個字元。", true);
                return;
            }

            int points;
            if (!int.TryParse(
                    pointsText,
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out points)
                || points < 0)
            {
                SetStatus("請輸入 0 或以上的整數點數。", true);
                return;
            }

            int duration;
            int? durationMinutes = null;
            if (!string.IsNullOrWhiteSpace(durationText))
            {
                if (!int.TryParse(
                        durationText,
                        NumberStyles.Integer,
                        CultureInfo.InvariantCulture,
                        out duration)
                    || duration < 1
                    || duration > 1440)
                {
                    SetStatus("時間分鐘必須介於 1 到 1440。", true);
                    return;
                }

                durationMinutes = duration;
            }
            if (requiresTimerToggle != null && requiresTimerToggle.isOn
                && !durationMinutes.HasValue)
            {
                SetStatus("需要計時時，請先輸入時間分鐘。", true);
                return;
            }

            if (createButton != null) createButton.interactable = false;
            SetStatus("正在建立一般冒險…", false);
            try
            {
                SupabaseParentAdventureMutationResult result = await createAdventure(
                    new SupabaseParentGeneralAdventureCreateInput
                    {
                        childProfileIds = new List<string>(selectedChildIds).ToArray(),
                        name = name,
                        description = EmptyToNull(description),
                        points = points,
                        icon = "Target",
                        category = CategoryValues[categoryIndex],
                        durationMinutes = durationMinutes,
                        dueOn = EmptyToNull(dueOnInput == null ? null : dueOnInput.text),
                        startTime = EmptyToNull(startTimeInput == null ? null : startTimeInput.text),
                        endTime = EmptyToNull(endTimeInput == null ? null : endTimeInput.text),
                        reportMode = reflectionReportToggle != null
                            && reflectionReportToggle.isOn
                            ? "reflection"
                            : "quick",
                        requiresTimer = requiresTimerToggle != null && requiresTimerToggle.isOn,
                        requiresReviewBeforeNextTask = requiresReviewToggle != null
                            && requiresReviewToggle.isOn,
                    });
                if (result == null || result.TaskIds == null || result.TaskIds.Length == 0)
                {
                    SetStatus("建立冒險回應無效，請稍後再試。", true);
                    if (createButton != null) createButton.interactable = true;
                    return;
                }

                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                string message = string.IsNullOrWhiteSpace(result.RefreshError)
                    ? "一般冒險已建立，孩子登入後即可看到。"
                    : "一般冒險已建立；最新家庭資料稍後會自動更新。";
                Close();
                if (setParentStatus != null) setParentStatus(message, false);
            }
            catch (Exception exception)
            {
                SetStatus("建立冒險失敗：" + exception.Message, true);
                if (createButton != null) createButton.interactable = true;
            }
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

        private void RefreshSelectedChildText()
        {
            if (selectedChildText == null) return;
            selectedChildText.text = selectedChildIds.Count == 0
                ? "尚未選擇孩子"
                : "已選擇 " + selectedChildIds.Count + " 位孩子";
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
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

        private static string EmptyToNull(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
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
            input.lineType = InputField.LineType.SingleLine;
            return input;
        }

        private void CreateLabel(
            Transform parent,
            string label,
            float yMin,
            float yMax,
            float xMin = 0.08f,
            float xMax = 0.92f)
        {
            HabitHeroUiFactory.CreateText(
                parent,
                font,
                label,
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(xMin, yMin),
                new Vector2(xMax, yMax));
        }

        private Toggle CreateOptionToggle(
            Transform parent,
            string label,
            string objectName,
            Vector2? anchorMin = null,
            Vector2? anchorMax = null)
        {
            GameObject toggleObject = new GameObject(
                objectName,
                typeof(RectTransform),
                typeof(Toggle));
            toggleObject.transform.SetParent(parent, false);
            RectTransform toggleRect = toggleObject.GetComponent<RectTransform>();
            toggleRect.anchorMin = anchorMin ?? Vector2.zero;
            toggleRect.anchorMax = anchorMax ?? Vector2.one;
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
            backgroundRect.sizeDelta = new Vector2(28f, 0f);
            backgroundRect.anchoredPosition = new Vector2(14f, 0f);
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
                15,
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
    }
}
