using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentCoopAdventureView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject entryListObject;
        private Text statusText;
        private Text detailTitleText;
        private Text detailBodyText;
        private Text reviewStatusText;
        private InputField feedbackInput;
        private InputField revisionInput;
        private Button approveButton;
        private Button reviseButton;
        private SupabaseParentHomeSnapshot latestSnapshot;
        private Func<string, Task<SupabaseCoopAdventureSummary[]>> listAdventures;
        private Func<string, Task<SupabaseCoopAdventureState>> loadState;
        private Func<
            string,
            SupabaseCoopReviewInput,
            Task<SupabaseCoopMutationResult>> reviewCompletion;
        private Action onClose;
        private ReviewEntry selectedEntry;
        private readonly List<ReviewEntry> entries = new List<ReviewEntry>();

        private sealed class ReviewEntry
        {
            public SupabaseCoopAdventureSummary Summary;
            public SupabaseCoopAdventureState State;
            public SupabaseCoopAdventureParticipant Participant;
            public SupabaseCoopAdventureCompletion Completion;
            public string ChildName;
        }

        public HabitHeroParentCoopAdventureView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<string, Task<SupabaseCoopAdventureSummary[]>> listAdventures,
            Func<string, Task<SupabaseCoopAdventureState>> loadState,
            Func<
                string,
                SupabaseCoopReviewInput,
                Task<SupabaseCoopMutationResult>> reviewCompletion,
            Action onClose)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (listAdventures == null) throw new ArgumentNullException("listAdventures");
            if (loadState == null) throw new ArgumentNullException("loadState");
            if (reviewCompletion == null)
            {
                throw new ArgumentNullException("reviewCompletion");
            }

            Dispose();
            latestSnapshot = snapshot;
            this.listAdventures = listAdventures;
            this.loadState = loadState;
            this.reviewCompletion = reviewCompletion;
            this.onClose = onClose;
            BuildPanel();
            RefreshAsync();
        }

        public void Close()
        {
            Dispose();
        }

        public void Dispose()
        {
            latestSnapshot = null;
            listAdventures = null;
            loadState = null;
            reviewCompletion = null;
            onClose = null;
            selectedEntry = null;
            entries.Clear();
            entryListObject = null;
            statusText = null;
            detailTitleText = null;
            detailBodyText = null;
            reviewStatusText = null;
            feedbackInput = null;
            revisionInput = null;
            approveButton = null;
            reviseButton = null;
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
                "ParentCoopAdventurePanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentCoopAdventureCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.04f, 0.05f);
            cardRect.anchorMax = new Vector2(0.96f, 0.95f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "合作冒險批改",
                31,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.05f, 0.91f),
                new Vector2(0.76f, 0.98f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.79f, 0.91f),
                new Vector2(0.95f, 0.98f));
            closeButton.onClick.AddListener(() =>
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
            });

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "待處理回報",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.06f, 0.84f),
                new Vector2(0.39f, 0.9f));
            entryListObject = new GameObject(
                "ParentCoopReviewList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            entryListObject.transform.SetParent(card.transform, false);
            RectTransform entryListRect = entryListObject.GetComponent<RectTransform>();
            entryListRect.anchorMin = new Vector2(0.06f, 0.18f);
            entryListRect.anchorMax = new Vector2(0.39f, 0.83f);
            entryListRect.offsetMin = Vector2.zero;
            entryListRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup entryLayout =
                entryListObject.GetComponent<VerticalLayoutGroup>();
            entryLayout.spacing = 8f;
            entryLayout.childControlWidth = true;
            entryLayout.childControlHeight = true;
            entryLayout.childForceExpandWidth = true;
            entryLayout.childForceExpandHeight = false;

            GameObject detailCard = HabitHeroUiFactory.CreatePanel(
                card.transform,
                new Color(0.04f, 0.07f, 0.12f, 0.9f),
                "ParentCoopReviewDetails");
            RectTransform detailRect = detailCard.GetComponent<RectTransform>();
            detailRect.anchorMin = new Vector2(0.43f, 0.18f);
            detailRect.anchorMax = new Vector2(0.94f, 0.83f);
            detailRect.offsetMin = Vector2.zero;
            detailRect.offsetMax = Vector2.zero;

            detailTitleText = HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                "選擇一筆回報",
                22,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.06f, 0.87f),
                new Vector2(0.94f, 0.98f));
            detailBodyText = HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                "合作冒險完成回報會先由伺服器保存，核准後才會完成這位參與者的任務。",
                17,
                TextAnchor.UpperLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.07f, 0.68f),
                new Vector2(0.93f, 0.86f));
            HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                "給孩子的回饋（選填）",
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.07f, 0.62f),
                new Vector2(0.93f, 0.68f));
            feedbackInput = HabitHeroUiFactory.CreateInput(
                detailCard.transform,
                font,
                "例如：你有和朋友一起完成，很棒！",
                false,
                new Vector2(0.07f, 0.53f),
                new Vector2(0.93f, 0.61f));
            feedbackInput.contentType = InputField.ContentType.Standard;
            feedbackInput.lineType = InputField.LineType.SingleLine;
            HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                "要求修改時的說明",
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.07f, 0.47f),
                new Vector2(0.93f, 0.53f));
            revisionInput = HabitHeroUiFactory.CreateInput(
                detailCard.transform,
                font,
                "需要修改的地方",
                false,
                new Vector2(0.07f, 0.38f),
                new Vector2(0.93f, 0.46f));
            revisionInput.contentType = InputField.ContentType.Standard;
            revisionInput.lineType = InputField.LineType.SingleLine;
            reviewStatusText = HabitHeroUiFactory.CreateText(
                detailCard.transform,
                font,
                "選擇回報後即可核准或要求修改。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.07f, 0.3f),
                new Vector2(0.93f, 0.37f));
            approveButton = HabitHeroUiFactory.CreateButton(
                detailCard.transform,
                font,
                "核准完成",
                new Vector2(0.07f, 0.2f),
                new Vector2(0.46f, 0.29f));
            approveButton.onClick.AddListener(() => HandleReviewDecision(true));
            reviseButton = HabitHeroUiFactory.CreateButton(
                detailCard.transform,
                font,
                "要求修改",
                new Vector2(0.54f, 0.2f),
                new Vector2(0.93f, 0.29f));
            reviseButton.onClick.AddListener(() => HandleReviewDecision(false));
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "正在載入合作冒險回報…",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.06f, 0.07f),
                new Vector2(0.94f, 0.15f));
        }

        private async void RefreshAsync()
        {
            if (panel == null || latestSnapshot == null) return;
            entries.Clear();
            selectedEntry = null;
            SetStatus("正在同步合作冒險回報…", false);
            try
            {
                foreach (SupabaseChildProfileRecord child in
                    latestSnapshot.children ?? new SupabaseChildProfileRecord[0])
                {
                    if (child == null || string.IsNullOrWhiteSpace(child.id)) continue;
                    SupabaseCoopAdventureSummary[] adventures =
                        await listAdventures(child.id);
                    foreach (SupabaseCoopAdventureSummary adventure in
                        adventures ?? new SupabaseCoopAdventureSummary[0])
                    {
                        if (adventure == null || string.IsNullOrWhiteSpace(adventure.id))
                        {
                            continue;
                        }

                        SupabaseCoopAdventureState state =
                            await loadState(adventure.id);
                        AddReviewEntries(state, child);
                    }
                }

                RenderEntries();
                if (entries.Count > 0)
                {
                    SelectEntry(entries[0]);
                    SetStatus(
                        "找到 " + entries.Count + " 筆尚未處理的合作回報。",
                        false);
                }
                else
                {
                    SetStatus("目前沒有尚未處理的合作冒險回報。", false);
                }
            }
            catch (Exception exception)
            {
                RenderEntries();
                SetStatus("合作冒險回報載入失敗：" + exception.Message, true);
            }
        }

        private void AddReviewEntries(
            SupabaseCoopAdventureState state,
            SupabaseChildProfileRecord child)
        {
            if (state == null) return;
            SupabaseCoopAdventureSummary summary = state.adventures != null
                && state.adventures.Length > 0
                ? state.adventures[0]
                : null;
            if (summary == null) return;

            foreach (SupabaseCoopAdventureCompletion completion in
                state.completions ?? new SupabaseCoopAdventureCompletion[0])
            {
                if (!HabitHeroParentCoopReviewEligibility.NeedsReview(completion))
                {
                    continue;
                }

                SupabaseCoopAdventureParticipant participant = FindParticipant(
                    state.participants,
                    completion.participant_id);
                if (participant == null || !IsKnownChild(participant.child_profile_id))
                {
                    continue;
                }

                entries.Add(new ReviewEntry
                {
                    Summary = summary,
                    State = state,
                    Participant = participant,
                    Completion = completion,
                    ChildName = GetChildName(
                        participant.child_profile_id,
                        child == null ? null : child.display_name),
                });
            }
        }

        private void RenderEntries()
        {
            if (entryListObject == null) return;
            foreach (Transform child in entryListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            foreach (ReviewEntry entry in entries)
            {
                if (entry == null) continue;
                Button entryButton = HabitHeroUiFactory.CreateButton(
                    entryListObject.transform,
                    font,
                    entry.ChildName + "｜" + entry.Summary.title
                        + "\n" + BuildStatusLabel(entry.Completion.status),
                    Vector2.zero,
                    Vector2.one);
                entryButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 66f);
                entryButton.onClick.AddListener(() => SelectEntry(entry));
            }

            if (entries.Count == 0)
            {
                HabitHeroUiFactory.CreateText(
                    entryListObject.transform,
                    font,
                    "目前沒有待批改的合作回報。",
                    17,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void SelectEntry(ReviewEntry entry)
        {
            selectedEntry = entry;
            if (entry == null) return;
            if (detailTitleText != null)
            {
                detailTitleText.text = entry.ChildName + "｜" + entry.Summary.title;
            }
            if (detailBodyText != null)
            {
                detailBodyText.text =
                    "參與者：" + (string.IsNullOrWhiteSpace(entry.Participant.display_name)
                        ? entry.ChildName
                        : entry.Participant.display_name)
                    + "\n目前狀態：" + BuildStatusLabel(entry.Completion.status)
                    + "\n送出時間：" + SafeValue(entry.Completion.submitted_at)
                    + "\n\n完成回報已由合作冒險伺服器保存；核准後會同步完成參與者的任務。";
            }
            if (feedbackInput != null) feedbackInput.text = string.Empty;
            if (revisionInput != null) revisionInput.text = string.Empty;
            if (approveButton != null) approveButton.interactable = true;
            if (reviseButton != null) reviseButton.interactable = true;
            SetReviewStatus("選擇核准，或填寫說明後要求修改。", false);
        }

        private async void HandleReviewDecision(bool approved)
        {
            if (selectedEntry == null || reviewCompletion == null) return;
            string feedback = feedbackInput == null ? string.Empty : feedbackInput.text.Trim();
            string revisionNote = revisionInput == null ? string.Empty : revisionInput.text.Trim();
            if (!approved && string.IsNullOrWhiteSpace(revisionNote))
            {
                SetReviewStatus("要求修改時請填寫說明。", true);
                return;
            }

            if (approveButton != null) approveButton.interactable = false;
            if (reviseButton != null) reviseButton.interactable = false;
            SetReviewStatus(approved ? "正在核准合作回報…" : "正在送回修改…", false);
            try
            {
                SupabaseCoopMutationResult result = await reviewCompletion(
                    selectedEntry.Participant.id,
                    new SupabaseCoopReviewInput
                    {
                        approved = approved,
                        approvedPoints = null,
                        feedback = feedback,
                        correction = null,
                        tone = approved ? "encouraging" : "coaching",
                        revisionNote = approved ? null : revisionNote,
                    });
                if (result == null)
                {
                    SetReviewStatus("批改回應無效，請稍後再試。", true);
                    EnableDecisionButtons();
                    return;
                }

                string message = approved
                    ? "合作回報已核准，點數與任務狀態已更新。"
                    : "已要求孩子修改合作冒險任務。";
                await RefreshAsyncAndReport(message);
            }
            catch (Exception exception)
            {
                SetReviewStatus("批改失敗：" + exception.Message, true);
                EnableDecisionButtons();
            }
        }

        private async Task RefreshAsyncAndReport(string message)
        {
            entries.Clear();
            selectedEntry = null;
            try
            {
                foreach (SupabaseChildProfileRecord child in
                    latestSnapshot == null
                        ? new SupabaseChildProfileRecord[0]
                        : latestSnapshot.children ?? new SupabaseChildProfileRecord[0])
                {
                    if (child == null || string.IsNullOrWhiteSpace(child.id)) continue;
                    SupabaseCoopAdventureSummary[] adventures =
                        await listAdventures(child.id);
                    foreach (SupabaseCoopAdventureSummary adventure in
                        adventures ?? new SupabaseCoopAdventureSummary[0])
                    {
                        if (adventure == null || string.IsNullOrWhiteSpace(adventure.id))
                        {
                            continue;
                        }

                        AddReviewEntries(await loadState(adventure.id), child);
                    }
                }

                RenderEntries();
                SetStatus(message, false);
                if (entries.Count > 0) SelectEntry(entries[0]);
            }
            catch (Exception exception)
            {
                RenderEntries();
                SetStatus(message + "但重新整理失敗：" + exception.Message, true);
                EnableDecisionButtons();
            }
        }

        private void EnableDecisionButtons()
        {
            if (approveButton != null) approveButton.interactable = true;
            if (reviseButton != null) reviseButton.interactable = true;
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void SetReviewStatus(string message, bool isError)
        {
            if (reviewStatusText == null)
            {
                SetStatus(message, isError);
                return;
            }

            reviewStatusText.text = message;
            reviewStatusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private bool IsKnownChild(string childProfileId)
        {
            foreach (SupabaseChildProfileRecord child in
                latestSnapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : latestSnapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childProfileId) return true;
            }

            return false;
        }

        private string GetChildName(string childProfileId, string fallbackName)
        {
            foreach (SupabaseChildProfileRecord child in
                latestSnapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : latestSnapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childProfileId
                    && !string.IsNullOrWhiteSpace(child.display_name))
                {
                    return child.display_name;
                }
            }

            return string.IsNullOrWhiteSpace(fallbackName) ? "孩子" : fallbackName;
        }

        private static SupabaseCoopAdventureParticipant FindParticipant(
            SupabaseCoopAdventureParticipant[] participants,
            string participantId)
        {
            foreach (SupabaseCoopAdventureParticipant participant in
                participants ?? new SupabaseCoopAdventureParticipant[0])
            {
                if (participant != null && participant.id == participantId)
                {
                    return participant;
                }
            }

            return null;
        }

        private static string BuildStatusLabel(string status)
        {
            if (status == "revision_requested") return "等待孩子修改";
            if (status == "pending") return "等待家長批改";
            if (status == "completed") return "已完成";
            return string.IsNullOrWhiteSpace(status) ? "未知" : status;
        }

        private static string SafeValue(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "尚未記錄" : value;
        }
    }
}
