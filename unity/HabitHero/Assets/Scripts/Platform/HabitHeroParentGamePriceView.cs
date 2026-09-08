using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentGamePriceView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject itemList;
        private Text statusText;
        private SupabaseChildGameData latestData;
        private Func<string, int, Task<SupabaseChildGameData>> setPrice;
        private Func<string, Task<SupabaseChildGameData>> resetPrice;
        private Action onClose;

        public HabitHeroParentGamePriceView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildGameData data,
            Func<string, int, Task<SupabaseChildGameData>> setPrice,
            Func<string, Task<SupabaseChildGameData>> resetPrice,
            Action onClose)
        {
            if (data == null) throw new ArgumentNullException("data");
            if (setPrice == null) throw new ArgumentNullException("setPrice");
            if (resetPrice == null) throw new ArgumentNullException("resetPrice");

            Dispose();
            latestData = data;
            this.setPrice = setPrice;
            this.resetPrice = resetPrice;
            this.onClose = onClose;
            BuildPanel();
        }

        public void Dispose()
        {
            latestData = null;
            setPrice = null;
            resetPrice = null;
            onClose = null;
            itemList = null;
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
                "ParentGamePricePanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentGamePriceCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.05f, 0.04f);
            cardRect.anchorMax = new Vector2(0.95f, 0.96f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "家庭商店價格",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.91f),
                new Vector2(0.92f, 0.98f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "調整後會套用到這個家庭的所有孩子；還原即可回到系統預設價格。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.86f),
                new Vector2(0.92f, 0.91f));
            itemList = new GameObject(
                "ParentGamePriceList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            itemList.transform.SetParent(card.transform, false);
            RectTransform listRect = itemList.GetComponent<RectTransform>();
            listRect.anchorMin = new Vector2(0.08f, 0.18f);
            listRect.anchorMax = new Vector2(0.92f, 0.84f);
            listRect.offsetMin = Vector2.zero;
            listRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = itemList.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 7f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            RenderItems();

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "價格由 Supabase 家庭設定保存。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.1f),
                new Vector2(0.92f, 0.17f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.02f),
                new Vector2(0.65f, 0.09f));
            closeButton.onClick.AddListener(Close);
        }

        private void RenderItems()
        {
            if (itemList == null) return;
            foreach (Transform child in itemList.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleCount = 0;
            foreach (SupabaseGameCatalogItemRecord item in
                latestData.catalog ?? new SupabaseGameCatalogItemRecord[0])
            {
                if (item == null || !item.is_active || item.is_starter || !item.is_newly_obtainable)
                {
                    continue;
                }

                GameObject row = new GameObject(
                    "GamePriceRow",
                    typeof(RectTransform),
                    typeof(HorizontalLayoutGroup));
                row.transform.SetParent(itemList.transform, false);
                row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 46f);
                HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
                layout.spacing = 6f;
                layout.childControlWidth = true;
                layout.childControlHeight = true;
                layout.childForceExpandWidth = false;
                layout.childForceExpandHeight = true;

                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    item.name + "（" + GetTypeLabel(item.item_type) + "）",
                    15,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                LayoutElement labelLayout = label.gameObject.AddComponent<LayoutElement>();
                labelLayout.flexibleWidth = 1f;
                InputField priceInput = CreatePriceInput(row.transform, GetPrice(item));
                Button saveButton = CreateRowButton(row.transform, "儲存", 82f);
                saveButton.onClick.AddListener(() => SavePriceAsync(
                    item.id,
                    priceInput,
                    saveButton));
                if (HasCustomPrice(item.id))
                {
                    Button resetButton = CreateRowButton(row.transform, "還原", 82f);
                    resetButton.onClick.AddListener(() => ResetPriceAsync(
                        item.id,
                        resetButton));
                }
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    itemList.transform,
                    font,
                    "目前沒有可調整的商店商品。",
                    18,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private async void SavePriceAsync(
            string catalogItemId,
            InputField input,
            Button button)
        {
            int price;
            if (!int.TryParse(
                    input == null ? string.Empty : input.text.Trim(),
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out price)
                || price < 1)
            {
                SetStatus("價格必須是大於零的整數。", true);
                return;
            }

            if (button != null) button.interactable = false;
            SetStatus("正在儲存商品價格…", false);
            try
            {
                SupabaseChildGameData refreshed = await setPrice(catalogItemId, price);
                ApplyData(refreshed);
                SetStatus("商品價格已更新。", false);
            }
            catch (Exception exception)
            {
                SetStatus("價格儲存失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void ResetPriceAsync(string catalogItemId, Button button)
        {
            if (button != null) button.interactable = false;
            SetStatus("正在還原商品價格…", false);
            try
            {
                SupabaseChildGameData refreshed = await resetPrice(catalogItemId);
                ApplyData(refreshed);
                SetStatus("商品價格已還原。", false);
            }
            catch (Exception exception)
            {
                SetStatus("價格還原失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private void ApplyData(SupabaseChildGameData data)
        {
            if (data == null) throw new SupabaseDataException("伺服器沒有回傳最新商店資料。");
            latestData = data;
            RenderItems();
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
            Action callback = onClose;
            if (callback != null) callback();
            else Dispose();
        }

        private InputField CreatePriceInput(Transform parent, int price)
        {
            InputField input = HabitHeroUiFactory.CreateInput(
                parent,
                font,
                "價格",
                false,
                Vector2.zero,
                Vector2.one);
            input.contentType = InputField.ContentType.IntegerNumber;
            input.lineType = InputField.LineType.SingleLine;
            input.text = price.ToString(CultureInfo.InvariantCulture);
            LayoutElement layout = input.gameObject.AddComponent<LayoutElement>();
            layout.preferredWidth = 120f;
            layout.minWidth = 100f;
            return input;
        }

        private Button CreateRowButton(Transform parent, string label, float width)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                Vector2.zero,
                Vector2.one);
            LayoutElement layout = button.gameObject.AddComponent<LayoutElement>();
            layout.preferredWidth = width;
            layout.minWidth = width;
            return button;
        }

        private int GetPrice(SupabaseGameCatalogItemRecord item)
        {
            foreach (SupabaseGamePriceRecord price in
                latestData.prices ?? new SupabaseGamePriceRecord[0])
            {
                if (price != null && price.catalog_item_id == item.id)
                {
                    return price.scroll_price;
                }
            }
            return item.scroll_price;
        }

        private bool HasCustomPrice(string catalogItemId)
        {
            foreach (SupabaseGamePriceRecord price in
                latestData.prices ?? new SupabaseGamePriceRecord[0])
            {
                if (price != null && price.catalog_item_id == catalogItemId) return true;
            }
            return false;
        }

        private static string GetTypeLabel(string itemType)
        {
            switch (itemType)
            {
                case "character": return "角色";
                case "pet": return "寵物";
                case "decoration": return "裝飾";
                default: return "商品";
            }
        }
    }
}
