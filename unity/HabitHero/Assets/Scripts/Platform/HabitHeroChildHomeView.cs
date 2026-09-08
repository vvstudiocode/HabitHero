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
        private GameObject wishlistPanel;
        private HabitHeroChildGameView gameView;
        private HabitHeroChildWorldView worldView;
        private HabitHeroChildWorldSceneView worldSceneView;
        private HabitHeroChildSocialView socialView;
        private HabitHeroChildLedgerView ledgerView;
        private Text statusText;
        private Text pointsText;
        private Text reportStatus;
        private Text timerText;
        private Text timerStatus;
        private Text rewardStatus;
        private Text wishlistStatus;
        private InputField reflectionInput;
        private InputField wishlistInput;
        private Button reportSubmitButton;
        private Button timerActionButton;
        private SupabaseChildTaskRecord activeTimerTask;
        private Button activeTimerTaskButton;
        private SupabaseTaskTimerSessionRecord activeTimer;
        private SupabaseTaskTimerSessionRecord[] timerSessions;
        private GameObject taskListObject;
        private SupabaseChildHomeSnapshot latestSnapshot;
        private SupabaseChildWorldData latestWorldData;
        private SupabaseChildSocialData latestSocialData;
        private CancellationTokenSource timerLoopCancellation;
        private Func<
            SupabaseChildTaskRecord,
            SupabaseTaskCompletionDraft,
            Task<SupabaseTaskCompletionResult>> submitTask;
        private Func<string, Task<SupabaseTaskTimerSessionRecord>> startTimer;
        private Func<string, Task<SupabaseTaskTimerSessionRecord>> pauseTimer;
        private Func<string, Task<SupabaseTaskTimerSessionRecord>> resumeTimer;
        private Func<string, Task<SupabaseChildHomeSnapshot>> abandonAdventure;
        private Func<string, Task<SupabaseRewardRedemptionResult>> redeemReward;
        private Func<string, Task<SupabaseWishlistMutationResult>> addWishlist;
        private Func<string, Task<SupabaseWishlistMutationResult>> deleteWishlist;
        private Func<string, Task<SupabaseChildWorldData>> completeNpcDialogueWorld;
        private Func<Task<SupabaseChildSocialData>> refreshSocial;
        private Func<string, Task<SupabaseChildSocialData>> sendFriendRequest;
        private Func<string, Task<SupabaseChildSocialData>> acceptFriendRequest;
        private Func<string, Task<SupabaseChildSocialData>> declineFriendRequest;
        private Func<string, Task<SupabaseChildSocialData>> removeFriend;
        private Func<string, Task<SupabaseChildSocialData>> blockFriend;
        private Func<string, bool, Task<SupabaseChildSocialData>> toggleFriendWorldCollaboration;
        private Func<string, Task<SupabaseChildFriendWorldData>> visitFriendWorld;
        private Func<string, Task<SupabaseChildWorldChatData>> loadWorldChat;
        private Func<string, string, Task<SupabaseChildWorldChatData>> sendWorldChat;
        private Func<string, string, Task<SupabaseChildWorldChatData>> markWorldChatRead;
        private Func<string, string, Task<SupabaseChildWorldChatData>> reportWorldChat;
        private string selectedMood;
        private int selectedDifficulty;
        private bool abandonConfirmationPending;

        public HabitHeroChildHomeView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildHomeSnapshot snapshot,
            SupabaseChildGameData gameData,
            SupabaseChildWorldData worldData,
            SupabaseChildSocialData socialData,
            Func<string, Task<SupabaseChildWorldData>> unlockWorldScene,
            Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue,
            Func<Task<SupabaseChildSocialData>> refreshSocial,
            Func<string, Task<SupabaseChildSocialData>> sendFriendRequest,
            Func<string, Task<SupabaseChildSocialData>> acceptFriendRequest,
            Func<string, Task<SupabaseChildSocialData>> declineFriendRequest,
            Func<string, Task<SupabaseChildSocialData>> removeFriend,
            Func<string, Task<SupabaseChildSocialData>> blockFriend,
            Func<string, bool, Task<SupabaseChildSocialData>> toggleFriendWorldCollaboration,
            Func<string, string, long, SupabaseFriendWorldTransform, Task<SupabaseChildFriendWorldData>> placeSharedDecoration,
            Func<string, string, long, SupabaseFriendWorldTransform, Task<SupabaseChildFriendWorldData>> updateSharedDecoration,
            Func<string, string, long, Task<SupabaseChildFriendWorldData>> removeSharedDecoration,
            Func<string, Task<SupabaseChildFriendWorldData>> visitFriendWorld,
            Func<string, Task<SupabaseChildWorldChatData>> loadWorldChat,
            Func<string, string, Task<SupabaseChildWorldChatData>> sendWorldChat,
            Func<string, string, Task<SupabaseChildWorldChatData>> markWorldChatRead,
            Func<string, string, Task<SupabaseChildWorldChatData>> reportWorldChat,
            Func<
                SupabaseChildTaskRecord,
                SupabaseTaskCompletionDraft,
                Task<SupabaseTaskCompletionResult>> submitTask,
            Func<string, Task<SupabaseTaskTimerSessionRecord>> startTimer,
            Func<string, Task<SupabaseTaskTimerSessionRecord>> pauseTimer,
            Func<string, Task<SupabaseTaskTimerSessionRecord>> resumeTimer,
            Func<string, Task<SupabaseChildHomeSnapshot>> abandonAdventure,
            Func<string, Task<SupabaseRewardRedemptionResult>> redeemReward,
            Func<string, Task<SupabaseWishlistMutationResult>> addWishlist,
            Func<string, Task<SupabaseWishlistMutationResult>> deleteWishlist,
            Func<string, int, string, Task<SupabaseChildGameData>> purchaseGameItem,
            Func<string, Task<SupabaseChildGameData>> equipGameCharacter,
            Func<string[], Task<SupabaseChildGameData>> setFollowingPets,
            Func<string[], Task<SupabaseChildGameData>> setRoamingPets,
            Func<string, long, SupabaseFriendWorldTransform, string, int?, Task<SupabaseChildGameData>> placeWorldEntity,
            Func<string, string, long, SupabaseFriendWorldTransform, Task<SupabaseChildGameData>> updateWorldEntity,
            Func<string, string, long, Task<SupabaseChildGameData>> removeWorldEntity,
            Func<long, Task<SupabaseChildGameData>> collectWorldDecorations,
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
            this.abandonAdventure = abandonAdventure;
            this.redeemReward = redeemReward;
            this.addWishlist = addWishlist;
            this.deleteWishlist = deleteWishlist;
            this.completeNpcDialogueWorld = completeNpcDialogue;
            this.refreshSocial = refreshSocial;
            this.sendFriendRequest = sendFriendRequest;
            this.acceptFriendRequest = acceptFriendRequest;
            this.declineFriendRequest = declineFriendRequest;
            this.removeFriend = removeFriend;
            this.blockFriend = blockFriend;
            this.toggleFriendWorldCollaboration = toggleFriendWorldCollaboration;
            this.visitFriendWorld = visitFriendWorld;
            this.loadWorldChat = loadWorldChat;
            this.sendWorldChat = sendWorldChat;
            this.markWorldChatRead = markWorldChatRead;
            this.reportWorldChat = reportWorldChat;
            latestSnapshot = snapshot;
            latestWorldData = worldData;
            latestSocialData = socialData;
            timerSessions = snapshot.timers ?? new SupabaseTaskTimerSessionRecord[0];
            gameView = new HabitHeroChildGameView(canvasTransform, font);
            gameView.Show(
                gameData,
                worldData,
                purchaseGameItem,
                equipGameCharacter,
                setFollowingPets,
                setRoamingPets,
                placeWorldEntity,
                updateWorldEntity,
                removeWorldEntity,
                collectWorldDecorations);
            worldView = new HabitHeroChildWorldView(canvasTransform, font);
            worldView.Show(
                worldData,
                (sceneId) => UnlockWorldSceneAndApplyAsync(unlockWorldScene, sceneId),
                (npcId) => CompleteNpcDialogueAndApplyAsync(completeNpcDialogue, npcId),
                OpenWorldScene);
            socialView = new HabitHeroChildSocialView(canvasTransform, font);
            socialView.Show(
                socialData,
                gameData,
                refreshSocial,
                sendFriendRequest,
                acceptFriendRequest,
                declineFriendRequest,
                removeFriend,
                blockFriend,
                toggleFriendWorldCollaboration,
                placeSharedDecoration,
                updateSharedDecoration,
                removeSharedDecoration,
                visitFriendWorld,
                loadWorldChat,
                sendWorldChat,
                markWorldChatRead,
                reportWorldChat,
                ApplySocialData,
                CloseSocialPanel);
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

            Button gameButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "冒險商店",
                new Vector2(0.23f, 0.14f),
                new Vector2(0.4f, 0.2f));
            gameButton.interactable = gameData != null;
            gameButton.onClick.AddListener(() => gameView.Open());
            Button worldButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "世界",
                new Vector2(0.08f, 0.14f),
                new Vector2(0.22f, 0.2f));
            worldButton.interactable = worldData != null;
            worldButton.onClick.AddListener(() => worldView.Open());
            Button socialButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "好友",
                new Vector2(0.41f, 0.14f),
                new Vector2(0.58f, 0.2f));
            socialButton.interactable = socialData != null;
            socialButton.onClick.AddListener(OpenSocialPanel);
            Button rewardsButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "獎勵商店",
                new Vector2(0.59f, 0.14f),
                new Vector2(0.76f, 0.2f));
            rewardsButton.onClick.AddListener(OpenRewardPanel);
            Button ledgerButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "點數紀錄",
                new Vector2(0.77f, 0.14f),
                new Vector2(0.92f, 0.2f));
            ledgerButton.onClick.AddListener(OpenLedgerPanel);

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
            abandonAdventure = null;
            redeemReward = null;
            addWishlist = null;
            deleteWishlist = null;
            completeNpcDialogueWorld = null;
            refreshSocial = null;
            sendFriendRequest = null;
            acceptFriendRequest = null;
            declineFriendRequest = null;
            removeFriend = null;
            blockFriend = null;
            toggleFriendWorldCollaboration = null;
            visitFriendWorld = null;
            loadWorldChat = null;
            sendWorldChat = null;
            markWorldChatRead = null;
            reportWorldChat = null;
            timerSessions = null;
            latestSnapshot = null;
            latestWorldData = null;
            latestSocialData = null;
            pointsText = null;
            taskListObject = null;
            CloseReportPanel();
            CloseTimerPanel();
            CloseRewardPanel();
            CloseWishlistPanel();
            CloseLedgerPanel();
            if (gameView != null)
            {
                gameView.Dispose();
                gameView = null;
            }
            if (worldView != null)
            {
                worldView.Dispose();
                worldView = null;
            }
            if (worldSceneView != null)
            {
                worldSceneView.Dispose();
                worldSceneView = null;
            }
            if (socialView != null)
            {
                socialView.Dispose();
                socialView = null;
            }
            abandonConfirmationPending = false;
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            statusText = null;
        }

        private async Task<SupabaseChildWorldData> UnlockWorldSceneAndApplyAsync(
            Func<string, Task<SupabaseChildWorldData>> mutation,
            string sceneId)
        {
            if (mutation == null) throw new SupabaseDataException("場景解鎖服務尚未連線。");
            SupabaseChildWorldData refreshed = await mutation(sceneId);
            if (refreshed == null) throw new SupabaseDataException("伺服器沒有回傳最新世界資料。");
            latestWorldData = refreshed;
            if (gameView != null) gameView.ApplyWorldData(refreshed);
            return refreshed;
        }

        private async Task<SupabaseChildWorldData> CompleteNpcDialogueAndApplyAsync(
            Func<string, Task<SupabaseChildWorldData>> mutation,
            string npcId)
        {
            if (mutation == null) throw new SupabaseDataException("NPC 對話服務尚未連線。");
            SupabaseChildWorldData refreshed = await mutation(npcId);
            if (refreshed == null) throw new SupabaseDataException("伺服器沒有回傳最新世界資料。");
            latestWorldData = refreshed;
            if (gameView != null) gameView.ApplyWorldData(refreshed);
            return refreshed;
        }

        private void OpenWorldScene(string sceneId)
        {
            if (latestWorldData == null || !latestWorldData.IsSceneUnlocked(sceneId)) return;
            if (worldSceneView == null)
            {
                worldSceneView = new HabitHeroChildWorldSceneView(canvasTransform, font);
            }

            worldSceneView.Show(
                latestWorldData,
                sceneId,
                (npcId) => CompleteNpcDialogueAndApplyAsync(completeNpcDialogueWorld, npcId),
                CloseWorldScene);
            worldSceneView.Open();
        }

        private void CloseWorldScene()
        {
            if (worldView != null && latestWorldData != null)
            {
                worldView.ApplyData(latestWorldData);
            }
        }

        private void ApplySocialData(SupabaseChildSocialData data)
        {
            latestSocialData = data;
        }

        public void NotifyWorldChatChanged(string worldOwnerChildProfileId)
        {
            if (socialView != null)
            {
                socialView.NotifyWorldChatChanged(worldOwnerChildProfileId);
            }
        }

        public void AttachFriendWorldRealtime(
            string localConnectionId,
            string localChildProfileId,
            string localCharacterAssetKey,
            Action<SupabaseFriendWorldAvatarState> onLocalAvatarStateChanged)
        {
            if (socialView != null)
            {
                socialView.AttachFriendWorldRealtime(
                    localConnectionId,
                    localChildProfileId,
                    localCharacterAssetKey,
                    onLocalAvatarStateChanged);
            }
        }

        public void ClearFriendWorldRealtime()
        {
            if (socialView != null) socialView.ClearFriendWorldRealtime();
        }

        public void NotifyFriendWorldPresence(
            SupabaseFriendWorldPresenceMember[] members,
            string localConnectionId)
        {
            if (socialView != null)
            {
                socialView.NotifyFriendWorldPresence(members, localConnectionId);
            }
        }

        public void NotifyFriendWorldAvatarState(
            SupabaseFriendWorldAvatarState state,
            string localConnectionId)
        {
            if (socialView != null)
            {
                socialView.NotifyFriendWorldAvatarState(state, localConnectionId);
            }
        }

        public void NotifyFriendWorldRealtimeStatus(string message, bool isError)
        {
            if (socialView != null)
            {
                socialView.NotifyFriendWorldRealtimeStatus(message, isError);
            }
        }

        public long FriendWorldCurrentRevision
        {
            get { return socialView == null ? 0 : socialView.FriendWorldCurrentRevision; }
        }

        public void ApplyFriendWorldData(SupabaseChildFriendWorldData data)
        {
            if (socialView != null) socialView.ApplyFriendWorldData(data);
        }

        public void Tick(float deltaSeconds)
        {
            if (socialView != null) socialView.Tick(deltaSeconds);
        }

        private void OpenSocialPanel()
        {
            if (socialView == null || latestSocialData == null)
            {
                SetStatus("好友功能尚未連線。", true);
                return;
            }

            CloseReportPanel();
            CloseTimerPanel();
            CloseRewardPanel();
            CloseWishlistPanel();
            CloseLedgerPanel();
            socialView.Open();
        }

        private void CloseSocialPanel()
        {
            if (socialView != null) socialView.Close();
            SetStatus("已返回今日任務。", false);
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
            if (ledgerView != null)
            {
                ledgerView.ApplySnapshot(snapshot);
            }
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
            if (addWishlist != null && deleteWishlist != null)
            {
                Button wishlistButton = HabitHeroUiFactory.CreateButton(
                    card.transform,
                    font,
                    "願望清單",
                    new Vector2(0.08f, 0.04f),
                    new Vector2(0.32f, 0.11f));
                wishlistButton.onClick.AddListener(OpenWishlistPanel);
            }
        }

        private void OpenLedgerPanel()
        {
            if (latestSnapshot == null || latestSnapshot.child == null)
            {
                SetStatus("點數紀錄尚未載入。", true);
                return;
            }

            CloseReportPanel();
            CloseTimerPanel();
            CloseRewardPanel();
            CloseWishlistPanel();
            if (ledgerView == null)
            {
                ledgerView = new HabitHeroChildLedgerView(canvasTransform, font);
            }

            ledgerView.Show(latestSnapshot, CloseLedgerPanel);
        }

        private void OpenWishlistPanel()
        {
            if (latestSnapshot == null || addWishlist == null || deleteWishlist == null)
            {
                SetStatus("願望清單尚未連線。", true);
                return;
            }

            CloseRewardPanel();
            CloseWishlistPanel();
            wishlistPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "WishlistPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                wishlistPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "WishlistCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.1f, 0.16f);
            cardRect.anchorMax = new Vector2(0.9f, 0.84f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "願望清單",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.88f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "寫下想和爸媽分享的願望。",
                17,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.81f),
                new Vector2(0.92f, 0.88f));
            wishlistInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：新的畫筆",
                false,
                new Vector2(0.08f, 0.69f),
                new Vector2(0.72f, 0.78f));
            wishlistInput.contentType = InputField.ContentType.Standard;
            wishlistInput.lineType = InputField.LineType.SingleLine;
            Button addButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "送出",
                new Vector2(0.75f, 0.69f),
                new Vector2(0.92f, 0.78f));
            addButton.onClick.AddListener(() => AddWishlistAsync(addButton));

            GameObject wishlistList = new GameObject(
                "WishlistList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            wishlistList.transform.SetParent(card.transform, false);
            RectTransform wishlistListRect = wishlistList.GetComponent<RectTransform>();
            wishlistListRect.anchorMin = new Vector2(0.08f, 0.2f);
            wishlistListRect.anchorMax = new Vector2(0.92f, 0.64f);
            wishlistListRect.offsetMin = Vector2.zero;
            wishlistListRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = wishlistList.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 8f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;

            int visibleWishlistCount = 0;
            foreach (SupabaseChildWishlistRecord item in
                latestSnapshot.wishlist ?? new SupabaseChildWishlistRecord[0])
            {
                if (item == null || visibleWishlistCount >= 8) continue;
                GameObject row = new GameObject(
                    "WishlistItemRow",
                    typeof(RectTransform),
                    typeof(HorizontalLayoutGroup));
                row.transform.SetParent(wishlistList.transform, false);
                row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 50f);
                HorizontalLayoutGroup rowLayout = row.GetComponent<HorizontalLayoutGroup>();
                rowLayout.spacing = 8f;
                rowLayout.childControlWidth = true;
                rowLayout.childControlHeight = true;
                rowLayout.childForceExpandWidth = false;
                rowLayout.childForceExpandHeight = true;

                Text itemText = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    item.name,
                    18,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                LayoutElement textLayout = itemText.gameObject.AddComponent<LayoutElement>();
                textLayout.flexibleWidth = 1f;
                Button cancelButton = HabitHeroUiFactory.CreateButton(
                    row.transform,
                    font,
                    "取消",
                    Vector2.zero,
                    Vector2.one);
                LayoutElement buttonLayout = cancelButton.gameObject.AddComponent<LayoutElement>();
                buttonLayout.preferredWidth = 92f;
                buttonLayout.minWidth = 92f;
                cancelButton.onClick.AddListener(() => DeleteWishlistAsync(item.id, cancelButton));
                visibleWishlistCount += 1;
            }

            if (visibleWishlistCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    wishlistList.transform,
                    font,
                    "目前還沒有等待核准的願望。",
                    20,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }

            wishlistStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "願望會送到家長端等待核准。",
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
            closeButton.onClick.AddListener(CloseWishlistPanel);
        }

        private async void AddWishlistAsync(Button addButton)
        {
            if (addWishlist == null || wishlistInput == null) return;
            string name = wishlistInput.text == null ? string.Empty : wishlistInput.text.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                SetWishlistStatus("請先寫下一個願望。", true);
                return;
            }

            if (addButton != null) addButton.interactable = false;
            SetWishlistStatus("正在送出願望…", false);
            try
            {
                SupabaseWishlistMutationResult result = await addWishlist(name);
                if (result != null && result.RefreshedSnapshot != null)
                {
                    ApplySnapshot(result.RefreshedSnapshot);
                }

                CloseWishlistPanel();
                SetStatus(
                    result != null && string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "願望已送出，已同步到家長端。"
                        : "願望已送出；清單更新稍後會自動重試。",
                    false);
            }
            catch (Exception exception)
            {
                SetWishlistStatus("送出失敗：" + exception.Message, true);
                if (addButton != null) addButton.interactable = true;
            }
        }

        private async void DeleteWishlistAsync(string wishlistId, Button cancelButton)
        {
            if (deleteWishlist == null || string.IsNullOrWhiteSpace(wishlistId)) return;
            if (cancelButton != null) cancelButton.interactable = false;
            SetWishlistStatus("正在取消願望…", false);
            try
            {
                SupabaseWishlistMutationResult result = await deleteWishlist(wishlistId);
                if (result != null && result.RefreshedSnapshot != null)
                {
                    ApplySnapshot(result.RefreshedSnapshot);
                }

                CloseWishlistPanel();
                SetStatus(
                    result != null && string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "願望已取消。"
                        : "願望已取消；清單更新稍後會自動重試。",
                    false);
            }
            catch (Exception exception)
            {
                SetWishlistStatus("取消失敗：" + exception.Message, true);
                if (cancelButton != null) cancelButton.interactable = true;
            }
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

        private void CloseWishlistPanel()
        {
            if (wishlistPanel != null)
            {
                UnityEngine.Object.Destroy(wishlistPanel);
                wishlistPanel = null;
            }

            wishlistInput = null;
            wishlistStatus = null;
        }

        private void CloseLedgerPanel()
        {
            if (ledgerView == null) return;
            ledgerView.Dispose();
            ledgerView = null;
        }

        private void SetRewardStatus(string message, bool isError)
        {
            if (rewardStatus == null) return;
            rewardStatus.text = message;
            rewardStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void SetWishlistStatus(string message, bool isError)
        {
            if (wishlistStatus == null)
            {
                SetStatus(message, isError);
                return;
            }

            wishlistStatus.text = message;
            wishlistStatus.color = isError
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
            if (CanAbandonAdventure(task))
            {
                Button abandonButton = HabitHeroUiFactory.CreateButton(
                    card.transform,
                    font,
                    "放棄冒險",
                    new Vector2(0.68f, 0.04f),
                    new Vector2(0.92f, 0.12f));
                abandonButton.onClick.AddListener(() =>
                    HandleAbandonClicked(task, abandonButton));
            }
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
            if (CanAbandonAdventure(task))
            {
                Button abandonButton = HabitHeroUiFactory.CreateButton(
                    card.transform,
                    font,
                    "放棄冒險",
                    new Vector2(0.68f, 0.04f),
                    new Vector2(0.92f, 0.12f));
                abandonButton.onClick.AddListener(() =>
                    HandleAbandonClicked(task, abandonButton));
            }
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
            abandonConfirmationPending = false;
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
            abandonConfirmationPending = false;
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

        private async void HandleAbandonClicked(
            SupabaseChildTaskRecord task,
            Button abandonButton)
        {
            if (task == null || abandonAdventure == null) return;
            if (!abandonConfirmationPending)
            {
                abandonConfirmationPending = true;
                SetAbandonButtonLabel(abandonButton, "再次點擊放棄");
                SetReportStatus("再次點擊即可放棄這個冒險。", false);
                return;
            }

            if (abandonButton != null) abandonButton.interactable = false;
            SetReportStatus("正在放棄冒險…", false);
            try
            {
                SupabaseChildHomeSnapshot refreshed = await abandonAdventure(task.id);
                if (refreshed != null)
                {
                    ApplySnapshot(refreshed);
                }

                CloseReportPanel();
                CloseTimerPanel();
                SetStatus("冒險已放棄。", false);
            }
            catch (Exception exception)
            {
                SetReportStatus("放棄冒險失敗：" + exception.Message, true);
                abandonConfirmationPending = false;
                if (abandonButton != null)
                {
                    abandonButton.interactable = true;
                    SetAbandonButtonLabel(abandonButton, "放棄冒險");
                }
            }
        }

        private static void SetAbandonButtonLabel(Button button, string label)
        {
            if (button == null) return;
            Text buttonText = button.GetComponentInChildren<Text>();
            if (buttonText != null) buttonText.text = label;
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

        private bool CanAbandonAdventure(SupabaseChildTaskRecord task)
        {
            return task != null
                && task.origin == "child_proposed"
                && task.adventure_type == "general"
                && (task.status == "proposed"
                    || task.status == "proposal_revision_requested"
                    || task.status == "todo")
                && string.IsNullOrWhiteSpace(task.submitted_at)
                && FindTimer(task.id) == null;
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
