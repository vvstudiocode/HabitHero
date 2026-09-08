using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentGoalReviewView
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
        private SupabaseChildTaskRecord task;
        private InputField nameInput;
        private InputField pointsInput;
        private InputField revisionInput;
        private Button categoryButton;
        private Button confirmButton;
        private Button returnButton;
        private Text categoryText;
        private Text statusText;
        private int categoryIndex;
        private Func<
            SupabaseChildTaskRecord,
            string,
            int,
            string,
            Task<SupabaseParentTaskReviewResult>> confirmGoal;
        private Func<
            SupabaseChildTaskRecord,
            string,
            Task<SupabaseParentTaskReviewResult>> returnGoal;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClose;

        public HabitHeroParentGoalReviewView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            SupabaseChildTaskRecord task,
            Func<
                SupabaseChildTaskRecord,
                string,
                int,
                string,
                Task<SupabaseParentTaskReviewResult>> confirmGoal,
            Func<
                SupabaseChildTaskRecord,
                string,
                Task<SupabaseParentTaskReviewResult>> returnGoal,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClose)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (task == null) throw new ArgumentNullException("task");
            if (confirmGoal == null) throw new ArgumentNullException("confirmGoal");
            if (returnGoal == null) throw new ArgumentNullException("returnGoal");

            Dispose();
            this.task = task;
            this.confirmGoal = confirmGoal;
            this.returnGoal = returnGoal;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClose = onClose;
            categoryIndex = FindCategoryIndex(task.category);

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentGoalReviewPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentGoalReviewCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.05f);
            cardRect.anchorMax = new Vector2(0.92f, 0.95f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "孩子目標確認",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.07f, 0.9f),
                new Vector2(0.93f, 0.98f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                GetChildName(snapshot, task.child_profile_id)
                    + "提出了一個目標：" + task.name,
                19,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.82f),
                new Vector2(0.92f, 0.9f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.IsNullOrWhiteSpace(task.revision_note)
                    ? "請確認目標名稱、點數與分類；確認後孩子就能開始執行。"
                    : "孩子已依照上次意見重新提出，請再次確認內容。",
                16,
                TextAnchor.UpperLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.1f, 0.72f),
                new Vector2(0.9f, 0.81f));

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "目標名稱",
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.67f),
                new Vector2(0.9f, 0.72f));
            nameInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：每天閱讀 20 分鐘",
                false,
                new Vector2(0.1f, 0.59f),
                new Vector2(0.9f, 0.67f));
            nameInput.contentType = InputField.ContentType.Standard;
            nameInput.lineType = InputField.LineType.SingleLine;
            nameInput.text = task.name ?? string.Empty;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "確認點數",
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.53f),
                new Vector2(0.27f, 0.59f));
            pointsInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "0",
                false,
                new Vector2(0.27f, 0.53f),
                new Vector2(0.45f, 0.59f));
            pointsInput.contentType = InputField.ContentType.IntegerNumber;
            pointsInput.lineType = InputField.LineType.SingleLine;
            pointsInput.text = task.points.ToString(CultureInfo.InvariantCulture);

            categoryButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                CategoryLabels[categoryIndex],
                new Vector2(0.5f, 0.53f),
                new Vector2(0.9f, 0.59f));
            categoryText = categoryButton.GetComponentInChildren<Text>();
            categoryButton.onClick.AddListener(CycleCategory);

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "需要孩子修改時的說明",
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.45f),
                new Vector2(0.9f, 0.51f));
            revisionInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "告訴孩子下一步可以怎麼調整",
                false,
                new Vector2(0.1f, 0.36f),
                new Vector2(0.9f, 0.45f));
            revisionInput.contentType = InputField.ContentType.Standard;
            revisionInput.lineType = InputField.LineType.SingleLine;
            revisionInput.text = task.revision_note ?? string.Empty;

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "確認後目標會變成孩子的待執行任務。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.29f),
                new Vector2(0.92f, 0.35f));
            confirmButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "確認目標",
                new Vector2(0.1f, 0.19f),
                new Vector2(0.43f, 0.28f));
            confirmButton.onClick.AddListener(HandleConfirm);
            returnButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "退回修改",
                new Vector2(0.57f, 0.19f),
                new Vector2(0.9f, 0.28f));
            returnButton.onClick.AddListener(HandleReturn);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "先不要",
                new Vector2(0.35f, 0.08f),
                new Vector2(0.65f, 0.17f));
            closeButton.onClick.AddListener(Close);
        }

        public void Dispose()
        {
            task = null;
            confirmGoal = null;
            returnGoal = null;
            applySnapshot = null;
            setParentStatus = null;
            onClose = null;
            nameInput = null;
            pointsInput = null;
            revisionInput = null;
            categoryButton = null;
            confirmButton = null;
            returnButton = null;
            categoryText = null;
            statusText = null;
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }
        }

        private void CycleCategory()
        {
            categoryIndex = (categoryIndex + 1) % CategoryValues.Length;
            if (categoryText != null) categoryText.text = CategoryLabels[categoryIndex];
        }

        private async void HandleConfirm()
        {
            if (task == null || confirmGoal == null) return;
            string name = nameInput == null ? string.Empty : nameInput.text.Trim();
            int points;
            if (name.Length < 1 || name.Length > 120)
            {
                SetStatus("目標名稱長度必須介於 1 到 120 個字元。", true);
                return;
            }
            if (!int.TryParse(
                    pointsInput == null ? string.Empty : pointsInput.text.Trim(),
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out points)
                || points < 0)
            {
                SetStatus("請輸入有效的確認點數。", true);
                return;
            }

            SetButtonsInteractable(false);
            SetStatus("正在確認孩子目標…", false);
            try
            {
                SupabaseParentTaskReviewResult result = await confirmGoal(
                    task,
                    name,
                    points,
                    CategoryValues[categoryIndex]);
                if (result == null || result.Task == null)
                {
                    SetStatus("確認回應無效，請稍後再試。", true);
                    SetButtonsInteractable(true);
                    return;
                }
                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                SetParentStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "孩子目標已確認，現在可以開始執行。"
                        : "孩子目標已確認；最新家庭資料稍後會更新。",
                    false);
                Close();
            }
            catch (Exception exception)
            {
                SetStatus("確認目標失敗：" + exception.Message, true);
                SetButtonsInteractable(true);
            }
        }

        private async void HandleReturn()
        {
            if (task == null || returnGoal == null) return;
            string note = revisionInput == null ? string.Empty : revisionInput.text.Trim();
            if (note.Length < 1 || note.Length > 1000)
            {
                SetStatus("退回修改時，請填寫 1 到 1000 個字元的說明。", true);
                return;
            }

            SetButtonsInteractable(false);
            SetStatus("正在退回孩子修改…", false);
            try
            {
                SupabaseParentTaskReviewResult result = await returnGoal(task, note);
                if (result == null || result.Task == null)
                {
                    SetStatus("退回回應無效，請稍後再試。", true);
                    SetButtonsInteractable(true);
                    return;
                }
                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                SetParentStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "已退回孩子修改，孩子會看到你的說明。"
                        : "已退回孩子修改；最新家庭資料稍後會更新。",
                    false);
                Close();
            }
            catch (Exception exception)
            {
                SetStatus("退回修改失敗：" + exception.Message, true);
                SetButtonsInteractable(true);
            }
        }

        private void SetButtonsInteractable(bool interactable)
        {
            if (confirmButton != null) confirmButton.interactable = interactable;
            if (returnButton != null) returnButton.interactable = interactable;
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void SetParentStatus(string message, bool isError)
        {
            if (setParentStatus != null)
            {
                setParentStatus(message, isError);
            }
        }

        private void Close()
        {
            Action callback = onClose;
            if (callback != null)
            {
                callback();
            }
            else
            {
                Dispose();
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

        private static string GetChildName(
            SupabaseParentHomeSnapshot snapshot,
            string childProfileId)
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childProfileId)
                {
                    return child.display_name;
                }
            }
            return "孩子";
        }
    }
}
