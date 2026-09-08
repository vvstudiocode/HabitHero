using System;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentChildPreviewView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject childListObject;
        private Text profileText;
        private Text taskText;
        private Text rewardText;
        private Text ledgerText;
        private SupabaseParentHomeSnapshot snapshot;
        private string selectedChildId;
        private Action close;

        public HabitHeroParentChildPreviewView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            string requestedChildId,
            Action close)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");

            Dispose();
            this.snapshot = snapshot;
            this.selectedChildId = GetSelectedChildId(snapshot, requestedChildId);
            this.close = close;
            BuildPanel();
            Render();
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null || panel == null) return;
            this.snapshot = snapshot;
            selectedChildId = GetSelectedChildId(snapshot, selectedChildId);
            Render();
        }

        public void Dispose()
        {
            snapshot = null;
            selectedChildId = null;
            close = null;
            childListObject = null;
            profileText = null;
            taskText = null;
            rewardText = null;
            ledgerText = null;
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
                "ParentChildPreviewPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentChildPreviewCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.05f, 0.06f);
            cardRect.anchorMax = new Vector2(0.95f, 0.94f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "孩子視角（唯讀預覽）",
                30,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.05f, 0.9f),
                new Vector2(0.76f, 0.98f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.78f, 0.91f),
                new Vector2(0.95f, 0.98f));
            closeButton.onClick.AddListener(() =>
            {
                if (close != null) close();
                else Dispose();
            });

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "選擇孩子",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.06f, 0.83f),
                new Vector2(0.38f, 0.89f));
            childListObject = new GameObject(
                "PreviewChildList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            childListObject.transform.SetParent(card.transform, false);
            RectTransform listRect = childListObject.GetComponent<RectTransform>();
            listRect.anchorMin = new Vector2(0.06f, 0.1f);
            listRect.anchorMax = new Vector2(0.38f, 0.82f);
            listRect.offsetMin = Vector2.zero;
            listRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = childListObject.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 8f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;

            GameObject detailCard = HabitHeroUiFactory.CreatePanel(
                card.transform,
                new Color(0.04f, 0.07f, 0.12f, 0.9f),
                "PreviewChildDetails");
            RectTransform detailRect = detailCard.GetComponent<RectTransform>();
            detailRect.anchorMin = new Vector2(0.42f, 0.1f);
            detailRect.anchorMax = new Vector2(0.94f, 0.88f);
            detailRect.offsetMin = Vector2.zero;
            detailRect.offsetMax = Vector2.zero;

            profileText = HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                string.Empty,
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.06f, 0.77f),
                new Vector2(0.94f, 0.98f));
            taskText = HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                string.Empty,
                16,
                TextAnchor.UpperLeft,
                new Color(0.86f, 0.91f, 0.97f, 1f),
                new Vector2(0.06f, 0.45f),
                new Vector2(0.94f, 0.76f));
            rewardText = HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                string.Empty,
                16,
                TextAnchor.UpperLeft,
                new Color(0.86f, 0.91f, 0.97f, 1f),
                new Vector2(0.06f, 0.2f),
                new Vector2(0.94f, 0.43f));
            ledgerText = HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                string.Empty,
                14,
                TextAnchor.UpperLeft,
                new Color(0.7f, 0.78f, 0.88f, 1f),
                new Vector2(0.06f, 0.04f),
                new Vector2(0.94f, 0.18f));
        }

        private void Render()
        {
            if (snapshot == null || childListObject == null) return;
            foreach (Transform child in childListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleCount = 0;
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child == null || visibleCount >= 8) continue;
                string childId = child.id;
                Button childButton = HabitHeroUiFactory.CreateButton(
                    childListObject.transform,
                    font,
                    child.id == selectedChildId ? "✓ " + child.display_name : child.display_name,
                    Vector2.zero,
                    Vector2.one);
                childButton.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 48f);
                childButton.onClick.AddListener(() =>
                {
                    selectedChildId = childId;
                    Render();
                });
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                CreateListMessage("尚未建立孩子資料。");
            }

            SupabaseChildProfileRecord selected = SupabaseFamilyPreview.SelectChild(
                snapshot,
                selectedChildId);
            if (selected == null)
            {
                SetDetails(
                    "尚未選擇孩子。",
                    "任務資料\n—",
                    "獎勵與願望\n—",
                    "點數紀錄\n—");
                return;
            }

            selectedChildId = selected.id;
            SupabaseChildTaskRecord[] tasks = SupabaseFamilyPreview.FilterTasks(
                snapshot,
                selected.id);
            SupabaseChildRewardRecord[] rewards = SupabaseFamilyPreview.FilterRewards(
                snapshot,
                selected.id);
            SupabaseChildWishlistRecord[] wishlist = SupabaseFamilyPreview.FilterWishlist(
                snapshot,
                selected.id);
            SupabaseChildTicketRecord[] tickets = SupabaseFamilyPreview.FilterTickets(
                snapshot,
                selected.id);
            SupabaseChildLedgerRecord[] ledger = SupabaseFamilyPreview.FilterLedger(
                snapshot,
                selected.id);

            SetDetails(
                selected.display_name + "\n目前點數：" + selected.points_balance
                    + (string.IsNullOrWhiteSpace(selected.login_name)
                        ? string.Empty
                        : "\n孩子帳號：" + selected.login_name),
                BuildTaskSummary(tasks),
                BuildRewardSummary(rewards, wishlist, tickets),
                BuildLedgerSummary(ledger));
        }

        private void SetDetails(
            string profile,
            string tasks,
            string rewards,
            string ledger)
        {
            if (profileText != null) profileText.text = profile;
            if (taskText != null) taskText.text = tasks;
            if (rewardText != null) rewardText.text = rewards;
            if (ledgerText != null) ledgerText.text = ledger;
        }

        private void CreateListMessage(string message)
        {
            HabitHeroUiFactory.CreateText(
                childListObject.transform,
                font,
                message,
                17,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                Vector2.zero,
                Vector2.one);
        }

        private static string GetSelectedChildId(
            SupabaseParentHomeSnapshot snapshot,
            string requestedChildId)
        {
            SupabaseChildProfileRecord child = SupabaseFamilyPreview.SelectChild(
                snapshot,
                requestedChildId);
            return child == null ? null : child.id;
        }

        private static string BuildTaskSummary(SupabaseChildTaskRecord[] tasks)
        {
            string summary = "任務\n";
            if (tasks == null || tasks.Length == 0) return summary + "—";

            int count = 0;
            foreach (SupabaseChildTaskRecord task in tasks)
            {
                if (task == null || count >= 6) continue;
                summary += "・" + task.name + "　" + GetTaskStatus(task.status)
                    + "　+" + task.points + " 點\n";
                count += 1;
            }

            return count == 0 ? summary + "—" : summary.TrimEnd();
        }

        private static string BuildRewardSummary(
            SupabaseChildRewardRecord[] rewards,
            SupabaseChildWishlistRecord[] wishlist,
            SupabaseChildTicketRecord[] tickets)
        {
            string summary = "獎勵／願望\n";
            int count = 0;
            foreach (SupabaseChildRewardRecord reward in rewards ?? new SupabaseChildRewardRecord[0])
            {
                if (reward == null || count >= 3) continue;
                summary += "・獎勵：" + reward.name + "（" + reward.points + " 點）\n";
                count += 1;
            }

            foreach (SupabaseChildWishlistRecord item in wishlist ?? new SupabaseChildWishlistRecord[0])
            {
                if (item == null || count >= 5) continue;
                summary += "・願望：" + item.name + "（待核准）\n";
                count += 1;
            }

            foreach (SupabaseChildTicketRecord ticket in tickets ?? new SupabaseChildTicketRecord[0])
            {
                if (ticket == null || count >= 6) continue;
                summary += "・獎勵券：" + ticket.reward_name + "（"
                    + (string.IsNullOrWhiteSpace(ticket.status) ? "未知" : ticket.status)
                    + "）\n";
                count += 1;
            }

            return count == 0 ? summary + "—" : summary.TrimEnd();
        }

        private static string BuildLedgerSummary(SupabaseChildLedgerRecord[] ledger)
        {
            string summary = "最近點數紀錄\n";
            int count = 0;
            foreach (SupabaseChildLedgerRecord entry in ledger ?? new SupabaseChildLedgerRecord[0])
            {
                if (entry == null || count >= 3) continue;
                summary += "・" + (entry.points_delta >= 0 ? "+" : string.Empty)
                    + entry.points_delta + "　" + (entry.note ?? entry.entry_type) + "\n";
                count += 1;
            }

            return count == 0 ? summary + "—" : summary.TrimEnd();
        }

        private static string GetTaskStatus(string status)
        {
            if (status == "pending") return "待確認";
            if (status == "completed") return "已完成";
            if (status == "revision_requested") return "需補充";
            if (status == "cancelled") return "已取消";
            if (status == "expired") return "已過期";
            return string.IsNullOrWhiteSpace(status) ? "未設定" : status;
        }
    }
}
