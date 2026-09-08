using System;
using System.Globalization;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentLedgerView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject childListObject;
        private GameObject ledgerListObject;
        private Text selectedChildText;
        private SupabaseParentHomeSnapshot snapshot;
        private string selectedChildId;
        private Action onClosed;

        public HabitHeroParentLedgerView(Transform canvasTransform, Font font)
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

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentLedgerPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentLedgerCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.08f);
            cardRect.anchorMax = new Vector2(0.92f, 0.92f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "孩子點數明細",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.91f),
                new Vector2(0.92f, 0.97f));
            childListObject = CreateVerticalList(
                card.transform,
                "ParentLedgerChildList",
                new Vector2(0.08f, 0.73f),
                new Vector2(0.92f, 0.89f));
            selectedChildText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                18,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.68f),
                new Vector2(0.92f, 0.73f));
            ledgerListObject = CreateVerticalList(
                card.transform,
                "ParentLedgerList",
                new Vector2(0.08f, 0.17f),
                new Vector2(0.92f, 0.66f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.05f),
                new Vector2(0.65f, 0.13f));
            closeButton.onClick.AddListener(Close);
            RenderChildList();
            RenderLedger();
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null || panel == null) return;
            this.snapshot = snapshot;
            if (FindChild(selectedChildId) == null)
            {
                selectedChildId = FindFirstChildId();
            }
            RenderChildList();
            RenderLedger();
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
            ledgerListObject = null;
            selectedChildText = null;
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
                Button childButton = HabitHeroUiFactory.CreateButton(
                    childListObject.transform,
                    font,
                    (child.id == selectedChildId ? "✓ " : "")
                        + child.display_name + "（" + child.points_balance + " 點）",
                    Vector2.zero,
                    Vector2.one);
                childButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 38f);
                childButton.onClick.AddListener(() =>
                {
                    selectedChildId = capturedChild.id;
                    RenderChildList();
                    RenderLedger();
                });
                visibleCount += 1;
            }
        }

        private void RenderLedger()
        {
            if (ledgerListObject == null) return;
            foreach (Transform child in ledgerListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            SupabaseChildProfileRecord selectedChild = FindChild(selectedChildId);
            if (selectedChildText != null)
            {
                selectedChildText.text = selectedChild == null
                    ? "請選擇孩子"
                    : selectedChild.display_name + "　目前點數："
                        + selectedChild.points_balance;
            }

            int visibleCount = 0;
            foreach (SupabaseChildLedgerRecord entry in
                snapshot.ledger ?? new SupabaseChildLedgerRecord[0])
            {
                if (entry == null || entry.child_profile_id != selectedChildId
                    || visibleCount >= 16)
                {
                    continue;
                }
                Text entryText = HabitHeroUiFactory.CreateText(
                    ledgerListObject.transform,
                    font,
                    FormatEntry(entry),
                    16,
                    TextAnchor.MiddleLeft,
                    new Color(0.86f, 0.91f, 0.97f, 1f),
                    Vector2.zero,
                    Vector2.one);
                entryText.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 40f);
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    ledgerListObject.transform,
                    font,
                    "目前還沒有點數紀錄。",
                    20,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
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

        private static string FormatEntry(SupabaseChildLedgerRecord entry)
        {
            string delta = entry.points_delta >= 0
                ? "+" + entry.points_delta.ToString(CultureInfo.InvariantCulture)
                : entry.points_delta.ToString(CultureInfo.InvariantCulture);
            string label = string.IsNullOrWhiteSpace(entry.note)
                ? GetEntryTypeLabel(entry.entry_type)
                : entry.note;
            return delta + " 點　" + label;
        }

        private static string GetEntryTypeLabel(string entryType)
        {
            if (entryType == "task_approved") return "任務核准";
            if (entryType == "task_submitted") return "任務完成";
            if (entryType == "reward_redemption") return "兌換獎勵";
            if (entryType == "parent_adjustment") return "家長調整";
            return string.IsNullOrWhiteSpace(entryType) ? "點數變動" : entryType;
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
            layout.spacing = 7f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return listObject;
        }
    }
}
