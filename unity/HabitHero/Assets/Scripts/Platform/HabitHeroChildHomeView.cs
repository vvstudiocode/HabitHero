using System;
using System.Globalization;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildHomeView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject reportPanel;
        private GameObject timerPanel;
        private GameObject rewardPanel;
        private Text statusText;
        private Text pointsText;
        private Text reportStatus;
        private Text timerText;
        private Text timerStatus;
        private Text rewardStatus;
        private InputField reflectionInput;
        private Button reportSubmitButton;
        private Button timerActionButton;
        private SupabaseChildTaskRecord activeTimerTask;
        private Button activeTimerTaskButton;
        private SupabaseTaskTimerSessionRecord activeTimer;
        private SupabaseTaskTimerSessionRecord[] timerSessions;
        private GameObject taskListObject;
        private SupabaseChildHomeSnapshot latestSnapshot;
        private CancellationTokenSource timerLoopCancellation;
        private Func<
            SupabaseChildTaskRecord,
            SupabaseTaskCompletionDraft,
            Task<SupabaseTaskCompletionResult>> submitTask;
        private Func<string, Task<SupabaseTaskTimerSessionRecord>> startTimer;
        private Func<string, Task<SupabaseTaskTimerSessionRecord>> pauseTimer;
        private Func<string, Task<SupabaseTaskTimerSessionRecord>> resumeTimer;
        private Func<string, Task<SupabaseRewardRedemptionResult>> redeemReward;
        private string selectedMood;
        private int selectedDifficulty;

        public HabitHeroChildHomeView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildHomeSnapshot snapshot,
            Func<
                SupabaseChildTaskRecord,
                SupabaseTaskCompletionDraft,
                Task<SupabaseTaskCompletionResult>> submitTask,
            Func<string, Task<SupabaseTaskTimerSessionRecord>> startTimer,
            Func<string, Task<SupabaseTaskTimerSessionRecord>> pauseTimer,
            Func<string, Task<SupabaseTaskTimerSessionRecord>> resumeTimer,
            Func<string, Task<SupabaseRewardRedemptionResult>> redeemReward,
            Action onSignOut)
        {
            if (snapshot == null || snapshot.child == null)
            {
                throw new ArgumentNullException("snapshot");
            }

            Dispose();
            this.submitTask = submitTask;
            this.startTimer = startTimer;
            this.pauseTimer = pauseTimer;
            this.resumeTimer = resumeTimer;
            this.redeemReward = redeemReward;
            latestSnapshot = snapshot;
            timerSessions = snapshot.timers ?? new SupabaseTaskTimerSessionRecord[0];
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                HabitHeroUiFactory.PanelColor,
                "ChildHomePanel");
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(680f, 720f);
            panelRect.anchoredPosition = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "今日任務",
                40,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.95f));
            pointsText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                snapshot.child.display_name + "　目前點數：" + snapshot.child.points_balance,
                21,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.76f),
                new Vector2(0.92f, 0.84f));

            Button signOutButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "登出",
                new Vector2(0.72f, 0.91f),
                new Vector2(0.91f, 0.97f));
            signOutButton.onClick.AddListener(() => onSignOut());

            taskListObject = new GameObject(
                "TaskList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            taskListObject.transform.SetParent(panel.transform, false);
            RectTransform taskListRect = taskListObject.GetComponent<RectTransform>();
            taskListRect.anchorMin = new Vector2(0.08f, 0.18f);
            taskListRect.anchorMax = new Vector2(0.92f, 0.74f);
            taskListRect.offsetMin = Vector2.zero;
            taskListRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = taskListObject.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 12f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;

            RenderTaskList(snapshot);

            Button rewardsButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "獎勵商店",
                new Vector2(0.08f, 0.14f),
                new Vector2(0.92f, 0.2f));
            rewardsButton.onClick.AddListener(OpenRewardPanel);

            statusText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "任務資料已從 Supabase 載入。",
                17,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.04f),
                new Vector2(0.92f, 0.13f));
        }

        public void Dispose()
        {
            submitTask = null;
            startTimer = null;
            pauseTimer = null;
            resumeTimer = null;
            redeemReward = null;
            timerSessions = null;
            latestSnapshot = null;
            pointsText = null;
            taskListObject = null;
            CloseReportPanel();
            CloseTimerPanel();
            CloseRewardPanel();
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            statusText = null;
        }

        public void ApplySnapshot(SupabaseChildHomeSnapshot snapshot)
        {
            if (snapshot == null || snapshot.child == null || panel == null) return;
            latestSnapshot = snapshot;
            timerSessions = snapshot.timers ?? new SupabaseTaskTimerSessionRecord[0];
            if (pointsText != null)
            {
                pointsText.text = snapshot.child.display_name
                    + "　目前點數："
                    + snapshot.child.points_balance;
            }

            RenderTaskList(snapshot);
            SetStatus("點數與任務資料已更新。", false);
        }

        private void RenderTaskList(SupabaseChildHomeSnapshot snapshot)
        {
            if (taskListObject == null) return;
            foreach (Transform child in taskListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleTaskCount = 0;
            foreach (SupabaseChildTaskRecord task in snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (!IsDisplayable(task) || visibleTaskCount >= 8) continue;
                Button taskButton = HabitHeroUiFactory.CreateButton(
                    taskListObject.transform,
                    font,
                    GetTaskLabel(task, FindTimer(task.id)),
                    Vector2.zero,
                    Vector2.one);
                RectTransform taskRect = taskButton.GetComponent<RectTransform>();
                taskRect.sizeDelta = new Vector2(0f, 58f);
                bool canInteract = IsActionable(task.status) && !task.pendingSync;
                taskButton.interactable = canInteract;
                if (canInteract)
                {
                    taskButton.onClick.AddListener(() => HandleTaskClicked(task, taskButton));
                }
                visibleTaskCount += 1;
            }

            if (visibleTaskCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    taskListObject.transform,
                    font,
                    "今天暫時沒有待完成任務。",
                    22,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void OpenRewardPanel()
        {
            if (latestSnapshot == null || redeemReward == null)
            {
                SetStatus("獎勵商店尚未連線。", true);
                return;
            }

            CloseRewardPanel();
            rewardPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "RewardPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                rewardPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "RewardCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.1f, 0.16f);
            cardRect.anchorMax = new Vector2(0.9f, 0.84f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "獎勵商店",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.87f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "目前點數：" + latestSnapshot.child.points_balance,
                18,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.79f),
                new Vector2(0.92f, 0.87f));

            GameObject rewardList = new GameObject(
                "RewardList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            rewardList.transform.SetParent(card.transform, false);
            RectTransform rewardListRect = rewardList.GetComponent<RectTransform>();
            rewardListRect.anchorMin = new Vector2(0.08f, 0.22f);
            rewardListRect.anchorMax = new Vector2(0.92f, 0.77f);
            rewardListRect.offsetMin = Vector2.zero;
            rewardListRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = rewardList.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 10f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;

            int visibleRewardCount = 0;
            foreach (SupabaseChildRewardRecord reward in
                latestSnapshot.rewards ?? new SupabaseChildRewardRecord[0])
            {
                if (reward == null || visibleRewardCount >= 8) continue;
                Button rewardButton = HabitHeroUiFactory.CreateButton(
                    rewardList.transform,
                    font,
                    reward.name + "　" + reward.points + " 點",
                    Vector2.zero,
                    Vector2.one);
                rewardButton.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 52f);
                bool canAfford = latestSnapshot.child.points_balance >= reward.points;
                rewardButton.interactable = canAfford;
                if (canAfford)
                {
                    rewardButton.onClick.AddListener(() =>
                        RedeemRewardAsync(reward, rewardButton));
                }
                visibleRewardCount += 1;
            }

            if (visibleRewardCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    rewardList.transform,
                    font,
                    "目前還沒有可兌換的獎勵。",
                    21,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }

            rewardStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "點選想兌換的獎勵。",
                16,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.13f),
                new Vector2(0.92f, 0.2f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.04f),
                new Vector2(0.65f, 0.11f));
            closeButton.onClick.AddListener(CloseRewardPanel);
        }

        private async void RedeemRewardAsync(
            SupabaseChildRewardRecord reward,
            Button rewardButton)
        {
            if (reward == null || redeemReward == null) return;
            if (rewardButton != null) rewardButton.interactable = false;
            SetRewardStatus("正在兌換「" + reward.name + "」…", false);
            try
            {
                SupabaseRewardRedemptionResult result = await redeemReward(reward.id);
                if (result == null || result.Ticket == null)
                {
                    SetRewardStatus("兌換回應無效，請稍後再試。", true);
                    return;
                }

                if (result.RefreshedSnapshot != null)
                {
                    ApplySnapshot(result.RefreshedSnapshot);
                }

                CloseRewardPanel();
                SetStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "獎勵已兌換，點數與紀錄已更新。"
                        : "獎勵已兌換；點數更新稍後會自動重試。",
                    false);
            }
            catch (Exception exception)
            {
                SetRewardStatus("兌換失敗：" + exception.Message, true);
                if (rewardButton != null) rewardButton.interactable = true;
            }
        }

        private void CloseRewardPanel()
        {
            if (rewardPanel != null)
            {
                UnityEngine.Object.Destroy(rewardPanel);
                rewardPanel = null;
            }

            rewardStatus = null;
        }

        private void SetRewardStatus(string message, bool isError)
        {
            if (rewardStatus == null) return;
            rewardStatus.text = message;
            rewardStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void HandleTaskClicked(
            SupabaseChildTaskRecord task,
            Button button)
        {
            if (task == null || button == null) return;
            if (task.requires_timer && !IsTimerReady(task))
            {
                OpenTimerPanel(task, button);
                return;
            }

            HandleTaskSubmit(task, button);
        }

        private void HandleTaskSubmit(
            SupabaseChildTaskRecord task,
            Button button)
        {
            if (task == null || button == null) return;
            if (task.requires_timer && !IsTimerReady(task))
            {
                OpenTimerPanel(task, button);
                return;
            }

            if (task.completion_report_mode == "none")
            {
                SubmitAsync(task, new SupabaseTaskCompletionDraft(), button);
                return;
            }

            OpenReportPanel(task, button);
        }

        private void OpenTimerPanel(
            SupabaseChildTaskRecord task,
            Button taskButton)
        {
            if (startTimer == null || pauseTimer == null || resumeTimer == null)
            {
                SetStatus("計時功能尚未連線。", true);
                return;
            }

            CloseTimerPanel();
            activeTimerTask = task;
            activeTimerTaskButton = taskButton;
            activeTimer = FindTimer(task.id);
            timerPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "TaskTimerPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                timerPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "TaskTimerCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.12f, 0.27f);
            cardRect.anchorMax = new Vector2(0.88f, 0.73f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "任務計時",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.77f),
                new Vector2(0.92f, 0.94f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                task.name,
                22,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.66f),
                new Vector2(0.92f, 0.77f));
            timerText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "--:--",
                52,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.42f),
                new Vector2(0.92f, 0.62f));
            timerStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                17,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.31f),
                new Vector2(0.92f, 0.4f));
            timerActionButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                GetTimerActionLabel(),
                new Vector2(0.2f, 0.16f),
                new Vector2(0.8f, 0.27f));
            timerActionButton.onClick.AddListener(HandleTimerAction);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.04f),
                new Vector2(0.65f, 0.12f));
            closeButton.onClick.AddListener(CloseTimerPanel);
            UpdateTimerDisplay();
            timerLoopCancellation = new CancellationTokenSource();
            _ = RunTimerDisplayLoopAsync(timerLoopCancellation.Token);
        }

        private async void HandleTimerAction()
        {
            if (activeTimerTask == null || timerActionButton == null) return;
            timerActionButton.interactable = false;
            try
            {
                if (activeTimer == null)
                {
                    activeTimer = await startTimer(activeTimerTask.id);
                }
                else if (activeTimer.status == "paused")
                {
                    activeTimer = await resumeTimer(activeTimerTask.id);
                }
                else if (activeTimer.status == "running")
                {
                    activeTimer = await pauseTimer(activeTimerTask.id);
                }

                ReplaceTimerSession(activeTimer);
                UpdateTimerDisplay();
            }
            catch (Exception exception)
            {
                SetStatus("計時同步失敗：" + exception.Message, true);
            }
            finally
            {
                if (timerActionButton != null) timerActionButton.interactable = true;
            }
        }

        private async Task RunTimerDisplayLoopAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested && timerPanel != null)
            {
                UpdateTimerDisplay();
                try
                {
                    await Task.Delay(1000, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }

        private void UpdateTimerDisplay()
        {
            if (activeTimerTask == null || timerText == null) return;
            int remainingSeconds = GetRemainingSeconds(activeTimerTask, activeTimer);
            timerText.text = string.Format(
                CultureInfo.InvariantCulture,
                "{0:00}:{1:00}",
                remainingSeconds / 60,
                remainingSeconds % 60);
            bool ready = remainingSeconds == 0 && activeTimer != null;
            if (ready && activeTimerTaskButton != null)
            {
                activeTimerTaskButton.interactable = true;
                Text buttonText = activeTimerTaskButton.GetComponentInChildren<Text>();
                if (buttonText != null) buttonText.text = "計時完成，送出回報";
            }

            if (timerStatus != null)
            {
                timerStatus.text = ready
                    ? "時間已到，關閉後即可送出回報。"
                    : GetTimerStatusLabel();
            }
            if (timerActionButton != null)
            {
                timerActionButton.interactable = !ready;
                Text buttonText = timerActionButton.GetComponentInChildren<Text>();
                if (buttonText != null) buttonText.text = GetTimerActionLabel();
            }
        }

        private string GetTimerStatusLabel()
        {
            if (activeTimer == null) return "按下開始計時。";
            if (activeTimer.status == "paused") return "計時已暫停。";
            if (activeTimer.status == "running") return "計時進行中。";
            return "計時已完成。";
        }

        private string GetTimerActionLabel()
        {
            if (activeTimer == null) return "開始計時";
            if (activeTimer.status == "paused") return "繼續計時";
            if (activeTimer.status == "running") return "暫停計時";
            return "已完成";
        }

        private void ReplaceTimerSession(SupabaseTaskTimerSessionRecord session)
        {
            if (session == null) return;
            if (timerSessions == null) timerSessions = new SupabaseTaskTimerSessionRecord[0];
            for (int index = 0; index < timerSessions.Length; index += 1)
            {
                if (timerSessions[index].task_id == session.task_id)
                {
                    timerSessions[index] = session;
                    return;
                }
            }

            SupabaseTaskTimerSessionRecord[] updated =
                new SupabaseTaskTimerSessionRecord[timerSessions.Length + 1];
            timerSessions.CopyTo(updated, 0);
            updated[updated.Length - 1] = session;
            timerSessions = updated;
        }

        private void OpenReportPanel(
            SupabaseChildTaskRecord task,
            Button taskButton)
        {
            CloseReportPanel();
            selectedMood = "happy";
            selectedDifficulty = 3;
            reportPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "TaskReportPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                reportPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "TaskReportCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.12f, 0.2f);
            cardRect.anchorMax = new Vector2(0.88f, 0.8f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "完成回報",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.96f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                task.name,
                22,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.75f),
                new Vector2(0.92f, 0.84f));

            if (task.completion_report_mode == "quick")
            {
                BuildQuickReport(card.transform, task, taskButton);
            }
            else
            {
                BuildReflectionReport(card.transform, task, taskButton);
            }

            Button cancelButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "取消",
                new Vector2(0.35f, 0.04f),
                new Vector2(0.65f, 0.12f));
            cancelButton.onClick.AddListener(CloseReportPanel);
        }

        private void BuildQuickReport(
            Transform card,
            SupabaseChildTaskRecord task,
            Button taskButton)
        {
            HabitHeroUiFactory.CreateText(
                card,
                font,
                "這次完成得怎麼樣？",
                20,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.65f),
                new Vector2(0.92f, 0.73f));
            AddReportChoice(card, task, taskButton, "smooth", "順利完成", 0.53f);
            AddReportChoice(card, task, taskButton, "hard", "有點困難", 0.41f);
            AddReportChoice(card, task, taskButton, "help", "需要幫忙", 0.29f);
        }

        private void AddReportChoice(
            Transform card,
            SupabaseChildTaskRecord task,
            Button taskButton,
            string report,
            string label,
            float yMin)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                card,
                font,
                label,
                new Vector2(0.14f, yMin),
                new Vector2(0.86f, yMin + 0.09f));
            button.onClick.AddListener(() => SubmitAsync(
                task,
                new SupabaseTaskCompletionDraft { quickReport = report },
                taskButton));
        }

        private void BuildReflectionReport(
            Transform card,
            SupabaseChildTaskRecord task,
            Button taskButton)
        {
            HabitHeroUiFactory.CreateText(
                card,
                font,
                "寫下完成心得",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.68f),
                new Vector2(0.9f, 0.74f));
            reflectionInput = HabitHeroUiFactory.CreateInput(
                card,
                font,
                "例如：我完成了整理書包",
                false,
                new Vector2(0.1f, 0.55f),
                new Vector2(0.9f, 0.68f));
            reflectionInput.contentType = InputField.ContentType.Standard;
            reflectionInput.lineType = InputField.LineType.MultiLineNewline;
            reflectionInput.text = task.child_reflection_text ?? string.Empty;

            HabitHeroUiFactory.CreateText(
                card,
                font,
                "現在的心情",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.46f),
                new Vector2(0.9f, 0.52f));
            string[] moods = { "proud", "happy", "calm", "okay", "tired", "frustrated" };
            string[] moodLabels = { "驕傲", "開心", "平靜", "還好", "疲累", "挫折" };
            for (int index = 0; index < moods.Length; index += 1)
            {
                int row = index / 3;
                int column = index % 3;
                float xMin = 0.1f + column * 0.27f;
                float yMin = 0.37f - row * 0.08f;
                string mood = moods[index];
                Button moodButton = HabitHeroUiFactory.CreateButton(
                    card,
                    font,
                    moodLabels[index],
                    new Vector2(xMin, yMin),
                    new Vector2(xMin + 0.24f, yMin + 0.065f));
                moodButton.onClick.AddListener(() =>
                {
                    selectedMood = mood;
                    SetReportStatus("已選擇心情。", false);
                });
            }

            HabitHeroUiFactory.CreateText(
                card,
                font,
                "難度：" + selectedDifficulty,
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.19f),
                new Vector2(0.45f, 0.25f));
            for (int difficulty = 1; difficulty <= 5; difficulty += 1)
            {
                int selected = difficulty;
                float xMin = 0.48f + (difficulty - 1) * 0.085f;
                Button difficultyButton = HabitHeroUiFactory.CreateButton(
                    card,
                    font,
                    difficulty.ToString(),
                    new Vector2(xMin, 0.18f),
                    new Vector2(xMin + 0.075f, 0.25f));
                difficultyButton.onClick.AddListener(() =>
                {
                    selectedDifficulty = selected;
                    SetReportStatus("難度已選為 " + selectedDifficulty + "。", false);
                });
            }

            reportStatus = HabitHeroUiFactory.CreateText(
                card,
                font,
                "請完成心得、心情與難度。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.12f),
                new Vector2(0.92f, 0.18f));
            reportSubmitButton = HabitHeroUiFactory.CreateButton(
                card,
                font,
                "送出回報",
                new Vector2(0.1f, 0.04f),
                new Vector2(0.32f, 0.12f));
            reportSubmitButton.onClick.AddListener(() => SubmitReflection(
                task,
                taskButton));
        }

        private void SubmitReflection(
            SupabaseChildTaskRecord task,
            Button taskButton)
        {
            string reflection = reflectionInput == null ? string.Empty : reflectionInput.text.Trim();
            if (string.IsNullOrWhiteSpace(reflection))
            {
                SetReportStatus("請先寫下一句完成心得。", true);
                return;
            }

            SubmitAsync(
                task,
                new SupabaseTaskCompletionDraft
                {
                    reflection = reflection,
                    mood = selectedMood,
                    difficulty = selectedDifficulty,
                },
                taskButton);
        }

        private async void SubmitAsync(
            SupabaseChildTaskRecord task,
            SupabaseTaskCompletionDraft draft,
            Button taskButton)
        {
            if (submitTask == null || task == null) return;
            if (reportSubmitButton != null) reportSubmitButton.interactable = false;
            if (taskButton != null) taskButton.interactable = false;
            SetStatus("正在送出「" + task.name + "」…", false);
            try
            {
                SupabaseTaskCompletionResult result = await submitTask(task, draft);
                CloseReportPanel();
                if (taskButton != null)
                {
                    Text buttonText = taskButton.GetComponentInChildren<Text>();
                    if (buttonText != null)
                    {
                        buttonText.text = result != null && result.QueuedForRetry
                            ? "已保存，等待同步"
                            : "已送出回報";
                    }
                }

                if (result != null && result.QueuedForRetry)
                {
                    SetStatus("已保存到本機，恢復網路後會自動同步。", false);
                }
                else if (result != null && !string.IsNullOrWhiteSpace(result.RefreshError))
                {
                    SetStatus("任務已送出；點數更新稍後會自動重試。", false);
                }
                else if (result != null && result.RefreshedSnapshot != null)
                {
                    SetStatus("任務已送出，點數與任務資料已更新。", false);
                }
                else
                {
                    SetStatus("任務已送出，等待家長確認點數。", false);
                }
            }
            catch (Exception exception)
            {
                if (taskButton != null) taskButton.interactable = true;
                if (reportSubmitButton != null) reportSubmitButton.interactable = true;
                SetReportStatus("任務同步失敗：" + exception.Message, true);
            }
        }

        private void CloseReportPanel()
        {
            if (reportPanel != null)
            {
                UnityEngine.Object.Destroy(reportPanel);
                reportPanel = null;
            }

            reflectionInput = null;
            reportStatus = null;
            reportSubmitButton = null;
        }

        private void CloseTimerPanel()
        {
            if (timerLoopCancellation != null)
            {
                timerLoopCancellation.Cancel();
                timerLoopCancellation.Dispose();
                timerLoopCancellation = null;
            }

            if (timerPanel != null)
            {
                UnityEngine.Object.Destroy(timerPanel);
                timerPanel = null;
            }

            timerText = null;
            timerStatus = null;
            timerActionButton = null;
            activeTimerTask = null;
            activeTimerTaskButton = null;
            activeTimer = null;
        }

        private void SetReportStatus(string message, bool isError)
        {
            if (reportStatus == null)
            {
                SetStatus(message, isError);
                return;
            }

            reportStatus.text = message;
            reportStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private static bool IsDisplayable(SupabaseChildTaskRecord task)
        {
            return task != null
                && task.status != "completed"
                && task.status != "cancelled";
        }

        private static bool IsActionable(string status)
        {
            return status == "todo"
                || status == "revision_requested"
                || status == "proposed"
                || status == "proposal_revision_requested";
        }

        private SupabaseTaskTimerSessionRecord FindTimer(string taskId)
        {
            if (timerSessions == null) return null;
            foreach (SupabaseTaskTimerSessionRecord timer in timerSessions)
            {
                if (timer != null && timer.task_id == taskId) return timer;
            }

            return null;
        }

        private bool IsTimerReady(SupabaseChildTaskRecord task)
        {
            if (task == null || !task.requires_timer) return true;
            SupabaseTaskTimerSessionRecord timer = activeTimerTask != null
                && activeTimerTask.id == task.id
                ? activeTimer
                : FindTimer(task.id);
            return timer != null && GetRemainingSeconds(task, timer) == 0;
        }

        private static int GetRemainingSeconds(
            SupabaseChildTaskRecord task,
            SupabaseTaskTimerSessionRecord timer)
        {
            if (task == null || task.duration_minutes <= 0) return 0;
            int elapsedSeconds = timer == null ? 0 : timer.accumulated_seconds;
            if (timer != null && timer.status == "running"
                && DateTimeOffset.TryParse(
                    timer.last_resumed_at,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out DateTimeOffset resumedAt))
            {
                elapsedSeconds += Math.Max(
                    0,
                    (int)Math.Floor((DateTimeOffset.UtcNow - resumedAt).TotalSeconds));
            }

            return Math.Max(0, task.duration_minutes * 60 - elapsedSeconds);
        }

        private string GetTaskLabel(
            SupabaseChildTaskRecord task,
            SupabaseTaskTimerSessionRecord timer)
        {
            if (task.pendingSync) return task.name + "　同步待處理";
            if (task.status == "pending") return task.name + "　等待家長確認";
            if (task.requires_timer && timer != null && GetRemainingSeconds(task, timer) == 0)
            {
                return task.name + "　計時完成，送出回報";
            }
            if (task.requires_timer) return task.name + "　需要完成計時";
            return task.name + " 　+" + task.points + " 點";
        }
    }
}
