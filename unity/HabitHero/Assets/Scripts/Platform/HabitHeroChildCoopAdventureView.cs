using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildCoopAdventureView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject taskListObject;
        private GameObject adventureListObject;
        private GameObject stateListObject;
        private Text statusText;
        private SupabaseChildHomeSnapshot latestSnapshot;
        private SupabaseChildSocialData latestSocialData;
        private string childProfileId;
        private Func<string, Task<SupabaseCoopAdventureSummary[]>> listAdventures;
        private Func<string, Task<SupabaseCoopAdventureState>> loadState;
        private Func<string, Task<SupabaseCoopAdventureNotification>> createAdventure;
        private Func<string, Task<SupabaseCoopMutationResult>> joinAdventure;
        private Func<
            string,
            SupabaseCoopCompletionInput,
            Task<SupabaseCoopMutationResult>> submitCompletion;
        private Action onClose;
        private readonly List<CoopAdventureEntry> adventureEntries =
            new List<CoopAdventureEntry>();
        private SupabaseCoopAdventureState selectedState;
        private string selectedAdventureId;
        private string selectedQuickReport = "smooth";
        private InputField reflectionInput;
        private InputField moodInput;
        private InputField difficultyInput;
        private Text completionStatusText;
        private Button smoothButton;
        private Button hardButton;
        private Button helpButton;

        private sealed class CoopAdventureEntry
        {
            public SupabaseCoopAdventureSummary Summary;
            public string OwnerChildProfileId;
        }

        public HabitHeroChildCoopAdventureView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildHomeSnapshot snapshot,
            SupabaseChildSocialData socialData,
            Func<string, Task<SupabaseCoopAdventureSummary[]>> listAdventures,
            Func<string, Task<SupabaseCoopAdventureState>> loadState,
            Func<string, Task<SupabaseCoopAdventureNotification>> createAdventure,
            Func<string, Task<SupabaseCoopMutationResult>> joinAdventure,
            Func<
                string,
                SupabaseCoopCompletionInput,
                Task<SupabaseCoopMutationResult>> submitCompletion,
            Action onClose)
        {
            if (snapshot == null || snapshot.child == null)
            {
                throw new ArgumentNullException("snapshot");
            }

            ClosePanel();
            latestSnapshot = snapshot;
            latestSocialData = socialData;
            childProfileId = snapshot.child.id;
            this.listAdventures = listAdventures;
            this.loadState = loadState;
            this.createAdventure = createAdventure;
            this.joinAdventure = joinAdventure;
            this.submitCompletion = submitCompletion;
            this.onClose = onClose;
            adventureEntries.Clear();
            selectedState = null;
            selectedAdventureId = null;
            selectedQuickReport = "smooth";
            Open();
        }

        public void Open()
        {
            if (latestSnapshot == null || latestSnapshot.child == null) return;
            ClosePanel();
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.92f),
                "ChildCoopAdventurePanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildCoopAdventureCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.04f, 0.04f);
            cardRect.anchorMax = new Vector2(0.96f, 0.96f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "合作冒險",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.93f),
                new Vector2(0.76f, 0.99f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.78f, 0.935f),
                new Vector2(0.94f, 0.99f));
            closeButton.onClick.AddListener(CloseFromButton);

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "把一般冒險分享給好友，一起完成同一個目標。",
                16,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.88f),
                new Vector2(0.92f, 0.93f));

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "可建立的冒險",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.81f),
                new Vector2(0.92f, 0.86f));
            taskListObject = CreateList(
                card.transform,
                "CoopTaskList",
                new Vector2(0.08f, 0.65f),
                new Vector2(0.92f, 0.8f));
            RenderTaskList();

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "好友的合作冒險",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.59f),
                new Vector2(0.92f, 0.64f));
            adventureListObject = CreateList(
                card.transform,
                "CoopAdventureList",
                new Vector2(0.08f, 0.45f),
                new Vector2(0.92f, 0.58f));
            RenderAdventureList();

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "目前冒險狀態",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.39f),
                new Vector2(0.92f, 0.44f));
            stateListObject = CreateList(
                card.transform,
                "CoopStateList",
                new Vector2(0.08f, 0.12f),
                new Vector2(0.92f, 0.38f));
            RenderState();

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "正在同步合作冒險…",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.055f),
                new Vector2(0.92f, 0.105f));
            _ = ReloadAsync();
        }

        public void Dispose()
        {
            ClosePanel();
            latestSnapshot = null;
            latestSocialData = null;
            childProfileId = null;
            listAdventures = null;
            loadState = null;
            createAdventure = null;
            joinAdventure = null;
            submitCompletion = null;
            onClose = null;
            adventureEntries.Clear();
            selectedState = null;
            selectedAdventureId = null;
        }

        public void Close()
        {
            ClosePanel();
        }

        private async Task ReloadAsync()
        {
            if (listAdventures == null)
            {
                SetStatus("合作冒險服務尚未連線。", true);
                return;
            }

            SetStatus("正在同步好友的合作冒險…", false);
            adventureEntries.Clear();
            HashSet<string> ownerIds = new HashSet<string>(StringComparer.Ordinal);
            AddOwnerId(ownerIds, childProfileId);
            foreach (SupabaseFriendSummaryRecord friend in
                (latestSocialData == null
                    ? new SupabaseFriendSummaryRecord[0]
                    : latestSocialData.friends ?? new SupabaseFriendSummaryRecord[0]))
            {
                if (friend == null || ownerIds.Count >= 9) continue;
                AddOwnerId(ownerIds, friend.child_profile_id);
            }

            int successfulOwnerCount = 0;
            string lastError = null;
            foreach (string ownerId in ownerIds)
            {
                try
                {
                    SupabaseCoopAdventureSummary[] summaries =
                        await listAdventures(ownerId);
                    successfulOwnerCount += 1;
                    foreach (SupabaseCoopAdventureSummary summary in
                        summaries ?? new SupabaseCoopAdventureSummary[0])
                    {
                        AddAdventure(summary, ownerId);
                    }
                }
                catch (Exception exception)
                {
                    lastError = exception.Message;
                }
            }

            RenderAdventureList();
            if (successfulOwnerCount == 0 && !string.IsNullOrWhiteSpace(lastError))
            {
                SetStatus("合作冒險同步失敗：" + lastError, true);
            }
            else if (adventureEntries.Count == 0)
            {
                SetStatus("目前還沒有可加入的合作冒險。", false);
            }
            else
            {
                SetStatus("合作冒險已同步。點選冒險查看參與者。", false);
            }
        }

        private void AddOwnerId(HashSet<string> ownerIds, string value)
        {
            if (!string.IsNullOrWhiteSpace(value)) ownerIds.Add(value.Trim());
        }

        private void AddAdventure(
            SupabaseCoopAdventureSummary summary,
            string ownerChildProfileId)
        {
            if (summary == null || string.IsNullOrWhiteSpace(summary.id)) return;
            foreach (CoopAdventureEntry entry in adventureEntries)
            {
                if (entry.Summary != null && entry.Summary.id == summary.id) return;
            }

            adventureEntries.Add(new CoopAdventureEntry
            {
                Summary = summary,
                OwnerChildProfileId = ownerChildProfileId,
            });
        }

        private void RenderTaskList()
        {
            if (taskListObject == null) return;
            ClearChildren(taskListObject.transform);
            int count = 0;
            foreach (SupabaseChildTaskRecord task in
                latestSnapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (!HabitHeroCoopAdventureEligibility.CanCreate(task) || count >= 3)
                {
                    continue;
                }

                GameObject row = CreateRow(taskListObject.transform, "CoopTaskRow");
                HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    task.name + "　" + task.points + " 點",
                    16,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                Button createButton = CreateRowButton(row.transform, "建立");
                createButton.onClick.AddListener(() => CreateAsync(task, createButton));
                count += 1;
            }

            if (count == 0)
            {
                CreateEmptyText(
                    taskListObject.transform,
                    "目前沒有可建立的非每日一般冒險。");
            }
        }

        private void RenderAdventureList()
        {
            if (adventureListObject == null) return;
            ClearChildren(adventureListObject.transform);
            int count = 0;
            foreach (CoopAdventureEntry entry in adventureEntries)
            {
                if (entry == null || entry.Summary == null || count >= 4) continue;
                GameObject row = CreateRow(adventureListObject.transform, "CoopAdventureRow");
                string description = string.IsNullOrWhiteSpace(entry.Summary.description)
                    ? string.Empty
                    : "　" + entry.Summary.description;
                HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    entry.Summary.title + description
                        + "　" + entry.Summary.participant_count + " 人",
                    15,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                Button viewButton = CreateRowButton(row.transform, "查看");
                viewButton.onClick.AddListener(() => LoadStateAsync(entry, viewButton));
                count += 1;
            }

            if (count == 0)
            {
                CreateEmptyText(
                    adventureListObject.transform,
                    "好友建立後，合作冒險會出現在這裡。");
            }
        }

        private void RenderState()
        {
            if (stateListObject == null) return;
            ClearChildren(stateListObject.transform);
            if (selectedState == null)
            {
                CreateEmptyText(
                    stateListObject.transform,
                    "選擇一個合作冒險即可查看完成狀態。");
                return;
            }

            SupabaseCoopAdventureSummary summary = selectedState.adventures != null
                && selectedState.adventures.Length > 0
                ? selectedState.adventures[0]
                : null;
            if (summary != null)
            {
                CreateStateText(
                    summary.title + "　" + GetStatusLabel(summary.status),
                    HabitHeroUiFactory.AccentColor);
            }

            SupabaseCoopAdventureParticipant currentParticipant = null;
            foreach (SupabaseCoopAdventureParticipant participant in
                selectedState.participants ?? new SupabaseCoopAdventureParticipant[0])
            {
                if (participant == null) continue;
                SupabaseCoopAdventureCompletion completion =
                    FindCompletion(participant.id);
                string completionLabel = completion == null
                    ? "尚未回報"
                    : GetStatusLabel(completion.status);
                CreateStateText(
                    participant.display_name + "：" + completionLabel,
                    participant.child_profile_id == childProfileId
                        ? Color.white
                        : new Color(0.74f, 0.81f, 0.9f, 1f));
                if (participant.child_profile_id == childProfileId)
                {
                    currentParticipant = participant;
                }
            }

            if (currentParticipant == null && summary != null && summary.status == "active")
            {
                Button joinButton = CreateStateButton("加入這個冒險");
                joinButton.onClick.AddListener(() => JoinAsync(joinButton));
                return;
            }

            SupabaseCoopAdventureCompletion currentCompletion =
                currentParticipant == null
                    ? null
                    : FindCompletion(currentParticipant.id);
            if (currentParticipant == null || currentCompletion != null
                && currentCompletion.status == "completed")
            {
                CreateStateText(
                    currentParticipant == null
                        ? "這個冒險目前由好友參與。"
                        : "你已完成這個合作冒險，等待其他參與者。",
                    new Color(0.84f, 0.89f, 0.96f, 1f));
                return;
            }

            CreateCompletionForm(currentParticipant.id);
        }

        private SupabaseCoopAdventureCompletion FindCompletion(string participantId)
        {
            foreach (SupabaseCoopAdventureCompletion completion in
                selectedState.completions ?? new SupabaseCoopAdventureCompletion[0])
            {
                if (completion != null && completion.participant_id == participantId)
                {
                    return completion;
                }
            }

            return null;
        }

        private void CreateCompletionForm(string participantId)
        {
            CreateStateText("完成後回報這次合作狀況", HabitHeroUiFactory.AccentColor);
            reflectionInput = CreateStateInput("完成心得（可選）", false);
            moodInput = CreateStateInput("心情（可選）", false);
            difficultyInput = CreateStateInput("難度 1-5（可選）", true);
            difficultyInput.contentType = InputField.ContentType.IntegerNumber;
            completionStatusText = HabitHeroUiFactory.CreateText(
                stateListObject.transform,
                font,
                "完成回報會同步到你的任務與合作狀態。",
                13,
                TextAnchor.MiddleLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                Vector2.zero,
                Vector2.one);
            GameObject quickRow = new GameObject(
                "CoopQuickReportRow",
                typeof(RectTransform),
                typeof(HorizontalLayoutGroup));
            quickRow.transform.SetParent(stateListObject.transform, false);
            quickRow.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 42f);
            HorizontalLayoutGroup quickLayout = quickRow.GetComponent<HorizontalLayoutGroup>();
            quickLayout.spacing = 6f;
            quickLayout.childControlWidth = true;
            quickLayout.childControlHeight = true;
            quickLayout.childForceExpandWidth = true;
            quickLayout.childForceExpandHeight = true;
            smoothButton = CreateRowButton(quickRow.transform, "順利");
            hardButton = CreateRowButton(quickRow.transform, "有點難");
            helpButton = CreateRowButton(quickRow.transform, "需要幫忙");
            smoothButton.onClick.AddListener(() => SetQuickReport("smooth"));
            hardButton.onClick.AddListener(() => SetQuickReport("hard"));
            helpButton.onClick.AddListener(() => SetQuickReport("help"));
            UpdateQuickReportButtons();
            Button submitButton = CreateStateButton("回報完成");
            submitButton.onClick.AddListener(
                () => SubmitAsync(participantId, submitButton));
        }

        private InputField CreateStateInput(string placeholder, bool number)
        {
            GameObject inputObject = new GameObject(
                "CoopCompletionInput",
                typeof(RectTransform),
                typeof(LayoutElement));
            inputObject.transform.SetParent(stateListObject.transform, false);
            LayoutElement layout = inputObject.GetComponent<LayoutElement>();
            layout.minHeight = 38f;
            layout.preferredHeight = 38f;
            InputField input = HabitHeroUiFactory.CreateInput(
                inputObject.transform,
                font,
                placeholder,
                false,
                Vector2.zero,
                Vector2.one);
            input.contentType = number
                ? InputField.ContentType.IntegerNumber
                : InputField.ContentType.Standard;
            return input;
        }

        private async void CreateAsync(SupabaseChildTaskRecord task, Button button)
        {
            if (task == null || createAdventure == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在建立合作冒險…", false);
            try
            {
                SupabaseCoopAdventureNotification notification =
                    await createAdventure(task.id);
                if (notification == null
                    || string.IsNullOrWhiteSpace(notification.coop_adventure_id))
                {
                    throw new SupabaseDataException("合作冒險建立回應無效。");
                }

                SetStatus("合作冒險已建立，正在載入參與狀態…", false);
                SupabaseCoopAdventureState state = await loadState(
                    notification.coop_adventure_id);
                AddAdventure(
                    state != null && state.adventures != null
                        && state.adventures.Length > 0
                        ? state.adventures[0]
                        : new SupabaseCoopAdventureSummary
                        {
                            id = notification.coop_adventure_id,
                            world_owner_child_profile_id = childProfileId,
                            title = notification.title,
                            status = "active",
                        },
                    childProfileId);
                selectedAdventureId = notification.coop_adventure_id;
                selectedState = state;
                RenderAdventureList();
                RenderState();
                SetStatus("合作冒險已建立，好友可以從好友世界加入。", false);
            }
            catch (Exception exception)
            {
                SetStatus("建立合作冒險失敗：" + exception.Message, true);
            }
            finally
            {
                if (button != null) button.interactable = true;
            }
        }

        private async void LoadStateAsync(CoopAdventureEntry entry, Button button)
        {
            if (entry == null || entry.Summary == null || loadState == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在載入合作冒險狀態…", false);
            try
            {
                selectedAdventureId = entry.Summary.id;
                selectedState = await loadState(entry.Summary.id);
                RenderState();
                SetStatus("合作冒險狀態已同步。", false);
            }
            catch (Exception exception)
            {
                SetStatus("載入合作冒險失敗：" + exception.Message, true);
            }
            finally
            {
                if (button != null) button.interactable = true;
            }
        }

        private async void JoinAsync(Button button)
        {
            if (string.IsNullOrWhiteSpace(selectedAdventureId)
                || joinAdventure == null
                || loadState == null)
            {
                return;
            }

            if (button != null) button.interactable = false;
            SetStatus("正在加入合作冒險…", false);
            try
            {
                await joinAdventure(selectedAdventureId);
                selectedState = await loadState(selectedAdventureId);
                RenderState();
                SetStatus("已加入合作冒險，完成自己的任務後即可回報。", false);
            }
            catch (Exception exception)
            {
                SetStatus("加入合作冒險失敗：" + exception.Message, true);
            }
            finally
            {
                if (button != null) button.interactable = true;
            }
        }

        private async void SubmitAsync(string participantId, Button button)
        {
            if (submitCompletion == null || string.IsNullOrWhiteSpace(participantId)) return;
            int? difficulty = null;
            string difficultyText = difficultyInput == null
                ? string.Empty
                : (difficultyInput.text ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(difficultyText))
            {
                int parsedDifficulty;
                if (!int.TryParse(
                    difficultyText,
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out parsedDifficulty)
                    || parsedDifficulty < 1
                    || parsedDifficulty > 5)
                {
                    SetStatus("難度請輸入 1 到 5。", true);
                    return;
                }

                difficulty = parsedDifficulty;
            }

            if (button != null) button.interactable = false;
            SetStatus("正在送出合作完成回報…", false);
            try
            {
                await submitCompletion(
                    participantId,
                    new SupabaseCoopCompletionInput
                    {
                        idempotencyKey = Guid.NewGuid().ToString(),
                        quickReport = selectedQuickReport,
                        reflection = GetInputValue(reflectionInput),
                        mood = GetInputValue(moodInput),
                        difficulty = difficulty,
                    });
                selectedState = await loadState(selectedAdventureId);
                RenderState();
                SetStatus("完成回報已送出，等待家長批改。", false);
            }
            catch (Exception exception)
            {
                SetStatus("完成回報失敗：" + exception.Message, true);
            }
            finally
            {
                if (button != null) button.interactable = true;
            }
        }

        private void SetQuickReport(string quickReport)
        {
            selectedQuickReport = quickReport;
            UpdateQuickReportButtons();
        }

        private void UpdateQuickReportButtons()
        {
            SetButtonLabel(smoothButton, selectedQuickReport == "smooth" ? "✓ 順利" : "順利");
            SetButtonLabel(hardButton, selectedQuickReport == "hard" ? "✓ 有點難" : "有點難");
            SetButtonLabel(helpButton, selectedQuickReport == "help" ? "✓ 需要幫忙" : "需要幫忙");
        }

        private static string GetInputValue(InputField input)
        {
            return input == null || string.IsNullOrWhiteSpace(input.text)
                ? null
                : input.text.Trim();
        }

        private void CreateStateText(string content, Color color)
        {
            Text text = HabitHeroUiFactory.CreateText(
                stateListObject.transform,
                font,
                content,
                14,
                TextAnchor.MiddleLeft,
                color,
                Vector2.zero,
                Vector2.one);
            LayoutElement layout = text.gameObject.AddComponent<LayoutElement>();
            layout.minHeight = 26f;
            layout.preferredHeight = 26f;
        }

        private Button CreateStateButton(string label)
        {
            Button button = CreateRowButton(stateListObject.transform, label);
            button.GetComponent<LayoutElement>().preferredWidth = 180f;
            return button;
        }

        private static string GetStatusLabel(string status)
        {
            if (status == "active") return "進行中";
            if (status == "completed") return "已完成";
            if (status == "revision_requested") return "需要修改";
            if (status == "pending") return "等待批改";
            return string.IsNullOrWhiteSpace(status) ? "尚未回報" : status;
        }

        private GameObject CreateList(
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
            layout.spacing = 4f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }

        private GameObject CreateRow(Transform parent, string name)
        {
            GameObject row = new GameObject(
                name,
                typeof(RectTransform),
                typeof(HorizontalLayoutGroup));
            row.transform.SetParent(parent, false);
            RectTransform rect = row.GetComponent<RectTransform>();
            rect.sizeDelta = new Vector2(0f, 40f);
            HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
            layout.spacing = 6f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = false;
            layout.childForceExpandHeight = true;
            return row;
        }

        private Button CreateRowButton(Transform parent, string label)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                Vector2.zero,
                Vector2.one);
            LayoutElement layout = button.gameObject.AddComponent<LayoutElement>();
            layout.preferredWidth = 96f;
            layout.minWidth = 96f;
            return button;
        }

        private void CreateEmptyText(Transform parent, string content)
        {
            Text text = HabitHeroUiFactory.CreateText(
                parent,
                font,
                content,
                14,
                TextAnchor.MiddleCenter,
                new Color(0.74f, 0.81f, 0.9f, 1f),
                Vector2.zero,
                Vector2.one);
            LayoutElement layout = text.gameObject.AddComponent<LayoutElement>();
            layout.minHeight = 34f;
            layout.preferredHeight = 34f;
        }

        private static void ClearChildren(Transform parent)
        {
            if (parent == null) return;
            foreach (Transform child in parent)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }
        }

        private static void SetButtonLabel(Button button, string label)
        {
            if (button == null) return;
            Text text = button.GetComponentInChildren<Text>();
            if (text != null) text.text = label;
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void CloseFromButton()
        {
            Action callback = onClose;
            ClosePanel();
            if (callback != null) callback();
        }

        private void ClosePanel()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            taskListObject = null;
            adventureListObject = null;
            stateListObject = null;
            statusText = null;
            reflectionInput = null;
            moodInput = null;
            difficultyInput = null;
            completionStatusText = null;
            smoothButton = null;
            hardButton = null;
            helpButton = null;
        }
    }
}
