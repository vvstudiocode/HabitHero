using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentApprovalReversalView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private SupabaseChildTaskRecord task;
        private Button revokeButton;
        private Text statusText;
        private Func<string, Task<SupabaseParentTaskApprovalReversalResult>> revokeApproval;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClose;

        public HabitHeroParentApprovalReversalView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildTaskRecord task,
            string childName,
            Func<string, Task<SupabaseParentTaskApprovalReversalResult>> revokeApproval,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClose)
        {
            if (task == null) throw new ArgumentNullException("task");
            if (revokeApproval == null) throw new ArgumentNullException("revokeApproval");

            Dispose();
            this.task = task;
            this.revokeApproval = revokeApproval;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClose = onClose;
            BuildPanel(string.IsNullOrWhiteSpace(childName) ? "孩子" : childName);
        }

        public void Dispose()
        {
            task = null;
            revokeApproval = null;
            applySnapshot = null;
            setParentStatus = null;
            onClose = null;
            revokeButton = null;
            statusText = null;
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }
        }

        private void BuildPanel(string childName)
        {
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentApprovalReversalPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentApprovalReversalCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.1f, 0.18f);
            cardRect.anchorMax = new Vector2(0.9f, 0.82f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "撤銷任務核准",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.96f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                childName + "｜" + (task.name ?? "未命名任務"),
                22,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.73f),
                new Vector2(0.92f, 0.84f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "撤銷後任務會回到待審狀態。伺服器會依孩子目前餘額，追回仍可追回的點數與卷軸；每筆核准只能撤銷一次。",
                17,
                TextAnchor.UpperLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.1f, 0.53f),
                new Vector2(0.9f, 0.7f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "目前核准點數：" + GetApprovedPoints().ToString(CultureInfo.InvariantCulture),
                16,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.1f, 0.45f),
                new Vector2(0.9f, 0.52f));

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "請確認這是要修正的核准紀錄。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.32f),
                new Vector2(0.92f, 0.4f));
            revokeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "撤銷核准",
                new Vector2(0.1f, 0.2f),
                new Vector2(0.43f, 0.3f));
            revokeButton.onClick.AddListener(HandleRevoke);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "先不要",
                new Vector2(0.57f, 0.2f),
                new Vector2(0.9f, 0.3f));
            closeButton.onClick.AddListener(Close);
        }

        private async void HandleRevoke()
        {
            if (task == null || revokeApproval == null) return;
            if (revokeButton != null) revokeButton.interactable = false;
            SetStatus("正在撤銷核准並整理獎勵…", false);
            try
            {
                SupabaseParentTaskApprovalReversalResult result =
                    await revokeApproval(task.id);
                if (result == null || result.Reversal == null)
                {
                    SetStatus("撤銷回應無效，請稍後再試。", true);
                    SetButtonsInteractable(true);
                    return;
                }

                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }

                string message = BuildSuccessMessage(result);
                SetParentStatus(message, false);
                Close();
            }
            catch (Exception exception)
            {
                SetStatus("撤銷核准失敗：" + exception.Message, true);
                SetButtonsInteractable(true);
            }
        }

        private int GetApprovedPoints()
        {
            if (task == null) return 0;
            return task.approved_points > 0 ? task.approved_points : task.points;
        }

        private static string BuildSuccessMessage(
            SupabaseParentTaskApprovalReversalResult result)
        {
            SupabaseTaskApprovalReversalRecord reversal = result.Reversal;
            string message = string.IsNullOrWhiteSpace(reversal.message)
                ? "任務已撤銷核准。"
                : reversal.message;
            message += "（追回 "
                + reversal.points_reversed.ToString(CultureInfo.InvariantCulture)
                + " 點、"
                + reversal.scroll_reversed.ToString(CultureInfo.InvariantCulture)
                + " 卷軸。）";
            if (!string.IsNullOrWhiteSpace(result.RefreshError))
            {
                message += " 家庭最新資料稍後會更新。";
            }
            return message;
        }

        private void SetButtonsInteractable(bool interactable)
        {
            if (revokeButton != null) revokeButton.interactable = interactable;
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
            if (setParentStatus != null) setParentStatus(message, isError);
        }

        private void Close()
        {
            Action callback = onClose;
            if (callback != null) callback();
            else Dispose();
        }
    }
}
