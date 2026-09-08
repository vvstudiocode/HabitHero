using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using GLTFast;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildWorldSceneView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private readonly string gameAssetBaseUrl;
        private GameObject scenePanel;
        private GameObject worldRoot;
        private Camera worldCamera;
        private RenderTexture renderTexture;
        private GameObject player;
        private Text sceneStatus;
        private SupabaseChildWorldData latestData;
        private SupabaseChildGameData latestGameData;
        private string sceneId;
        private HabitHeroWorldSceneProfile activeSceneProfile;
        private HabitHeroWorldCollisionProxy[] worldCollisionProxies =
            new HabitHeroWorldCollisionProxy[0];
        private Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue;
        private Action onClose;
        private readonly List<Material> runtimeMaterials = new List<Material>();
        private readonly Dictionary<string, GltfImport> modelImports =
            new Dictionary<string, GltfImport>(StringComparer.Ordinal);
        private readonly Dictionary<string, Task<GltfImport>> modelImportLoads =
            new Dictionary<string, Task<GltfImport>>(StringComparer.Ordinal);
        private CancellationTokenSource modelLoadingCancellation;

        public HabitHeroChildWorldSceneView(
            Transform canvasTransform,
            Font font,
            string gameAssetBaseUrl)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
            this.gameAssetBaseUrl = gameAssetBaseUrl == null
                ? string.Empty
                : gameAssetBaseUrl.Trim();
        }

        public void Show(
            SupabaseChildWorldData data,
            SupabaseChildGameData gameData,
            string sceneId,
            Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue,
            Action onClose)
        {
            CloseInternal(false);
            latestData = data;
            latestGameData = gameData;
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

        public void ApplyGameData(SupabaseChildGameData data)
        {
            latestGameData = data;
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
            latestGameData = null;
            sceneId = null;
            completeNpcDialogue = null;
            onClose = null;
        }

        private void CreateWorld(SupabaseGameWorldSceneRecord scene)
        {
            worldRoot = new GameObject("ChildWorldRuntime");
            modelLoadingCancellation = new CancellationTokenSource();
            activeSceneProfile = ResolveSceneProfile(scene.id);
            float movementBoundary = activeSceneProfile.MovementBoundary;
            worldCollisionProxies = BuildWorldCollisionProxies(scene.id);
            GameObject cameraObject = new GameObject("ChildWorldCamera");
            cameraObject.transform.SetParent(worldRoot.transform, false);
            worldCamera = cameraObject.AddComponent<Camera>();
            worldCamera.clearFlags = CameraClearFlags.SolidColor;
            worldCamera.backgroundColor = GetSceneColor(scene.id);
            worldCamera.orthographic = false;
            worldCamera.fieldOfView = 50f;
            worldCamera.nearClipPlane = 0.1f;
            worldCamera.farClipPlane = 100f;

            CreatePrimitive(
                PrimitiveType.Plane,
                "WorldGround",
                new Vector3(0f, 0f, 0f),
                new Vector3(movementBoundary / 5f, 1f, movementBoundary / 5f),
                GetGroundColor(scene.id));
            float boundaryEdge = movementBoundary + 1.5f;
            float boundarySpan = boundaryEdge * 2f;
            CreatePrimitive(
                PrimitiveType.Cube,
                "WorldNorthBoundary",
                new Vector3(0f, 0.35f, boundaryEdge),
                new Vector3(boundarySpan, 0.7f, 0.35f),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "WorldSouthBoundary",
                new Vector3(0f, 0.35f, -boundaryEdge),
                new Vector3(boundarySpan, 0.7f, 0.35f),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "WorldEastBoundary",
                new Vector3(boundaryEdge, 0.35f, 0f),
                new Vector3(0.35f, 0.7f, boundarySpan),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "WorldWestBoundary",
                new Vector3(-boundaryEdge, 0.35f, 0f),
                new Vector3(0.35f, 0.7f, boundarySpan),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            RenderAuthoredWorldModules(scene.id);

            Vector2 safeSpawn = HabitHeroWorldCollision.FindClearSpawn(
                new Vector2(
                    activeSceneProfile.SpawnPosition.x,
                    activeSceneProfile.SpawnPosition.z),
                0.35f,
                movementBoundary,
                worldCollisionProxies);
            Vector3 spawnPosition = new Vector3(
                safeSpawn.x,
                activeSceneProfile.SpawnPosition.y,
                safeSpawn.y);
            player = CreatePrimitive(
                PrimitiveType.Capsule,
                "ChildAvatarPlaceholder",
                spawnPosition + Vector3.up,
                new Vector3(0.75f, 1f, 0.75f),
                HabitHeroUiFactory.AccentColor);
            StartModelLoad(
                player,
                FindEquippedCharacterAssetKey(),
                spawnPosition,
                Vector3.zero,
                1f);
            UpdateWorldCamera();
            RenderNpcPlaceholders();
            RenderWorldEntityPlaceholders();

            renderTexture = new RenderTexture(720, 960, 24, RenderTextureFormat.ARGB32);
            renderTexture.name = "HabitHeroWorldRenderTexture";
            renderTexture.Create();
            worldCamera.targetTexture = renderTexture;
        }

        private HabitHeroWorldCollisionProxy[] BuildWorldCollisionProxies(
            string targetSceneId)
        {
            List<HabitHeroWorldCollisionProxy> result =
                new List<HabitHeroWorldCollisionProxy>();
            HabitHeroWorldCollisionProxy[] authoredProxies;
            if (HabitHeroWorldCollision.TryGetAuthoredProxies(
                targetSceneId,
                out authoredProxies))
            {
                result.AddRange(authoredProxies);
            }

            if (latestGameData == null) return result.ToArray();
            foreach (SupabaseChildWorldEntityRecord entity in
                latestGameData.worldEntities ?? new SupabaseChildWorldEntityRecord[0])
            {
                if (entity == null
                    || !entity.is_active
                    || entity.entity_kind != "decoration") continue;
                SupabaseGameCatalogItemRecord item = FindCatalogItemForInventory(
                    entity.inventory_item_id);
                if (item == null) continue;
                HabitHeroWorldCollisionProxy proxy =
                    HabitHeroWorldCollision.CreateScaledProxy(
                        entity.position_x,
                        entity.position_z,
                        item.collision_radius,
                        entity.scale);
                if (proxy != null) result.Add(proxy);
            }

            foreach (SupabaseChildSharedWorldDecorationRecord shared in
                latestGameData.sharedWorldDecorations
                    ?? new SupabaseChildSharedWorldDecorationRecord[0])
            {
                if (shared == null || !shared.is_active) continue;
                SupabaseGameCatalogItemRecord item = FindCatalogItem(
                    shared.catalog_item_id);
                if (item == null) continue;
                HabitHeroWorldCollisionProxy proxy =
                    HabitHeroWorldCollision.CreateScaledProxy(
                        shared.position_x,
                        shared.position_z,
                        item.collision_radius,
                        shared.scale);
                if (proxy != null) result.Add(proxy);
            }

            return result.ToArray();
        }

        private void RenderAuthoredWorldModules(string targetSceneId)
        {
            HabitHeroWorldAssetModule[] modules;
            if (!HabitHeroWorldAssetCatalog.TryGetModules(targetSceneId, out modules)) return;

            foreach (HabitHeroWorldAssetModule module in modules)
            {
                if (module == null) continue;
                GameObject placeholder = CreatePrimitive(
                    PrimitiveType.Cube,
                    "AuthoredModule_" + module.AssetKey,
                    module.Position + Vector3.up * 0.05f,
                    Vector3.one * 0.05f,
                    new Color(0.26f, 0.82f, 0.88f, 1f));
                StartModelLoad(
                    placeholder,
                    module.AssetKey,
                    module.Position,
                    module.Rotation.eulerAngles,
                    module.Scale);
            }
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
                GameObject placeholder = CreatePrimitive(
                    primitive,
                    "Npc_" + npc.id,
                    position,
                    scale,
                    color);
                StartModelLoad(
                    placeholder,
                    npc.asset_key,
                    new Vector3(npc.position_x, npc.position_y, npc.position_z),
                    Vector3.zero,
                    npc.npc_type == "roaming_pet" ? 1.3f : 1f);
            }
        }

        private void RenderWorldEntityPlaceholders()
        {
            if (latestGameData == null) return;

            foreach (SupabaseChildWorldEntityRecord entity in
                latestGameData.worldEntities ?? new SupabaseChildWorldEntityRecord[0])
            {
                if (entity == null || !entity.is_active) continue;
                SupabaseGameCatalogItemRecord item = FindCatalogItemForInventory(
                    entity.inventory_item_id);
                string assetKey = item == null ? entity.entity_kind : item.asset_key;
                GameObject placeholder = CreateWorldEntityPlaceholder(
                    "WorldEntity_" + entity.id,
                    entity.entity_kind,
                    assetKey,
                    entity.position_x,
                    entity.position_y,
                    entity.position_z,
                    entity.rotation_x,
                    entity.rotation_y,
                    entity.rotation_z,
                    entity.scale,
                    false);
                StartModelLoad(
                    placeholder,
                    assetKey,
                    new Vector3(entity.position_x, entity.position_y, entity.position_z),
                    new Vector3(
                        RadiansToDegrees(entity.rotation_x),
                        RadiansToDegrees(entity.rotation_y),
                        RadiansToDegrees(entity.rotation_z)),
                    GetModelScaleMultiplier(entity.entity_kind, assetKey)
                        * Mathf.Clamp(entity.scale <= 0f ? 1f : entity.scale, 0.25f, 3f));
            }

            foreach (SupabaseChildSharedWorldDecorationRecord shared in
                latestGameData.sharedWorldDecorations
                    ?? new SupabaseChildSharedWorldDecorationRecord[0])
            {
                if (shared == null || !shared.is_active) continue;
                GameObject placeholder = CreateWorldEntityPlaceholder(
                    "SharedWorldEntity_" + shared.id,
                    "decoration",
                    shared.asset_key,
                    shared.position_x,
                    shared.position_y,
                    shared.position_z,
                    shared.rotation_x,
                    shared.rotation_y,
                    shared.rotation_z,
                    shared.scale,
                    true);
                StartModelLoad(
                    placeholder,
                    shared.asset_key,
                    new Vector3(shared.position_x, shared.position_y, shared.position_z),
                    new Vector3(
                        RadiansToDegrees(shared.rotation_x),
                        RadiansToDegrees(shared.rotation_y),
                        RadiansToDegrees(shared.rotation_z)),
                    GetModelScaleMultiplier("decoration", shared.asset_key)
                        * Mathf.Clamp(shared.scale <= 0f ? 1f : shared.scale, 0.25f, 3f));
            }
        }

        private GameObject CreateWorldEntityPlaceholder(
            string name,
            string entityKind,
            string assetKey,
            float positionX,
            float positionY,
            float positionZ,
            float rotationX,
            float rotationY,
            float rotationZ,
            float scale,
            bool isShared)
        {
            bool isPet = entityKind == "pet";
            float effectiveScale = Mathf.Clamp(scale <= 0f ? 1f : scale, 0.25f, 3f);
            PrimitiveType primitiveType = isPet ? PrimitiveType.Sphere : PrimitiveType.Cube;
            Vector3 baseScale = isPet
                ? new Vector3(0.9f, 0.75f, 0.9f)
                : new Vector3(1.35f, 0.7f, 1.1f);
            float height = isPet ? 0.75f : 0.35f;
            GameObject worldEntity = CreatePrimitive(
                primitiveType,
                name,
                new Vector3(
                    positionX,
                    positionY + height * effectiveScale,
                    positionZ),
                baseScale * effectiveScale,
                GetWorldEntityColor(entityKind, assetKey, isShared));
            worldEntity.transform.localEulerAngles = new Vector3(
                RadiansToDegrees(rotationX),
                RadiansToDegrees(rotationY),
                RadiansToDegrees(rotationZ));
            return worldEntity;
        }

        private SupabaseGameCatalogItemRecord FindCatalogItemForInventory(
            string inventoryItemId)
        {
            foreach (SupabaseChildInventoryItemRecord inventory in
                latestGameData.inventory ?? new SupabaseChildInventoryItemRecord[0])
            {
                if (inventory == null || inventory.id != inventoryItemId) continue;
                foreach (SupabaseGameCatalogItemRecord item in
                    latestGameData.catalog ?? new SupabaseGameCatalogItemRecord[0])
                {
                    if (item != null && item.id == inventory.catalog_item_id) return item;
                }
            }

            return null;
        }

        private string FindEquippedCharacterAssetKey()
        {
            if (latestGameData == null || latestGameData.loadout == null)
            {
                return null;
            }

            SupabaseChildInventoryItemRecord inventory = null;
            foreach (SupabaseChildInventoryItemRecord candidate in
                latestGameData.inventory ?? new SupabaseChildInventoryItemRecord[0])
            {
                if (candidate != null
                    && candidate.id == latestGameData.loadout.equipped_character_inventory_id)
                {
                    inventory = candidate;
                    break;
                }
            }

            if (inventory == null) return null;
            SupabaseGameCatalogItemRecord item = FindCatalogItem(inventory.catalog_item_id);
            return item == null ? null : item.asset_key;
        }

        private SupabaseGameCatalogItemRecord FindCatalogItem(string catalogItemId)
        {
            foreach (SupabaseGameCatalogItemRecord item in
                latestGameData == null
                    ? new SupabaseGameCatalogItemRecord[0]
                    : latestGameData.catalog ?? new SupabaseGameCatalogItemRecord[0])
            {
                if (item != null && item.id == catalogItemId) return item;
            }

            return null;
        }

        private void StartModelLoad(
            GameObject placeholder,
            string assetKey,
            Vector3 groundPosition,
            Vector3 eulerAngles,
            float visualScale)
        {
            StartModelLoadInternal(
                placeholder,
                assetKey,
                groundPosition,
                eulerAngles,
                Vector3.one * Mathf.Clamp(visualScale, 0.05f, 8f));
        }

        private void StartModelLoad(
            GameObject placeholder,
            string assetKey,
            Vector3 groundPosition,
            Vector3 eulerAngles,
            Vector3 visualScale)
        {
            StartModelLoadInternal(
                placeholder,
                assetKey,
                groundPosition,
                eulerAngles,
                ClampAuthoredModuleScale(visualScale));
        }

        private void StartModelLoadInternal(
            GameObject placeholder,
            string assetKey,
            Vector3 groundPosition,
            Vector3 eulerAngles,
            Vector3 visualScale)
        {
            if (placeholder == null
                || !HabitHeroGameAssetCatalog.TryResolveModelUrl(
                    assetKey,
                    gameAssetBaseUrl,
                    out string modelUrl)
                || modelLoadingCancellation == null
                || worldRoot == null)
            {
                return;
            }

            _ = LoadModelAsync(
                placeholder,
                modelUrl,
                groundPosition,
                eulerAngles,
                visualScale,
                worldRoot,
                modelLoadingCancellation.Token);
        }

        private async Task LoadModelAsync(
            GameObject placeholder,
            string modelUrl,
            Vector3 groundPosition,
            Vector3 eulerAngles,
            Vector3 visualScale,
            GameObject expectedWorldRoot,
            CancellationToken cancellationToken)
        {
            try
            {
                GltfImport gltf = await GetOrLoadModelImportAsync(
                    modelUrl,
                    cancellationToken);
                if (gltf == null
                    || cancellationToken.IsCancellationRequested
                    || worldRoot != expectedWorldRoot)
                {
                    return;
                }

                GameObject modelRoot = new GameObject(placeholder.name + "Model");
                modelRoot.transform.SetParent(expectedWorldRoot.transform, false);
                GameObject modelContent = new GameObject("Content");
                modelContent.transform.SetParent(modelRoot.transform, false);
                bool instantiated = await gltf.InstantiateMainSceneAsync(
                    modelContent.transform,
                    cancellationToken);
                if (!instantiated
                    || cancellationToken.IsCancellationRequested
                    || worldRoot != expectedWorldRoot)
                {
                    UnityEngine.Object.Destroy(modelRoot);
                    return;
                }

                modelContent.transform.localScale = visualScale;
                CenterModelOnGround(modelContent, modelRoot, groundPosition, eulerAngles);
                placeholder.SetActive(false);
            }
            catch (OperationCanceledException)
            {
                // Closing or refreshing the scene cancels in-flight asset loads.
            }
            catch (Exception exception)
            {
                Debug.LogWarning(
                    "HabitHero could not load world model " + modelUrl + ": "
                    + exception.Message);
            }
        }

        private static Vector3 ClampAuthoredModuleScale(Vector3 visualScale)
        {
            return new Vector3(
                ClampSignedScale(visualScale.x),
                ClampSignedScale(visualScale.y),
                ClampSignedScale(visualScale.z));
        }

        private static float ClampSignedScale(float value)
        {
            if (Mathf.Abs(value) < 0.0001f) return 0.05f;
            return Mathf.Clamp(value, -64f, 64f);
        }

        private async Task<GltfImport> GetOrLoadModelImportAsync(
            string modelUrl,
            CancellationToken cancellationToken)
        {
            GltfImport cached;
            if (modelImports.TryGetValue(modelUrl, out cached)) return cached;

            Task<GltfImport> pending;
            if (!modelImportLoads.TryGetValue(modelUrl, out pending))
            {
                pending = LoadModelImportAsync(modelUrl, cancellationToken);
                modelImportLoads[modelUrl] = pending;
            }

            try
            {
                return await pending;
            }
            finally
            {
                if (modelImportLoads.ContainsKey(modelUrl)
                    && modelImportLoads[modelUrl] == pending)
                {
                    modelImportLoads.Remove(modelUrl);
                }
            }
        }

        private async Task<GltfImport> LoadModelImportAsync(
            string modelUrl,
            CancellationToken cancellationToken)
        {
            GltfImport gltf = new GltfImport();
            try
            {
                bool loaded = await gltf.Load(
                    modelUrl,
                    null,
                    cancellationToken);
                if (!loaded || cancellationToken.IsCancellationRequested)
                {
                    gltf.Dispose();
                    return null;
                }

                modelImports[modelUrl] = gltf;
                return gltf;
            }
            catch
            {
                gltf.Dispose();
                throw;
            }
        }

        private static void CenterModelOnGround(
            GameObject modelContent,
            GameObject modelRoot,
            Vector3 groundPosition,
            Vector3 eulerAngles)
        {
            Bounds bounds;
            if (!TryGetRendererBounds(modelContent, out bounds))
            {
                modelRoot.transform.position = groundPosition;
                modelRoot.transform.eulerAngles = eulerAngles;
                return;
            }

            modelContent.transform.localPosition = new Vector3(
                -bounds.center.x,
                -bounds.min.y,
                -bounds.center.z);
            modelRoot.transform.position = groundPosition;
            modelRoot.transform.eulerAngles = eulerAngles;
        }

        private static bool TryGetRendererBounds(GameObject root, out Bounds bounds)
        {
            Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
            if (renderers.Length == 0)
            {
                bounds = new Bounds(Vector3.zero, Vector3.zero);
                return false;
            }

            bounds = renderers[0].bounds;
            for (int index = 1; index < renderers.Length; index += 1)
            {
                bounds.Encapsulate(renderers[index].bounds);
            }

            return bounds.size.sqrMagnitude > 0.000001f;
        }

        private static float GetModelScaleMultiplier(
            string entityKind,
            string assetKey)
        {
            if (entityKind != "pet") return 1f;
            if (assetKey == "pet.yaoguang-deer") return 1.3f * (8f / 3f);
            if (assetKey == "pet.murphy-bear") return 1.3f * 2f;
            if (assetKey == "pet.oum") return 1.3f * 4f;
            return 1.3f;
        }

        private static float RadiansToDegrees(float radians)
        {
            return radians * Mathf.Rad2Deg;
        }

        private static Color GetWorldEntityColor(
            string entityKind,
            string assetKey,
            bool isShared)
        {
            if (isShared)
            {
                return new Color(0.75f, 0.46f, 0.92f, 1f);
            }

            if (entityKind == "pet")
            {
                return new Color(0.95f, 0.68f, 0.38f, 1f);
            }

            if (!string.IsNullOrWhiteSpace(assetKey)
                && assetKey.IndexOf("book", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return new Color(0.38f, 0.72f, 0.92f, 1f);
            }

            return new Color(0.38f, 0.84f, 0.66f, 1f);
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
            float movementBoundary = activeSceneProfile == null
                ? 8f
                : activeSceneProfile.MovementBoundary;
            Vector2 next = HabitHeroWorldCollision.MoveCharacter(
                new Vector2(position.x, position.z),
                new Vector2(
                    position.x + direction.x * 0.8f,
                    position.z + direction.y * 0.8f),
                0.35f,
                worldCollisionProxies,
                movementBoundary);
            position.x = next.x;
            position.z = next.y;
            player.transform.position = position;
            UpdateWorldCamera();
            SetStatus("孩子角色已移動到 " + position.x.ToString("0.0") + ", " + position.z.ToString("0.0") + "。", false);
        }

        private void UpdateWorldCamera()
        {
            if (worldCamera == null || player == null) return;
            Vector3 target = player.transform.position;
            target.y = player.transform.position.y - 1f + 0.38f;
            Vector3 cameraPosition = target + HabitHeroWorldCameraMath.GetOffset(
                Mathf.PI / 2f,
                0.18f,
                4.1f);
            worldCamera.transform.position = cameraPosition;
            worldCamera.transform.LookAt(target);
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

        private static HabitHeroWorldSceneProfile ResolveSceneProfile(string targetSceneId)
        {
            HabitHeroWorldSceneProfile profile;
            if (HabitHeroWorldSceneProfileCatalog.TryGetProfile(targetSceneId, out profile))
            {
                return profile;
            }

            return new HabitHeroWorldSceneProfile(
                targetSceneId,
                new Vector3(0f, 0f, -4f),
                8f);
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
            if (modelLoadingCancellation != null)
            {
                modelLoadingCancellation.Cancel();
                modelLoadingCancellation.Dispose();
                modelLoadingCancellation = null;
            }

            foreach (GltfImport gltf in modelImports.Values)
            {
                if (gltf != null) gltf.Dispose();
            }

            modelImports.Clear();
            modelImportLoads.Clear();

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
            worldCollisionProxies = new HabitHeroWorldCollisionProxy[0];
            activeSceneProfile = null;
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
