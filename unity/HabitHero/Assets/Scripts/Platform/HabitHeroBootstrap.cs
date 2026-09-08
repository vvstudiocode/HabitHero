using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroBootstrap : MonoBehaviour
    {
        private const string ChildEmailDomain = "@children.habithero.local";

        private CancellationTokenSource lifetimeCancellation;
        private SupabaseAuthClient authClient;
        private SupabaseNotificationClient notificationClient;
        private ISupabasePushTokenProvider pushTokenProvider;
        private HabitHeroNotificationSettingsController notificationSettingsController;
        private HabitHeroNotificationSettingsView notificationSettingsView;
        private CancellationTokenSource notificationContextCancellation;
        private string notificationContextKey;
        private HabitHeroChildHomeCoordinator childHomeCoordinator;
        private HabitHeroParentHomeCoordinator parentHomeCoordinator;
        private Canvas canvas;
        private GameObject loginPanel;
        private GameObject recoveryPanel;
        private Font uiFont;
        private InputField accountInput;
        private InputField passwordInput;
        private InputField recoveryPasswordInput;
        private InputField recoveryConfirmationInput;
        private Toggle childModeToggle;
        private Button loginButton;
        private Button signOutButton;
        private Button recoverySubmitButton;
        private GameObject parentUnlockPanel;
        private InputField parentUnlockPasswordInput;
        private Button parentUnlockSubmitButton;
        private Text statusText;
        private Text recoveryStatusText;
        private Text parentUnlockStatusText;
        private Text titleText;
        private Text accountLabel;
        private bool isBusy;
        private string pendingDeepLinkUrl;
        private readonly HashSet<string> handledDeepLinks = new HashSet<string>();

        private void OnEnable()
        {
            Application.deepLinkActivated += HandleDeepLinkActivated;
        }

        private void Update()
        {
            if (childHomeCoordinator != null)
            {
                childHomeCoordinator.Tick(Time.unscaledDeltaTime);
            }
        }

        private async void Start()
        {
            lifetimeCancellation = new CancellationTokenSource();
            BuildInterface();
            string launchUrl = Application.absoluteURL;

            SupabaseRuntimeConfig config = Resources.Load<SupabaseRuntimeConfig>(
                "SupabaseRuntimeConfig");
            if (config == null)
            {
                SetStatus(
                    "尚未設定 Supabase。請用 HabitHero/Configure Supabase Runtime " +
                    "產生本機設定。",
                    true);
                return;
            }

            SupabaseClientSettings settings;
            string error;
            if (!config.TryCreateSettings(out settings, out error))
            {
                SetStatus("Supabase 設定無效：" + error, true);
                return;
            }

            authClient = new SupabaseAuthClient(settings);
            SupabaseRestClient restClient = new SupabaseRestClient(settings, authClient);
            notificationClient = new SupabaseNotificationClient(restClient);
            pushTokenProvider = new UnityMobilePushTokenProvider();
            childHomeCoordinator = new HabitHeroChildHomeCoordinator(
                new SupabaseChildHomeClient(restClient),
                new SupabaseChildGameClient(restClient),
                new SupabaseChildWorldClient(restClient),
                new SupabaseChildSocialClient(restClient),
                new SupabaseChildCoopAdventureClient(restClient),
                new SupabaseChildCoopAdventureRealtimeClient(restClient),
                new SupabaseChildFriendWorldClient(restClient),
                new SupabaseChildWorldChatClient(restClient),
                new SupabaseChildFriendWorldRealtimeClient(restClient),
                canvas.transform,
                uiFont,
                config.GameAssetBaseUrl,
                OpenNotificationSettings);
            parentHomeCoordinator = new HabitHeroParentHomeCoordinator(
                new SupabaseParentHomeClient(restClient),
                new SupabaseChildGameClient(restClient),
                new SupabaseChildCoopAdventureClient(restClient),
                canvas.transform,
                uiFont,
                OpenNotificationSettings);
            authClient.AuthStateChanged += HandleAuthStateChanged;
            SetBusy(true);
            SetStatus("正在恢復登入狀態…", false);
            try
            {
                string callbackUrl = !string.IsNullOrWhiteSpace(pendingDeepLinkUrl)
                    ? pendingDeepLinkUrl
                    : launchUrl;
                if (!string.IsNullOrWhiteSpace(callbackUrl)
                    && await ProcessDeepLinkAsync(callbackUrl))
                {
                    return;
                }

                SupabaseSession session = await authClient.InitializeAsync(
                    lifetimeCancellation.Token);
                if (session == null)
                {
                    SetStatus("請登入以開始使用。", false);
                }
                else
                {
                    ShowSignedIn(session);
                    if (!await TryShowChildHomeAsync(session))
                    {
                        await TryShowParentHomeAsync(session);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Destroyed scenes cancel the initialization without showing an error.
            }
            catch (Exception exception)
            {
                SetStatus("恢復登入失敗：" + exception.Message, true);
            }
            finally
            {
                SetBusy(false);
            }
        }

        private void OnDestroy()
        {
            Application.deepLinkActivated -= HandleDeepLinkActivated;
            if (authClient != null)
            {
                authClient.AuthStateChanged -= HandleAuthStateChanged;
            }

            if (childHomeCoordinator != null)
            {
                childHomeCoordinator.Dispose();
                childHomeCoordinator = null;
            }
            if (parentHomeCoordinator != null)
            {
                parentHomeCoordinator.Dispose();
                parentHomeCoordinator = null;
            }

            ClearNotificationContext();

            CloseRecoveryPanel();
            CloseParentUnlockPanel();

            if (lifetimeCancellation != null)
            {
                lifetimeCancellation.Cancel();
                lifetimeCancellation.Dispose();
                lifetimeCancellation = null;
            }
        }

        private void BuildInterface()
        {
            uiFont = Resources.GetBuiltinResource<Font>("Arial.ttf");
            Font font = uiFont;
            canvas = HabitHeroUiFactory.CreateCanvas();
            HabitHeroUiFactory.CreatePanel(
                canvas.transform,
                HabitHeroUiFactory.BackgroundColor,
                "Background");

            GameObject panel = HabitHeroUiFactory.CreatePanel(
                canvas.transform,
                HabitHeroUiFactory.PanelColor,
                "LoginPanel");
            loginPanel = panel;
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(680f, 720f);
            panelRect.anchoredPosition = Vector2.zero;

            titleText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "習慣冒險島",
                46,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.81f),
                new Vector2(0.92f, 0.95f));
            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "Unity client foundation",
                18,
                TextAnchor.MiddleCenter,
                new Color(0.74f, 0.81f, 0.9f, 1f),
                new Vector2(0.08f, 0.75f),
                new Vector2(0.92f, 0.83f));

            accountLabel = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "家長 Email",
                20,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.63f),
                new Vector2(0.9f, 0.7f));
            accountInput = HabitHeroUiFactory.CreateInput(
                panel.transform,
                font,
                "輸入 Email",
                false,
                new Vector2(0.1f, 0.52f),
                new Vector2(0.9f, 0.63f));

            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "密碼",
                20,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.4f),
                new Vector2(0.9f, 0.47f));
            passwordInput = HabitHeroUiFactory.CreateInput(
                panel.transform,
                font,
                "輸入密碼",
                true,
                new Vector2(0.1f, 0.29f),
                new Vector2(0.9f, 0.4f));

            childModeToggle = HabitHeroUiFactory.CreateToggle(
                panel.transform,
                font,
                new Vector2(0.1f, 0.19f),
                new Vector2(0.9f, 0.28f));
            childModeToggle.onValueChanged.AddListener(HandleChildModeChanged);

            loginButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "登入",
                new Vector2(0.1f, 0.08f),
                new Vector2(0.43f, 0.17f));
            loginButton.onClick.AddListener(HandleLoginClicked);

            signOutButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "登出",
                new Vector2(0.57f, 0.08f),
                new Vector2(0.9f, 0.17f));
            signOutButton.onClick.AddListener(HandleSignOutClicked);

            statusText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "準備中…",
                18,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.01f),
                new Vector2(0.92f, 0.075f));
            HandleChildModeChanged(false);
            SetSignedInControls(false);
        }

        private void HandleDeepLinkActivated(string rawUrl)
        {
            if (string.IsNullOrWhiteSpace(rawUrl)) return;
            pendingDeepLinkUrl = rawUrl;
            if (authClient == null) return;
            _ = ProcessDeepLinkAsync(rawUrl);
        }

        private async Task<bool> ProcessDeepLinkAsync(string rawUrl)
        {
            if (string.IsNullOrWhiteSpace(rawUrl)
                || !handledDeepLinks.Add(rawUrl)) return false;

            AuthIntent intent = AuthCallbackParser.GetIntent(rawUrl);
            if (intent == AuthIntent.None) return false;

            AuthCallbackPayload payload = AuthCallbackParser.Parse(rawUrl);
            if (!string.IsNullOrWhiteSpace(payload.Error))
            {
                string message = !string.IsNullOrWhiteSpace(payload.ErrorDescription)
                    ? payload.ErrorDescription
                    : payload.Error;
                SetStatus("登入連結失敗：" + message, true);
                return true;
            }

            if (payload.HasSessionPayload
                && !string.IsNullOrWhiteSpace(payload.AccessToken)
                && !string.IsNullOrWhiteSpace(payload.RefreshToken))
            {
                SupabaseSession session;
                string error;
                if (!authClient.TrySetSessionFromCallback(
                        payload.AccessToken,
                        payload.RefreshToken,
                        intent == AuthIntent.PasswordRecovery,
                        out session,
                        out error))
                {
                    SetStatus("登入連結無效：" + error, true);
                    return true;
                }

                if (intent == AuthIntent.PasswordRecovery)
                {
                    ShowSignedIn(session);
                    ShowRecoveryPanel();
                    return true;
                }

                try
                {
                    await authClient.GetUserAsync(lifetimeCancellation.Token);
                    session = authClient.CurrentSession;
                    ShowSignedIn(session);
                    if (!await TryShowChildHomeAsync(session))
                    {
                        await TryShowParentHomeAsync(session);
                    }
                }
                catch (Exception exception)
                {
                    SetStatus("登入連結已收到，但無法確認帳號：" + exception.Message, true);
                }

                return true;
            }

            if (!string.IsNullOrWhiteSpace(payload.Code))
            {
                if (string.IsNullOrWhiteSpace(payload.CodeVerifier))
                {
                    SetStatus(
                        "此登入連結缺少 PKCE 驗證資訊，請回到原本的登入頁重新開啟登入流程。",
                        true);
                    return true;
                }

                try
                {
                    SupabaseSession session = await authClient.ExchangeCodeForSessionAsync(
                        payload.Code,
                        payload.CodeVerifier,
                        intent == AuthIntent.PasswordRecovery,
                        lifetimeCancellation.Token);
                    if (intent == AuthIntent.PasswordRecovery)
                    {
                        ShowSignedIn(session);
                        ShowRecoveryPanel();
                        return true;
                    }

                    await authClient.GetUserAsync(lifetimeCancellation.Token);
                    session = authClient.CurrentSession;
                    ShowSignedIn(session);
                    if (!await TryShowChildHomeAsync(session))
                    {
                        await TryShowParentHomeAsync(session);
                    }
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception exception)
                {
                    SetStatus("登入連結交換失敗：" + exception.Message, true);
                }

                return true;
            }

            if (intent == AuthIntent.PasswordRecovery)
            {
                SetStatus("重設連結無效或已過期，請重新寄送重設連結。", true);
                return true;
            }

            if (loginPanel != null) loginPanel.SetActive(true);
            SetSignedInControls(false);
            SetStatus("請輸入帳號與密碼登入。", false);
            return true;
        }

        private void ShowRecoveryPanel()
        {
            if (canvas == null) return;
            if (recoveryPanel != null) CloseRecoveryPanel();
            if (loginPanel != null) loginPanel.SetActive(false);

            recoveryPanel = HabitHeroUiFactory.CreatePanel(
                canvas.transform,
                HabitHeroUiFactory.PanelColor,
                "RecoveryPanel");
            RectTransform panelRect = recoveryPanel.GetComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(680f, 720f);
            panelRect.anchoredPosition = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                recoveryPanel.transform,
                uiFont,
                "重設家長密碼",
                42,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.79f),
                new Vector2(0.92f, 0.94f));
            HabitHeroUiFactory.CreateText(
                recoveryPanel.transform,
                uiFont,
                "請設定至少 8 碼，並包含大小寫英文字母的新密碼。",
                18,
                TextAnchor.MiddleCenter,
                new Color(0.74f, 0.81f, 0.9f, 1f),
                new Vector2(0.08f, 0.7f),
                new Vector2(0.92f, 0.78f));
            HabitHeroUiFactory.CreateText(
                recoveryPanel.transform,
                uiFont,
                "新密碼",
                20,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.59f),
                new Vector2(0.9f, 0.66f));
            recoveryPasswordInput = HabitHeroUiFactory.CreateInput(
                recoveryPanel.transform,
                uiFont,
                "輸入新密碼",
                true,
                new Vector2(0.1f, 0.48f),
                new Vector2(0.9f, 0.59f));
            HabitHeroUiFactory.CreateText(
                recoveryPanel.transform,
                uiFont,
                "再次輸入新密碼",
                20,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.38f),
                new Vector2(0.9f, 0.45f));
            recoveryConfirmationInput = HabitHeroUiFactory.CreateInput(
                recoveryPanel.transform,
                uiFont,
                "再次輸入新密碼",
                true,
                new Vector2(0.1f, 0.27f),
                new Vector2(0.9f, 0.38f));
            recoverySubmitButton = HabitHeroUiFactory.CreateButton(
                recoveryPanel.transform,
                uiFont,
                "更新密碼",
                new Vector2(0.1f, 0.14f),
                new Vector2(0.43f, 0.23f));
            recoverySubmitButton.onClick.AddListener(HandleRecoverySubmitClicked);
            Button backButton = HabitHeroUiFactory.CreateButton(
                recoveryPanel.transform,
                uiFont,
                "返回登入",
                new Vector2(0.57f, 0.14f),
                new Vector2(0.9f, 0.23f));
            backButton.onClick.AddListener(HandleRecoveryBackClicked);
            recoveryStatusText = HabitHeroUiFactory.CreateText(
                recoveryPanel.transform,
                uiFont,
                "",
                17,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.02f),
                new Vector2(0.92f, 0.11f));
            SetRecoveryStatus("請輸入新的家長密碼。", false);
            SetBusy(false);
        }

        private async void HandleRecoverySubmitClicked()
        {
            if (authClient == null || isBusy) return;
            string password = recoveryPasswordInput == null
                ? string.Empty
                : recoveryPasswordInput.text ?? string.Empty;
            string confirmation = recoveryConfirmationInput == null
                ? string.Empty
                : recoveryConfirmationInput.text ?? string.Empty;
            if (password.Length < 8
                || !HasUppercase(password)
                || !HasLowercase(password))
            {
                SetRecoveryStatus("密碼需至少 8 碼，並包含大小寫英文字母。", true);
                return;
            }

            if (password != confirmation)
            {
                SetRecoveryStatus("兩次輸入的密碼不一致。", true);
                return;
            }

            SetBusy(true);
            SetRecoveryStatus("正在更新密碼…", false);
            try
            {
                await authClient.UpdatePasswordAsync(password, lifetimeCancellation.Token);
                try
                {
                    await authClient.SignOutAsync(lifetimeCancellation.Token);
                }
                catch (Exception)
                {
                    // Update succeeded; local SignOut still clears the session in the auth client.
                }

                CloseRecoveryPanel();
                if (loginPanel != null) loginPanel.SetActive(true);
                SetSignedInControls(false);
                SetStatus("密碼已更新，請使用新密碼登入。", false);
            }
            catch (OperationCanceledException)
            {
                // Scene shutdown cancels the request.
            }
            catch (Exception exception)
            {
                SetRecoveryStatus("密碼更新失敗：" + exception.Message, true);
            }
            finally
            {
                SetBusy(false);
            }
        }

        private async void HandleRecoveryBackClicked()
        {
            if (authClient == null || isBusy) return;
            SetBusy(true);
            try
            {
                await authClient.SignOutAsync(lifetimeCancellation.Token);
            }
            catch (Exception)
            {
                // SignOut clears the local session even when the network is unavailable.
            }
            finally
            {
                CloseRecoveryPanel();
                if (loginPanel != null) loginPanel.SetActive(true);
                SetSignedInControls(false);
                SetStatus("已返回登入畫面。", false);
                SetBusy(false);
            }
        }

        private void CloseRecoveryPanel()
        {
            if (recoveryPanel != null)
            {
                UnityEngine.Object.Destroy(recoveryPanel);
                recoveryPanel = null;
            }

            recoveryPasswordInput = null;
            recoveryConfirmationInput = null;
            recoverySubmitButton = null;
            recoveryStatusText = null;
        }

        private void SetRecoveryStatus(string message, bool isError)
        {
            if (recoveryStatusText == null) return;
            recoveryStatusText.text = message;
            recoveryStatusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private static bool HasUppercase(string value)
        {
            foreach (char character in value)
            {
                if (char.IsUpper(character)) return true;
            }

            return false;
        }

        private static bool HasLowercase(string value)
        {
            foreach (char character in value)
            {
                if (char.IsLower(character)) return true;
            }

            return false;
        }

        private void HandleChildModeChanged(bool isChildMode)
        {
            if (accountLabel == null || accountInput == null) return;
            accountLabel.text = isChildMode ? "孩子帳號名稱" : "家長 Email";
            accountInput.placeholder.GetComponent<Text>().text = isChildMode
                ? "輸入孩子帳號名稱"
                : "輸入 Email";
            accountInput.contentType = isChildMode
                ? InputField.ContentType.Alphanumeric
                : InputField.ContentType.EmailAddress;
        }

        private async void HandleLoginClicked()
        {
            if (authClient == null || isBusy) return;

            string account = accountInput.text == null ? string.Empty : accountInput.text.Trim();
            string password = passwordInput.text == null ? string.Empty : passwordInput.text;
            if (string.IsNullOrWhiteSpace(account) || string.IsNullOrWhiteSpace(password))
            {
                SetStatus("請輸入帳號與密碼。", true);
                return;
            }

            string email = childModeToggle.isOn
                ? BuildChildEmail(account)
                : account;
            SetBusy(true);
            SetStatus("正在登入…", false);
            try
            {
                SupabaseSession session = await authClient.SignInWithPasswordAsync(
                    email,
                    password,
                    lifetimeCancellation.Token);
                ShowSignedIn(session);
                if (!await TryShowChildHomeAsync(session))
                {
                    await TryShowParentHomeAsync(session);
                }
            }
            catch (OperationCanceledException)
            {
                // Scene shutdown cancels the request.
            }
            catch (Exception exception)
            {
                SetStatus("登入失敗：" + exception.Message, true);
            }
            finally
            {
                SetBusy(false);
            }
        }

        private async void HandleSignOutClicked()
        {
            if (authClient == null || isBusy) return;

            SetBusy(true);
            SetStatus("正在登出…", false);
            try
            {
                await authClient.SignOutAsync(lifetimeCancellation.Token);
                if (childHomeCoordinator != null)
                {
                    childHomeCoordinator.Dispose();
                }
                if (parentHomeCoordinator != null)
                {
                    parentHomeCoordinator.Dispose();
                }
                ClearNotificationContext();
                if (loginPanel != null) loginPanel.SetActive(true);
                SetSignedInControls(false);
                SetStatus("已登出，請重新登入。", false);
            }
            catch (OperationCanceledException)
            {
                // Scene shutdown cancels the request.
            }
            catch (Exception exception)
            {
                if (childHomeCoordinator != null)
                {
                    childHomeCoordinator.Dispose();
                }
                if (parentHomeCoordinator != null)
                {
                    parentHomeCoordinator.Dispose();
                }
                ClearNotificationContext();
                if (loginPanel != null) loginPanel.SetActive(true);
                SetSignedInControls(false);
                SetStatus("已清除本機登入，但遠端登出回報錯誤：" + exception.Message, true);
            }
            finally
            {
                SetBusy(false);
            }
        }

        private void HandleAuthStateChanged(
            SupabaseAuthEvent eventType,
            SupabaseSession session)
        {
            if (eventType == SupabaseAuthEvent.SignedOut)
            {
                SetSignedInControls(false);
                return;
            }

            if (session != null && eventType != SupabaseAuthEvent.InitialSession)
            {
                SetSignedInControls(true);
            }
        }

        private void ShowSignedIn(SupabaseSession session)
        {
            string email = session == null || session.User == null
                ? "已登入"
                : session.User.Email;
            SetSignedInControls(true);
            SetStatus("已登入：" + email, false);
        }

        private void SetSignedInControls(bool signedIn)
        {
            if (accountInput != null) accountInput.interactable = !signedIn;
            if (passwordInput != null) passwordInput.interactable = !signedIn;
            if (childModeToggle != null) childModeToggle.interactable = !signedIn;
            if (loginButton != null) loginButton.gameObject.SetActive(!signedIn);
            if (signOutButton != null) signOutButton.gameObject.SetActive(signedIn);
            if (titleText != null) titleText.text = signedIn ? "歡迎回來" : "習慣冒險島";
        }

        private void SetBusy(bool busy)
        {
            isBusy = busy;
            if (loginButton != null) loginButton.interactable = !busy;
            if (signOutButton != null) signOutButton.interactable = !busy;
            if (accountInput != null && authClient != null && authClient.CurrentSession == null)
            {
                accountInput.interactable = !busy;
            }

            if (passwordInput != null && authClient != null && authClient.CurrentSession == null)
            {
                passwordInput.interactable = !busy;
            }
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void HandleSwitchToParentRequested()
        {
            if (authClient == null || authClient.CurrentSession == null)
            {
                SetStatus("找不到目前的家長 session，請重新登入。", true);
                return;
            }

            ShowParentUnlockPanel();
        }

        private async Task<bool> HandleEnterChildModeAsync(
            string familyId,
            string childProfileId)
        {
            if (childHomeCoordinator == null) return false;
            bool shown = await childHomeCoordinator.TryShowParentChildAsync(
                familyId,
                childProfileId,
                lifetimeCancellation.Token,
                SetStatus,
                HandleSignOutClicked,
                HandleSwitchToParentRequested,
                () => loginPanel.SetActive(false),
                () => { });
            if (shown && parentHomeCoordinator != null)
            {
                parentHomeCoordinator.Dispose();
            }

            if (shown)
            {
                ConfigureNotificationContext(
                    authClient.CurrentSession,
                    childHomeCoordinator.ActiveFamilyId,
                    childHomeCoordinator.ActiveChildProfileId);
            }

            return shown;
        }

        private void ShowParentUnlockPanel()
        {
            if (canvas == null) return;
            CloseParentUnlockPanel();
            parentUnlockPanel = HabitHeroUiFactory.CreatePanel(
                canvas.transform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentUnlockPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                parentUnlockPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentUnlockCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.5f, 0.5f);
            cardRect.anchorMax = new Vector2(0.5f, 0.5f);
            cardRect.pivot = new Vector2(0.5f, 0.5f);
            cardRect.sizeDelta = new Vector2(620f, 420f);
            cardRect.anchoredPosition = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                uiFont,
                "回到家長模式",
                34,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.75f),
                new Vector2(0.92f, 0.92f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                uiFont,
                "為保護孩子資料，請重新輸入家長密碼。",
                17,
                TextAnchor.MiddleCenter,
                new Color(0.78f, 0.84f, 0.92f, 1f),
                new Vector2(0.08f, 0.63f),
                new Vector2(0.92f, 0.73f));
            parentUnlockPasswordInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                uiFont,
                "輸入家長密碼",
                true,
                new Vector2(0.1f, 0.42f),
                new Vector2(0.9f, 0.57f));
            parentUnlockSubmitButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                uiFont,
                "確認",
                new Vector2(0.1f, 0.2f),
                new Vector2(0.43f, 0.32f));
            parentUnlockSubmitButton.onClick.AddListener(
                HandleParentUnlockSubmitClicked);
            Button cancelButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                uiFont,
                "取消",
                new Vector2(0.57f, 0.2f),
                new Vector2(0.9f, 0.32f));
            cancelButton.onClick.AddListener(CloseParentUnlockPanel);
            parentUnlockStatusText = HabitHeroUiFactory.CreateText(
                card.transform,
                uiFont,
                "",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.06f),
                new Vector2(0.92f, 0.17f));
            SetParentUnlockStatus("家長驗證不會切換成孩子帳號。", false);
        }

        private async void HandleParentUnlockSubmitClicked()
        {
            if (authClient == null || isBusy || parentUnlockPasswordInput == null)
            {
                return;
            }

            SupabaseSession currentSession = authClient.CurrentSession;
            string email = currentSession == null || currentSession.User == null
                ? string.Empty
                : currentSession.User.Email;
            string password = parentUnlockPasswordInput.text ?? string.Empty;
            if (string.IsNullOrWhiteSpace(email)
                || email.EndsWith(ChildEmailDomain, StringComparison.OrdinalIgnoreCase))
            {
                SetParentUnlockStatus("目前 session 不是家長帳號，請重新登入。", true);
                return;
            }
            if (string.IsNullOrWhiteSpace(password))
            {
                SetParentUnlockStatus("請輸入家長密碼。", true);
                return;
            }

            SetBusy(true);
            if (parentUnlockSubmitButton != null)
            {
                parentUnlockSubmitButton.interactable = false;
            }
            SetParentUnlockStatus("正在驗證家長密碼…", false);
            try
            {
                SupabaseSession session = await authClient.SignInWithPasswordAsync(
                    email,
                    password,
                    lifetimeCancellation.Token);
                if (childHomeCoordinator != null)
                {
                    childHomeCoordinator.Dispose();
                }

                bool shown = await TryShowParentHomeAsync(session);
                if (shown)
                {
                    CloseParentUnlockPanel();
                }
                else
                {
                    SetParentUnlockStatus("家長工作台載入失敗，請稍後再試。", true);
                }
            }
            catch (OperationCanceledException)
            {
                // Scene shutdown cancels the request.
            }
            catch (Exception exception)
            {
                SetParentUnlockStatus("家長驗證失敗：" + exception.Message, true);
            }
            finally
            {
                SetBusy(false);
                if (parentUnlockSubmitButton != null)
                {
                    parentUnlockSubmitButton.interactable = true;
                }
            }
        }

        private void CloseParentUnlockPanel()
        {
            if (parentUnlockPanel != null)
            {
                UnityEngine.Object.Destroy(parentUnlockPanel);
                parentUnlockPanel = null;
            }

            parentUnlockPasswordInput = null;
            parentUnlockSubmitButton = null;
            parentUnlockStatusText = null;
        }

        private void SetParentUnlockStatus(string message, bool isError)
        {
            if (parentUnlockStatusText == null) return;
            parentUnlockStatusText.text = message;
            parentUnlockStatusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private static string BuildChildEmail(string username)
        {
            return username.Trim().ToLowerInvariant() + ChildEmailDomain;
        }

        private async Task<bool> TryShowChildHomeAsync(SupabaseSession session)
        {
            string email = session == null || session.User == null
                ? string.Empty
                : session.User.Email;
            if (childHomeCoordinator == null
                || canvas == null
                || string.IsNullOrWhiteSpace(email)
                || !email.EndsWith(ChildEmailDomain, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            childModeToggle.isOn = true;
            bool shown = await childHomeCoordinator.TryShowAsync(
                session,
                lifetimeCancellation.Token,
                SetStatus,
                HandleSignOutClicked,
                () => loginPanel.SetActive(false),
                () => loginPanel.SetActive(true));
            if (shown)
            {
                ConfigureNotificationContext(
                    session,
                    childHomeCoordinator.ActiveFamilyId,
                    childHomeCoordinator.ActiveChildProfileId);
            }

            return shown;
        }

        private async Task<bool> TryShowParentHomeAsync(SupabaseSession session)
        {
            string email = session == null || session.User == null
                ? string.Empty
                : session.User.Email;
            if (parentHomeCoordinator == null
                || canvas == null
                || string.IsNullOrWhiteSpace(email)
                || email.EndsWith(ChildEmailDomain, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            childModeToggle.isOn = false;
            bool shown = await parentHomeCoordinator.TryShowAsync(
                session,
                lifetimeCancellation.Token,
                SetStatus,
                HandleSignOutClicked,
                (familyId, childProfileId) => HandleEnterChildModeAsync(
                    familyId,
                    childProfileId),
                () => loginPanel.SetActive(false),
                () => loginPanel.SetActive(true));
            if (shown)
            {
                ConfigureNotificationContext(
                    session,
                    parentHomeCoordinator.ActiveFamilyId,
                    null);
            }

            return shown;
        }

        private void OpenNotificationSettings()
        {
            if (notificationSettingsController == null
                || canvas == null
                || uiFont == null)
            {
                SetStatus("找不到目前的家庭通知設定，請重新載入畫面。", true);
                return;
            }

            if (notificationSettingsView == null)
            {
                notificationSettingsView = new HabitHeroNotificationSettingsView(
                    canvas.transform,
                    uiFont);
            }

            CancellationToken token = notificationContextCancellation == null
                ? lifetimeCancellation.Token
                : notificationContextCancellation.Token;
            notificationSettingsView.Show(
                notificationSettingsController,
                token,
                CloseNotificationSettings);
        }

        private void CloseNotificationSettings()
        {
            if (notificationSettingsView == null) return;
            notificationSettingsView.Dispose();
            notificationSettingsView = null;
        }

        private void ConfigureNotificationContext(
            SupabaseSession session,
            string familyId,
            string childProfileId)
        {
            string profileId = session == null || session.User == null
                ? string.Empty
                : session.User.Id;
            if (notificationClient == null
                || pushTokenProvider == null
                || string.IsNullOrWhiteSpace(profileId)
                || string.IsNullOrWhiteSpace(familyId))
            {
                ClearNotificationContext();
                return;
            }

            string key = profileId.Trim()
                + ":" + familyId.Trim()
                + ":" + (string.IsNullOrWhiteSpace(childProfileId)
                    ? "parent"
                    : childProfileId.Trim());
            if (string.Equals(notificationContextKey, key, StringComparison.Ordinal))
            {
                return;
            }

            ClearNotificationContext();
            notificationContextKey = key;
            notificationContextCancellation =
                CancellationTokenSource.CreateLinkedTokenSource(
                    lifetimeCancellation.Token);
            notificationSettingsController =
                new HabitHeroNotificationSettingsController(
                    notificationClient,
                    pushTokenProvider,
                    familyId,
                    profileId,
                    childProfileId,
                    GetNotificationPlatform());
            _ = EnsureNotificationsRegisteredAsync(
                notificationSettingsController,
                notificationContextCancellation.Token);
        }

        private async Task EnsureNotificationsRegisteredAsync(
            HabitHeroNotificationSettingsController controller,
            CancellationToken cancellationToken)
        {
            try
            {
                await controller.EnsureRegisteredAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                // The account or selected child changed while registration was pending.
            }
            catch (Exception)
            {
                // Notification permission is optional; the settings panel exposes errors.
            }
        }

        private void ClearNotificationContext()
        {
            CloseNotificationSettings();
            if (notificationContextCancellation != null)
            {
                notificationContextCancellation.Cancel();
                notificationContextCancellation.Dispose();
                notificationContextCancellation = null;
            }

            if (notificationSettingsController != null)
            {
                notificationSettingsController.Dispose();
                notificationSettingsController = null;
            }

            notificationContextKey = null;
        }

        private static string GetNotificationPlatform()
        {
#if UNITY_IOS && !UNITY_EDITOR
            return "ios";
#elif UNITY_ANDROID && !UNITY_EDITOR
            return "android";
#else
            return "web";
#endif
        }

    }
}
