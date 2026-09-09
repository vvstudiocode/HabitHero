using System;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildSettingsView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private Text statusText;
        private string childProfileId;
        private Action openNotificationSettings;
        private Action onSwitchToParent;
        private Action onLogout;
        private Action onClosed;

        public HabitHeroChildSettingsView(Transform canvasTransform, Font font)
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
            string childProfileId,
            Action openNotificationSettings,
            Action onSwitchToParent,
            Action onLogout,
            Action onClosed)
        {
            if (string.IsNullOrWhiteSpace(childProfileId))
            {
                throw new ArgumentException(
                    "孩子 Profile ID 不可為空。",
                    "childProfileId");
            }

            Dispose();
            this.childProfileId = childProfileId.Trim();
            this.openNotificationSettings = openNotificationSettings;
            this.onSwitchToParent = onSwitchToParent;
            this.onLogout = onLogout;
            this.onClosed = onClosed;
            BuildPanel();
        }

        public void Dispose()
        {
            childProfileId = null;
            openNotificationSettings = null;
            onSwitchToParent = null;
            onLogout = null;
            onClosed = null;
            statusText = null;
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }
        }

        private void BuildPanel()
        {
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ChildSettingsPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildSettingsCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.12f);
            cardRect.anchorMax = new Vector2(0.92f, 0.88f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "通知與世界設定",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.88f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "這些設定只會套用到目前的孩子帳號。",
                16,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.81f),
                new Vector2(0.92f, 0.88f));

            CreatePreferenceRow(
                card.transform,
                "背景音樂",
                "進入世界時播放場景音樂。",
                HabitHeroWorldBackgroundMusic.GetEnabled(childProfileId),
                (enabled) =>
                {
                    HabitHeroWorldBackgroundMusic.SetEnabled(childProfileId, enabled);
                    SetStatus(enabled ? "背景音樂已開啟。" : "背景音樂已關閉。", false);
                },
                0.68f);
            CreatePreferenceRow(
                card.transform,
                "顯示寵物名字",
                "在世界中顯示寵物上方的名稱。",
                HabitHeroChildDisplayPreferences.GetShowPetNames(childProfileId),
                (enabled) =>
                {
                    HabitHeroChildDisplayPreferences.SetShowPetNames(
                        childProfileId,
                        enabled);
                    SetStatus(enabled ? "寵物名字會顯示。" : "寵物名字已隱藏。", false);
                },
                0.54f);
            CreatePreferenceRow(
                card.transform,
                "日夜效果",
                "依台北時間套用世界的日夜光線。",
                HabitHeroChildDisplayPreferences.GetDayNightEnabled(childProfileId),
                (enabled) =>
                {
                    HabitHeroChildDisplayPreferences.SetDayNightEnabled(
                        childProfileId,
                        enabled);
                    SetStatus(enabled ? "日夜效果已開啟。" : "日夜效果已關閉。", false);
                },
                0.4f);

            Button notificationButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "通知設定",
                new Vector2(0.08f, 0.28f),
                new Vector2(0.44f, 0.36f));
            notificationButton.interactable = openNotificationSettings != null;
            notificationButton.onClick.AddListener(() =>
            {
                if (openNotificationSettings != null) openNotificationSettings();
            });
            Button parentButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "家長模式",
                new Vector2(0.48f, 0.28f),
                new Vector2(0.92f, 0.36f));
            parentButton.interactable = onSwitchToParent != null;
            parentButton.onClick.AddListener(() =>
            {
                if (onSwitchToParent != null) onSwitchToParent();
            });

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "設定會保存在這台裝置。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.2f),
                new Vector2(0.92f, 0.27f));
            Button logoutButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "登出",
                new Vector2(0.08f, 0.1f),
                new Vector2(0.44f, 0.18f));
            logoutButton.interactable = onLogout != null;
            logoutButton.onClick.AddListener(() =>
            {
                if (onLogout != null) onLogout();
            });
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.48f, 0.1f),
                new Vector2(0.92f, 0.18f));
            closeButton.onClick.AddListener(Close);
        }

        private void CreatePreferenceRow(
            Transform parent,
            string title,
            string description,
            bool initialValue,
            Action<bool> onChanged,
            float y)
        {
            HabitHeroUiFactory.CreateText(
                parent,
                font,
                title,
                20,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, y),
                new Vector2(0.62f, y + 0.07f));
            HabitHeroUiFactory.CreateText(
                parent,
                font,
                description,
                13,
                TextAnchor.MiddleLeft,
                new Color(0.68f, 0.75f, 0.84f, 1f),
                new Vector2(0.08f, y - 0.05f),
                new Vector2(0.62f, y));
            Toggle toggle = HabitHeroUiFactory.CreateSwitch(
                parent,
                new Vector2(0.72f, y),
                new Vector2(0.92f, y + 0.07f));
            toggle.isOn = initialValue;
            toggle.onValueChanged.AddListener(value => onChanged(value));
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
            Action callback = onClosed;
            Dispose();
            if (callback != null) callback();
        }
    }
}
