using System;
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
        private HabitHeroChildHomeCoordinator childHomeCoordinator;
        private Canvas canvas;
        private GameObject loginPanel;
        private Font uiFont;
        private InputField accountInput;
        private InputField passwordInput;
        private Toggle childModeToggle;
        private Button loginButton;
        private Button signOutButton;
        private Text statusText;
        private Text titleText;
        private Text accountLabel;
        private bool isBusy;

        private async void Start()
        {
            lifetimeCancellation = new CancellationTokenSource();
            BuildInterface();

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
            childHomeCoordinator = new HabitHeroChildHomeCoordinator(
                new SupabaseChildHomeClient(new SupabaseRestClient(settings, authClient)),
                canvas.transform,
                uiFont);
            authClient.AuthStateChanged += HandleAuthStateChanged;
            SetBusy(true);
            SetStatus("正在恢復登入狀態…", false);
            try
            {
                SupabaseSession session = await authClient.InitializeAsync(
                    lifetimeCancellation.Token);
                if (session == null)
                {
                    SetStatus("請登入以開始使用。", false);
                }
                else
                {
                    ShowSignedIn(session);
                    await TryShowChildHomeAsync(session);
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
            if (authClient != null)
            {
                authClient.AuthStateChanged -= HandleAuthStateChanged;
            }

            if (childHomeCoordinator != null)
            {
                childHomeCoordinator.Dispose();
                childHomeCoordinator = null;
            }

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
                await TryShowChildHomeAsync(session);
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

        private static string BuildChildEmail(string username)
        {
            return username.Trim().ToLowerInvariant() + ChildEmailDomain;
        }

        private async Task TryShowChildHomeAsync(SupabaseSession session)
        {
            if (childHomeCoordinator == null || canvas == null) return;

            childModeToggle.isOn = true;
            await childHomeCoordinator.TryShowAsync(
                session,
                lifetimeCancellation.Token,
                SetStatus,
                HandleSignOutClicked,
                () => loginPanel.SetActive(false),
                () => loginPanel.SetActive(true));
        }

    }
}
