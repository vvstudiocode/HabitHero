using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildWorldSceneView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject scenePanel;
        private GameObject worldRoot;
        private Camera worldCamera;
        private RenderTexture renderTexture;
        private GameObject player;
        private Text sceneStatus;
        private SupabaseChildWorldData latestData;
        private string sceneId;
        private Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue;
        private Action onClose;
        private readonly List<Material> runtimeMaterials = new List<Material>();

        public HabitHeroChildWorldSceneView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildWorldData data,
            string sceneId,
            Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue,
            Action onClose)
        {
            CloseInternal(false);
            latestData = data;
            this.sceneId = sceneId;
            this.completeNpcDialogue = completeNpcDialogue;
            this.onClose = onClose;
        }

        public void ApplyData(SupabaseChildWorldData data)
        {
            latestData = data;
            if (scenePanel == null) return;
            CloseInternal(false);
            Open();
        }

        public void Open()
        {
            SupabaseGameWorldSceneRecord scene = FindScene(sceneId);
            if (latestData == null || scene == null) return;

            CloseInternal(false);
            CreateWorld(scene);
            CreateOverlay(scene);
        }

        public void Dispose()
        {
            CloseInternal(false);
            latestData = null;
            sceneId = null;
            completeNpcDialogue = null;
            onClose = null;
        }

        private void CreateWorld(SupabaseGameWorldSceneRecord scene)
        {
            worldRoot = new GameObject("ChildWorldRuntime");
            GameObject cameraObject = new GameObject("ChildWorldCamera");
            cameraObject.transform.SetParent(worldRoot.transform, false);
            worldCamera = cameraObject.AddComponent<Camera>();
            worldCamera.clearFlags = CameraClearFlags.SolidColor;
            worldCamera.backgroundColor = GetSceneColor(scene.id);
            worldCamera.orthographic = true;
            worldCamera.orthographicSize = 9f;
            worldCamera.transform.position = new Vector3(0f, 12f, -14f);
            worldCamera.transform.LookAt(new Vector3(0f, 0f, 0f));

            CreatePrimitive(
                PrimitiveType.Plane,
                "WorldGround",
                new Vector3(0f, 0f, 0f),
                new Vector3(2f, 1f, 2f),
                GetGroundColor(scene.id));
            CreatePrimitive(
                PrimitiveType.Cube,
                "WorldNorthBoundary",
                new Vector3(0f, 0.35f, 9.5f),
                new Vector3(20f, 0.7f, 0.35f),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "WorldSouthBoundary",
                new Vector3(0f, 0.35f, -9.5f),
                new Vector3(20f, 0.7f, 0.35f),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "WorldEastBoundary",
                new Vector3(9.5f, 0.35f, 0f),
                new Vector3(0.35f, 0.7f, 20f),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "WorldWestBoundary",
                new Vector3(-9.5f, 0.35f, 0f),
                new Vector3(0.35f, 0.7f, 20f),
                new Color(0.08f, 0.14f, 0.2f, 1f));

            player = CreatePrimitive(
                PrimitiveType.Capsule,
                "ChildAvatarPlaceholder",
                new Vector3(0f, 1f, -4f),
                new Vector3(0.75f, 1f, 0.75f),
                HabitHeroUiFactory.AccentColor);
            RenderNpcPlaceholders();

            renderTexture = new RenderTexture(720, 960, 24, RenderTextureFormat.ARGB32);
            renderTexture.name = "HabitHeroWorldRenderTexture";
            renderTexture.Create();
            worldCamera.targetTexture = renderTexture;
        }

        private void RenderNpcPlaceholders()
        {
            foreach (SupabaseGameWorldNpcRecord npc in
                latestData.npcs ?? new SupabaseGameWorldNpcRecord[0])
            {
                if (npc == null || !npc.is_active || npc.scene_id != sceneId) continue;
                PrimitiveType primitive = npc.npc_type == "roaming_pet"
                    ? PrimitiveType.Sphere
                    : PrimitiveType.Capsule;
                float height = npc.npc_type == "roaming_pet" ? 0.75f : 1f;
                Vector3 position = new Vector3(
                    npc.position_x,
                    height,
                    npc.position_z);
                Vector3 scale = npc.npc_type == "roaming_pet"
                    ? new Vector3(0.9f, 0.75f, 0.9f)
                    : new Vector3(0.8f, 1f, 0.8f);
                Color color = npc.npc_type == "roaming_pet"
                    ? new Color(0.95f, 0.68f, 0.38f, 1f)
                    : new Color(0.52f, 0.68f, 0.95f, 1f);
                CreatePrimitive(primitive, "Npc_" + npc.id, position, scale, color);
            }
        }

        private void CreateOverlay(SupabaseGameWorldSceneRecord scene)
        {
            scenePanel = new GameObject(
                "ChildWorldScenePanel",
                typeof(RectTransform),
                typeof(Image));
            scenePanel.transform.SetParent(canvasTransform, false);
            Image panelImage = scenePanel.GetComponent<Image>();
            panelImage.color = new Color(0f, 0f, 0f, 0f);
            panelImage.raycastTarget = false;
            RectTransform panelRect = scenePanel.GetComponent<RectTransform>();
            panelRect.anchorMin = Vector2.zero;
            panelRect.anchorMax = Vector2.one;
            panelRect.offsetMin = Vector2.zero;
            panelRect.offsetMax = Vector2.zero;

            RawImage worldImage = new GameObject(
                "WorldRender",
                typeof(RectTransform),
                typeof(RawImage)).GetComponent<RawImage>();
            worldImage.transform.SetParent(scenePanel.transform, false);
            worldImage.texture = renderTexture;
            worldImage.color = Color.white;
            worldImage.raycastTarget = false;
            RectTransform imageRect = worldImage.GetComponent<RectTransform>();
            imageRect.anchorMin = Vector2.zero;
            imageRect.anchorMax = Vector2.one;
            imageRect.offsetMin = Vector2.zero;
            imageRect.offsetMax = Vector2.zero;

            GameObject hud = HabitHeroUiFactory.CreatePanel(
                scenePanel.transform,
                new Color(0.03f, 0.05f, 0.08f, 0.84f),
                "WorldHud");
            RectTransform hudRect = hud.GetComponent<RectTransform>();
            hudRect.anchorMin = new Vector2(0.03f, 0.76f);
            hudRect.anchorMax = new Vector2(0.97f, 0.98f);
            hudRect.offsetMin = Vector2.zero;
            hudRect.offsetMax = Vector2.zero;
            HabitHeroUiFactory.CreateText(
                hud.transform,
                font,
                scene.name + "　3D 世界",
                25,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.04f, 0.58f),
                new Vector2(0.96f, 0.96f));
            HabitHeroUiFactory.CreateText(
                hud.transform,
                font,
                "目前為資料驅動的 Unity 世界 runtime；NPC 位置與互動規則來自 Supabase。",
                13,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.04f, 0.1f),
                new Vector2(0.96f, 0.55f));

            GameObject npcList = CreateList(
                scenePanel.transform,
                "WorldNpcList",
                new Vector2(0.04f, 0.34f),
                new Vector2(0.44f, 0.73f));
            RenderNpcActions(npcList.transform);

            GameObject controls = HabitHeroUiFactory.CreatePanel(
                scenePanel.transform,
                new Color(0.03f, 0.05f, 0.08f, 0.86f),
                "WorldMovementControls");
            RectTransform controlsRect = controls.GetComponent<RectTransform>();
            controlsRect.anchorMin = new Vector2(0.69f, 0.04f);
            controlsRect.anchorMax = new Vector2(0.96f, 0.32f);
            controlsRect.offsetMin = Vector2.zero;
            controlsRect.offsetMax = Vector2.zero;
            CreateMovementButton(controls.transform, "上", new Vector2(0.34f, 0.56f), new Vector2(0.66f, 0.9f), new Vector2(0f, 1f));
            CreateMovementButton(controls.transform, "左", new Vector2(0.04f, 0.24f), new Vector2(0.36f, 0.58f), new Vector2(-1f, 0f));
            CreateMovementButton(controls.transform, "右", new Vector2(0.64f, 0.24f), new Vector2(0.96f, 0.58f), new Vector2(1f, 0f));
            CreateMovementButton(controls.transform, "下", new Vector2(0.34f, 0.02f), new Vector2(0.66f, 0.36f), new Vector2(0f, -1f));

            sceneStatus = HabitHeroUiFactory.CreateText(
                scenePanel.transform,
                font,
                "方向按鈕可移動孩子角色；可從左側與 NPC 對話。",
                14,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.04f, 0.24f),
                new Vector2(0.64f, 0.33f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                scenePanel.transform,
                font,
                "返回世界",
                new Vector2(0.35f, 0.04f),
                new Vector2(0.64f, 0.12f));
            closeButton.onClick.AddListener(CloseFromButton);
        }

        private void RenderNpcActions(Transform parent)
        {
            foreach (SupabaseGameWorldNpcRecord npc in
                latestData.npcs ?? new SupabaseGameWorldNpcRecord[0])
            {
                if (npc == null || !npc.is_active || npc.scene_id != sceneId) continue;
                GameObject row = new GameObject(
                    "NpcActionRow",
                    typeof(RectTransform),
                    typeof(HorizontalLayoutGroup));
                row.transform.SetParent(parent, false);
                row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 34f);
                HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
                layout.spacing = 4f;
                layout.childControlWidth = true;
                layout.childControlHeight = true;
                layout.childForceExpandWidth = false;
                layout.childForceExpandHeight = true;
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    npc.name + "　" + (npc.npc_type == "roaming_pet" ? "寵物" : "商人"),
                    14,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                LayoutElement labelLayout = label.gameObject.AddComponent<LayoutElement>();
                labelLayout.flexibleWidth = 1f;
                Button talkButton = HabitHeroUiFactory.CreateButton(
                    row.transform,
                    font,
                    "對話",
                    Vector2.zero,
                    Vector2.one);
                LayoutElement buttonLayout = talkButton.gameObject.AddComponent<LayoutElement>();
                buttonLayout.preferredWidth = 74f;
                buttonLayout.minWidth = 74f;
                talkButton.interactable = completeNpcDialogue != null;
                if (completeNpcDialogue != null)
                {
                    talkButton.onClick.AddListener(() => CompleteNpcDialogueAsync(
                        npc.id,
                        talkButton));
                }
            }
        }

        private void CreateMovementButton(
            Transform parent,
            string label,
            Vector2 anchorMin,
            Vector2 anchorMax,
            Vector2 direction)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                anchorMin,
                anchorMax);
            button.onClick.AddListener(() => MovePlayer(direction));
        }

        private void MovePlayer(Vector2 direction)
        {
            if (player == null) return;
            Vector3 position = player.transform.position;
            position.x = Mathf.Clamp(position.x + direction.x * 0.8f, -8f, 8f);
            position.z = Mathf.Clamp(position.z + direction.y * 0.8f, -8f, 8f);
            player.transform.position = position;
            SetStatus("孩子角色已移動到 " + position.x.ToString("0.0") + ", " + position.z.ToString("0.0") + "。", false);
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
                SetStatus("對話完成，商店來源已更新。", false);
            }
            catch (Exception exception)
            {
                SetStatus("NPC 對話失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private SupabaseGameWorldSceneRecord FindScene(string targetSceneId)
        {
            foreach (SupabaseGameWorldSceneRecord scene in
                latestData == null
                    ? new SupabaseGameWorldSceneRecord[0]
                    : latestData.scenes ?? new SupabaseGameWorldSceneRecord[0])
            {
                if (scene != null && scene.id == targetSceneId) return scene;
            }

            return null;
        }

        private GameObject CreatePrimitive(
            PrimitiveType type,
            string name,
            Vector3 position,
            Vector3 scale,
            Color color)
        {
            GameObject primitive = GameObject.CreatePrimitive(type);
            primitive.name = name;
            primitive.transform.SetParent(worldRoot.transform, false);
            primitive.transform.localPosition = position;
            primitive.transform.localScale = scale;
            Renderer renderer = primitive.GetComponent<Renderer>();
            if (renderer != null)
            {
                Material material = CreateMaterial(color);
                renderer.sharedMaterial = material;
                runtimeMaterials.Add(material);
            }

            return primitive;
        }

        private static Material CreateMaterial(Color color)
        {
            Shader shader = Shader.Find("Unlit/Color") ?? Shader.Find("Standard");
            Material material = new Material(shader);
            material.color = color;
            return material;
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

        private void SetStatus(string message, bool isError)
        {
            if (sceneStatus == null) return;
            sceneStatus.text = message;
            sceneStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : Color.white;
        }

        private void CloseFromButton()
        {
            Action callback = onClose;
            CloseInternal(false);
            if (callback != null) callback();
        }

        private void CloseInternal(bool notify)
        {
            if (scenePanel != null)
            {
                UnityEngine.Object.Destroy(scenePanel);
                scenePanel = null;
            }

            if (worldRoot != null)
            {
                UnityEngine.Object.Destroy(worldRoot);
                worldRoot = null;
            }

            if (renderTexture != null)
            {
                renderTexture.Release();
                UnityEngine.Object.Destroy(renderTexture);
                renderTexture = null;
            }

            foreach (Material material in runtimeMaterials)
            {
                if (material != null) UnityEngine.Object.Destroy(material);
            }

            runtimeMaterials.Clear();
            worldCamera = null;
            player = null;
            sceneStatus = null;
            if (notify && onClose != null) onClose();
        }

        private static Color GetSceneColor(string targetSceneId)
        {
            switch (targetSceneId)
            {
                case "forest-valley":
                    return new Color(0.08f, 0.16f, 0.12f, 1f);
                case "cloud-workshop":
                    return new Color(0.38f, 0.62f, 0.84f, 1f);
                case "tideglow-archipelago":
                    return new Color(0.05f, 0.3f, 0.42f, 1f);
                case "star-sand-wasteland":
                    return new Color(0.34f, 0.18f, 0.09f, 1f);
                default:
                    return new Color(0.32f, 0.48f, 0.64f, 1f);
            }
        }

        private static Color GetGroundColor(string targetSceneId)
        {
            switch (targetSceneId)
            {
                case "forest-valley":
                    return new Color(0.16f, 0.35f, 0.22f, 1f);
                case "cloud-workshop":
                    return new Color(0.72f, 0.84f, 0.92f, 1f);
                case "tideglow-archipelago":
                    return new Color(0.12f, 0.45f, 0.5f, 1f);
                case "star-sand-wasteland":
                    return new Color(0.58f, 0.35f, 0.16f, 1f);
                default:
                    return new Color(0.36f, 0.55f, 0.3f, 1f);
            }
        }
    }
}
