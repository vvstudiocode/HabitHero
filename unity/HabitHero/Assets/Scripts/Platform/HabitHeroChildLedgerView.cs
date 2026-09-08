using System;
using System.Globalization;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildLedgerView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject ledgerListObject;
        private Text summaryText;
        private SupabaseChildHomeSnapshot snapshot;
        private Action close;

        public HabitHeroChildLedgerView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(SupabaseChildHomeSnapshot snapshot, Action close)
        {
            if (snapshot == null || snapshot.child == null)
            {
                throw new ArgumentNullException("snapshot");
            }

            Dispose();
            this.snapshot = snapshot;
            this.close = close;
            BuildPanel();
            Render();
        }

        public void ApplySnapshot(SupabaseChildHomeSnapshot snapshot)
        {
            if (snapshot == null || snapshot.child == null || panel == null) return;
            this.snapshot = snapshot;
            Render();
        }

        public void Dispose()
        {
            snapshot = null;
            close = null;
            ledgerListObject = null;
            summaryText = null;
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }
        }

        private void BuildPanel()
        {
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ChildLedgerPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildLedgerCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.1f);
            cardRect.anchorMax = new Vector2(0.92f, 0.9f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "點數紀錄",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.88f),
                new Vector2(0.92f, 0.97f));
            summaryText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                19,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.79f),
                new Vector2(0.92f, 0.87f));

            ledgerListObject = new GameObject(
                "ChildLedgerList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            ledgerListObject.transform.SetParent(card.transform, false);
            RectTransform listRect = ledgerListObject.GetComponent<RectTransform>();
            listRect.anchorMin = new Vector2(0.08f, 0.18f);
            listRect.anchorMax = new Vector2(0.92f, 0.77f);
            listRect.offsetMin = Vector2.zero;
            listRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = ledgerListObject.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 8f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;

            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.05f),
                new Vector2(0.65f, 0.13f));
            closeButton.onClick.AddListener(() =>
            {
                if (close != null) close();
                else Dispose();
            });
        }

        private void Render()
        {
            if (snapshot == null || snapshot.child == null || ledgerListObject == null)
            {
                return;
            }

            if (summaryText != null)
            {
                summaryText.text = snapshot.child.display_name
                    + "　目前點數："
                    + snapshot.child.points_balance;
            }

            foreach (Transform child in ledgerListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleCount = 0;
            foreach (SupabaseChildLedgerRecord entry in
                snapshot.ledger ?? new SupabaseChildLedgerRecord[0])
            {
                if (entry == null || visibleCount >= 12) continue;
                Text entryText = HabitHeroUiFactory.CreateText(
                    ledgerListObject.transform,
                    font,
                    FormatEntry(entry),
                    17,
                    TextAnchor.MiddleLeft,
                    new Color(0.86f, 0.91f, 0.97f, 1f),
                    Vector2.zero,
                    Vector2.one);
                entryText.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 42f);
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    ledgerListObject.transform,
                    font,
                    "目前還沒有點數紀錄。",
                    21,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
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
    }
}
