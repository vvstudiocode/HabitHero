using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildWorldView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject worldPanel;
        private Text worldStatus;
        private SupabaseChildWorldData latestData;
        private Func<string, Task<SupabaseChildWorldData>> unlockScene;
        private Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue;
        private Action<string> enterScene;

        public HabitHeroChildWorldView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildWorldData data,
            Func<string, Task<SupabaseChildWorldData>> unlockScene,
            Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue,
            Action<string> enterScene)
        {
            Close();
            latestData = data;
            this.unlockScene = unlockScene;
            this.completeNpcDialogue = completeNpcDialogue;
            this.enterScene = enterScene;
        }

        public void ApplyData(SupabaseChildWorldData data)
        {
            latestData = data;
            if (worldPanel == null) return;
            Close();
            Open();
        }

        public void Open()
        {
            if (latestData == null) return;

            Close();
            worldPanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ChildWorldPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                worldPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildWorldCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.05f, 0.06f);
            cardRect.anchorMax = new Vector2(0.95f, 0.94f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "世界與 NPC",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.9f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "解鎖場景、和 NPC 對話後，才能取得對應的冒險商品。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.9f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "場景",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.77f),
                new Vector2(0.92f, 0.83f));
            GameObject sceneList = CreateList(
                card.transform,
                "SceneList",
                new Vector2(0.08f, 0.56f),
                new Vector2(0.92f, 0.77f));
            RenderScenes(sceneList.transform);

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "NPC 與對話",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.49f),
                new Vector2(0.92f, 0.55f));
            GameObject npcList = CreateList(
                card.transform,
                "NpcList",
                new Vector2(0.08f, 0.13f),
                new Vector2(0.92f, 0.49f));
            RenderNpcs(npcList.transform);

            worldStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "世界資料已從 Supabase 載入。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.075f),
                new Vector2(0.92f, 0.13f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.01f),
                new Vector2(0.65f, 0.065f));
            closeButton.onClick.AddListener(Close);
        }

        public void Dispose()
        {
            Close();
            latestData = null;
            unlockScene = null;
            completeNpcDialogue = null;
            enterScene = null;
        }

        private void RenderScenes(Transform parent)
        {
            int visibleCount = 0;
            foreach (SupabaseGameWorldSceneRecord scene in
                latestData.scenes ?? new SupabaseGameWorldSceneRecord[0])
            {
                if (scene == null) continue;
                bool isUnlocked = latestData.IsSceneUnlocked(scene.id);
                GameObject row = CreateRow(parent, "SceneRow");
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    scene.name + "　" + (isUnlocked ? "已解鎖" : "尚未解鎖"),
                    15,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                AddFlexibleLayout(label.gameObject);
                Button actionButton = CreateRowButton(
                    row.transform,
                    isUnlocked ? "進入" : "解鎖");
                actionButton.interactable = isUnlocked
                    ? enterScene != null
                    : unlockScene != null;
                if (isUnlocked && enterScene != null)
                {
                    actionButton.onClick.AddListener(() => enterScene(scene.id));
                }
                else if (!isUnlocked && unlockScene != null)
                {
                    actionButton.onClick.AddListener(() => UnlockSceneAsync(
                        scene.id,
                        actionButton));
                }

                visibleCount += 1;
                if (visibleCount >= 5) break;
            }

            if (visibleCount == 0)
            {
                CreateEmptyRow(parent, "目前沒有可用場景資料。");
            }
        }

        private void RenderNpcs(Transform parent)
        {
            int visibleCount = 0;
            foreach (SupabaseGameWorldNpcRecord npc in
                latestData.npcs ?? new SupabaseGameWorldNpcRecord[0])
            {
                if (npc == null || !npc.is_active) continue;
                bool sceneUnlocked = latestData.IsSceneUnlocked(npc.scene_id);
                bool talked = latestData.HasDialogue(npc.id, 1);
                string status = !sceneUnlocked
                    ? "場景鎖定"
                    : talked ? "已對話" : "可對話";
                string offeringText = GetOfferingCount(npc.id) == 0
                    ? string.Empty
                    : "　商品 " + GetOfferingCount(npc.id) + " 件";
                GameObject row = CreateRow(parent, "NpcRow");
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    npc.name + "　" + GetSceneName(npc.scene_id) + offeringText + "　" + status,
                    14,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                AddFlexibleLayout(label.gameObject);
                Button actionButton = CreateRowButton(
                    row.transform,
                    sceneUnlocked ? "對話" : "先解鎖");
                actionButton.interactable = sceneUnlocked && completeNpcDialogue != null;
                if (sceneUnlocked && completeNpcDialogue != null)
                {
                    actionButton.onClick.AddListener(() => CompleteNpcDialogueAsync(
                        npc.id,
                        actionButton));
                }

                visibleCount += 1;
                if (visibleCount >= 9) break;
            }

            if (visibleCount == 0)
            {
                CreateEmptyRow(parent, "目前沒有可互動的 NPC。");
            }
        }

        private async void UnlockSceneAsync(string sceneId, Button button)
        {
            if (unlockScene == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在確認場景解鎖資格…", false);
            try
            {
                SupabaseChildWorldData refreshed = await unlockScene(sceneId);
                if (refreshed == null) throw new SupabaseDataException("伺服器沒有回傳最新世界資料。");
                ApplyData(refreshed);
                SetStatus("場景資料已更新。", false);
            }
            catch (Exception exception)
            {
                SetStatus("場景解鎖失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void CompleteNpcDialogueAsync(string npcId, Button button)
        {
            if (completeNpcDialogue == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在和 NPC 對話…", false);
            try
            {
                SupabaseChildWorldData refreshed = await completeNpcDialogue(npcId);
                if (refreshed == null) throw new SupabaseDataException("伺服器沒有回傳最新世界資料。");
                ApplyData(refreshed);
                SetStatus("對話完成，商品來源已更新。", false);
            }
            catch (Exception exception)
            {
                SetStatus("NPC 對話失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private string GetSceneName(string sceneId)
        {
            foreach (SupabaseGameWorldSceneRecord scene in
                latestData.scenes ?? new SupabaseGameWorldSceneRecord[0])
            {
                if (scene != null && scene.id == sceneId) return scene.name;
            }

            return sceneId;
        }

        private int GetOfferingCount(string npcId)
        {
            int count = 0;
            foreach (SupabaseGameWorldNpcOfferingRecord offering in
                latestData.offerings ?? new SupabaseGameWorldNpcOfferingRecord[0])
            {
                if (offering != null && offering.npc_id == npcId && offering.is_active) count += 1;
            }

            return count;
        }

        private GameObject CreateList(
            Transform parent,
            string name,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject list = new GameObject(
                name,
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            list.transform.SetParent(parent, false);
            RectTransform rect = list.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = list.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 4f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }

        private GameObject CreateRow(Transform parent, string name)
        {
            GameObject row = new GameObject(
                name,
                typeof(RectTransform),
                typeof(HorizontalLayoutGroup));
            row.transform.SetParent(parent, false);
            row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 32f);
            HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
            layout.spacing = 5f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = false;
            layout.childForceExpandHeight = true;
            return row;
        }

        private Button CreateRowButton(Transform parent, string label)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                Vector2.zero,
                Vector2.one);
            LayoutElement layout = button.gameObject.AddComponent<LayoutElement>();
            layout.preferredWidth = 82f;
            layout.minWidth = 82f;
            return button;
        }

        private static void AddFlexibleLayout(GameObject target)
        {
            LayoutElement layout = target.AddComponent<LayoutElement>();
            layout.flexibleWidth = 1f;
        }

        private void CreateEmptyRow(Transform parent, string message)
        {
            GameObject row = CreateRow(parent, "EmptyRow");
            Text text = HabitHeroUiFactory.CreateText(
                row.transform,
                font,
                message,
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                Vector2.zero,
                Vector2.one);
            AddFlexibleLayout(text.gameObject);
        }

        private void SetStatus(string message, bool isError)
        {
            if (worldStatus == null) return;
            worldStatus.text = message;
            worldStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void Close()
        {
            if (worldPanel != null)
            {
                UnityEngine.Object.Destroy(worldPanel);
                worldPanel = null;
            }

            worldStatus = null;
        }
    }
}
