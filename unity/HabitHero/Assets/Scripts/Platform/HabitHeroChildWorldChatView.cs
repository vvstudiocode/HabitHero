using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildWorldChatView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject messageListObject;
        private InputField messageInput;
        private Text statusText;
        private string worldOwnerDisplayName;
        private SupabaseChildWorldChatData latestData;
        private Func<Task<SupabaseChildWorldChatData>> refresh;
        private Func<string, Task<SupabaseChildWorldChatData>> send;
        private Func<string, Task<SupabaseChildWorldChatData>> markRead;
        private Func<string, Task<SupabaseChildWorldChatData>> report;
        private Action onClose;

        public HabitHeroChildWorldChatView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            string worldOwnerDisplayName,
            SupabaseChildWorldChatData data,
            Func<Task<SupabaseChildWorldChatData>> refresh,
            Func<string, Task<SupabaseChildWorldChatData>> send,
            Func<string, Task<SupabaseChildWorldChatData>> markRead,
            Func<string, Task<SupabaseChildWorldChatData>> report,
            Action onClose)
        {
            Close();
            this.worldOwnerDisplayName = string.IsNullOrWhiteSpace(worldOwnerDisplayName)
                ? "好友"
                : worldOwnerDisplayName;
            latestData = data;
            this.refresh = refresh;
            this.send = send;
            this.markRead = markRead;
            this.report = report;
            this.onClose = onClose;
        }

        public void Open()
        {
            if (latestData == null) return;
            Close();
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ChildWorldChatPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildWorldChatCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.05f, 0.06f);
            cardRect.anchorMax = new Vector2(0.95f, 0.94f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "與" + worldOwnerDisplayName + "聊天",
                30,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.9f),
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
                "訊息由 Supabase server 驗證與保存；請勿分享個人聯絡資訊。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.9f));
            messageListObject = CreateList(
                card.transform,
                "WorldChatMessageList",
                new Vector2(0.08f, 0.27f),
                new Vector2(0.92f, 0.82f));
            RenderMessages(messageListObject.transform);

            messageInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "說點什麼…",
                false,
                new Vector2(0.08f, 0.18f),
                new Vector2(0.72f, 0.25f));
            messageInput.contentType = InputField.ContentType.Standard;
            Button sendButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "送出",
                new Vector2(0.74f, 0.18f),
                new Vector2(0.92f, 0.25f));
            sendButton.interactable = send != null;
            sendButton.onClick.AddListener(() => SendAsync(sendButton));

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                latestData.unreadCount > 0
                    ? "未讀訊息：" + latestData.unreadCount
                    : "目前沒有未讀訊息。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.08f),
                new Vector2(0.48f, 0.15f));
            Button readButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "標為已讀",
                new Vector2(0.5f, 0.08f),
                new Vector2(0.64f, 0.15f));
            readButton.interactable = markRead != null && latestData.messages.Length > 0;
            readButton.onClick.AddListener(() => MarkReadAsync(readButton));
            Button refreshButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "重新整理",
                new Vector2(0.66f, 0.08f),
                new Vector2(0.8f, 0.15f));
            refreshButton.interactable = refresh != null;
            refreshButton.onClick.AddListener(() => RefreshAsync(refreshButton));
            Button bottomCloseButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "返回好友",
                new Vector2(0.82f, 0.08f),
                new Vector2(0.94f, 0.15f));
            bottomCloseButton.onClick.AddListener(CloseFromButton);
        }

        public void Dispose()
        {
            Close();
            latestData = null;
            refresh = null;
            send = null;
            markRead = null;
            report = null;
            onClose = null;
        }

        private void RenderMessages(Transform parent)
        {
            SupabaseWorldChatMessageRecord[] messages =
                latestData.messages ?? new SupabaseWorldChatMessageRecord[0];
            if (messages.Length == 0)
            {
                CreateMessageText(parent, "尚無訊息，打個招呼吧！");
                return;
            }

            int start = Math.Max(0, messages.Length - 12);
            for (int index = start; index < messages.Length; index += 1)
            {
                SupabaseWorldChatMessageRecord message = messages[index];
                if (message == null || string.IsNullOrWhiteSpace(message.id)) continue;
                GameObject row = new GameObject(
                    "WorldChatMessageRow",
                    typeof(RectTransform),
                    typeof(HorizontalLayoutGroup));
                row.transform.SetParent(parent, false);
                row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 38f);
                HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
                layout.spacing = 4f;
                layout.childControlWidth = true;
                layout.childControlHeight = true;
                layout.childForceExpandWidth = false;
                layout.childForceExpandHeight = true;
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    message.sender_display_name + "：" + message.body,
                    14,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                label.horizontalOverflow = HorizontalWrapMode.Wrap;
                label.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1f;
                Button reportButton = HabitHeroUiFactory.CreateButton(
                    row.transform,
                    font,
                    "檢舉",
                    Vector2.zero,
                    Vector2.one);
                LayoutElement buttonLayout = reportButton.gameObject.AddComponent<LayoutElement>();
                buttonLayout.preferredWidth = 68f;
                buttonLayout.minWidth = 68f;
                reportButton.interactable = report != null;
                reportButton.onClick.AddListener(() => ReportAsync(
                    message.id,
                    reportButton));
            }
        }

        private void CreateMessageText(Transform parent, string message)
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
            text.gameObject.AddComponent<LayoutElement>().preferredHeight = 36f;
        }

        private async void RefreshAsync(Button button)
        {
            if (refresh == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在同步聊天…", false);
            try
            {
                ApplyMutationData(await refresh(), "聊天資料已更新。", button);
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void SendAsync(Button button)
        {
            if (send == null || messageInput == null) return;
            string body = messageInput.text == null
                ? string.Empty
                : messageInput.text.Trim();
            if (!SupabaseChildWorldChatClient.IsValidMessage(body))
            {
                SetStatus("訊息格式不符合聊天規則。", true);
                return;
            }

            if (button != null) button.interactable = false;
            SetStatus("正在送出聊天訊息…", false);
            try
            {
                ApplyMutationData(await send(body), "訊息已送出。", button);
                if (messageInput != null) messageInput.text = string.Empty;
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void MarkReadAsync(Button button)
        {
            if (markRead == null || latestData == null) return;
            SupabaseWorldChatMessageRecord[] messages = latestData.messages;
            if (messages == null || messages.Length == 0) return;
            SupabaseWorldChatMessageRecord latest = messages[messages.Length - 1];
            if (latest == null || string.IsNullOrWhiteSpace(latest.id)) return;
            if (button != null) button.interactable = false;
            SetStatus("正在更新已讀狀態…", false);
            try
            {
                ApplyMutationData(await markRead(latest.id), "已標為已讀。", button);
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void ReportAsync(string messageId, Button button)
        {
            if (report == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在送出檢舉…", false);
            try
            {
                ApplyMutationData(await report(messageId), "檢舉已送出。", button);
            }
            catch (Exception exception)
            {
                SetStatus(exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private void ApplyMutationData(
            SupabaseChildWorldChatData data,
            string successMessage,
            Button button)
        {
            if (data == null)
            {
                throw new SupabaseDataException("伺服器沒有回傳最新聊天資料。");
            }

            latestData = data;
            ApplyData(data);
            SetStatus(successMessage, false);
            if (button != null) button.interactable = true;
        }

        private void ApplyData(SupabaseChildWorldChatData data)
        {
            latestData = data;
            if (panel == null) return;
            Close();
            Open();
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
            layout.spacing = 5f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
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

            messageListObject = null;
            messageInput = null;
            statusText = null;
        }
    }
}
