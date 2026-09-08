using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentHomeView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject reviewPanel;
        private GameObject rewardPanel;
        private GameObject wishlistApprovalPanel;
        private GameObject taskListObject;
        private HabitHeroParentTaskCreateView taskCreateView;
        private HabitHeroParentTaskManagementView taskManagementView;
        private HabitHeroParentTaskTemplateView taskTemplateView;
        private HabitHeroParentGeneralAdventureCreateView generalAdventureCreateView;
        private HabitHeroParentAdventureScheduleView adventureScheduleView;
        private HabitHeroParentRewardManagementView rewardManagementView;
        private HabitHeroParentPointAdjustmentView pointAdjustmentView;
        private HabitHeroParentChildAccountView childAccountView;
        private HabitHeroParentChildPreviewView childPreviewView;
        private HabitHeroParentCoopAdventureView coopAdventureView;
        private HabitHeroParentGoalReviewView goalReviewView;
        private Text statusText;
        private Text summaryText;
        private Text reviewStatus;
        private Text rewardStatus;
        private Text wishlistApprovalStatus;
        private InputField feedbackInput;
        private InputField revisionInput;
        private InputField wishlistPointsInput;
        private Button approveButton;
        private Button reviseButton;
        private Button approveWishlistButton;
        private SupabaseParentHomeSnapshot latestSnapshot;
        private SupabaseChildTaskRecord activeReviewTask;
        private SupabaseChildWishlistRecord activeWishlist;
        private Func<
            SupabaseChildTaskRecord,
            bool,
            int?,
            string,
            string,
            string,
            string,
            Task<SupabaseParentTaskReviewResult>> reviewTask;
        private Func<
            SupabaseChildTaskRecord,
            string,
            int,
            string,
            Task<SupabaseParentTaskReviewResult>> confirmChildGoal;
        private Func<
            SupabaseChildTaskRecord,
            string,
            Task<SupabaseParentTaskReviewResult>> returnChildGoal;
        private Func<
            SupabaseChildWishlistRecord,
            int,
            Task<SupabaseParentRewardMutationResult>> approveWishlist;
        private Func<string, Task<SupabaseParentRewardMutationResult>> fulfillTicket;
        private Func<
            SupabaseParentTaskCreateInput,
            Task<SupabaseParentTaskMutationResult>> createTask;
        private Func<
            string,
            SupabaseParentTaskUpdateInput,
            Task<SupabaseParentTaskMutationResult>> updateTask;
        private Func<string, Task<SupabaseParentTaskMutationResult>> deleteTask;
        private Func<
            SupabaseParentTaskTemplateCreateInput,
            Task<SupabaseParentTaskTemplateMutationResult>> createTaskTemplate;
        private Func<
            string,
            SupabaseParentTaskTemplateUpdateInput,
            Task<SupabaseParentTaskTemplateMutationResult>> updateTaskTemplate;
        private Func<
            string,
            Task<SupabaseParentTaskTemplateMutationResult>> deleteTaskTemplate;
        private Func<
            SupabaseParentGeneralAdventureCreateInput,
            Task<SupabaseParentAdventureMutationResult>> createGeneralAdventure;
        private Func<
            Task<SupabaseParentAdventureScheduleRecord[]>> loadAdventureSchedules;
        private Func<
            SupabaseParentAdventureScheduleCreateInput,
            Task<string[]>> createAdventureSchedule;
        private Func<
            string,
            SupabaseParentAdventureScheduleUpdateInput,
            Task<SupabaseParentAdventureScheduleRecord>> updateAdventureSchedule;
        private Func<
            string,
            Task<SupabaseParentAdventureScheduleRecord>> disableAdventureSchedule;
        private Func<
            SupabaseParentRewardCreateInput,
            Task<SupabaseParentRewardMutationResult>> createReward;
        private Func<
            SupabaseChildRewardRecord,
            string,
            int,
            Task<SupabaseParentRewardMutationResult>> updateReward;
        private Func<string, Task<SupabaseParentRewardMutationResult>> deleteReward;
        private Func<string, int, string, Task<SupabaseParentPointMutationResult>> adjustPoints;
        private Func<
            SupabaseParentChildAccountCreateInput,
            Task<SupabaseParentChildAccountMutationResult>> createChildAccount;
        private Func<
            string,
            string,
            Task<SupabaseParentChildAccountMutationResult>> resetChildPassword;
        private Func<
            string,
            Task<SupabaseParentChildAccountMutationResult>> deleteChildAccount;
        private Func<
            string,
            Task<SupabaseCoopAdventureSummary[]>> listCoopAdventures;
        private Func<
            string,
            Task<SupabaseCoopAdventureState>> loadCoopAdventureState;
        private Func<
            string,
            SupabaseCoopReviewInput,
            Task<SupabaseCoopMutationResult>> reviewCoopCompletion;
        private Func<string, Task<bool>> enterChildMode;
        private Action onOpenNotificationSettings;

        public HabitHeroParentHomeView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<
                SupabaseChildTaskRecord,
                bool,
                int?,
                string,
                string,
                string,
                string,
                Task<SupabaseParentTaskReviewResult>> reviewTask,
            Func<
                SupabaseChildTaskRecord,
                string,
                int,
                string,
                Task<SupabaseParentTaskReviewResult>> confirmChildGoal,
            Func<
                SupabaseChildTaskRecord,
                string,
                Task<SupabaseParentTaskReviewResult>> returnChildGoal,
            Func<
                SupabaseChildWishlistRecord,
                int,
                Task<SupabaseParentRewardMutationResult>> approveWishlist,
            Func<string, Task<SupabaseParentRewardMutationResult>> fulfillTicket,
            Func<
                SupabaseParentTaskCreateInput,
                Task<SupabaseParentTaskMutationResult>> createTask,
            Func<
                string,
                SupabaseParentTaskUpdateInput,
                Task<SupabaseParentTaskMutationResult>> updateTask,
            Func<string, Task<SupabaseParentTaskMutationResult>> deleteTask,
            Func<
                SupabaseParentTaskTemplateCreateInput,
                Task<SupabaseParentTaskTemplateMutationResult>> createTaskTemplate,
            Func<
                string,
                SupabaseParentTaskTemplateUpdateInput,
                Task<SupabaseParentTaskTemplateMutationResult>> updateTaskTemplate,
            Func<
                string,
                Task<SupabaseParentTaskTemplateMutationResult>> deleteTaskTemplate,
            Func<
                SupabaseParentGeneralAdventureCreateInput,
                Task<SupabaseParentAdventureMutationResult>> createGeneralAdventure,
            Func<Task<SupabaseParentAdventureScheduleRecord[]>> loadAdventureSchedules,
            Func<SupabaseParentAdventureScheduleCreateInput, Task<string[]>> createAdventureSchedule,
            Func<
                string,
                SupabaseParentAdventureScheduleUpdateInput,
                Task<SupabaseParentAdventureScheduleRecord>> updateAdventureSchedule,
            Func<string, Task<SupabaseParentAdventureScheduleRecord>> disableAdventureSchedule,
            Func<
                SupabaseParentRewardCreateInput,
                Task<SupabaseParentRewardMutationResult>> createReward,
            Func<
                SupabaseChildRewardRecord,
                string,
                int,
                Task<SupabaseParentRewardMutationResult>> updateReward,
            Func<string, Task<SupabaseParentRewardMutationResult>> deleteReward,
            Func<string, int, string, Task<SupabaseParentPointMutationResult>> adjustPoints,
            Func<
                SupabaseParentChildAccountCreateInput,
                Task<SupabaseParentChildAccountMutationResult>> createChildAccount,
            Func<
                string,
                string,
                Task<SupabaseParentChildAccountMutationResult>> resetChildPassword,
            Func<
                string,
                Task<SupabaseParentChildAccountMutationResult>> deleteChildAccount,
            Func<string, Task<SupabaseCoopAdventureSummary[]>> listCoopAdventures,
            Func<string, Task<SupabaseCoopAdventureState>> loadCoopAdventureState,
            Func<
                string,
                SupabaseCoopReviewInput,
                Task<SupabaseCoopMutationResult>> reviewCoopCompletion,
            Func<string, Task<bool>> enterChildMode,
            Action onSignOut,
            Action onOpenNotificationSettings)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");

            Dispose();
            latestSnapshot = snapshot;
            this.reviewTask = reviewTask;
            this.confirmChildGoal = confirmChildGoal;
            this.returnChildGoal = returnChildGoal;
            this.approveWishlist = approveWishlist;
            this.fulfillTicket = fulfillTicket;
            this.createTask = createTask;
            this.updateTask = updateTask;
            this.deleteTask = deleteTask;
            this.createTaskTemplate = createTaskTemplate;
            this.updateTaskTemplate = updateTaskTemplate;
            this.deleteTaskTemplate = deleteTaskTemplate;
            this.createGeneralAdventure = createGeneralAdventure;
            this.loadAdventureSchedules = loadAdventureSchedules;
            this.createAdventureSchedule = createAdventureSchedule;
            this.updateAdventureSchedule = updateAdventureSchedule;
            this.disableAdventureSchedule = disableAdventureSchedule;
            this.createReward = createReward;
            this.updateReward = updateReward;
            this.deleteReward = deleteReward;
            this.adjustPoints = adjustPoints;
            this.createChildAccount = createChildAccount;
            this.resetChildPassword = resetChildPassword;
            this.deleteChildAccount = deleteChildAccount;
            this.listCoopAdventures = listCoopAdventures;
            this.loadCoopAdventureState = loadCoopAdventureState;
            this.reviewCoopCompletion = reviewCoopCompletion;
            this.enterChildMode = enterChildMode;
            this.onOpenNotificationSettings = onOpenNotificationSettings;
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                HabitHeroUiFactory.PanelColor,
                "ParentHomePanel");
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(680f, 720f);
            panelRect.anchoredPosition = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "家長工作台",
                40,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.85f),
                new Vector2(0.92f, 0.95f));
            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                snapshot.family == null ? "我的家庭" : snapshot.family.name,
                21,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.78f),
                new Vector2(0.92f, 0.85f));
            summaryText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                string.Empty,
                18,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.7f),
                new Vector2(0.92f, 0.77f));

            if (onOpenNotificationSettings != null)
            {
                Button notificationButton = HabitHeroUiFactory.CreateButton(
                    panel.transform,
                    font,
                    "通知",
                    new Vector2(0.08f, 0.91f),
                    new Vector2(0.25f, 0.97f));
                notificationButton.onClick.AddListener(
                    () => onOpenNotificationSettings());
            }

            Button signOutButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "登出",
                new Vector2(0.72f, 0.91f),
                new Vector2(0.91f, 0.97f));
            signOutButton.onClick.AddListener(() => onSignOut());
            Button childPreviewButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "孩子視角",
                new Vector2(0.5f, 0.91f),
                new Vector2(0.69f, 0.97f));
            childPreviewButton.onClick.AddListener(OpenChildPreviewPanel);
            Button taskManagementButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "任務管理",
                new Vector2(0.28f, 0.91f),
                new Vector2(0.49f, 0.97f));
            taskManagementButton.onClick.AddListener(OpenTaskManagementPanel);

            taskListObject = new GameObject(
                "ParentPendingTaskList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            taskListObject.transform.SetParent(panel.transform, false);
            RectTransform taskListRect = taskListObject.GetComponent<RectTransform>();
            taskListRect.anchorMin = new Vector2(0.08f, 0.25f);
            taskListRect.anchorMax = new Vector2(0.92f, 0.61f);
            taskListRect.offsetMin = Vector2.zero;
            taskListRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = taskListObject.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 10f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;

            RenderSnapshot(snapshot);
            Button createTaskButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "建立孩子任務",
                new Vector2(0.08f, 0.63f),
                new Vector2(0.35f, 0.69f));
            createTaskButton.onClick.AddListener(OpenTaskCreatePanel);
            Button templateButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "任務模板",
                new Vector2(0.37f, 0.63f),
                new Vector2(0.63f, 0.69f));
            templateButton.onClick.AddListener(OpenTaskTemplatePanel);
            Button createAdventureButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "建立冒險",
                new Vector2(0.65f, 0.63f),
                new Vector2(0.92f, 0.69f));
            createAdventureButton.onClick.AddListener(OpenGeneralAdventurePanel);
            Button rewardButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "願望與獎勵券",
                new Vector2(0.72f, 0.18f),
                new Vector2(0.92f, 0.24f));
            rewardButton.onClick.AddListener(OpenRewardPanel);
            Button scheduleButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "每日排程",
                new Vector2(0.31f, 0.18f),
                new Vector2(0.5f, 0.24f));
            scheduleButton.onClick.AddListener(OpenAdventureSchedulePanel);
            Button childAccountButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "孩子帳號",
                new Vector2(0.08f, 0.18f),
                new Vector2(0.29f, 0.24f));
            childAccountButton.onClick.AddListener(OpenChildAccountPanel);
            Button coopAdventureButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "合作批改",
                new Vector2(0.52f, 0.18f),
                new Vector2(0.7f, 0.24f));
            coopAdventureButton.onClick.AddListener(OpenCoopAdventurePanel);
            statusText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "點選待審任務即可核准或要求修改。",
                17,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.03f),
                new Vector2(0.92f, 0.16f));
        }

        public void Dispose()
        {
            reviewTask = null;
            confirmChildGoal = null;
            returnChildGoal = null;
            approveWishlist = null;
            fulfillTicket = null;
            createTask = null;
            updateTask = null;
            deleteTask = null;
            createTaskTemplate = null;
            updateTaskTemplate = null;
            deleteTaskTemplate = null;
            createGeneralAdventure = null;
            loadAdventureSchedules = null;
            createAdventureSchedule = null;
            updateAdventureSchedule = null;
            disableAdventureSchedule = null;
            createReward = null;
            updateReward = null;
            deleteReward = null;
            adjustPoints = null;
            createChildAccount = null;
            resetChildPassword = null;
            deleteChildAccount = null;
            listCoopAdventures = null;
            loadCoopAdventureState = null;
            reviewCoopCompletion = null;
            enterChildMode = null;
            onOpenNotificationSettings = null;
            latestSnapshot = null;
            activeReviewTask = null;
            activeWishlist = null;
            taskListObject = null;
            summaryText = null;
            statusText = null;
            CloseReviewPanel();
            CloseGoalReviewPanel();
            CloseWishlistApprovalPanel();
            CloseRewardPanel();
            CloseTaskCreatePanel();
            CloseTaskManagementPanel();
            CloseTaskTemplatePanel();
            CloseGeneralAdventurePanel();
            CloseAdventureSchedulePanel();
            CloseRewardManagementPanel();
            ClosePointAdjustmentPanel();
            CloseChildAccountPanel();
            CloseChildPreviewPanel();
            CloseCoopAdventurePanel();
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null || panel == null) return;
            if (snapshot.taskTemplates == null && latestSnapshot != null)
            {
                snapshot.taskTemplates = latestSnapshot.taskTemplates;
            }
            latestSnapshot = snapshot;
            RenderSnapshot(snapshot);
            if (childPreviewView != null)
            {
                childPreviewView.ApplySnapshot(snapshot);
            }
            if (taskManagementView != null)
            {
                taskManagementView.ApplySnapshot(snapshot);
            }
            if (taskTemplateView != null)
            {
                taskTemplateView.ApplySnapshot(snapshot);
            }
            SetStatus("家庭資料、待審任務與點數已更新。", false);
        }

        private void RenderSnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            int childCount = snapshot.children == null ? 0 : snapshot.children.Length;
            int pendingCount = 0;
            int goalProposalCount = 0;
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (task != null && task.status == "pending") pendingCount += 1;
                if (HabitHeroParentGoalReviewEligibility.NeedsReview(task))
                {
                    goalProposalCount += 1;
                }
            }

            if (summaryText != null)
            {
                summaryText.text = string.Format(
                    CultureInfo.InvariantCulture,
                    "{0} 位孩子　．　{1} 個待確認目標　．　{2} 件待審任務　．　{3} 張待領獎勵券",
                    childCount,
                    goalProposalCount,
                    pendingCount,
                    snapshot.tickets == null ? 0 : snapshot.tickets.Length);
            }

            if (taskListObject == null) return;
            foreach (Transform child in taskListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleTaskCount = 0;
            foreach (SupabaseChildTaskRecord task in
                snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (task == null
                    || (!HabitHeroParentGoalReviewEligibility.NeedsReview(task)
                        && task.status != "pending")
                    || visibleTaskCount >= 8)
                {
                    continue;
                }

                Button taskButton = HabitHeroUiFactory.CreateButton(
                    taskListObject.transform,
                    font,
                    GetChildName(task.child_profile_id) + "　"
                        + GetReviewTaskLabel(task) + "　" + task.name
                        + "　+" + task.points + " 點",
                    Vector2.zero,
                    Vector2.one);
                taskButton.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 58f);
                taskButton.onClick.AddListener(() => OpenReviewPanel(task));
                visibleTaskCount += 1;
            }

            if (visibleTaskCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    taskListObject.transform,
                    font,
                    "目前沒有等待家長確認的任務。",
                    22,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void OpenRewardPanel()
        {
            if (latestSnapshot == null || approveWishlist == null || fulfillTicket == null)
            {
                SetStatus("願望與獎勵券尚未連線。", true);
                return;
            }

            CloseRewardPanel();
            CloseWishlistApprovalPanel();
            rewardPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentRewardPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                rewardPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentRewardCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.1f);
            cardRect.anchorMax = new Vector2(0.92f, 0.9f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "願望與獎勵券",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.91f),
                new Vector2(0.92f, 0.97f));
            Button manageRewardButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "管理獎勵",
                new Vector2(0.62f, 0.84f),
                new Vector2(0.92f, 0.9f));
            manageRewardButton.onClick.AddListener(OpenRewardManagementPanel);
            Button adjustPointsButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "調整點數",
                new Vector2(0.08f, 0.84f),
                new Vector2(0.38f, 0.9f));
            adjustPointsButton.onClick.AddListener(OpenPointAdjustmentPanel);
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "待核准願望",
                19,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.77f),
                new Vector2(0.92f, 0.83f));
            GameObject wishlistList = CreateVerticalList(
                card.transform,
                "ParentWishlistList",
                new Vector2(0.08f, 0.51f),
                new Vector2(0.92f, 0.76f));
            int visibleWishlistCount = 0;
            foreach (SupabaseChildWishlistRecord item in
                latestSnapshot.wishlist ?? new SupabaseChildWishlistRecord[0])
            {
                if (item == null || visibleWishlistCount >= 4) continue;
                Button wishlistButton = HabitHeroUiFactory.CreateButton(
                    wishlistList.transform,
                    font,
                    GetChildName(item.child_profile_id) + "｜" + item.name + "｜核准",
                    Vector2.zero,
                    Vector2.one);
                wishlistButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 48f);
                wishlistButton.onClick.AddListener(() => OpenWishlistApprovalPanel(item));
                visibleWishlistCount += 1;
            }
            if (visibleWishlistCount == 0)
            {
                CreateListEmptyMessage(wishlistList.transform, "目前沒有等待核准的願望。");
            }

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "待領取獎勵券",
                19,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.44f),
                new Vector2(0.92f, 0.5f));
            GameObject ticketList = CreateVerticalList(
                card.transform,
                "ParentTicketList",
                new Vector2(0.08f, 0.2f),
                new Vector2(0.92f, 0.43f));
            int visibleTicketCount = 0;
            foreach (SupabaseChildTicketRecord ticket in
                latestSnapshot.tickets ?? new SupabaseChildTicketRecord[0])
            {
                if (ticket == null || visibleTicketCount >= 4) continue;
                bool isPending = ticket.status == "pending";
                Button ticketButton = HabitHeroUiFactory.CreateButton(
                    ticketList.transform,
                    font,
                    GetChildName(ticket.child_profile_id) + "｜" + ticket.reward_name
                        + (isPending ? "｜標記已領取" : "｜" + ticket.status),
                    Vector2.zero,
                    Vector2.one);
                ticketButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 48f);
                ticketButton.interactable = isPending;
                if (isPending)
                {
                    ticketButton.onClick.AddListener(() =>
                        FulfillTicketAsync(ticket.id, ticketButton));
                }
                visibleTicketCount += 1;
            }
            if (visibleTicketCount == 0)
            {
                CreateListEmptyMessage(ticketList.transform, "目前沒有待領取的獎勵券。");
            }

            rewardStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "點選願望設定點數，或將獎勵券標記為已領取。",
                15,
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

        private void OpenTaskCreatePanel()
        {
            if (latestSnapshot == null || createTask == null)
            {
                SetStatus("建立任務尚未連線。", true);
                return;
            }

            CloseTaskManagementPanel();
            CloseTaskTemplatePanel();
            if (taskCreateView == null)
            {
                taskCreateView = new HabitHeroParentTaskCreateView(canvasTransform, font);
            }

            taskCreateView.Show(
                latestSnapshot,
                createTask,
                ApplySnapshot,
                SetStatus,
                CloseTaskCreatePanel);
        }

        private void OpenTaskManagementPanel()
        {
            if (latestSnapshot == null || updateTask == null || deleteTask == null)
            {
                SetStatus("任務管理尚未連線。", true);
                return;
            }

            CloseReviewPanel();
            CloseWishlistApprovalPanel();
            CloseRewardPanel();
            CloseTaskCreatePanel();
            CloseTaskTemplatePanel();
            CloseGeneralAdventurePanel();
            CloseAdventureSchedulePanel();
            CloseRewardManagementPanel();
            ClosePointAdjustmentPanel();
            CloseChildAccountPanel();
            CloseChildPreviewPanel();
            if (taskManagementView == null)
            {
                taskManagementView = new HabitHeroParentTaskManagementView(
                    canvasTransform,
                    font);
            }

            taskManagementView.Show(
                latestSnapshot,
                updateTask,
                deleteTask,
                ApplySnapshot,
                SetStatus,
                CloseTaskManagementPanel);
        }

        private void OpenTaskTemplatePanel()
        {
            if (latestSnapshot == null
                || createTaskTemplate == null
                || updateTaskTemplate == null
                || deleteTaskTemplate == null
                || createTask == null)
            {
                SetStatus("任務模板尚未連線。", true);
                return;
            }

            CloseReviewPanel();
            CloseWishlistApprovalPanel();
            CloseRewardPanel();
            CloseTaskCreatePanel();
            CloseTaskManagementPanel();
            CloseGeneralAdventurePanel();
            CloseAdventureSchedulePanel();
            CloseRewardManagementPanel();
            ClosePointAdjustmentPanel();
            CloseChildAccountPanel();
            CloseChildPreviewPanel();
            if (taskTemplateView == null)
            {
                taskTemplateView = new HabitHeroParentTaskTemplateView(
                    canvasTransform,
                    font);
            }

            taskTemplateView.Show(
                latestSnapshot,
                createTaskTemplate,
                updateTaskTemplate,
                deleteTaskTemplate,
                createTask,
                ApplySnapshot,
                SetStatus,
                CloseTaskTemplatePanel);
        }

        private void OpenGeneralAdventurePanel()
        {
            if (latestSnapshot == null || createGeneralAdventure == null)
            {
                SetStatus("建立冒險尚未連線。", true);
                return;
            }

            CloseTaskCreatePanel();
            CloseTaskManagementPanel();
            if (generalAdventureCreateView == null)
            {
                generalAdventureCreateView =
                    new HabitHeroParentGeneralAdventureCreateView(
                        canvasTransform,
                        font);
            }

            generalAdventureCreateView.Show(
                latestSnapshot,
                createGeneralAdventure,
                ApplySnapshot,
                SetStatus,
                CloseGeneralAdventurePanel);
        }

        private void OpenAdventureSchedulePanel()
        {
            if (latestSnapshot == null
                || loadAdventureSchedules == null
                || createAdventureSchedule == null
                || updateAdventureSchedule == null
                || disableAdventureSchedule == null)
            {
                SetStatus("每日冒險排程尚未連線。", true);
                return;
            }

            CloseTaskCreatePanel();
            CloseGeneralAdventurePanel();
            CloseRewardPanel();
            CloseRewardManagementPanel();
            ClosePointAdjustmentPanel();
            CloseChildAccountPanel();
            if (adventureScheduleView == null)
            {
                adventureScheduleView = new HabitHeroParentAdventureScheduleView(
                    canvasTransform,
                    font);
            }

            adventureScheduleView.Show(
                latestSnapshot,
                loadAdventureSchedules,
                createAdventureSchedule,
                updateAdventureSchedule,
                disableAdventureSchedule,
                SetStatus,
                CloseAdventureSchedulePanel);
        }

        private void OpenRewardManagementPanel()
        {
            if (latestSnapshot == null
                || createReward == null
                || updateReward == null
                || deleteReward == null)
            {
                SetStatus("獎勵管理尚未連線。", true);
                return;
            }

            CloseRewardPanel();
            if (rewardManagementView == null)
            {
                rewardManagementView = new HabitHeroParentRewardManagementView(
                    canvasTransform,
                    font);
            }

            rewardManagementView.Show(
                latestSnapshot,
                createReward,
                updateReward,
                deleteReward,
                ApplySnapshot,
                SetStatus,
                CloseRewardManagementPanel);
        }

        private void OpenPointAdjustmentPanel()
        {
            if (latestSnapshot == null || adjustPoints == null)
            {
                SetStatus("點數調整尚未連線。", true);
                return;
            }

            CloseRewardPanel();
            if (pointAdjustmentView == null)
            {
                pointAdjustmentView = new HabitHeroParentPointAdjustmentView(
                    canvasTransform,
                    font);
            }

            pointAdjustmentView.Show(
                latestSnapshot,
                adjustPoints,
                ApplySnapshot,
                SetStatus,
                ClosePointAdjustmentPanel);
        }

        private void OpenChildAccountPanel()
        {
            if (latestSnapshot == null
                || createChildAccount == null
                || resetChildPassword == null
                || deleteChildAccount == null)
            {
                SetStatus("孩子帳號管理尚未連線。", true);
                return;
            }

            CloseRewardPanel();
            CloseRewardManagementPanel();
            ClosePointAdjustmentPanel();
            if (childAccountView == null)
            {
                childAccountView = new HabitHeroParentChildAccountView(
                    canvasTransform,
                    font);
            }

            childAccountView.Show(
                latestSnapshot,
                createChildAccount,
                resetChildPassword,
                deleteChildAccount,
                ApplySnapshot,
                SetStatus,
                CloseChildAccountPanel);
        }

        private void OpenChildPreviewPanel()
        {
            if (latestSnapshot == null
                || latestSnapshot.children == null
                || latestSnapshot.children.Length == 0)
            {
                SetStatus("目前沒有可預覽的孩子資料。", true);
                return;
            }

            CloseRewardPanel();
            CloseWishlistApprovalPanel();
            CloseReviewPanel();
            CloseTaskCreatePanel();
            CloseRewardManagementPanel();
            ClosePointAdjustmentPanel();
            CloseChildAccountPanel();
            CloseAdventureSchedulePanel();
            if (childPreviewView == null)
            {
                childPreviewView = new HabitHeroParentChildPreviewView(
                    canvasTransform,
                    font);
            }

            childPreviewView.Show(
                latestSnapshot,
                latestSnapshot.children[0].id,
                CloseChildPreviewPanel,
                enterChildMode);
        }

        private void OpenCoopAdventurePanel()
        {
            if (latestSnapshot == null
                || listCoopAdventures == null
                || loadCoopAdventureState == null
                || reviewCoopCompletion == null)
            {
                SetStatus("合作冒險批改尚未連線。", true);
                return;
            }

            CloseReviewPanel();
            CloseWishlistApprovalPanel();
            CloseRewardPanel();
            CloseTaskCreatePanel();
            CloseTaskManagementPanel();
            CloseTaskTemplatePanel();
            CloseGeneralAdventurePanel();
            CloseAdventureSchedulePanel();
            CloseRewardManagementPanel();
            ClosePointAdjustmentPanel();
            CloseChildAccountPanel();
            CloseChildPreviewPanel();
            if (coopAdventureView == null)
            {
                coopAdventureView = new HabitHeroParentCoopAdventureView(
                    canvasTransform,
                    font);
            }

            coopAdventureView.Show(
                latestSnapshot,
                listCoopAdventures,
                loadCoopAdventureState,
                reviewCoopCompletion,
                CloseCoopAdventurePanel);
        }

        private void OpenWishlistApprovalPanel(SupabaseChildWishlistRecord wishlist)
        {
            if (wishlist == null || approveWishlist == null) return;
            CloseRewardPanel();
            CloseWishlistApprovalPanel();
            activeWishlist = wishlist;
            wishlistApprovalPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "WishlistApprovalPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                wishlistApprovalPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "WishlistApprovalCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.17f, 0.25f);
            cardRect.anchorMax = new Vector2(0.83f, 0.75f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "核准願望",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.82f),
                new Vector2(0.92f, 0.95f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                GetChildName(wishlist.child_profile_id) + "想要：" + wishlist.name,
                21,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.68f),
                new Vector2(0.92f, 0.8f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "設定要新增到獎勵商店的點數",
                18,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.57f),
                new Vector2(0.92f, 0.65f));
            wishlistPointsInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：30",
                false,
                new Vector2(0.24f, 0.43f),
                new Vector2(0.76f, 0.55f));
            wishlistPointsInput.contentType = InputField.ContentType.IntegerNumber;
            wishlistPointsInput.lineType = InputField.LineType.SingleLine;
            wishlistApprovalStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "核准後願望會變成孩子可兌換的獎勵。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.32f),
                new Vector2(0.92f, 0.4f));
            approveWishlistButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "核准並建立獎勵",
                new Vector2(0.1f, 0.18f),
                new Vector2(0.9f, 0.28f));
            approveWishlistButton.onClick.AddListener(HandleWishlistApproval);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "先不要",
                new Vector2(0.35f, 0.06f),
                new Vector2(0.65f, 0.14f));
            closeButton.onClick.AddListener(CloseWishlistApprovalPanel);
        }

        private async void HandleWishlistApproval()
        {
            if (activeWishlist == null || approveWishlist == null) return;
            int points;
            string pointsText = wishlistPointsInput == null
                ? string.Empty
                : wishlistPointsInput.text.Trim();
            if (!int.TryParse(
                    pointsText,
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out points)
                || points <= 0)
            {
                SetWishlistApprovalStatus("請輸入大於 0 的整數點數。", true);
                return;
            }

            if (approveWishlistButton != null)
            {
                approveWishlistButton.interactable = false;
            }
            SetWishlistApprovalStatus("正在建立獎勵…", false);
            try
            {
                SupabaseParentRewardMutationResult result = await approveWishlist(
                    activeWishlist,
                    points);
                if (result == null || result.Reward == null)
                {
                    SetWishlistApprovalStatus("核准回應無效，請稍後再試。", true);
                    return;
                }
                if (result.RefreshedSnapshot != null)
                {
                    ApplySnapshot(result.RefreshedSnapshot);
                }

                CloseWishlistApprovalPanel();
                SetStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "願望已核准並加入獎勵商店。"
                        : "願望已核准；最新資料稍後會自動更新。",
                    false);
            }
            catch (Exception exception)
            {
                SetWishlistApprovalStatus("核准失敗：" + exception.Message, true);
                if (approveWishlistButton != null)
                {
                    approveWishlistButton.interactable = true;
                }
            }
        }

        private async void FulfillTicketAsync(string ticketId, Button ticketButton)
        {
            if (fulfillTicket == null || string.IsNullOrWhiteSpace(ticketId)) return;
            if (ticketButton != null) ticketButton.interactable = false;
            SetRewardStatus("正在更新獎勵券…", false);
            try
            {
                SupabaseParentRewardMutationResult result = await fulfillTicket(ticketId);
                if (result != null && result.RefreshedSnapshot != null)
                {
                    ApplySnapshot(result.RefreshedSnapshot);
                }

                CloseRewardPanel();
                SetStatus(
                    result != null && string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "獎勵券已標記為已領取。"
                        : "獎勵券已更新；最新資料稍後會自動更新。",
                    false);
            }
            catch (Exception exception)
            {
                SetRewardStatus("更新失敗：" + exception.Message, true);
                if (ticketButton != null) ticketButton.interactable = true;
            }
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
            layout.spacing = 8f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }

        private void CreateListEmptyMessage(Transform parent, string message)
        {
            HabitHeroUiFactory.CreateText(
                parent,
                font,
                message,
                17,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                Vector2.zero,
                Vector2.one);
        }

        private void OpenReviewPanel(SupabaseChildTaskRecord task)
        {
            if (HabitHeroParentGoalReviewEligibility.NeedsReview(task))
            {
                OpenGoalReviewPanel(task);
                return;
            }
            if (task == null || reviewTask == null) return;
            CloseGoalReviewPanel();
            CloseReviewPanel();
            activeReviewTask = task;
            reviewPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentTaskReviewPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                reviewPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentTaskReviewCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.1f, 0.12f);
            cardRect.anchorMax = new Vector2(0.9f, 0.88f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "任務審核",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.88f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                GetChildName(task.child_profile_id) + "｜" + task.name,
                22,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.78f),
                new Vector2(0.92f, 0.87f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                BuildTaskReport(task),
                17,
                TextAnchor.UpperLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.1f, 0.64f),
                new Vector2(0.9f, 0.76f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "給孩子的回饋（選填）",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.57f),
                new Vector2(0.9f, 0.63f));
            feedbackInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：你有注意到細節，很棒！",
                false,
                new Vector2(0.1f, 0.47f),
                new Vector2(0.9f, 0.56f));
            feedbackInput.contentType = InputField.ContentType.Standard;
            feedbackInput.lineType = InputField.LineType.SingleLine;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "要求修改時的說明",
                17,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.4f),
                new Vector2(0.9f, 0.46f));
            revisionInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "需要修改的地方",
                false,
                new Vector2(0.1f, 0.3f),
                new Vector2(0.9f, 0.39f));
            revisionInput.contentType = InputField.ContentType.Standard;
            revisionInput.lineType = InputField.LineType.SingleLine;

            reviewStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "核准會依伺服器規則發放點數。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.23f),
                new Vector2(0.92f, 0.29f));
            approveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "核准完成",
                new Vector2(0.1f, 0.13f),
                new Vector2(0.43f, 0.22f));
            approveButton.onClick.AddListener(() => HandleReviewDecision(true));
            reviseButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "要求修改",
                new Vector2(0.57f, 0.13f),
                new Vector2(0.9f, 0.22f));
            reviseButton.onClick.AddListener(() => HandleReviewDecision(false));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "先不要",
                new Vector2(0.35f, 0.04f),
                new Vector2(0.65f, 0.11f));
            closeButton.onClick.AddListener(CloseReviewPanel);
        }

        private void OpenGoalReviewPanel(SupabaseChildTaskRecord task)
        {
            if (task == null || confirmChildGoal == null || returnChildGoal == null)
            {
                SetStatus("孩子目標審核尚未連線。", true);
                return;
            }

            CloseReviewPanel();
            CloseGoalReviewPanel();
            goalReviewView = new HabitHeroParentGoalReviewView(canvasTransform, font);
            goalReviewView.Show(
                latestSnapshot,
                task,
                confirmChildGoal,
                returnChildGoal,
                ApplySnapshot,
                SetStatus,
                CloseGoalReviewPanel);
        }

        private async void HandleReviewDecision(bool approved)
        {
            if (activeReviewTask == null || reviewTask == null) return;
            string feedback = feedbackInput == null ? string.Empty : feedbackInput.text.Trim();
            string revisionNote = revisionInput == null ? string.Empty : revisionInput.text.Trim();
            if (!approved && string.IsNullOrWhiteSpace(revisionNote))
            {
                SetReviewStatus("要求修改時請填寫說明。", true);
                return;
            }

            if (approveButton != null) approveButton.interactable = false;
            if (reviseButton != null) reviseButton.interactable = false;
            SetReviewStatus(approved ? "正在核准任務…" : "正在送回修改…", false);
            try
            {
                SupabaseParentTaskReviewResult result = await reviewTask(
                    activeReviewTask,
                    approved,
                    approved ? activeReviewTask.points : (int?)null,
                    feedback,
                    null,
                    approved ? "encouraging" : "coaching",
                    approved ? null : revisionNote);
                if (result == null || result.Task == null)
                {
                    SetReviewStatus("審核回應無效，請稍後再試。", true);
                    return;
                }

                if (result.RefreshedSnapshot != null)
                {
                    ApplySnapshot(result.RefreshedSnapshot);
                }

                CloseReviewPanel();
                SetStatus(
                    approved
                        ? (string.IsNullOrWhiteSpace(result.RefreshError)
                            ? "任務已核准，點數與紀錄已更新。"
                            : "任務已核准；點數更新稍後會自動重試。")
                        : (string.IsNullOrWhiteSpace(result.RefreshError)
                            ? "已要求孩子修改任務。"
                            : "已送回修改；最新狀態稍後會自動更新。"),
                    false);
            }
            catch (Exception exception)
            {
                SetReviewStatus("審核失敗：" + exception.Message, true);
                if (approveButton != null) approveButton.interactable = true;
                if (reviseButton != null) reviseButton.interactable = true;
            }
        }

        private void CloseReviewPanel()
        {
            if (reviewPanel != null)
            {
                UnityEngine.Object.Destroy(reviewPanel);
                reviewPanel = null;
            }

            activeReviewTask = null;
            feedbackInput = null;
            revisionInput = null;
            approveButton = null;
            reviseButton = null;
            reviewStatus = null;
        }

        private void CloseGoalReviewPanel()
        {
            if (goalReviewView == null) return;
            goalReviewView.Dispose();
            goalReviewView = null;
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

        private void CloseWishlistApprovalPanel()
        {
            if (wishlistApprovalPanel != null)
            {
                UnityEngine.Object.Destroy(wishlistApprovalPanel);
                wishlistApprovalPanel = null;
            }

            activeWishlist = null;
            wishlistPointsInput = null;
            approveWishlistButton = null;
            wishlistApprovalStatus = null;
        }

        private void CloseTaskCreatePanel()
        {
            if (taskCreateView == null) return;
            taskCreateView.Dispose();
            taskCreateView = null;
        }

        private void CloseTaskManagementPanel()
        {
            if (taskManagementView == null) return;
            taskManagementView.Dispose();
            taskManagementView = null;
        }

        private void CloseTaskTemplatePanel()
        {
            if (taskTemplateView == null) return;
            taskTemplateView.Dispose();
            taskTemplateView = null;
        }

        private void CloseGeneralAdventurePanel()
        {
            if (generalAdventureCreateView == null) return;
            generalAdventureCreateView.Dispose();
            generalAdventureCreateView = null;
        }

        private void CloseAdventureSchedulePanel()
        {
            if (adventureScheduleView == null) return;
            adventureScheduleView.Dispose();
            adventureScheduleView = null;
        }

        private void CloseRewardManagementPanel()
        {
            if (rewardManagementView == null) return;
            rewardManagementView.Dispose();
            rewardManagementView = null;
        }

        private void ClosePointAdjustmentPanel()
        {
            if (pointAdjustmentView == null) return;
            pointAdjustmentView.Dispose();
            pointAdjustmentView = null;
        }

        private void CloseChildAccountPanel()
        {
            if (childAccountView == null) return;
            childAccountView.Dispose();
            childAccountView = null;
        }

        private void CloseChildPreviewPanel()
        {
            if (childPreviewView == null) return;
            childPreviewView.Dispose();
            childPreviewView = null;
        }

        private void CloseCoopAdventurePanel()
        {
            if (coopAdventureView != null)
            {
                coopAdventureView.Close();
                coopAdventureView = null;
            }
            SetStatus("已返回家長工作台。", false);
        }

        private void SetReviewStatus(string message, bool isError)
        {
            if (reviewStatus == null)
            {
                SetStatus(message, isError);
                return;
            }

            reviewStatus.text = message;
            reviewStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void SetRewardStatus(string message, bool isError)
        {
            if (rewardStatus == null)
            {
                SetStatus(message, isError);
                return;
            }

            rewardStatus.text = message;
            rewardStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void SetWishlistApprovalStatus(string message, bool isError)
        {
            if (wishlistApprovalStatus == null)
            {
                SetStatus(message, isError);
                return;
            }

            wishlistApprovalStatus.text = message;
            wishlistApprovalStatus.color = isError
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

        private string GetChildName(string childProfileId)
        {
            foreach (SupabaseChildProfileRecord child in
                latestSnapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : latestSnapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childProfileId)
                {
                    return child.display_name;
                }
            }

            return "孩子";
        }

        private static string GetReviewTaskLabel(SupabaseChildTaskRecord task)
        {
            if (HabitHeroParentGoalReviewEligibility.NeedsReview(task))
            {
                return task.status == "proposal_revision_requested"
                    ? "待修改目標"
                    : "待確認目標";
            }
            return "待審完成";
        }

        private static string BuildTaskReport(SupabaseChildTaskRecord task)
        {
            string report = string.Empty;
            if (!string.IsNullOrWhiteSpace(task.quick_report))
            {
                report += "快速回報：" + task.quick_report;
            }
            if (!string.IsNullOrWhiteSpace(task.child_reflection_text))
            {
                if (report.Length > 0) report += "\n";
                report += "完成心得：" + task.child_reflection_text;
            }
            if (!string.IsNullOrWhiteSpace(task.child_mood))
            {
                if (report.Length > 0) report += "\n";
                report += "心情：" + task.child_mood;
            }
            if (task.child_difficulty > 0)
            {
                if (report.Length > 0) report += "\n";
                report += "難度：" + task.child_difficulty;
            }

            return string.IsNullOrWhiteSpace(report) ? "孩子已送出完成回報。" : report;
        }
    }
}
