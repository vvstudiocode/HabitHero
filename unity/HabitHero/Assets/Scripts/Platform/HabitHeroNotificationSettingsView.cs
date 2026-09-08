using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroNotificationSettingsView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject overlay;
        private Toggle enabledToggle;
        private Button closeButton;
        private Text statusText;
        private HabitHeroNotificationSettingsController controller;
        private Action onClose;
        private CancellationTokenSource viewCancellation;
        private bool applyingState;
        private bool busy;

        public HabitHeroNotificationSettingsView(
            Transform canvasTransform,
            Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            HabitHeroNotificationSettingsController controller,
            CancellationToken cancellationToken,
            Action onClose)
        {
            if (controller == null) throw new ArgumentNullException("controller");
            Dispose();
            this.controller = controller;
            this.onClose = onClose;
            viewCancellation = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken);

            overlay = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0f, 0f, 0f, 0.58f),
                "NotificationSettingsOverlay");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                overlay.transform,
                HabitHeroUiFactory.PanelColor,
                "NotificationSettingsCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.5f, 0.5f);
            cardRect.anchorMax = new Vector2(0.5f, 0.5f);
            cardRect.pivot = new Vector2(0.5f, 0.5f);
            cardRect.sizeDelta = new Vector2(620f, 470f);
            cardRect.anchoredPosition = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "通知設定",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.76f),
                new Vector2(0.92f, 0.92f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "開啟後，習慣冒險島可以在背景提醒任務與獎勵變化。",
                18,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.61f),
                new Vector2(0.92f, 0.73f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "背景通知",
                22,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.45f),
                new Vector2(0.64f, 0.56f));
            enabledToggle = HabitHeroUiFactory.CreateSwitch(
                card.transform,
                new Vector2(0.7f, 0.43f),
                new Vector2(0.9f, 0.58f));
            enabledToggle.onValueChanged.AddListener(HandleToggleChanged);
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "正在讀取通知設定…",
                16,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.25f),
                new Vector2(0.92f, 0.4f));
            closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "完成",
                new Vector2(0.25f, 0.08f),
                new Vector2(0.75f, 0.2f));
            closeButton.onClick.AddListener(Close);

            _ = LoadAsync();
        }

        public void Dispose()
        {
            if (viewCancellation != null)
            {
                viewCancellation.Cancel();
                viewCancellation.Dispose();
                viewCancellation = null;
            }

            if (overlay != null)
            {
                UnityEngine.Object.Destroy(overlay);
                overlay = null;
            }

            enabledToggle = null;
            closeButton = null;
            statusText = null;
            controller = null;
            onClose = null;
            applyingState = false;
            busy = false;
        }

        private async Task LoadAsync()
        {
            try
            {
                HabitHeroNotificationSettingsState state =
                    await controller.LoadAsync(viewCancellation.Token);
                if (overlay == null) return;
                ApplyState(state);
            }
            catch (OperationCanceledException)
            {
                // The panel or scene was closed while loading.
            }
            catch (Exception exception)
            {
                if (statusText != null)
                {
                    statusText.text = "通知設定載入失敗：" + exception.Message;
                    statusText.color = new Color(1f, 0.52f, 0.52f, 1f);
                }
            }
        }

        private async void HandleToggleChanged(bool nextEnabled)
        {
            if (applyingState || busy || controller == null) return;

            SetBusy(true);
            try
            {
                HabitHeroNotificationSettingsState state =
                    await controller.SetEnabledAsync(
                        nextEnabled,
                        viewCancellation.Token);
                if (overlay != null) ApplyState(state);
            }
            catch (OperationCanceledException)
            {
                // The panel or scene was closed while saving.
            }
            catch (Exception exception)
            {
                if (statusText != null)
                {
                    statusText.text = "通知設定更新失敗：" + exception.Message;
                    statusText.color = new Color(1f, 0.52f, 0.52f, 1f);
                }
                ApplyToggleValue(!nextEnabled);
            }
            finally
            {
                SetBusy(false);
            }
        }

        private void ApplyState(HabitHeroNotificationSettingsState state)
        {
            if (state == null) return;
            ApplyToggleValue(state.Enabled);
            if (statusText != null)
            {
                statusText.text = !string.IsNullOrWhiteSpace(state.Error)
                    ? state.Error
                    : state.Supported
                        ? (state.Enabled
                            ? "通知已開啟。"
                            : "通知目前為關閉狀態。")
                        : "目前只有 iOS 原生 App 支援背景通知。";
                statusText.color = !string.IsNullOrWhiteSpace(state.Error)
                    ? new Color(1f, 0.65f, 0.38f, 1f)
                    : new Color(0.84f, 0.89f, 0.96f, 1f);
            }

            if (enabledToggle != null)
            {
                enabledToggle.interactable = !busy
                    && (state.Supported || state.Enabled);
            }
        }

        private void ApplyToggleValue(bool value)
        {
            if (enabledToggle == null) return;
            applyingState = true;
            enabledToggle.isOn = value;
            applyingState = false;
        }

        private void SetBusy(bool nextBusy)
        {
            busy = nextBusy;
            if (closeButton != null) closeButton.interactable = !nextBusy;
            if (enabledToggle != null) enabledToggle.interactable = !nextBusy;
        }

        private void Close()
        {
            Action callback = onClose;
            if (callback != null) callback();
        }
    }
}
