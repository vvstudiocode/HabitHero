using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace HabitHero.App
{
    public static class HabitHeroUiFactory
    {
        public static readonly Color BackgroundColor = new Color(0.035f, 0.055f, 0.09f, 1f);
        public static readonly Color PanelColor = new Color(0.08f, 0.12f, 0.19f, 0.97f);
        public static readonly Color AccentColor = new Color(0.35f, 0.78f, 0.67f, 1f);

        public static Canvas CreateCanvas()
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

            if (Object.FindAnyObjectByType<EventSystem>() == null)
            {
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            }

            return canvas;
        }

        public static GameObject CreatePanel(
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

        public static Text CreateText(
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

        public static InputField CreateInput(
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

        public static Toggle CreateToggle(
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

        public static Button CreateButton(
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
