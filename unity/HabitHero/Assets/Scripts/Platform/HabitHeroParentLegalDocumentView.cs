using System;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentLegalDocumentView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private Action onClosed;

        public HabitHeroParentLegalDocumentView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null)
            {
                throw new ArgumentNullException("canvasTransform");
            }
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(string document, Action onClosed)
        {
            Dispose();
            this.onClosed = onClosed;
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.94f),
                "ParentLegalDocumentPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentLegalDocumentCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.06f, 0.04f);
            cardRect.anchorMax = new Vector2(0.94f, 0.96f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            string title;
            string subtitle;
            string[] sections;
            BuildDocument(document, out title, out subtitle, out sections);
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                title,
                31,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.9f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                subtitle,
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.9f));

            GameObject viewport = new GameObject(
                "ParentLegalDocumentViewport",
                typeof(RectTransform),
                typeof(Image),
                typeof(RectMask2D),
                typeof(ScrollRect));
            viewport.transform.SetParent(card.transform, false);
            RectTransform viewportRect = viewport.GetComponent<RectTransform>();
            viewportRect.anchorMin = new Vector2(0.08f, 0.16f);
            viewportRect.anchorMax = new Vector2(0.92f, 0.83f);
            viewportRect.offsetMin = Vector2.zero;
            viewportRect.offsetMax = Vector2.zero;
            Image viewportImage = viewport.GetComponent<Image>();
            viewportImage.color = new Color(0.015f, 0.025f, 0.045f, 0.45f);

            GameObject content = new GameObject(
                "ParentLegalDocumentContent",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup),
                typeof(ContentSizeFitter));
            content.transform.SetParent(viewport.transform, false);
            RectTransform contentRect = content.GetComponent<RectTransform>();
            contentRect.anchorMin = new Vector2(0f, 1f);
            contentRect.anchorMax = new Vector2(1f, 1f);
            contentRect.pivot = new Vector2(0.5f, 1f);
            contentRect.offsetMin = new Vector2(18f, 0f);
            contentRect.offsetMax = new Vector2(-18f, 0f);
            VerticalLayoutGroup layout = content.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 12f;
            layout.padding = new RectOffset(10, 10, 14, 18);
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            ContentSizeFitter fitter = content.GetComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            for (int index = 0; index + 1 < sections.Length; index += 2)
            {
                AddTextBlock(
                    content.transform,
                    sections[index],
                    19,
                    32f,
                    HabitHeroUiFactory.AccentColor,
                    TextAnchor.MiddleLeft);
                AddTextBlock(
                    content.transform,
                    sections[index + 1],
                    16,
                    86f,
                    new Color(0.9f, 0.93f, 0.98f, 1f),
                    TextAnchor.UpperLeft);
            }

            ScrollRect scrollRect = viewport.GetComponent<ScrollRect>();
            scrollRect.content = contentRect;
            scrollRect.viewport = viewportRect;
            scrollRect.horizontal = false;
            scrollRect.vertical = true;
            scrollRect.movementType = ScrollRect.MovementType.Clamped;
            scrollRect.verticalNormalizedPosition = 1f;

            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "返回設定",
                new Vector2(0.32f, 0.06f),
                new Vector2(0.68f, 0.13f));
            closeButton.onClick.AddListener(Close);
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            onClosed = null;
        }

        private Text AddTextBlock(
            Transform parent,
            string content,
            int fontSize,
            float preferredHeight,
            Color color,
            TextAnchor alignment)
        {
            Text text = HabitHeroUiFactory.CreateText(
                parent,
                font,
                content,
                fontSize,
                alignment,
                color,
                Vector2.zero,
                Vector2.one);
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            LayoutElement layoutElement = text.gameObject.AddComponent<LayoutElement>();
            layoutElement.minHeight = preferredHeight;
            layoutElement.preferredHeight = preferredHeight;
            return text;
        }

        private static void BuildDocument(
            string document,
            out string title,
            out string subtitle,
            out string[] sections)
        {
            switch (document)
            {
                case "support":
                    title = "支援中心";
                    subtitle = "登入、同步、點數與資料刪除的快速說明";
                    sections = new[]
                    {
                        "登入或刷新失敗",
                        "請確認網路連線，重新整理後再試；孩子帳號請由家長確認登入名稱與密碼仍有效。",
                        "孩子看不到自己的任務",
                        "請確認孩子使用正確帳號，並由家長重新整理管理端。孩子只能看到所屬家庭與自己的資料。",
                        "點數或獎勵狀態不一致",
                        "請先不要重複點擊，確認網路恢復後使用重試流程；所有點數交易以 Supabase 伺服器確認結果為準。",
                        "資料刪除與隱私請求",
                        "請使用家庭設定中的刪除帳號流程。若無法登入，請寄信至 "
                            + HabitHeroLegalVersions.SupportEmail
                            + "，不要寄送密碼或孩子的完整個人資料。",
                        "支援信箱",
                        HabitHeroLegalVersions.SupportEmail,
                    };
                    return;
                case "consent":
                    title = "兒童與家長同意";
                    subtitle = "版本 " + HabitHeroLegalVersions.ParentConsent;
                    sections = new[]
                    {
                        "家長確認事項",
                        "我是孩子的家長或合法監護人，已了解任務、心得、心情與帳號資料的用途，並會以適合孩子年齡的方式說明資料紀錄與安全規則。",
                        "家長控制",
                        "家長可以管理孩子登入、重設密碼、建立與核准任務、核准點數、刪除孩子帳號，並在任何時候刪除家庭資料。",
                        "使用範圍",
                        "孩子不能自行核准任務、增加點數或開啟家長功能；家庭資料只提供同步、登入、安全與支援所需的功能使用。",
                        "同意紀錄",
                        "請返回設定並按下「閱讀並記錄同意」，系統會以家長登入身分保存本版本同意紀錄。",
                    };
                    return;
                default:
                    title = "隱私政策";
                    subtitle = "版本 " + HabitHeroLegalVersions.PrivacyPolicy;
                    sections = new[]
                    {
                        "我們收集哪些資料",
                        "習慣冒險島會收集家長 Email、家庭成員設定、孩子顯示名稱、任務與獎勵紀錄，以及孩子主動提交的心得、心情與難度評分。若開啟通知，也會保存裝置 Push Token 與通知偏好。",
                        "資料如何使用",
                        "資料用於同步家庭資料、執行家長核准與點數交易、維持帳號安全、處理刪除請求，以及改善服務穩定性。我們不以兒童資料投放個人化廣告。",
                        "兒童資料與家長責任",
                        "兒童帳號由家長建立與管理。家長應確認自己有權代表家庭與孩子提供資料，並在孩子使用前說明任務與資料紀錄的用途。",
                        "保存、分享與刪除",
                        "資料會保存至家長要求刪除帳號，或服務不再需要該資料為止；法律要求保存的資料除外。我們不販售個人資料，家長可在設定中刪除家庭資料。",
                        "聯絡我們",
                        "若要查詢、更正、匯出或刪除資料，請透過支援中心聯絡："
                            + HabitHeroLegalVersions.SupportEmail,
                    };
                    return;
            }
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
        }
    }
}
