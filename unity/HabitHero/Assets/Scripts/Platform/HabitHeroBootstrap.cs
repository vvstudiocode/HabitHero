using System;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroBootstrap : MonoBehaviour
    {
        private const string ChildEmailDomain = "@children.habithero.local";

        private static readonly Color BackgroundColor = new Color(0.035f, 0.055f, 0.09f, 1f);
        private static readonly Color PanelColor = new Color(0.08f, 0.12f, 0.19f, 0.97f);
        private static readonly Color AccentColor = new Color(0.35f, 0.78f, 0.67f, 1f);

        private CancellationTokenSource lifetimeCancellation;
        private SupabaseAuthClient authClient;
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

            if (lifetimeCancellation != null)
            {
                lifetimeCancellation.Cancel();
                lifetimeCancellation.Dispose();
                lifetimeCancellation = null;
            }
        }

        private void BuildInterface()
        {
            Font font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            Canvas canvas = CreateCanvas();
            CreatePanel(canvas.transform, BackgroundColor, "Background");

            GameObject panel = CreatePanel(canvas.transform, PanelColor, "LoginPanel");
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(680f, 720f);
            panelRect.anchoredPosition = Vector2.zero;

            titleText = CreateText(
                panel.transform,
                font,
                "習慣冒險島",
                46,
                TextAnchor.MiddleCenter,
                AccentColor,
                new Vector2(0.08f, 0.81f),
                new Vector2(0.92f, 0.95f));
            CreateText(
                panel.transform,
                font,
                "Unity client foundation",
                18,
                TextAnchor.MiddleCenter,
                new Color(0.74f, 0.81f, 0.9f, 1f),
                new Vector2(0.08f, 0.75f),
                new Vector2(0.92f, 0.83f));

            accountLabel = CreateText(
                panel.transform,
                font,
                "家長 Email",
                20,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.63f),
                new Vector2(0.9f, 0.7f));
            accountInput = CreateInput(
                panel.transform,
                font,
                "輸入 Email",
                false,
                new Vector2(0.1f, 0.52f),
                new Vector2(0.9f, 0.63f));

            CreateText(
                panel.transform,
                font,
                "密碼",
                20,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0.4f),
                new Vector2(0.9f, 0.47f));
            passwordInput = CreateInput(
                panel.transform,
                font,
                "輸入密碼",
                true,
                new Vector2(0.1f, 0.29f),
                new Vector2(0.9f, 0.4f));

            childModeToggle = CreateToggle(
                panel.transform,
                font,
                new Vector2(0.1f, 0.19f),
                new Vector2(0.9f, 0.28f));
            childModeToggle.onValueChanged.AddListener(HandleChildModeChanged);

            loginButton = CreateButton(
                panel.transform,
                font,
                "登入",
                new Vector2(0.1f, 0.08f),
                new Vector2(0.43f, 0.17f));
            loginButton.onClick.AddListener(HandleLoginClicked);

            signOutButton = CreateButton(
                panel.transform,
                font,
                "登出",
                new Vector2(0.57f, 0.08f),
                new Vector2(0.9f, 0.17f));
            signOutButton.onClick.AddListener(HandleSignOutClicked);

            statusText = CreateText(
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
                SetSignedInControls(false);
                SetStatus("已登出，請重新登入。", false);
            }
            catch (OperationCanceledException)
            {
                // Scene shutdown cancels the request.
            }
            catch (Exception exception)
            {
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

        private static Canvas CreateCanvas()
        {
            GameObject canvasObject = new GameObject(
                "HabitHeroCanvas",
                typeof(RectTransform),
                typeof(Canvas),
                typeof(CanvasScaler),
                typeof(GraphicRaycaster));
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;

            CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080f, 1920f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            if (FindAnyObjectByType<EventSystem>() == null)
            {
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            }

            return canvas;
        }

        private static GameObject CreatePanel(
            Transform parent,
            Color color,
            string name)
        {
            GameObject panel = new GameObject(name, typeof(RectTransform), typeof(Image));
            panel.transform.SetParent(parent, false);
            Image image = panel.GetComponent<Image>();
            image.color = color;
            RectTransform rect = panel.GetComponent<RectTransform>();
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            return panel;
        }

        private static Text CreateText(
            Transform parent,
            Font font,
            string content,
            int fontSize,
            TextAnchor alignment,
            Color color,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject textObject = new GameObject("Text", typeof(RectTransform), typeof(Text));
            textObject.transform.SetParent(parent, false);
            Text text = textObject.GetComponent<Text>();
            text.font = font;
            text.text = content;
            text.fontSize = fontSize;
            text.alignment = alignment;
            text.color = color;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Truncate;
            RectTransform rect = textObject.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            return text;
        }

        private static InputField CreateInput(
            Transform parent,
            Font font,
            string placeholder,
            bool password,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject inputObject = new GameObject(
                "InputField",
                typeof(RectTransform),
                typeof(Image),
                typeof(InputField));
            inputObject.transform.SetParent(parent, false);
            Image image = inputObject.GetComponent<Image>();
            image.color = new Color(1f, 1f, 1f, 0.1f);

            Text text = CreateText(
                inputObject.transform,
                font,
                string.Empty,
                22,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.04f, 0f),
                new Vector2(0.96f, 1f));
            Text hint = CreateText(
                inputObject.transform,
                font,
                placeholder,
                22,
                TextAnchor.MiddleLeft,
                new Color(0.68f, 0.73f, 0.82f, 1f),
                new Vector2(0.04f, 0f),
                new Vector2(0.96f, 1f));

            InputField input = inputObject.GetComponent<InputField>();
            input.textComponent = text;
            input.placeholder = hint;
            input.contentType = password
                ? InputField.ContentType.Password
                : InputField.ContentType.EmailAddress;
            input.lineType = InputField.LineType.SingleLine;

            RectTransform rect = inputObject.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            return input;
        }

        private static Toggle CreateToggle(
            Transform parent,
            Font font,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject toggleObject = new GameObject(
                "ChildModeToggle",
                typeof(RectTransform),
                typeof(Toggle));
            toggleObject.transform.SetParent(parent, false);
            RectTransform toggleRect = toggleObject.GetComponent<RectTransform>();
            toggleRect.anchorMin = anchorMin;
            toggleRect.anchorMax = anchorMax;
            toggleRect.offsetMin = Vector2.zero;
            toggleRect.offsetMax = Vector2.zero;

            GameObject backgroundObject = new GameObject(
                "Background",
                typeof(RectTransform),
                typeof(Image));
            backgroundObject.transform.SetParent(toggleObject.transform, false);
            RectTransform backgroundRect = backgroundObject.GetComponent<RectTransform>();
            backgroundRect.anchorMin = new Vector2(0f, 0.2f);
            backgroundRect.anchorMax = new Vector2(0f, 0.8f);
            backgroundRect.sizeDelta = new Vector2(34f, 0f);
            backgroundRect.anchoredPosition = new Vector2(17f, 0f);
            Image background = backgroundObject.GetComponent<Image>();
            background.color = new Color(1f, 1f, 1f, 0.18f);

            GameObject checkObject = new GameObject(
                "Checkmark",
                typeof(RectTransform),
                typeof(Image));
            checkObject.transform.SetParent(backgroundObject.transform, false);
            RectTransform checkRect = checkObject.GetComponent<RectTransform>();
            checkRect.anchorMin = new Vector2(0.15f, 0.15f);
            checkRect.anchorMax = new Vector2(0.85f, 0.85f);
            checkRect.offsetMin = Vector2.zero;
            checkRect.offsetMax = Vector2.zero;
            Image check = checkObject.GetComponent<Image>();
            check.color = new Color(0.35f, 0.9f, 0.7f, 1f);

            CreateText(
                toggleObject.transform,
                font,
                "我是孩子，使用孩子帳號登入",
                19,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.1f, 0f),
                new Vector2(1f, 1f));

            Toggle toggle = toggleObject.GetComponent<Toggle>();
            toggle.targetGraphic = background;
            toggle.graphic = check;
            toggle.isOn = false;
            return toggle;
        }

        private static Button CreateButton(
            Transform parent,
            Font font,
            string label,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject buttonObject = new GameObject(
                label,
                typeof(RectTransform),
                typeof(Image),
                typeof(Button));
            buttonObject.transform.SetParent(parent, false);
            Image image = buttonObject.GetComponent<Image>();
            image.color = new Color(0.16f, 0.29f, 0.38f, 1f);
            Button button = buttonObject.GetComponent<Button>();
            ColorBlock colors = button.colors;
            colors.normalColor = image.color;
            colors.highlightedColor = new Color(0.24f, 0.42f, 0.5f, 1f);
            colors.pressedColor = AccentColor;
            colors.disabledColor = new Color(0.2f, 0.24f, 0.28f, 1f);
            button.colors = colors;
            CreateText(
                buttonObject.transform,
                font,
                label,
                21,
                TextAnchor.MiddleCenter,
                Color.white,
                Vector2.zero,
                Vector2.one);

            RectTransform rect = buttonObject.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            return button;
        }
    }
}
