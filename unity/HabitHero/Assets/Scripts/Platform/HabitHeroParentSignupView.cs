using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentSignupView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private InputField emailInput;
        private InputField passwordInput;
        private InputField confirmationInput;
        private Toggle consentToggle;
        private Button submitButton;
        private Text statusText;
        private bool isBusy;
        private HabitHeroParentLegalDocumentView legalDocumentView;
        private Func<string, string, Task<SupabaseSession>> submit;
        private Action<SupabaseSession> onCompleted;
        private Action onClosed;

        public HabitHeroParentSignupView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null)
            {
                throw new ArgumentNullException("canvasTransform");
            }
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            Func<string, string, Task<SupabaseSession>> submit,
            Action<SupabaseSession> onCompleted,
            Action onClosed)
        {
            if (submit == null) throw new ArgumentNullException("submit");

            Dispose();
            this.submit = submit;
            this.onCompleted = onCompleted;
            this.onClosed = onClosed;
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                HabitHeroUiFactory.PanelColor,
                "ParentSignupPanel");
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(680f, 780f);
            panelRect.anchoredPosition = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "建立家長帳號",
                42,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.95f));
            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "先建立家長帳號，再替孩子安排每天的任務與獎勵。",
                17,
                TextAnchor.MiddleCenter,
                new Color(0.74f, 0.81f, 0.9f, 1f),
                new Vector2(0.08f, 0.77f),
                new Vector2(0.92f, 0.84f));

            AddLabel("Email", new Vector2(0.1f, 0.68f), new Vector2(0.9f, 0.73f));
            emailInput = HabitHeroUiFactory.CreateInput(
                panel.transform,
                font,
                "家長 Email",
                false,
                new Vector2(0.1f, 0.59f),
                new Vector2(0.9f, 0.68f));
            emailInput.contentType = InputField.ContentType.EmailAddress;
            emailInput.lineType = InputField.LineType.SingleLine;

            AddLabel(
                "通關密語",
                new Vector2(0.1f, 0.51f),
                new Vector2(0.9f, 0.56f));
            passwordInput = HabitHeroUiFactory.CreateInput(
                panel.transform,
                font,
                "至少 8 碼，含大小寫英文",
                true,
                new Vector2(0.1f, 0.42f),
                new Vector2(0.9f, 0.51f));
            passwordInput.contentType = InputField.ContentType.Password;
            passwordInput.lineType = InputField.LineType.SingleLine;

            AddLabel(
                "再次輸入通關密語",
                new Vector2(0.1f, 0.34f),
                new Vector2(0.9f, 0.39f));
            confirmationInput = HabitHeroUiFactory.CreateInput(
                panel.transform,
                font,
                "再次輸入相同密碼",
                true,
                new Vector2(0.1f, 0.25f),
                new Vector2(0.9f, 0.34f));
            confirmationInput.contentType = InputField.ContentType.Password;
            confirmationInput.lineType = InputField.LineType.SingleLine;

            consentToggle = HabitHeroUiFactory.CreateToggle(
                panel.transform,
                font,
                new Vector2(0.1f, 0.14f),
                new Vector2(0.9f, 0.23f));
            consentToggle.name = "ParentSignupConsentToggle";
            Text consentLabel = consentToggle.GetComponentInChildren<Text>(true);
            if (consentLabel != null)
            {
                consentLabel.text = "我是孩子的家長或合法監護人，已閱讀並同意家長說明";
            }

            Button consentButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "閱讀同意說明",
                new Vector2(0.08f, 0.05f),
                new Vector2(0.31f, 0.12f));
            consentButton.onClick.AddListener(OpenConsentDocument);
            submitButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "建立帳號",
                new Vector2(0.35f, 0.05f),
                new Vector2(0.65f, 0.12f));
            submitButton.onClick.AddListener(HandleSubmitClicked);
            Button backButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "返回登入",
                new Vector2(0.69f, 0.05f),
                new Vector2(0.92f, 0.12f));
            backButton.onClick.AddListener(Close);
            statusText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "建立帳號前請先閱讀並同意家長說明。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.005f),
                new Vector2(0.92f, 0.045f));
        }

        public void Dispose()
        {
            if (legalDocumentView != null)
            {
                legalDocumentView.Dispose();
                legalDocumentView = null;
            }

            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            emailInput = null;
            passwordInput = null;
            confirmationInput = null;
            consentToggle = null;
            submitButton = null;
            statusText = null;
            submit = null;
            onCompleted = null;
            onClosed = null;
            isBusy = false;
        }

        private void AddLabel(string content, Vector2 anchorMin, Vector2 anchorMax)
        {
            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                content,
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                anchorMin,
                anchorMax);
        }

        private void OpenConsentDocument()
        {
            if (panel == null) return;
            panel.SetActive(false);
            if (legalDocumentView == null)
            {
                legalDocumentView = new HabitHeroParentLegalDocumentView(
                    canvasTransform,
                    font);
            }

            legalDocumentView.Show(
                "consent",
                () =>
                {
                    if (panel != null) panel.SetActive(true);
                });
        }

        private async void HandleSubmitClicked()
        {
            if (isBusy || submit == null) return;
            string email = emailInput == null ? string.Empty : emailInput.text.Trim();
            string password = passwordInput == null ? string.Empty : passwordInput.text;
            string confirmation = confirmationInput == null
                ? string.Empty
                : confirmationInput.text;
            string error;
            if (!HabitHeroAuthValidation.TryValidateParentRegistration(
                    email,
                    password,
                    out error))
            {
                SetStatus(error, true);
                return;
            }

            if (!HabitHeroAuthValidation.TryValidatePasswordConfirmation(
                    password,
                    confirmation,
                    out error))
            {
                SetStatus(error, true);
                return;
            }

            if (consentToggle == null || !consentToggle.isOn)
            {
                SetStatus("請先閱讀並同意家長說明。", true);
                return;
            }

            isBusy = true;
            if (submitButton != null) submitButton.interactable = false;
            SetStatus("正在建立家長帳號…", false);
            try
            {
                SupabaseSession session = await submit(email, password);
                if (session == null)
                {
                    SetStatus(
                        "帳號已建立，請完成 Email 驗證後回到登入畫面。",
                        false);
                    return;
                }

                Action<SupabaseSession> completed = onCompleted;
                Dispose();
                if (completed != null) completed(session);
            }
            catch (OperationCanceledException)
            {
                // Scene shutdown cancels the request.
            }
            catch (Exception exception)
            {
                SetStatus("建立帳號失敗：" + exception.Message, true);
            }
            finally
            {
                isBusy = false;
                if (submitButton != null) submitButton.interactable = true;
            }
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }
    }
}
