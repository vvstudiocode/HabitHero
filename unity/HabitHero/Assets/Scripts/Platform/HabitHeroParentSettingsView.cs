using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentSettingsView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private Text consentStatusText;
        private Text statusText;
        private Button consentButton;
        private InputField currentPasswordInput;
        private InputField newPasswordInput;
        private Button updatePasswordButton;
        private Toggle musicToggle;
        private Button deleteButton;
        private Text deleteButtonLabel;
        private SupabaseParentHomeSnapshot snapshot;
        private Func<
            string,
            Task<SupabaseParentConsentRecord>> recordParentConsent;
        private Func<string, string, Task> updateParentPassword;
        private Func<Task> deleteParentAccount;
        private Action<bool> setParentMusicEnabled;
        private Action<string> openLegalDocument;
        private Action onClosed;
        private bool deleteConfirmationPending;

        public HabitHeroParentSettingsView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<string, Task<SupabaseParentConsentRecord>> recordParentConsent,
            Func<string, string, Task> updateParentPassword,
            Func<Task> deleteParentAccount,
            bool parentMusicEnabled,
            Action<bool> setParentMusicEnabled,
            Action<string> openLegalDocument,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");

            Dispose();
            this.snapshot = snapshot;
            this.recordParentConsent = recordParentConsent;
            this.updateParentPassword = updateParentPassword;
            this.deleteParentAccount = deleteParentAccount;
            this.setParentMusicEnabled = setParentMusicEnabled;
            this.openLegalDocument = openLegalDocument;
            this.onClosed = onClosed;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentSettingsPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentSettingsCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.07f, 0.08f);
            cardRect.anchorMax = new Vector2(0.93f, 0.92f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "家庭設定與安全",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.9f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "家長可以查看同意版本、資料說明與永久刪除家庭資料。",
                16,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.9f));

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "兒童與家長同意",
                21,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.75f),
                new Vector2(0.92f, 0.81f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "建立孩子資料前，請由家長確認任務、心得、獎勵與刪除權的使用方式。",
                15,
                TextAnchor.UpperLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.64f),
                new Vector2(0.92f, 0.74f));
            consentStatusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                15,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.58f),
                new Vector2(0.58f, 0.64f));
            consentButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "閱讀並記錄同意",
                new Vector2(0.62f, 0.58f),
                new Vector2(0.92f, 0.65f));
            consentButton.onClick.AddListener(HandleConsentClicked);

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "資料與支援",
                21,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.48f),
                new Vector2(0.92f, 0.54f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "文件與支援：隱私 " + HabitHeroLegalVersions.PrivacyPolicy,
                14,
                TextAnchor.MiddleLeft,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.44f),
                new Vector2(0.92f, 0.49f));
            Button privacyButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "隱私政策",
                new Vector2(0.08f, 0.4f),
                new Vector2(0.34f, 0.44f));
            privacyButton.interactable = openLegalDocument != null;
            privacyButton.onClick.AddListener(() => OpenLegalDocument("privacy"));
            Button supportButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "支援中心",
                new Vector2(0.37f, 0.4f),
                new Vector2(0.63f, 0.44f));
            supportButton.interactable = openLegalDocument != null;
            supportButton.onClick.AddListener(() => OpenLegalDocument("support"));
            Button consentDocumentButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "同意說明",
                new Vector2(0.66f, 0.4f),
                new Vector2(0.92f, 0.44f));
            consentDocumentButton.interactable = openLegalDocument != null;
            consentDocumentButton.onClick.AddListener(() => OpenLegalDocument("consent"));

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "修改家長密碼",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.38f),
                new Vector2(0.92f, 0.43f));
            currentPasswordInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "目前密碼",
                true,
                new Vector2(0.08f, 0.33f),
                new Vector2(0.52f, 0.38f));
            currentPasswordInput.contentType = InputField.ContentType.Password;
            currentPasswordInput.lineType = InputField.LineType.SingleLine;
            newPasswordInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "新密碼（至少 8 碼，含大小寫）",
                true,
                new Vector2(0.54f, 0.33f),
                new Vector2(0.92f, 0.38f));
            newPasswordInput.contentType = InputField.ContentType.Password;
            newPasswordInput.lineType = InputField.LineType.SingleLine;
            updatePasswordButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "更新家長密碼",
                new Vector2(0.08f, 0.27f),
                new Vector2(0.48f, 0.32f));
            updatePasswordButton.interactable = updateParentPassword != null;
            updatePasswordButton.onClick.AddListener(HandleUpdatePasswordClicked);

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "家長背景音樂",
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.54f, 0.27f),
                new Vector2(0.78f, 0.32f));
            musicToggle = HabitHeroUiFactory.CreateSwitch(
                card.transform,
                new Vector2(0.79f, 0.27f),
                new Vector2(0.92f, 0.32f));
            musicToggle.isOn = parentMusicEnabled;
            musicToggle.onValueChanged.AddListener(HandleMusicChanged);

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.21f),
                new Vector2(0.92f, 0.26f));
            deleteButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "永久刪除家長帳號",
                new Vector2(0.08f, 0.13f),
                new Vector2(0.92f, 0.2f));
            deleteButtonLabel = deleteButton.GetComponentInChildren<Text>();
            deleteButton.onClick.AddListener(HandleDeleteClicked);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.32f, 0.04f),
                new Vector2(0.68f, 0.11f));
            closeButton.onClick.AddListener(Close);

            RenderConsentState();
            SetStatus("請確認目前家長同意版本。", false);
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            recordParentConsent = null;
            updateParentPassword = null;
            deleteParentAccount = null;
            setParentMusicEnabled = null;
            openLegalDocument = null;
            onClosed = null;
            consentStatusText = null;
            statusText = null;
            consentButton = null;
            currentPasswordInput = null;
            newPasswordInput = null;
            updatePasswordButton = null;
            musicToggle = null;
            deleteButton = null;
            deleteButtonLabel = null;
            deleteConfirmationPending = false;
        }

        private async void HandleConsentClicked()
        {
            if (recordParentConsent == null || consentButton == null) return;
            consentButton.interactable = false;
            SetStatus("正在儲存家長同意…", false);
            try
            {
                SupabaseParentConsentRecord consent = await recordParentConsent(
                    HabitHeroLegalVersions.ParentConsent);
                if (consent == null
                    || string.IsNullOrWhiteSpace(consent.consent_version))
                {
                    throw new SupabaseDataException("家長同意回應無效。");
                }

                snapshot.parentConsent = consent;
                RenderConsentState();
                SetStatus("家長同意已記錄，現在可以管理孩子資料。", false);
            }
            catch (Exception exception)
            {
                SetStatus("記錄家長同意失敗：" + exception.Message, true);
                consentButton.interactable = true;
            }
        }

        private async void HandleUpdatePasswordClicked()
        {
            if (updateParentPassword == null || updatePasswordButton == null)
            {
                return;
            }

            string currentPassword = currentPasswordInput == null
                ? string.Empty
                : currentPasswordInput.text;
            string newPassword = newPasswordInput == null
                ? string.Empty
                : newPasswordInput.text;
            if (string.IsNullOrWhiteSpace(currentPassword))
            {
                SetStatus("請輸入目前的家長密碼。", true);
                return;
            }
            if (!IsValidParentPassword(newPassword))
            {
                SetStatus("新密碼至少 8 碼，並且要包含大小寫英文字母。", true);
                return;
            }

            updatePasswordButton.interactable = false;
            SetStatus("正在更新家長密碼…", false);
            try
            {
                await updateParentPassword(currentPassword, newPassword);
                if (currentPasswordInput != null) currentPasswordInput.text = string.Empty;
                if (newPasswordInput != null) newPasswordInput.text = string.Empty;
                SetStatus("家長密碼已更新。", false);
            }
            catch (Exception exception)
            {
                SetStatus("家長密碼更新失敗：" + exception.Message, true);
            }
            finally
            {
                if (updatePasswordButton != null)
                {
                    updatePasswordButton.interactable = true;
                }
            }
        }

        private void HandleMusicChanged(bool enabled)
        {
            if (setParentMusicEnabled == null) return;
            setParentMusicEnabled(enabled);
            SetStatus(
                enabled ? "家長背景音樂已開啟。" : "家長背景音樂已關閉。",
                false);
        }

        private void OpenLegalDocument(string document)
        {
            if (openLegalDocument != null)
            {
                openLegalDocument(document);
            }
        }

        private async void HandleDeleteClicked()
        {
            if (deleteParentAccount == null || deleteButton == null) return;
            if (!deleteConfirmationPending)
            {
                deleteConfirmationPending = true;
                if (deleteButtonLabel != null)
                {
                    deleteButtonLabel.text = "再次確認永久刪除";
                }
                SetStatus(
                    "再次點擊才會永久刪除帳號與整個家庭資料。",
                    true);
                return;
            }

            deleteButton.interactable = false;
            if (consentButton != null) consentButton.interactable = false;
            SetStatus("正在刪除家庭資料，請不要關閉程式…", false);
            try
            {
                await deleteParentAccount();
                SetStatus("帳號已刪除，正在登出…", false);
            }
            catch (Exception exception)
            {
                SetStatus("刪除帳號失敗：" + exception.Message, true);
                deleteButton.interactable = true;
            }
        }

        private void RenderConsentState()
        {
            bool recorded = snapshot != null
                && snapshot.parentConsent != null
                && snapshot.parentConsent.consent_version
                    == HabitHeroLegalVersions.ParentConsent;
            if (consentStatusText != null)
            {
                consentStatusText.text = recorded
                    ? "目前版本已完成：" + HabitHeroLegalVersions.ParentConsent
                    : "尚未完成目前版本：" + HabitHeroLegalVersions.ParentConsent;
            }
            if (consentButton != null)
            {
                consentButton.interactable = !recorded;
                Text label = consentButton.GetComponentInChildren<Text>();
                if (label != null) label.text = recorded ? "已完成確認" : "閱讀並記錄同意";
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

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
        }

        private static bool IsValidParentPassword(string password)
        {
            if (string.IsNullOrEmpty(password) || password.Length < 8)
            {
                return false;
            }

            bool hasUppercase = false;
            bool hasLowercase = false;
            foreach (char character in password)
            {
                hasUppercase |= char.IsUpper(character);
                hasLowercase |= char.IsLower(character);
            }

            return hasUppercase && hasLowercase;
        }
    }
}
