using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentTaskCreateView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private InputField nameInput;
        private InputField pointsInput;
        private InputField durationInput;
        private Toggle dailyToggle;
        private Text selectedChildText;
        private Text statusText;
        private Button createButton;
        private string selectedChildId;
        private SupabaseParentHomeSnapshot snapshot;
        private Func<
            SupabaseParentTaskCreateInput,
            Task<SupabaseParentTaskMutationResult>> createTask;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClosed;

        public HabitHeroParentTaskCreateView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<
                SupabaseParentTaskCreateInput,
                Task<SupabaseParentTaskMutationResult>> createTask,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (createTask == null) throw new ArgumentNullException("createTask");

            Dispose();
            this.snapshot = snapshot;
            this.createTask = createTask;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentTaskCreatePanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentTaskCreateCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.04f);
            cardRect.anchorMax = new Vector2(0.92f, 0.96f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "建立孩子任務",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.9f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "任務會直接寫入同一個 Supabase 家庭資料，孩子登入後即可看到。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.9f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "指定孩子",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.78f),
                new Vector2(0.92f, 0.83f));

            SupabaseChildProfileRecord[] children =
                snapshot.children ?? new SupabaseChildProfileRecord[0];
            GameObject childList = CreateVerticalList(
                card.transform,
                "ParentTaskChildList",
                new Vector2(0.08f, 0.64f),
                new Vector2(0.92f, 0.78f));
            int visibleChildren = 0;
            foreach (SupabaseChildProfileRecord child in children)
            {
                if (child == null || string.IsNullOrWhiteSpace(child.id)
                    || visibleChildren >= 4) continue;
                if (string.IsNullOrWhiteSpace(selectedChildId))
                {
                    selectedChildId = child.id;
                }

                Button childButton = HabitHeroUiFactory.CreateButton(
                    childList.transform,
                    font,
                    child.display_name,
                    Vector2.zero,
                    Vector2.one);
                childButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 42f);
                childButton.onClick.AddListener(() => SelectChild(child));
                visibleChildren += 1;
            }
            if (visibleChildren == 0)
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
                "目前指定：" + GetChildName(selectedChildId),
                16,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.59f),
                new Vector2(0.92f, 0.64f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "任務名稱",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.54f),
                new Vector2(0.92f, 0.59f));
            nameInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：整理書包",
                false,
                new Vector2(0.08f, 0.47f),
                new Vector2(0.92f, 0.54f));
            nameInput.contentType = InputField.ContentType.Standard;
            nameInput.lineType = InputField.LineType.SingleLine;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "點數",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.42f),
                new Vector2(0.47f, 0.47f));
            pointsInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：10",
                false,
                new Vector2(0.08f, 0.35f),
                new Vector2(0.47f, 0.42f));
            pointsInput.contentType = InputField.ContentType.IntegerNumber;
            pointsInput.lineType = InputField.LineType.SingleLine;
            pointsInput.text = "5";

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "計時分鐘（選填）",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.53f, 0.42f),
                new Vector2(0.92f, 0.47f));
            durationInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：20",
                false,
                new Vector2(0.53f, 0.35f),
                new Vector2(0.92f, 0.42f));
            durationInput.contentType = InputField.ContentType.IntegerNumber;
            durationInput.lineType = InputField.LineType.SingleLine;

            dailyToggle = CreateOptionToggle(
                card.transform,
                "每天顯示在孩子的今日任務",
                new Vector2(0.08f, 0.27f),
                new Vector2(0.92f, 0.34f));
            dailyToggle.isOn = true;
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "建立後會重新整理家庭資料。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.2f),
                new Vector2(0.92f, 0.26f));
            createButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "建立任務",
                new Vector2(0.1f, 0.1f),
                new Vector2(0.9f, 0.18f));
            createButton.onClick.AddListener(HandleCreate);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "取消",
                new Vector2(0.35f, 0.03f),
                new Vector2(0.65f, 0.09f));
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
            createTask = null;
            applySnapshot = null;
            setParentStatus = null;
            onClosed = null;
            nameInput = null;
            pointsInput = null;
            durationInput = null;
            dailyToggle = null;
            selectedChildText = null;
            statusText = null;
            createButton = null;
            selectedChildId = null;
        }

        private void SelectChild(SupabaseChildProfileRecord child)
        {
            if (child == null || string.IsNullOrWhiteSpace(child.id)) return;
            selectedChildId = child.id;
            if (selectedChildText != null)
            {
                selectedChildText.text = "目前指定：" + GetChildName(selectedChildId);
            }
            SetStatus("已選擇 " + GetChildName(selectedChildId) + "。", false);
        }

        private async void HandleCreate()
        {
            if (createTask == null) return;
            string name = nameInput == null ? string.Empty : nameInput.text.Trim();
            string pointsText = pointsInput == null ? string.Empty : pointsInput.text.Trim();
            string durationText = durationInput == null ? string.Empty : durationInput.text.Trim();
            int points;
            if (string.IsNullOrWhiteSpace(selectedChildId))
            {
                SetStatus("請先選擇孩子。", true);
                return;
            }
            if (name.Length < 1 || name.Length > 120)
            {
                SetStatus("請輸入 1 到 120 個字元的任務名稱。", true);
                return;
            }
            if (!int.TryParse(
                    pointsText,
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out points)
                || points <= 0)
            {
                SetStatus("請輸入大於 0 的整數點數。", true);
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
                    || duration <= 0
                    || duration > 1440)
                {
                    SetStatus("計時分鐘必須介於 1 到 1440。", true);
                    return;
                }

                durationMinutes = duration;
            }

            if (createButton != null) createButton.interactable = false;
            SetStatus("正在建立任務…", false);
            try
            {
                SupabaseParentTaskMutationResult result = await createTask(
                    new SupabaseParentTaskCreateInput
                    {
                        childProfileId = selectedChildId,
                        name = name,
                        points = points,
                        icon = "Star",
                        durationMinutes = durationMinutes,
                        isDaily = dailyToggle != null && dailyToggle.isOn,
                        category = "life_habit",
                        requiresReviewBeforeNextTask = false,
                    });
                if (result == null || !result.Created)
                {
                    SetStatus("建立任務回應無效，請稍後再試。", true);
                    if (createButton != null) createButton.interactable = true;
                    return;
                }

                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                string refreshMessage = string.IsNullOrWhiteSpace(result.RefreshError)
                    ? "任務已建立，孩子登入後即可看到。"
                    : "任務已建立；最新家庭資料稍後會自動更新。";
                Close();
                if (setParentStatus != null) setParentStatus(refreshMessage, false);
            }
            catch (Exception exception)
            {
                SetStatus("建立任務失敗：" + exception.Message, true);
                if (createButton != null) createButton.interactable = true;
            }
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
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
            layout.spacing = 6f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }

        private Toggle CreateOptionToggle(
            Transform parent,
            string label,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject toggleObject = new GameObject(
                "TaskDailyToggle",
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
            backgroundRect.sizeDelta = new Vector2(34f, 0f);
            backgroundRect.anchoredPosition = new Vector2(17f, 0f);
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
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0f),
                new Vector2(1f, 1f));

            Toggle toggle = toggleObject.GetComponent<Toggle>();
            toggle.targetGraphic = background;
            toggle.graphic = check;
            toggle.isOn = false;
            return toggle;
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
    }
}
