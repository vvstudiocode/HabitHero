using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildSocialView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject friendListObject;
        private GameObject requestListObject;
        private HabitHeroChildFriendWorldView friendWorldView;
        private HabitHeroChildWorldChatView chatView;
        private InputField friendCodeInput;
        private Text statusText;
        private SupabaseChildSocialData latestData;
        private Func<Task<SupabaseChildSocialData>> refresh;
        private Func<string, Task<SupabaseChildSocialData>> sendRequest;
        private Func<string, Task<SupabaseChildSocialData>> acceptRequest;
        private Func<string, Task<SupabaseChildSocialData>> declineRequest;
        private Func<string, Task<SupabaseChildSocialData>> removeFriend;
        private Func<string, Task<SupabaseChildSocialData>> blockFriend;
        private Func<string, Task<SupabaseChildFriendWorldData>> visitFriendWorld;
        private Func<string, Task<SupabaseChildWorldChatData>> loadWorldChat;
        private Func<string, string, Task<SupabaseChildWorldChatData>> sendWorldChat;
        private Func<string, string, Task<SupabaseChildWorldChatData>> markWorldChatRead;
        private Func<string, string, Task<SupabaseChildWorldChatData>> reportWorldChat;
        private Action<SupabaseChildSocialData> onDataChanged;
        private Action onClose;
        private string friendWorldRealtimeConnectionId;
        private string friendWorldRealtimeChildProfileId;
        private string friendWorldRealtimeCharacterAssetKey;
        private Action<SupabaseFriendWorldAvatarState> onLocalFriendWorldAvatarStateChanged;

        public HabitHeroChildSocialView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildSocialData data,
            Func<Task<SupabaseChildSocialData>> refresh,
            Func<string, Task<SupabaseChildSocialData>> sendRequest,
            Func<string, Task<SupabaseChildSocialData>> acceptRequest,
            Func<string, Task<SupabaseChildSocialData>> declineRequest,
            Func<string, Task<SupabaseChildSocialData>> removeFriend,
            Func<string, Task<SupabaseChildSocialData>> blockFriend,
            Func<string, Task<SupabaseChildFriendWorldData>> visitFriendWorld,
            Func<string, Task<SupabaseChildWorldChatData>> loadWorldChat,
            Func<string, string, Task<SupabaseChildWorldChatData>> sendWorldChat,
            Func<string, string, Task<SupabaseChildWorldChatData>> markWorldChatRead,
            Func<string, string, Task<SupabaseChildWorldChatData>> reportWorldChat,
            Action<SupabaseChildSocialData> onDataChanged,
            Action onClose)
        {
            Close();
            latestData = data;
            this.refresh = refresh;
            this.sendRequest = sendRequest;
            this.acceptRequest = acceptRequest;
            this.declineRequest = declineRequest;
            this.removeFriend = removeFriend;
            this.blockFriend = blockFriend;
            this.visitFriendWorld = visitFriendWorld;
            this.loadWorldChat = loadWorldChat;
            this.sendWorldChat = sendWorldChat;
            this.markWorldChatRead = markWorldChatRead;
            this.reportWorldChat = reportWorldChat;
            this.onDataChanged = onDataChanged;
            this.onClose = onClose;
            if (friendWorldView == null)
            {
                friendWorldView = new HabitHeroChildFriendWorldView(canvasTransform, font);
            }
            if (chatView == null)
            {
                chatView = new HabitHeroChildWorldChatView(canvasTransform, font);
            }
        }

        public void ApplyData(SupabaseChildSocialData data)
        {
            latestData = data;
            if (panel == null) return;
            Close();
            Open();
        }

        public void NotifyWorldChatChanged(string worldOwnerChildProfileId)
        {
            if (chatView == null
                || !chatView.IsOpen
                || !string.Equals(
                    chatView.WorldOwnerChildProfileId,
                    (worldOwnerChildProfileId ?? string.Empty).Trim(),
                    StringComparison.Ordinal))
            {
                return;
            }

            _ = chatView.RefreshFromServerAsync();
        }

        public void AttachFriendWorldRealtime(
            string localConnectionId,
            string localChildProfileId,
            string localCharacterAssetKey,
            Action<SupabaseFriendWorldAvatarState> onLocalAvatarStateChanged)
        {
            friendWorldRealtimeConnectionId = localConnectionId;
            friendWorldRealtimeChildProfileId = localChildProfileId;
            friendWorldRealtimeCharacterAssetKey = localCharacterAssetKey;
            onLocalFriendWorldAvatarStateChanged = onLocalAvatarStateChanged;
            if (friendWorldView != null)
            {
                friendWorldView.SetRealtime(
                    friendWorldRealtimeConnectionId,
                    friendWorldRealtimeChildProfileId,
                    friendWorldRealtimeCharacterAssetKey,
                    onLocalFriendWorldAvatarStateChanged);
            }
        }

        public void ClearFriendWorldRealtime()
        {
            friendWorldRealtimeConnectionId = null;
            friendWorldRealtimeChildProfileId = null;
            friendWorldRealtimeCharacterAssetKey = null;
            onLocalFriendWorldAvatarStateChanged = null;
            if (friendWorldView != null) friendWorldView.ClearRealtime();
        }

        public void NotifyFriendWorldPresence(
            SupabaseFriendWorldPresenceMember[] members,
            string localConnectionId)
        {
            if (friendWorldView != null)
            {
                friendWorldView.ApplyPresence(members, localConnectionId);
            }
        }

        public void NotifyFriendWorldAvatarState(
            SupabaseFriendWorldAvatarState state,
            string localConnectionId)
        {
            if (friendWorldView != null)
            {
                friendWorldView.ApplyAvatarState(state, localConnectionId);
            }
        }

        public void NotifyFriendWorldRealtimeStatus(string message, bool isError)
        {
            if (friendWorldView != null)
            {
                friendWorldView.SetRealtimeStatus(message, isError);
            }
        }

        public long FriendWorldCurrentRevision
        {
            get { return friendWorldView == null ? 0 : friendWorldView.CurrentRevision; }
        }

        public void ApplyFriendWorldData(SupabaseChildFriendWorldData data)
        {
            if (friendWorldView != null) friendWorldView.ApplyData(data);
        }

        public void Open()
        {
            if (latestData == null) return;
            Close();
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ChildSocialPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildSocialCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.05f, 0.06f);
            cardRect.anchorMax = new Vector2(0.95f, 0.94f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "好友與邀請",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.91f),
                new Vector2(0.72f, 0.98f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.76f, 0.92f),
                new Vector2(0.94f, 0.98f));
            closeButton.onClick.AddListener(CloseFromButton);

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "我的好友代碼：" + latestData.friendCode,
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.9f));
            friendCodeInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "輸入好友代碼",
                false,
                new Vector2(0.08f, 0.76f),
                new Vector2(0.7f, 0.83f));
            friendCodeInput.contentType = InputField.ContentType.Standard;
            Button sendButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "新增好友",
                new Vector2(0.72f, 0.76f),
                new Vector2(0.92f, 0.83f));
            sendButton.interactable = sendRequest != null;
            sendButton.onClick.AddListener(() => SendRequestAsync(sendButton));

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "好友",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.68f),
                new Vector2(0.92f, 0.74f));
            friendListObject = CreateList(
                card.transform,
                "FriendList",
                new Vector2(0.08f, 0.43f),
                new Vector2(0.92f, 0.67f));
            RenderFriends(friendListObject.transform);

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "待處理邀請",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.36f),
                new Vector2(0.92f, 0.42f));
            requestListObject = CreateList(
                card.transform,
                "RequestList",
                new Vector2(0.08f, 0.14f),
                new Vector2(0.92f, 0.35f));
            RenderRequests(requestListObject.transform);

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "好友狀態由 Supabase 伺服器同步。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.07f),
                new Vector2(0.62f, 0.13f));
            Button refreshButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "重新整理",
                new Vector2(0.64f, 0.07f),
                new Vector2(0.79f, 0.13f));
            refreshButton.interactable = refresh != null;
            refreshButton.onClick.AddListener(() => RefreshAsync(refreshButton));
            Button bottomCloseButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "返回今日任務",
                new Vector2(0.81f, 0.07f),
                new Vector2(0.94f, 0.13f));
            bottomCloseButton.onClick.AddListener(CloseFromButton);
        }

        public void Dispose()
        {
            Close();
            latestData = null;
            refresh = null;
            sendRequest = null;
            acceptRequest = null;
            declineRequest = null;
            removeFriend = null;
            blockFriend = null;
            visitFriendWorld = null;
            loadWorldChat = null;
            sendWorldChat = null;
            markWorldChatRead = null;
            reportWorldChat = null;
            onDataChanged = null;
            onClose = null;
            ClearFriendWorldRealtime();
            if (friendWorldView != null)
            {
                friendWorldView.Dispose();
                friendWorldView = null;
            }
            if (chatView != null)
            {
                chatView.Dispose();
                chatView = null;
            }
        }

        private void RenderFriends(Transform parent)
        {
            int count = 0;
            foreach (SupabaseFriendSummaryRecord friend in
                latestData.friends ?? new SupabaseFriendSummaryRecord[0])
            {
                if (friend == null || count >= 8) continue;
                GameObject row = CreateRow(parent, "FriendRow");
                string status = friend.is_online ? "在線" : "離線";
                string collaboration = friend.can_collaborate_in_my_world
                    ? "可協作"
                    : "僅好友";
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    friend.display_name + "　" + status + "／" + collaboration,
                    14,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                AddFlexibleLayout(label.gameObject);
                Button chatButton = CreateRowButton(row.transform, "聊天");
                chatButton.interactable = loadWorldChat != null;
                chatButton.onClick.AddListener(() => OpenWorldChatAsync(
                    friend.child_profile_id,
                    friend.display_name,
                    chatButton));
                Button visitButton = CreateRowButton(row.transform, "造訪");
                visitButton.interactable = visitFriendWorld != null;
                visitButton.onClick.AddListener(() => VisitFriendWorldAsync(
                    friend.child_profile_id,
                    visitButton));
                Button removeButton = CreateRowButton(row.transform, "移除");
                removeButton.interactable = removeFriend != null;
                removeButton.onClick.AddListener(() => RemoveFriendAsync(
                    friend.child_profile_id,
                    removeButton));
                Button blockButton = CreateRowButton(row.transform, "封鎖");
                blockButton.interactable = blockFriend != null;
                blockButton.onClick.AddListener(() => BlockFriendAsync(
                    friend.child_profile_id,
                    blockButton));
                count += 1;
            }

            if (count == 0) CreateEmptyRow(parent, "目前還沒有好友。");
        }

        private void RenderRequests(Transform parent)
        {
            int count = 0;
            foreach (SupabaseFriendRequestRecord request in
                latestData.requests ?? new SupabaseFriendRequestRecord[0])
            {
                if (request == null || count >= 6) continue;
                GameObject row = CreateRow(parent, "FriendRequestRow");
                string direction = request.direction == "outgoing" ? "已送出" : "邀請你";
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    request.display_name + "　" + direction,
                    14,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                AddFlexibleLayout(label.gameObject);
                bool incoming = request.direction != "outgoing";
                Button acceptButton = CreateRowButton(row.transform, "接受");
                acceptButton.interactable = incoming && acceptRequest != null;
                acceptButton.onClick.AddListener(() => AcceptRequestAsync(
                    request.id,
                    acceptButton));
                Button declineButton = CreateRowButton(row.transform, "拒絕");
                declineButton.interactable = incoming && declineRequest != null;
                declineButton.onClick.AddListener(() => DeclineRequestAsync(
                    request.id,
                    declineButton));
                count += 1;
            }

            if (count == 0) CreateEmptyRow(parent, "目前沒有待處理邀請。");
        }

        private async void SendRequestAsync(Button button)
        {
            if (sendRequest == null || friendCodeInput == null) return;
            string code = friendCodeInput.text == null
                ? string.Empty
                : friendCodeInput.text.Trim();
            if (string.IsNullOrWhiteSpace(code))
            {
                SetStatus("請先輸入好友代碼。", true);
                return;
            }

            if (button != null) button.interactable = false;
            SetStatus("正在送出好友邀請…", false);
            try
            {
                SupabaseChildSocialData data = await sendRequest(code);
                ApplyMutationData(data, "好友邀請已送出。", button);
                friendCodeInput.text = string.Empty;
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void RefreshAsync(Button button)
        {
            if (refresh == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在同步好友資料…", false);
            try
            {
                ApplyMutationData(await refresh(), "好友資料已更新。", button);
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void AcceptRequestAsync(string requestId, Button button)
        {
            await RunMutationAsync(
                acceptRequest,
                requestId,
                button,
                "好友邀請已接受。");
        }

        private async void DeclineRequestAsync(string requestId, Button button)
        {
            await RunMutationAsync(
                declineRequest,
                requestId,
                button,
                "好友邀請已拒絕。");
        }

        private async void RemoveFriendAsync(string childProfileId, Button button)
        {
            await RunMutationAsync(
                removeFriend,
                childProfileId,
                button,
                "好友已移除。");
        }

        private async void BlockFriendAsync(string childProfileId, Button button)
        {
            await RunMutationAsync(
                blockFriend,
                childProfileId,
                button,
                "已封鎖這位好友。");
        }

        private async void VisitFriendWorldAsync(string childProfileId, Button button)
        {
            if (visitFriendWorld == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在載入好友世界…", false);
            try
            {
                SupabaseChildFriendWorldData data = await visitFriendWorld(childProfileId);
                if (data == null)
                {
                    throw new SupabaseDataException(
                        "伺服器沒有回傳好友世界資料。");
                }

                Close();
                if (friendWorldView == null)
                {
                    friendWorldView = new HabitHeroChildFriendWorldView(
                        canvasTransform,
                        font);
                }

                friendWorldView.Show(data, CloseFriendWorld);
                friendWorldView.Open();
                friendWorldView.SetRealtime(
                    friendWorldRealtimeConnectionId,
                    friendWorldRealtimeChildProfileId,
                    friendWorldRealtimeCharacterAssetKey,
                    onLocalFriendWorldAvatarStateChanged);
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void OpenWorldChatAsync(
            string childProfileId,
            string displayName,
            Button button)
        {
            if (loadWorldChat == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在載入聊天…", false);
            try
            {
                SupabaseChildWorldChatData data = await loadWorldChat(childProfileId);
                if (data == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳聊天資料。");
                }

                Close();
                if (chatView == null)
                {
                    chatView = new HabitHeroChildWorldChatView(
                        canvasTransform,
                        font);
                }

                chatView.Show(
                    displayName,
                    data,
                    () => loadWorldChat(childProfileId),
                    (body) => sendWorldChat == null
                        ? Task.FromException<SupabaseChildWorldChatData>(
                            new SupabaseDataException("聊天服務尚未連線。"))
                        : sendWorldChat(childProfileId, body),
                    (messageId) => markWorldChatRead == null
                        ? Task.FromException<SupabaseChildWorldChatData>(
                            new SupabaseDataException("聊天已讀服務尚未連線。"))
                        : markWorldChatRead(childProfileId, messageId),
                    (messageId) => reportWorldChat == null
                        ? Task.FromException<SupabaseChildWorldChatData>(
                            new SupabaseDataException("聊天檢舉服務尚未連線。"))
                        : reportWorldChat(childProfileId, messageId),
                    CloseWorldChat);
                chatView.Open();
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private void CloseFriendWorld()
        {
            if (friendWorldView != null) friendWorldView.Close();
            Open();
        }

        private void CloseWorldChat()
        {
            if (chatView != null) chatView.Close();
            Open();
        }

        private async Task RunMutationAsync(
            Func<string, Task<SupabaseChildSocialData>> mutation,
            string value,
            Button button,
            string successMessage)
        {
            if (mutation == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在更新好友資料…", false);
            try
            {
                ApplyMutationData(await mutation(value), successMessage, button);
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private void ApplyMutationData(
            SupabaseChildSocialData data,
            string successMessage,
            Button button)
        {
            if (data == null) throw new SupabaseDataException("伺服器沒有回傳最新好友資料。");
            latestData = data;
            if (onDataChanged != null) onDataChanged(data);
            ApplyData(data);
            SetStatus(successMessage, false);
            if (button != null) button.interactable = true;
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
            row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 34f);
            HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
            layout.spacing = 4f;
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
            layout.preferredWidth = 68f;
            layout.minWidth = 68f;
            return button;
        }

        private void CreateEmptyRow(Transform parent, string message)
        {
            Text text = HabitHeroUiFactory.CreateText(
                parent,
                font,
                message,
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                Vector2.zero,
                Vector2.one);
            text.gameObject.AddComponent<LayoutElement>().preferredHeight = 30f;
        }

        private static void AddFlexibleLayout(GameObject target)
        {
            target.AddComponent<LayoutElement>().flexibleWidth = 1f;
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
            Close();
            if (callback != null) callback();
        }

        public void Close()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            if (friendWorldView != null) friendWorldView.Close();
            if (chatView != null) chatView.Close();

            friendListObject = null;
            requestListObject = null;
            friendCodeInput = null;
            statusText = null;
        }
    }
}
