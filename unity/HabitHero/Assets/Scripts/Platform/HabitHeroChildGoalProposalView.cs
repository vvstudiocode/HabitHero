using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildGoalProposalView
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
        private InputField nameInput;
        private InputField pointsInput;
        private InputField durationInput;
        private InputField dueTimeInput;
        private InputField endTimeInput;
        private Button categoryButton;
        private Button submitButton;
        private Text categoryText;
        private Text statusText;
        private SupabaseChildHomeSnapshot snapshot;
        private Func<
            SupabaseChildGoalProposalInput,
            Task<SupabaseChildGoalProposalResult>> proposeGoal;
        private Action<SupabaseChildHomeSnapshot> applySnapshot;
        private Action<string, bool> setStatus;
        private Action onClosed;
        private int categoryIndex;

        public HabitHeroChildGoalProposalView(
            Transform canvasTransform,
            Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildHomeSnapshot snapshot,
            Func<
                SupabaseChildGoalProposalInput,
                Task<SupabaseChildGoalProposalResult>> proposeGoal,
            Action<SupabaseChildHomeSnapshot> applySnapshot,
            Action<string, bool> setStatus,
            Action onClosed)
        {
            if (snapshot == null || snapshot.child == null)
            {
                throw new ArgumentNullException("snapshot");
            }
            if (proposeGoal == null) throw new ArgumentNullException("proposeGoal");

            Dispose();
            this.snapshot = snapshot;
            this.proposeGoal = proposeGoal;
            this.applySnapshot = applySnapshot;
            this.setStatus = setStatus;
            this.onClosed = onClosed;
            categoryIndex = 0;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.88f),
                "ChildGoalProposalPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildGoalProposalCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.06f);
            cardRect.anchorMax = new Vector2(0.92f, 0.94f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "建立一般冒險",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.88f),
                new Vector2(0.92f, 0.98f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "設定好今天想完成的目標，建立後就可以直接開始。",
                16,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.82f),
                new Vector2(0.92f, 0.88f));

            CreateLabel(card.transform, "我今天想做到", 0.75f, 0.81f);
            nameInput = CreateSmallInput(
                card.transform,
                "例如：自己整理明天的書包",
                new Vector2(0.08f, 0.67f),
                new Vector2(0.92f, 0.75f));

            CreateLabel(card.transform, "預估點數", 0.61f, 0.67f, 0.08f, 0.28f);
            pointsInput = CreateSmallInput(
                card.transform,
                "5",
                new Vector2(0.28f, 0.61f),
                new Vector2(0.4f, 0.67f));
            pointsInput.contentType = InputField.ContentType.IntegerNumber;
            pointsInput.text = "5";

            CreateLabel(card.transform, "想做多久（選填）", 0.61f, 0.67f, 0.44f, 0.66f);
            durationInput = CreateSmallInput(
                card.transform,
                "分鐘",
                new Vector2(0.66f, 0.61f),
                new Vector2(0.82f, 0.67f));
            durationInput.contentType = InputField.ContentType.IntegerNumber;

            categoryButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                string.Empty,
                new Vector2(0.84f, 0.61f),
                new Vector2(0.92f, 0.67f));
            categoryText = categoryButton.GetComponentInChildren<Text>();
            categoryButton.onClick.AddListener(CycleCategory);
            RefreshCategoryText();

            CreateLabel(card.transform, "開始時間", 0.54f, 0.6f, 0.08f, 0.2f);
            dueTimeInput = CreateSmallInput(
                card.transform,
                "18:00",
                new Vector2(0.2f, 0.54f),
                new Vector2(0.48f, 0.6f));
            dueTimeInput.contentType = InputField.ContentType.Standard;

            CreateLabel(card.transform, "最晚開始", 0.54f, 0.6f, 0.52f, 0.66f);
            endTimeInput = CreateSmallInput(
                card.transform,
                "20:00",
                new Vector2(0.66f, 0.54f),
                new Vector2(0.92f, 0.6f));
            endTimeInput.contentType = InputField.ContentType.Standard;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "冒險分類",
                15,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.46f),
                new Vector2(0.28f, 0.52f));
            Text categoryHint = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "送出後會同步到家長端；若設定時間，完成前需要完成計時。",
                14,
                TextAnchor.MiddleLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.4f),
                new Vector2(0.92f, 0.46f));
            categoryHint.horizontalOverflow = HorizontalWrapMode.Wrap;

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "請填寫開始時間與最晚開始時間。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.29f),
                new Vector2(0.92f, 0.39f));
            submitButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "建立冒險",
                new Vector2(0.08f, 0.17f),
                new Vector2(0.46f, 0.27f));
            submitButton.onClick.AddListener(HandleSubmit);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "取消",
                new Vector2(0.54f, 0.17f),
                new Vector2(0.92f, 0.27f));
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
            proposeGoal = null;
            applySnapshot = null;
            setStatus = null;
            onClosed = null;
            nameInput = null;
            pointsInput = null;
            durationInput = null;
            dueTimeInput = null;
            endTimeInput = null;
            categoryButton = null;
            submitButton = null;
            categoryText = null;
            statusText = null;
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

        private async void HandleSubmit()
        {
            if (proposeGoal == null || submitButton == null) return;

            string name = nameInput == null ? string.Empty : nameInput.text.Trim();
            string pointsText = pointsInput == null ? string.Empty : pointsInput.text.Trim();
            string durationText = durationInput == null ? string.Empty : durationInput.text.Trim();
            string dueTime = dueTimeInput == null ? string.Empty : dueTimeInput.text.Trim();
            string endTime = endTimeInput == null ? string.Empty : endTimeInput.text.Trim();
            int points;
            int duration = 0;
            if (string.IsNullOrWhiteSpace(name))
            {
                SetPanelStatus("請先寫下想完成的冒險。", true);
                return;
            }
            if (!int.TryParse(pointsText, NumberStyles.Integer, CultureInfo.InvariantCulture, out points)
                || points <= 0)
            {
                SetPanelStatus("預估點數必須是大於零的整數。", true);
                return;
            }
            if (!string.IsNullOrWhiteSpace(durationText)
                && (!int.TryParse(durationText, NumberStyles.Integer, CultureInfo.InvariantCulture, out duration)
                    || duration <= 0))
            {
                SetPanelStatus("時間分鐘必須是大於零的整數。", true);
                return;
            }
            TimeSpan parsedDueTime;
            TimeSpan parsedEndTime;
            if (!TryParseTime(dueTime, out parsedDueTime)
                || !TryParseTime(endTime, out parsedEndTime)
                || parsedEndTime <= parsedDueTime)
            {
                SetPanelStatus("請輸入有效的開始時間，且最晚開始時間要晚於開始時間。", true);
                return;
            }

            submitButton.interactable = false;
            SetPanelStatus("正在建立一般冒險…", false);
            try
            {
                SupabaseChildGoalProposalResult result = await proposeGoal(
                    new SupabaseChildGoalProposalInput
                    {
                        name = name,
                        points = points,
                        icon = "Star",
                        category = CategoryValues[categoryIndex],
                        durationMinutes = string.IsNullOrWhiteSpace(durationText)
                            ? (int?)null
                            : duration,
                        dueOn = null,
                        dueTime = dueTime,
                        endTime = endTime,
                    });
                if (result != null && result.RefreshedSnapshot != null
                    && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }

                Action<string, bool> reportStatus = setStatus;
                Close();
                if (reportStatus != null)
                {
                    reportStatus(
                        result == null || string.IsNullOrWhiteSpace(result.RefreshError)
                            ? "一般冒險已建立，可以開始挑戰了。"
                            : "一般冒險已建立；最新清單稍後會自動同步。",
                        false);
                }
            }
            catch (Exception exception)
            {
                SetPanelStatus("建立失敗：" + exception.Message, true);
                if (submitButton != null) submitButton.interactable = true;
            }
        }

        private void Close()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            Action closed = onClosed;
            snapshot = null;
            proposeGoal = null;
            applySnapshot = null;
            setStatus = null;
            onClosed = null;
            if (closed != null) closed();
        }

        private void SetPanelStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private static bool TryParseTime(string value, out TimeSpan parsed)
        {
            return TimeSpan.TryParseExact(
                value ?? string.Empty,
                new[] { "hh\\:mm", "h\\:mm" },
                CultureInfo.InvariantCulture,
                out parsed)
                && parsed >= TimeSpan.Zero
                && parsed < TimeSpan.FromDays(1);
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
            string text,
            float yMin,
            float yMax,
            float xMin = 0.08f,
            float xMax = 0.92f)
        {
            HabitHeroUiFactory.CreateText(
                parent,
                font,
                text,
                15,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(xMin, yMin),
                new Vector2(xMax, yMax));
        }
    }
}
