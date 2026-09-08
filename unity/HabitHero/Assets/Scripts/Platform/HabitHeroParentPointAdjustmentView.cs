using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentPointAdjustmentView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject childListObject;
        private Text selectedChildText;
        private Text statusText;
        private InputField amountInput;
        private InputField noteInput;
        private Button saveButton;
        private SupabaseParentHomeSnapshot snapshot;
        private string selectedChildId;
        private Func<string, int, string, Task<SupabaseParentPointMutationResult>> adjustPoints;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClosed;

        public HabitHeroParentPointAdjustmentView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<string, int, string, Task<SupabaseParentPointMutationResult>> adjustPoints,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (adjustPoints == null) throw new ArgumentNullException("adjustPoints");

            Dispose();
            this.snapshot = snapshot;
            this.adjustPoints = adjustPoints;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;
            selectedChildId = FindFirstChildId();

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentPointAdjustmentPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentPointAdjustmentCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.1f, 0.1f);
            cardRect.anchorMax = new Vector2(0.9f, 0.9f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "調整孩子點數",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.88f),
                new Vector2(0.92f, 0.96f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "加點請輸入正數，扣點請輸入負數；所有紀錄會寫入點數帳本。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.81f),
                new Vector2(0.92f, 0.88f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "選擇孩子",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.75f),
                new Vector2(0.92f, 0.81f));
            childListObject = CreateVerticalList(
                card.transform,
                "ParentPointChildList",
                new Vector2(0.08f, 0.59f),
                new Vector2(0.92f, 0.75f));
            RenderChildList();
            selectedChildText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                BuildSelectedChildMessage(),
                16,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.53f),
                new Vector2(0.92f, 0.59f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "點數變更",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.48f),
                new Vector2(0.92f, 0.53f));
            amountInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：+10 或 -5",
                false,
                new Vector2(0.08f, 0.41f),
                new Vector2(0.92f, 0.48f));
            amountInput.contentType = InputField.ContentType.Standard;
            amountInput.lineType = InputField.LineType.SingleLine;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "調整原因（必填）",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.35f),
                new Vector2(0.92f, 0.4f));
            noteInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：完成額外家事",
                false,
                new Vector2(0.08f, 0.27f),
                new Vector2(0.92f, 0.35f));
            noteInput.contentType = InputField.ContentType.Standard;
            noteInput.lineType = InputField.LineType.SingleLine;
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "請確認孩子與點數後送出。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.2f),
                new Vector2(0.92f, 0.26f));
            saveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "送出調整",
                new Vector2(0.1f, 0.11f),
                new Vector2(0.9f, 0.18f));
            saveButton.onClick.AddListener(HandleSave);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "取消",
                new Vector2(0.35f, 0.04f),
                new Vector2(0.65f, 0.1f));
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
            selectedChildId = null;
            adjustPoints = null;
            applySnapshot = null;
            setParentStatus = null;
            onClosed = null;
            childListObject = null;
            selectedChildText = null;
            statusText = null;
            amountInput = null;
            noteInput = null;
            saveButton = null;
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
                Button childButton = HabitHeroUiFactory.CreateButton(
                    childListObject.transform,
                    font,
                    child.display_name + "（目前 " + child.points_balance + " 點）",
                    Vector2.zero,
                    Vector2.one);
                childButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 40f);
                childButton.onClick.AddListener(() => SelectChild(child));
                visibleCount += 1;
            }
        }

        private void SelectChild(SupabaseChildProfileRecord child)
        {
            if (child == null || string.IsNullOrWhiteSpace(child.id)) return;
            selectedChildId = child.id;
            if (selectedChildText != null)
            {
                selectedChildText.text = BuildSelectedChildMessage();
            }
            SetStatus("已選擇 " + GetChildName(selectedChildId) + "。", false);
        }

        private async void HandleSave()
        {
            string amountText = amountInput == null ? string.Empty : amountInput.text.Trim();
            string note = noteInput == null ? string.Empty : noteInput.text.Trim();
            int delta;
            if (string.IsNullOrWhiteSpace(selectedChildId))
            {
                SetStatus("請先選擇孩子。", true);
                return;
            }
            if (!int.TryParse(
                    amountText,
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out delta)
                || delta == 0
                || Math.Abs((long)delta) > 10000)
            {
                SetStatus("點數變更必須介於 -10000 到 10000，且不可為 0。", true);
                return;
            }
            if (note.Length < 1 || note.Length > 200)
            {
                SetStatus("請填寫 1 到 200 個字元的調整原因。", true);
                return;
            }

            if (saveButton != null) saveButton.interactable = false;
            SetStatus("正在更新點數帳本…", false);
            try
            {
                SupabaseParentPointMutationResult result = await adjustPoints(
                    selectedChildId,
                    delta,
                    note);
                if (result == null)
                {
                    SetStatus("點數調整回應無效，請稍後再試。", true);
                    if (saveButton != null) saveButton.interactable = true;
                    return;
                }
                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                string message = string.IsNullOrWhiteSpace(result.RefreshError)
                    ? GetChildName(selectedChildId) + " 的點數已更新為 "
                        + result.PointsBalance + " 點。"
                    : "點數已寫入；最新家庭資料稍後會自動更新。";
                Close();
                if (setParentStatus != null) setParentStatus(message, false);
            }
            catch (Exception exception)
            {
                SetStatus("點數調整失敗：" + exception.Message, true);
                if (saveButton != null) saveButton.interactable = true;
            }
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
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

        private string BuildSelectedChildMessage()
        {
            string childName = GetChildName(selectedChildId);
            int balance = 0;
            foreach (SupabaseChildProfileRecord child in
                snapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == selectedChildId)
                {
                    balance = child.points_balance;
                    break;
                }
            }

            return "目前選擇：" + childName + "｜目前餘額 " + balance + " 點";
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
