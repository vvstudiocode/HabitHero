using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using GLTFast;
using UnityEngine;
using UnityEngine.Networking;
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
        private RectTransform cameraGestureRect;
        private HabitHeroWorldCameraInput cameraInput;
        private HabitHeroWorldCameraState worldCameraState;
        private Light worldSun;
        private Light worldFill;
        private ParticleSystem rainParticles;
        private AudioSource worldMusicAudio;
        private AudioClip worldMusicClip;
        private Toggle worldMusicToggle;
        private float atmosphereRefreshTimer;
        private RenderTexture renderTexture;
        private GameObject player;
        private HabitHeroWorldModelAnimation playerAnimation;
        private HabitHeroWorldJoystickInput worldJoystick;
        private Vector2 joystickDirection;
        private readonly List<HabitHeroWorldPetActor> petActors =
            new List<HabitHeroWorldPetActor>();
        private readonly List<HabitHeroWorldLabelBinding> worldLabelBindings =
            new List<HabitHeroWorldLabelBinding>();
        private readonly List<HabitHeroWorldShadowBinding> worldShadowBindings =
            new List<HabitHeroWorldShadowBinding>();
        private Text sceneStatus;
        private SupabaseChildWorldData latestData;
        private SupabaseChildGameData latestGameData;
        private string sceneId;
        private Func<
            string,
            long,
            SupabaseFriendWorldTransform,
            string,
            int?,
            Task<SupabaseChildGameData>> placeWorldEntity;
        private Func<
            string,
            string,
            long,
            SupabaseFriendWorldTransform,
            Task<SupabaseChildGameData>> updateWorldEntity;
        private Func<string, string, long, Task<SupabaseChildGameData>> removeWorldEntity;
        private GameObject decorationEditor;
        private GameObject placementPreview;
        private string placementInventoryItemId;
        private SupabaseGameCatalogItemRecord placementItem;
        private SupabaseChildWorldEntityRecord placementEntity;
        private HabitHeroWorldPlacementDraft placementDraft;
        private float placementCollisionRadius;
        private HabitHeroWorldSceneProfile activeSceneProfile;
        private HabitHeroWorldCollisionProxy[] worldCollisionProxies =
            new HabitHeroWorldCollisionProxy[0];
        private readonly Dictionary<HabitHeroWorldAssetModule, int> authoredCollisionProxyIndices =
            new Dictionary<HabitHeroWorldAssetModule, int>();
        private Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue;
        private Action onClose;
        private readonly List<Material> runtimeMaterials = new List<Material>();
        private readonly Dictionary<string, GltfImport> modelImports =
            new Dictionary<string, GltfImport>(StringComparer.Ordinal);
        private readonly Dictionary<string, Task<GltfImport>> modelImportLoads =
            new Dictionary<string, Task<GltfImport>>(StringComparer.Ordinal);
        private CancellationTokenSource modelLoadingCancellation;
        private CancellationTokenSource worldMusicCancellation;
        private readonly List<Texture2D> runtimeTextures = new List<Texture2D>();
        private Material worldShadowMaterial;
        private HabitHeroWorldShadowBinding playerShadow;

        private sealed class HabitHeroWorldPetActor
        {
            public string inventoryItemId;
            public string behaviorMode;
            public int followIndex;
            public float radius;
            public GameObject placeholder;
            public HabitHeroWorldModelAnimation animation;
            public HabitHeroPetMotionState motionState;
            public SupabaseGameWorldRoamBoundsRecord roamBounds;
            public HabitHeroWorldLabelBinding label;
            public HabitHeroWorldShadowBinding shadow;

            public Transform VisualRoot
            {
                get
                {
                    if (animation != null) return animation.transform;
                    return placeholder == null ? null : placeholder.transform;
                }
            }
        }

        private sealed class HabitHeroWorldLabelBinding
        {
            public GameObject labelObject;
            public Transform target;
            public Vector3 offset;

            public void Update(Camera camera)
            {
                if (labelObject == null || target == null || camera == null) return;
                labelObject.transform.position = target.position + offset;
                Vector3 toCamera = labelObject.transform.position - camera.transform.position;
                if (toCamera.sqrMagnitude > 0.0001f)
                {
                    labelObject.transform.rotation = Quaternion.LookRotation(
                        toCamera,
                        Vector3.up);
                }
            }
        }

        private sealed class HabitHeroWorldShadowBinding
        {
            public GameObject shadowObject;
            public Transform target;
            public float groundY;

            public void Update()
            {
                if (shadowObject == null || target == null) return;
                Vector3 position = target.position;
                shadowObject.transform.position = new Vector3(
                    position.x,
                    groundY + 0.015f,
                    position.z);
            }
        }

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
            Show(
                data,
                gameData,
                sceneId,
                completeNpcDialogue,
                onClose,
                null,
                null,
                null);
        }

        public void Show(
            SupabaseChildWorldData data,
            SupabaseChildGameData gameData,
            string sceneId,
            Func<string, Task<SupabaseChildWorldData>> completeNpcDialogue,
            Action onClose,
            Func<
                string,
                long,
                SupabaseFriendWorldTransform,
                string,
                int?,
                Task<SupabaseChildGameData>> placeWorldEntity,
            Func<
                string,
                string,
                long,
                SupabaseFriendWorldTransform,
                Task<SupabaseChildGameData>> updateWorldEntity,
            Func<string, string, long, Task<SupabaseChildGameData>> removeWorldEntity)
        {
            CloseInternal(false);
            latestData = data;
            latestGameData = gameData;
            this.sceneId = sceneId;
            this.completeNpcDialogue = completeNpcDialogue;
            this.onClose = onClose;
            this.placeWorldEntity = placeWorldEntity;
            this.updateWorldEntity = updateWorldEntity;
            this.removeWorldEntity = removeWorldEntity;
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

        public void Tick(float deltaSeconds)
        {
            if (scenePanel == null) return;
            float safeDelta = Mathf.Max(0f, deltaSeconds);
            UpdatePlayerFromJoystick(safeDelta);
            UpdatePetActors(safeDelta);
            UpdateWorldLabels();
            UpdateWorldShadows();
            atmosphereRefreshTimer -= safeDelta;
            UpdateWorldAtmosphere(false);
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
            placeWorldEntity = null;
            updateWorldEntity = null;
            removeWorldEntity = null;
        }

        public bool BeginDecorationPlacement(string inventoryItemId)
        {
            if (scenePanel == null || latestGameData == null)
            {
                return false;
            }

            SupabaseChildInventoryItemRecord inventory = FindInventoryItem(inventoryItemId);
            SupabaseGameCatalogItemRecord item = FindCatalogItemForInventory(inventoryItemId);
            if (inventory == null || item == null || item.item_type != "decoration")
            {
                return false;
            }

            SupabaseChildWorldEntityRecord entity = FindActiveDecoration(inventoryItemId);
            placementInventoryItemId = inventoryItemId;
            placementItem = item;
            placementEntity = entity;
            placementCollisionRadius = item.collision_radius;
            if (entity != null)
            {
                placementDraft = new HabitHeroWorldPlacementDraft
                {
                    X = entity.position_x,
                    Z = entity.position_z,
                    RotationY = entity.rotation_y,
                    Scale = entity.scale <= 0f ? 1f : entity.scale,
                };
                placementDraft = HabitHeroWorldPlacement.ClampToWorld(
                    placementDraft,
                    placementCollisionRadius,
                    activeSceneProfile == null
                        ? 8f
                        : activeSceneProfile.MovementBoundary);
            }
            else
            {
                Vector2 characterPosition = player == null
                    ? Vector2.zero
                    : new Vector2(player.transform.position.x, player.transform.position.z);
                float defaultScale = item.min_scale > 0f
                    ? Mathf.Clamp(1f, item.min_scale, item.max_scale)
                    : 1f;
                placementDraft = HabitHeroWorldPlacement.CreateDraft(
                    characterPosition,
                    worldCameraState == null ? 0f : worldCameraState.Yaw,
                    1.8f,
                    defaultScale,
                    item.min_scale,
                    item.max_scale,
                    activeSceneProfile == null
                        ? 8f
                        : activeSceneProfile.MovementBoundary);
            }

            RefreshPlacementPreview();
            SetStatus(
                "正在編輯「" + item.name + "」：可旋轉、縮放或點擊世界移動位置。",
                false);
            return true;
        }

        public bool ApplyPlacementControl(HabitHeroWorldPlacementControl control)
        {
            if (placementItem == null) return false;
            placementDraft = HabitHeroWorldPlacement.ApplyControl(
                placementDraft,
                control,
                placementItem.min_scale,
                placementItem.max_scale);
            placementDraft = HabitHeroWorldPlacement.ClampToWorld(
                placementDraft,
                placementCollisionRadius,
                activeSceneProfile == null ? 8f : activeSceneProfile.MovementBoundary);
            RefreshPlacementPreview();
            return true;
        }

        public void CancelDecorationPlacement()
        {
            ClearPlacementState();
            SetStatus("已取消裝飾編輯。", false);
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
            worldCameraState = new HabitHeroWorldCameraState();
            CreateWorldAtmosphere(movementBoundary);
            StartWorldBackgroundMusic(scene.id);

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
            playerShadow = CreateWorldShadowBinding(
                player.transform,
                spawnPosition.y,
                0.72f,
                0.42f);
            StartModelLoad(
                player,
                FindEquippedCharacterAssetKey(),
                spawnPosition,
                Vector3.zero,
                1f,
                AttachPlayerAnimation);
            UpdateWorldCamera();
            petActors.Clear();
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
            authoredCollisionProxyIndices.Clear();
            List<HabitHeroWorldCollisionProxy> result =
                new List<HabitHeroWorldCollisionProxy>();
            HabitHeroWorldCollisionProxy[] authoredProxies;
            if (HabitHeroWorldCollision.TryGetAuthoredProxies(
                targetSceneId,
                out authoredProxies))
            {
                HabitHeroWorldAssetModule[] authoredModules;
                int authoredProxyIndex = 0;
                if (HabitHeroWorldAssetCatalog.TryGetModules(
                    targetSceneId,
                    out authoredModules))
                {
                    foreach (HabitHeroWorldAssetModule module in authoredModules)
                    {
                        if (module == null || !module.Collision) continue;
                        if (authoredProxyIndex < authoredProxies.Length)
                        {
                            authoredCollisionProxyIndices[module] = authoredProxyIndex;
                        }
                        authoredProxyIndex += 1;
                    }
                }
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

        private void UpdateAuthoredCollisionProxy(
            HabitHeroWorldAssetModule module,
            Bounds loadedBounds)
        {
            if (module == null
                || !authoredCollisionProxyIndices.TryGetValue(module, out int proxyIndex)
                || worldCollisionProxies == null
                || proxyIndex < 0
                || proxyIndex >= worldCollisionProxies.Length)
            {
                return;
            }

            float footprintScale = module.CollisionFootprintScale > 0f
                ? module.CollisionFootprintScale
                : 1f;
            HabitHeroWorldCollisionProxy proxy = HabitHeroWorldCollision.CreateBoundsProxy(
                loadedBounds,
                footprintScale,
                HabitHeroWorldCollision.AuthoredNavigationInset);
            if (proxy == null) return;
            worldCollisionProxies[proxyIndex] = proxy;

            if (player == null || activeSceneProfile == null) return;
            Vector3 playerPosition = player.transform.position;
            Vector2 safePosition = HabitHeroWorldCollision.FindClearSpawn(
                new Vector2(playerPosition.x, playerPosition.z),
                0.35f,
                activeSceneProfile.MovementBoundary,
                worldCollisionProxies);
            if (Vector2.Distance(
                    new Vector2(playerPosition.x, playerPosition.z),
                    safePosition) > 0.001f)
            {
                player.transform.position = new Vector3(
                    safePosition.x,
                    playerPosition.y,
                    safePosition.y);
                if (playerAnimation != null)
                {
                    playerAnimation.transform.position = player.transform.position;
                }
            }
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
                HabitHeroWorldAssetModule collisionModule = module;
                StartModelLoad(
                    placeholder,
                    module.AssetKey,
                    module.Position,
                    module.Rotation.eulerAngles,
                    module.Scale,
                    module.Collision
                        ? (Action<Bounds>)(bounds => UpdateAuthoredCollisionProxy(collisionModule, bounds))
                        : null);
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
                if (npc.npc_type == "roaming_pet")
                {
                    HabitHeroWorldPetActor actor = CreatePetActor(
                        npc.id,
                        "wander",
                        -1,
                        0.28f,
                        placeholder,
                        npc.roam_bounds);
                    actor.label = CreateWorldLabelBinding(
                        string.IsNullOrWhiteSpace(npc.name) ? "寵物" : npc.name,
                        placeholder.transform,
                        1.1f,
                        new Color(1f, 0.9f, 0.72f, 1f));
                    actor.shadow = CreateWorldShadowBinding(
                        placeholder.transform,
                        npc.position_y,
                        0.68f,
                        0.38f);
                    petActors.Add(actor);
                    StartModelLoad(
                        placeholder,
                        npc.asset_key,
                        new Vector3(npc.position_x, npc.position_y, npc.position_z),
                        Vector3.zero,
                        Vector3.one * 1.3f,
                        null,
                        animation => AttachPetAnimation(actor, animation));
                }
                else
                {
                    HabitHeroWorldLabelBinding npcLabel = CreateWorldLabelBinding(
                        string.IsNullOrWhiteSpace(npc.name) ? "NPC" : npc.name,
                        placeholder.transform,
                        1.55f,
                        Color.white);
                    HabitHeroWorldShadowBinding npcShadow = CreateWorldShadowBinding(
                        placeholder.transform,
                        npc.position_y,
                        0.72f,
                        0.44f);
                    StartModelLoad(
                        placeholder,
                        npc.asset_key,
                        new Vector3(npc.position_x, npc.position_y, npc.position_z),
                        Vector3.zero,
                        1f,
                        animation =>
                        {
                            if (npcLabel != null) npcLabel.target = animation.transform;
                            if (npcShadow != null) npcShadow.target = animation.transform;
                        });
                }
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
                Vector3 groundPosition = new Vector3(
                    entity.position_x,
                    entity.position_y,
                    entity.position_z);
                Vector3 eulerAngles = new Vector3(
                    RadiansToDegrees(entity.rotation_x),
                    RadiansToDegrees(entity.rotation_y),
                    RadiansToDegrees(entity.rotation_z));
                float visualScale = GetModelScaleMultiplier(entity.entity_kind, assetKey)
                    * Mathf.Clamp(entity.scale <= 0f ? 1f : entity.scale, 0.25f, 3f);
                if (entity.entity_kind == "pet")
                {
                    HabitHeroWorldPetActor actor = CreatePetActor(
                        entity.inventory_item_id,
                        entity.behavior_mode,
                        GetPetFollowingIndex(entity.inventory_item_id),
                        GetPetRadius(item, entity.scale),
                        placeholder);
                    actor.label = CreateWorldLabelBinding(
                        GetPetDisplayName(entity.inventory_item_id, item),
                        placeholder.transform,
                        1.1f * Mathf.Clamp(visualScale, 0.5f, 2.5f),
                        new Color(1f, 0.9f, 0.72f, 1f));
                    actor.shadow = CreateWorldShadowBinding(
                        placeholder.transform,
                        groundPosition.y,
                        0.68f * Mathf.Clamp(visualScale, 0.5f, 2.5f),
                        0.38f * Mathf.Clamp(visualScale, 0.5f, 2.5f));
                    petActors.Add(actor);
                    StartModelLoad(
                        placeholder,
                        assetKey,
                        groundPosition,
                        eulerAngles,
                        Vector3.one * visualScale,
                        null,
                        animation => AttachPetAnimation(actor, animation));
                }
                else
                {
                    StartModelLoad(
                        placeholder,
                        assetKey,
                        groundPosition,
                        eulerAngles,
                        visualScale);
                }
            }

            RenderFollowingPetPlaceholders();

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

        private HabitHeroWorldPetActor CreatePetActor(
            string inventoryItemId,
            string behaviorMode,
            int followIndex,
            float radius,
            GameObject placeholder,
            SupabaseGameWorldRoamBoundsRecord roamBounds = null)
        {
            return new HabitHeroWorldPetActor
            {
                inventoryItemId = inventoryItemId,
                behaviorMode = string.IsNullOrWhiteSpace(behaviorMode)
                    ? "idle"
                    : behaviorMode,
                followIndex = followIndex,
                radius = radius,
                placeholder = placeholder,
                roamBounds = roamBounds,
                motionState = HabitHeroPetMotion.CreateState(
                    "pet:" + (inventoryItemId ?? string.Empty) + ":" + followIndex),
            };
        }

        private void RenderFollowingPetPlaceholders()
        {
            if (player == null || activeSceneProfile == null) return;
            string[] followingIds = GetFollowingPetInventoryIds();
            Vector2 playerPosition = new Vector2(
                player.transform.position.x,
                player.transform.position.z);
            for (int index = 0; index < followingIds.Length; index += 1)
            {
                string inventoryItemId = followingIds[index];
                if (string.IsNullOrWhiteSpace(inventoryItemId)
                    || HasPetActor(inventoryItemId)) continue;
                SupabaseGameCatalogItemRecord item = FindCatalogItemForInventory(
                    inventoryItemId);
                if (item == null || item.item_type != "pet") continue;

                float radius = GetPetRadius(item, 1f);
                float distance = HabitHeroPetMotion.GetSafeFollowingDistance(
                    HabitHeroPetMotion.GetFollowingDistance(index),
                    radius,
                    0.35f);
                Vector2 preferred = playerPosition + Vector2.down * distance;
                Vector2 spawn = HabitHeroWorldCollision.FindClearSpawn(
                    preferred,
                    radius,
                    activeSceneProfile.MovementBoundary,
                    worldCollisionProxies);
                float groundY = activeSceneProfile.SpawnPosition.y;
                GameObject placeholder = CreateWorldEntityPlaceholder(
                    "FollowingPet_" + inventoryItemId,
                    "pet",
                    item.asset_key,
                    spawn.x,
                    groundY,
                    spawn.y,
                    0f,
                    0f,
                    0f,
                    1f,
                    false);
                HabitHeroWorldPetActor actor = CreatePetActor(
                    inventoryItemId,
                    "idle",
                    index,
                    radius,
                    placeholder);
                actor.label = CreateWorldLabelBinding(
                    GetPetDisplayName(inventoryItemId, item),
                    placeholder.transform,
                    1.1f * GetModelScaleMultiplier("pet", item.asset_key),
                    new Color(1f, 0.9f, 0.72f, 1f));
                actor.shadow = CreateWorldShadowBinding(
                    placeholder.transform,
                    groundY,
                    0.68f * GetModelScaleMultiplier("pet", item.asset_key),
                    0.38f * GetModelScaleMultiplier("pet", item.asset_key));
                petActors.Add(actor);
                StartModelLoad(
                    placeholder,
                    item.asset_key,
                    new Vector3(spawn.x, groundY, spawn.y),
                    Vector3.zero,
                    Vector3.one * GetModelScaleMultiplier("pet", item.asset_key),
                    null,
                    animation => AttachPetAnimation(actor, animation));
            }
        }

        private static void AttachPetAnimation(
            HabitHeroWorldPetActor actor,
            HabitHeroWorldModelAnimation animation)
        {
            if (actor == null || animation == null) return;
            actor.animation = animation;
            if (actor.label != null) actor.label.target = animation.transform;
            if (actor.shadow != null) actor.shadow.target = animation.transform;
            if (actor.placeholder == null) return;
            Vector3 loadedPosition = animation.transform.position;
            Vector3 placeholderPosition = actor.placeholder.transform.position;
            animation.transform.position = new Vector3(
                placeholderPosition.x,
                loadedPosition.y,
                placeholderPosition.z);
            animation.transform.rotation = actor.placeholder.transform.rotation;
        }

        private void AttachPlayerAnimation(HabitHeroWorldModelAnimation animation)
        {
            playerAnimation = animation;
            if (animation != null && playerShadow != null)
            {
                playerShadow.target = animation.transform;
            }
        }

        private void UpdatePetActors(float deltaSeconds)
        {
            if (player == null || activeSceneProfile == null) return;
            Vector2 playerPosition = new Vector2(
                player.transform.position.x,
                player.transform.position.z);
            foreach (HabitHeroWorldPetActor actor in petActors)
            {
                if (actor == null) continue;
                Transform visualRoot = actor.VisualRoot;
                if (visualRoot == null) continue;

                Vector2 current = new Vector2(
                    visualRoot.position.x,
                    visualRoot.position.z);
                HabitHeroPetMotionStep step;
                if (actor.followIndex >= 0)
                {
                    HabitHeroWorldPetActor leader = actor.followIndex == 0
                        ? null
                        : FindPetActorByFollowIndex(actor.followIndex - 1);
                    Vector2 leaderPosition = leader == null || leader.VisualRoot == null
                        ? playerPosition
                        : new Vector2(
                            leader.VisualRoot.position.x,
                            leader.VisualRoot.position.z);
                    float leaderRadius = leader == null ? 0.35f : leader.radius;
                    step = HabitHeroPetMotion.GetFollowingStep(
                        current,
                        leaderPosition,
                        actor.followIndex,
                        actor.radius,
                        leaderRadius,
                        deltaSeconds,
                        worldCollisionProxies,
                        activeSceneProfile.MovementBoundary);
                }
                else if (actor.behaviorMode == "wander")
                {
                    step = HabitHeroPetMotion.GetWanderStep(
                        current,
                        deltaSeconds,
                        actor.radius,
                        HabitHeroPetMotion.WanderSpeed,
                        worldCollisionProxies,
                        activeSceneProfile.MovementBoundary,
                        actor.motionState);
                }
                else
                {
                    step = new HabitHeroPetMotionStep
                    {
                        Position = current,
                        Facing = actor.motionState == null
                            ? Vector2.up
                            : actor.motionState.Facing,
                        Moving = false,
                        Blocked = false,
                    };
                }

                if (actor.roamBounds != null && actor.behaviorMode == "wander")
                {
                    Vector2 boundedPosition = HabitHeroPetMotion.ClampToBounds(
                        step.Position,
                        actor.roamBounds.minX,
                        actor.roamBounds.maxX,
                        actor.roamBounds.minZ,
                        actor.roamBounds.maxZ);
                    if (Vector2.Distance(step.Position, boundedPosition) > 0.0001f)
                    {
                        step.Position = boundedPosition;
                        step.Moving = false;
                        step.Blocked = true;
                        actor.motionState.Facing = new Vector2(
                            -actor.motionState.Facing.x,
                            -actor.motionState.Facing.y);
                        actor.motionState.NextTurnAt = actor.motionState.Clock;
                    }
                }

                visualRoot.position = new Vector3(
                    step.Position.x,
                    visualRoot.position.y,
                    step.Position.y);
                if (actor.animation != null)
                {
                    actor.animation.FaceDirection(step.Facing);
                    actor.animation.SetMoving(step.Moving);
                }
                else if (step.Moving)
                {
                    visualRoot.eulerAngles = new Vector3(
                        visualRoot.eulerAngles.x,
                        Mathf.Atan2(step.Facing.x, step.Facing.y) * Mathf.Rad2Deg,
                        visualRoot.eulerAngles.z);
                }
            }
        }

        private HabitHeroWorldPetActor FindPetActorByFollowIndex(int followIndex)
        {
            foreach (HabitHeroWorldPetActor actor in petActors)
            {
                if (actor != null && actor.followIndex == followIndex) return actor;
            }

            return null;
        }

        private bool HasPetActor(string inventoryItemId)
        {
            foreach (HabitHeroWorldPetActor actor in petActors)
            {
                if (actor != null && actor.inventoryItemId == inventoryItemId) return true;
            }

            return false;
        }

        private int GetPetFollowingIndex(string inventoryItemId)
        {
            string[] followingIds = GetFollowingPetInventoryIds();
            for (int index = 0; index < followingIds.Length; index += 1)
            {
                if (followingIds[index] == inventoryItemId) return index;
            }

            return -1;
        }

        private string[] GetFollowingPetInventoryIds()
        {
            if (latestGameData == null || latestGameData.loadout == null)
            {
                return new string[0];
            }

            List<string> result = new List<string>();
            foreach (string inventoryItemId in
                latestGameData.loadout.following_pet_inventory_ids
                    ?? new string[0])
            {
                if (string.IsNullOrWhiteSpace(inventoryItemId)
                    || result.Contains(inventoryItemId)) continue;
                result.Add(inventoryItemId);
            }

            string legacyId = latestGameData.loadout.following_pet_inventory_id;
            if (!string.IsNullOrWhiteSpace(legacyId) && !result.Contains(legacyId))
            {
                result.Add(legacyId);
            }

            return result.ToArray();
        }

        private SupabaseChildInventoryItemRecord FindInventoryItem(
            string inventoryItemId)
        {
            foreach (SupabaseChildInventoryItemRecord inventory in
                latestGameData == null
                    ? new SupabaseChildInventoryItemRecord[0]
                    : latestGameData.inventory ?? new SupabaseChildInventoryItemRecord[0])
            {
                if (inventory != null && inventory.id == inventoryItemId) return inventory;
            }

            return null;
        }

        private SupabaseChildWorldEntityRecord FindActiveDecoration(
            string inventoryItemId)
        {
            foreach (SupabaseChildWorldEntityRecord entity in
                latestGameData == null
                    ? new SupabaseChildWorldEntityRecord[0]
                    : latestGameData.worldEntities ?? new SupabaseChildWorldEntityRecord[0])
            {
                if (entity != null
                    && entity.is_active
                    && entity.entity_kind == "decoration"
                    && entity.inventory_item_id == inventoryItemId)
                {
                    return entity;
                }
            }

            return null;
        }

        private void RefreshPlacementPreview()
        {
            if (placementPreview != null)
            {
                UnityEngine.Object.Destroy(placementPreview);
                placementPreview = null;
            }

            if (placementItem == null || worldRoot == null) return;
            placementPreview = CreateWorldEntityPlaceholder(
                "WorldPlacementPreview",
                "decoration",
                placementItem.asset_key,
                placementDraft.X,
                0f,
                placementDraft.Z,
                0f,
                placementDraft.RotationY,
                0f,
                placementDraft.Scale,
                false);
            Renderer renderer = placementPreview.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.sharedMaterial.color = new Color(0.35f, 0.9f, 0.78f, 0.72f);
            }
        }

        private void ClearPlacementState()
        {
            if (placementPreview != null)
            {
                UnityEngine.Object.Destroy(placementPreview);
                placementPreview = null;
            }

            placementInventoryItemId = null;
            placementItem = null;
            placementEntity = null;
            placementCollisionRadius = 0f;
            placementDraft = new HabitHeroWorldPlacementDraft();
        }

        private async void ConfirmDecorationPlacementAsync(Button button)
        {
            if (placementItem == null || string.IsNullOrWhiteSpace(placementInventoryItemId))
            {
                SetStatus("請先選擇要編輯的裝飾。", true);
                return;
            }

            bool isUpdate = placementEntity != null;
            if (isUpdate && updateWorldEntity == null)
            {
                SetStatus("裝飾更新服務尚未連線。", true);
                return;
            }
            if (!isUpdate && placeWorldEntity == null)
            {
                SetStatus("裝飾放置服務尚未連線。", true);
                return;
            }

            if (button != null) button.interactable = false;
            try
            {
                SupabaseFriendWorldTransform transform = HabitHeroWorldPlacement.ToTransform(
                    placementDraft);
                SupabaseChildGameData refreshed;
                if (isUpdate)
                {
                    refreshed = await updateWorldEntity(
                        placementInventoryItemId,
                        placementEntity.id,
                        latestGameData.worldRevision,
                        transform);
                }
                else
                {
                    refreshed = await placeWorldEntity(
                        placementInventoryItemId,
                        latestGameData.worldRevision,
                        transform,
                        "static",
                        null);
                }

                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新遊戲資料。");
                }

                if (latestGameData != refreshed && scenePanel != null)
                {
                    ApplyGameData(refreshed);
                }
                ClearPlacementState();
                if (scenePanel != null)
                {
                    SetStatus(isUpdate ? "裝飾位置已儲存。" : "裝飾已放入我的世界。", false);
                }
            }
            catch (Exception exception)
            {
                SetStatus("裝飾儲存失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void RemoveDecorationAsync(
            string inventoryItemId,
            SupabaseChildWorldEntityRecord entity,
            Button button)
        {
            if (removeWorldEntity == null || entity == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在把裝飾收回背包…", false);
            try
            {
                SupabaseChildGameData refreshed = await removeWorldEntity(
                    inventoryItemId,
                    entity.id,
                    latestGameData.worldRevision);
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新遊戲資料。");
                }

                if (latestGameData != refreshed && scenePanel != null)
                {
                    ApplyGameData(refreshed);
                }
                if (scenePanel != null)
                {
                    SetStatus("裝飾已收回背包。", false);
                }
            }
            catch (Exception exception)
            {
                SetStatus("裝飾收回失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private string GetPetDisplayName(
            string inventoryItemId,
            SupabaseGameCatalogItemRecord item)
        {
            SupabaseChildInventoryItemRecord inventory = FindInventoryItem(inventoryItemId);
            if (inventory != null && !string.IsNullOrWhiteSpace(inventory.display_name))
            {
                return inventory.display_name.Trim();
            }

            if (item != null && !string.IsNullOrWhiteSpace(item.name))
            {
                return item.name.Trim();
            }

            return "寵物";
        }

        private static float GetPetRadius(
            SupabaseGameCatalogItemRecord item,
            float scale)
        {
            float radius = item == null || item.collision_radius <= 0f
                ? 0.28f
                : item.collision_radius;
            float effectiveScale = Mathf.Clamp(
                scale <= 0f ? 1f : scale,
                0.25f,
                3f);
            return Mathf.Max(0.12f, radius * effectiveScale);
        }

        private HabitHeroWorldLabelBinding CreateWorldLabelBinding(
            string text,
            Transform target,
            float height,
            Color color)
        {
            if (string.IsNullOrWhiteSpace(text) || target == null || worldRoot == null)
            {
                return null;
            }

            GameObject labelObject = new GameObject("WorldLabel", typeof(TextMesh));
            labelObject.transform.SetParent(worldRoot.transform, false);
            TextMesh label = labelObject.GetComponent<TextMesh>();
            label.text = text.Trim();
            label.font = font;
            label.fontSize = 48;
            label.characterSize = 0.04f;
            label.anchor = TextAnchor.MiddleCenter;
            label.alignment = TextAlignment.Center;
            label.color = color;
            label.richText = false;

            HabitHeroWorldLabelBinding binding = new HabitHeroWorldLabelBinding
            {
                labelObject = labelObject,
                target = target,
                offset = Vector3.up * Mathf.Max(0.35f, height),
            };
            worldLabelBindings.Add(binding);
            binding.Update(worldCamera);
            return binding;
        }

        private void UpdateWorldLabels()
        {
            foreach (HabitHeroWorldLabelBinding binding in worldLabelBindings)
            {
                if (binding != null) binding.Update(worldCamera);
            }
        }

        private void UpdateWorldShadows()
        {
            if (playerShadow != null) playerShadow.Update();
            foreach (HabitHeroWorldShadowBinding binding in worldShadowBindings)
            {
                if (binding != null) binding.Update();
            }
        }

        private HabitHeroWorldShadowBinding CreateWorldShadowBinding(
            Transform target,
            float groundY,
            float width,
            float depth)
        {
            if (target == null || worldRoot == null) return null;
            EnsureWorldShadowMaterial();
            if (worldShadowMaterial == null) return null;

            GameObject shadowObject = GameObject.CreatePrimitive(PrimitiveType.Quad);
            shadowObject.name = "WorldGroundShadow";
            shadowObject.transform.SetParent(worldRoot.transform, false);
            shadowObject.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            shadowObject.transform.localScale = new Vector3(
                Mathf.Max(0.1f, width),
                Mathf.Max(0.06f, depth),
                1f);
            Renderer renderer = shadowObject.GetComponent<Renderer>();
            if (renderer != null) renderer.sharedMaterial = worldShadowMaterial;
            Collider collider = shadowObject.GetComponent<Collider>();
            if (collider != null) UnityEngine.Object.Destroy(collider);

            HabitHeroWorldShadowBinding binding = new HabitHeroWorldShadowBinding
            {
                shadowObject = shadowObject,
                target = target,
                groundY = groundY,
            };
            worldShadowBindings.Add(binding);
            binding.Update();
            return binding;
        }

        private void EnsureWorldShadowMaterial()
        {
            if (worldShadowMaterial != null) return;

            Shader shader = Shader.Find("Sprites/Default")
                ?? Shader.Find("Unlit/Transparent")
                ?? Shader.Find("UI/Default")
                ?? Shader.Find("Unlit/Color");
            if (shader == null) return;

            worldShadowMaterial = new Material(shader);
            worldShadowMaterial.color = new Color(0.02f, 0.04f, 0.08f, 0.42f);
            Texture2D texture = CreateWorldShadowTexture();
            if (texture != null && worldShadowMaterial.HasProperty("_MainTex"))
            {
                worldShadowMaterial.mainTexture = texture;
            }
            runtimeMaterials.Add(worldShadowMaterial);
        }

        private Texture2D CreateWorldShadowTexture()
        {
            const int size = 32;
            Texture2D texture = new Texture2D(
                size,
                size,
                TextureFormat.RGBA32,
                false,
                true);
            Color[] pixels = new Color[size * size];
            for (int y = 0; y < size; y += 1)
            {
                for (int x = 0; x < size; x += 1)
                {
                    float normalizedX = (x + 0.5f) / size * 2f - 1f;
                    float normalizedY = (y + 0.5f) / size * 2f - 1f;
                    float distance = normalizedX * normalizedX
                        + normalizedY * normalizedY;
                    float alpha = Mathf.Clamp01(1f - distance);
                    alpha *= alpha;
                    pixels[y * size + x] = new Color(1f, 1f, 1f, alpha);
                }
            }

            texture.SetPixels(pixels);
            texture.wrapMode = TextureWrapMode.Clamp;
            texture.filterMode = FilterMode.Bilinear;
            texture.Apply(false, true);
            runtimeTextures.Add(texture);
            return texture;
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

        private void CreateWorldAtmosphere(float movementBoundary)
        {
            GameObject sunObject = new GameObject("WorldSun");
            sunObject.transform.SetParent(worldRoot.transform, false);
            worldSun = sunObject.AddComponent<Light>();
            worldSun.type = LightType.Directional;
            worldSun.shadows = LightShadows.None;
            worldSun.transform.localRotation = Quaternion.Euler(42f, -32f, 0f);

            GameObject fillObject = new GameObject("WorldFill");
            fillObject.transform.SetParent(worldRoot.transform, false);
            worldFill = fillObject.AddComponent<Light>();
            worldFill.type = LightType.Directional;
            worldFill.shadows = LightShadows.None;
            worldFill.transform.localRotation = Quaternion.Euler(58f, 148f, 0f);

            GameObject rainObject = new GameObject("WorldRain");
            rainObject.transform.SetParent(worldRoot.transform, false);
            rainParticles = rainObject.AddComponent<ParticleSystem>();
            ParticleSystem.MainModule main = rainParticles.main;
            main.loop = true;
            main.playOnAwake = true;
            main.startLifetime = 1.15f;
            main.startSpeed = 8f;
            main.startSize = 0.035f;
            main.startColor = new Color(0.72f, 0.88f, 1f, 0.68f);
            main.maxParticles = 700;
            ParticleSystem.EmissionModule emission = rainParticles.emission;
            emission.enabled = true;
            emission.rateOverTime = 0f;
            ParticleSystem.ShapeModule shape = rainParticles.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(
                movementBoundary * 2f,
                0.1f,
                movementBoundary * 2f);
            shape.position = new Vector3(0f, 8f, 0f);
            ParticleSystemRenderer renderer = rainObject.GetComponent<ParticleSystemRenderer>();
            if (renderer != null)
            {
                renderer.renderMode = ParticleSystemRenderMode.Stretch;
                renderer.lengthScale = 0.75f;
                renderer.velocityScale = 0.25f;
                Material material = CreateMaterial(new Color(0.72f, 0.88f, 1f, 0.68f));
                renderer.sharedMaterial = material;
                runtimeMaterials.Add(material);
            }

            UpdateWorldAtmosphere(true);
        }

        private void UpdateWorldAtmosphere(bool force)
        {
            if (worldSun == null || worldFill == null || worldCamera == null) return;
            if (!force && atmosphereRefreshTimer > 0f) return;
            atmosphereRefreshTimer = 0.5f;

            DateTime taipeiNow = GetTaipeiNow();
            HabitHeroWorldTimePhase phase = HabitHeroWorldWeather.GetTimePhase(
                taipeiNow.Hour,
                taipeiNow.Minute);
            SupabaseWorldWeatherRecord weather = HabitHeroWorldWeather.Normalize(
                latestData == null ? null : latestData.weather);
            HabitHeroWorldWeatherCondition condition =
                HabitHeroWorldWeather.ParseCondition(weather.condition);
            float weatherFactor = HabitHeroWorldWeather.GetWeatherLightFactor(condition);

            float sunIntensity;
            float fillIntensity;
            Color sunColor;
            switch (phase)
            {
                case HabitHeroWorldTimePhase.Dawn:
                    sunIntensity = 1.9f;
                    fillIntensity = 0.62f;
                    sunColor = new Color(1f, 0.74f, 0.55f, 1f);
                    break;
                case HabitHeroWorldTimePhase.Dusk:
                    sunIntensity = 1.62f;
                    fillIntensity = 0.5f;
                    sunColor = new Color(1f, 0.59f, 0.53f, 1f);
                    break;
                case HabitHeroWorldTimePhase.Night:
                    sunIntensity = 0.22f;
                    fillIntensity = 0.18f;
                    sunColor = new Color(0.56f, 0.67f, 0.86f, 1f);
                    break;
                default:
                    sunIntensity = 2.85f;
                    fillIntensity = 0.86f;
                    sunColor = new Color(1f, 0.84f, 0.67f, 1f);
                    break;
            }

            worldSun.intensity = sunIntensity * weatherFactor;
            worldSun.color = sunColor;
            worldFill.intensity = fillIntensity * weatherFactor;
            worldFill.color = phase == HabitHeroWorldTimePhase.Night
                ? new Color(0.45f, 0.58f, 0.86f, 1f)
                : new Color(0.72f, 0.84f, 1f, 1f);

            float rainRate = HabitHeroWorldWeather.GetRainRate(condition) * 300f;
            if (rainRate > 0f)
            {
                rainRate *= Mathf.Clamp(weather.intensity, 0.25f, 1f);
            }

            if (rainParticles != null)
            {
                ParticleSystem.EmissionModule emission = rainParticles.emission;
                emission.rateOverTime = new ParticleSystem.MinMaxCurve(rainRate);
                if (rainRate > 0f)
                {
                    if (!rainParticles.isPlaying) rainParticles.Play();
                }
                else if (rainParticles.isPlaying)
                {
                    rainParticles.Stop(
                        true,
                        ParticleSystemStopBehavior.StopEmittingAndClear);
                }
            }

            Color baseColor = GetSceneColor(sceneId);
            if (phase == HabitHeroWorldTimePhase.Night)
            {
                baseColor = Color.Lerp(
                    baseColor,
                    new Color(0.03f, 0.05f, 0.13f, 1f),
                    0.68f);
            }
            else if (condition == HabitHeroWorldWeatherCondition.Cloudy
                || condition == HabitHeroWorldWeatherCondition.Storm)
            {
                baseColor = Color.Lerp(
                    baseColor,
                    new Color(0.48f, 0.56f, 0.66f, 1f),
                    0.18f);
            }

            worldCamera.backgroundColor = baseColor;
        }

        private static DateTime GetTaipeiNow()
        {
            try
            {
                TimeZoneInfo zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Taipei");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone);
            }
            catch (TimeZoneNotFoundException)
            {
                try
                {
                    TimeZoneInfo zone = TimeZoneInfo.FindSystemTimeZoneById(
                        "Taipei Standard Time");
                    return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone);
                }
                catch (TimeZoneNotFoundException)
                {
                    return DateTime.Now;
                }
            }
            catch (InvalidTimeZoneException)
            {
                return DateTime.Now;
            }
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
            float visualScale,
            Action<HabitHeroWorldModelAnimation> onAnimationLoaded = null)
        {
            StartModelLoadInternal(
                placeholder,
                assetKey,
                groundPosition,
                eulerAngles,
                Vector3.one * Mathf.Clamp(visualScale, 0.05f, 8f),
                null,
                onAnimationLoaded);
        }

        private void StartModelLoad(
            GameObject placeholder,
            string assetKey,
            Vector3 groundPosition,
            Vector3 eulerAngles,
            Vector3 visualScale,
            Action<Bounds> onModelLoaded = null,
            Action<HabitHeroWorldModelAnimation> onAnimationLoaded = null)
        {
            StartModelLoadInternal(
                placeholder,
                assetKey,
                groundPosition,
                eulerAngles,
                ClampAuthoredModuleScale(visualScale),
                onModelLoaded,
                onAnimationLoaded);
        }

        private void StartModelLoadInternal(
            GameObject placeholder,
            string assetKey,
            Vector3 groundPosition,
            Vector3 eulerAngles,
            Vector3 visualScale,
            Action<Bounds> onModelLoaded = null,
            Action<HabitHeroWorldModelAnimation> onAnimationLoaded = null)
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
                modelLoadingCancellation.Token,
                onModelLoaded,
                onAnimationLoaded);
        }

        private async Task LoadModelAsync(
            GameObject placeholder,
            string modelUrl,
            Vector3 groundPosition,
            Vector3 eulerAngles,
            Vector3 visualScale,
            GameObject expectedWorldRoot,
            CancellationToken cancellationToken,
            Action<Bounds> onModelLoaded,
            Action<HabitHeroWorldModelAnimation> onAnimationLoaded)
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
                HabitHeroWorldModelAnimation modelAnimation =
                    HabitHeroWorldModelAnimation.Attach(modelRoot, modelContent);
                if (onAnimationLoaded != null) onAnimationLoaded(modelAnimation);
                if (onModelLoaded != null
                    && TryGetRendererBounds(modelContent, out Bounds loadedBounds))
                {
                    onModelLoaded(loadedBounds);
                }
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

            GameObject cameraGestureSurface = new GameObject(
                "WorldCameraGestureSurface",
                typeof(RectTransform),
                typeof(Image),
                typeof(HabitHeroWorldCameraInput));
            cameraGestureSurface.transform.SetParent(scenePanel.transform, false);
            Image gestureImage = cameraGestureSurface.GetComponent<Image>();
            gestureImage.color = new Color(0f, 0f, 0f, 0f);
            gestureImage.raycastTarget = true;
            cameraGestureRect = cameraGestureSurface.GetComponent<RectTransform>();
            cameraGestureRect.anchorMin = Vector2.zero;
            cameraGestureRect.anchorMax = Vector2.one;
            cameraGestureRect.offsetMin = Vector2.zero;
            cameraGestureRect.offsetMax = Vector2.zero;
            cameraInput = cameraGestureSurface.GetComponent<HabitHeroWorldCameraInput>();
            cameraInput.Dragged += ApplyCameraDrag;
            cameraInput.Zoomed += ApplyCameraZoom;
            cameraInput.Tapped += HandleWorldTap;

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
                new Vector2(0.64f, 0.96f));
            HabitHeroUiFactory.CreateText(
                hud.transform,
                font,
                "背景音樂",
                13,
                TextAnchor.MiddleRight,
                Color.white,
                new Vector2(0.64f, 0.58f),
                new Vector2(0.81f, 0.96f));
            worldMusicToggle = HabitHeroUiFactory.CreateSwitch(
                hud.transform,
                new Vector2(0.83f, 0.62f),
                new Vector2(0.96f, 0.92f));
            worldMusicToggle.isOn = HabitHeroWorldBackgroundMusic.GetEnabled(
                GetChildProfileId());
            worldMusicToggle.onValueChanged.AddListener(SetWorldMusicEnabled);
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
            CreateDecorationEditor();

            GameObject controls = HabitHeroUiFactory.CreatePanel(
                scenePanel.transform,
                new Color(0.03f, 0.05f, 0.08f, 0.86f),
                "WorldMovementControls");
            RectTransform controlsRect = controls.GetComponent<RectTransform>();
            controlsRect.anchorMin = new Vector2(0.69f, 0.04f);
            controlsRect.anchorMax = new Vector2(0.96f, 0.32f);
            controlsRect.offsetMin = Vector2.zero;
            controlsRect.offsetMax = Vector2.zero;
            CreateMovementJoystick(controls.transform);

            GameObject cameraControls = HabitHeroUiFactory.CreatePanel(
                scenePanel.transform,
                new Color(0.03f, 0.05f, 0.08f, 0.86f),
                "WorldCameraControls");
            RectTransform cameraControlsRect = cameraControls.GetComponent<RectTransform>();
            cameraControlsRect.anchorMin = new Vector2(0.69f, 0.34f);
            cameraControlsRect.anchorMax = new Vector2(0.96f, 0.51f);
            cameraControlsRect.offsetMin = Vector2.zero;
            cameraControlsRect.offsetMax = Vector2.zero;
            CreateCameraButton(
                cameraControls.transform,
                "放大",
                new Vector2(0.02f, 0.14f),
                new Vector2(0.31f, 0.86f),
                () => ApplyCameraZoom(50f));
            CreateCameraButton(
                cameraControls.transform,
                "縮小",
                new Vector2(0.345f, 0.14f),
                new Vector2(0.655f, 0.86f),
                () => ApplyCameraZoom(-50f));
            CreateCameraButton(
                cameraControls.transform,
                "重設",
                new Vector2(0.69f, 0.14f),
                new Vector2(0.98f, 0.86f),
                ResetCamera);

            sceneStatus = HabitHeroUiFactory.CreateText(
                scenePanel.transform,
                font,
                "拖曳搖桿可移動孩子角色；可從左側與 NPC 對話。",
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

        private void CreateDecorationEditor()
        {
            decorationEditor = HabitHeroUiFactory.CreatePanel(
                scenePanel.transform,
                new Color(0.03f, 0.05f, 0.08f, 0.9f),
                "WorldDecorationEditor");
            RectTransform editorRect = decorationEditor.GetComponent<RectTransform>();
            editorRect.anchorMin = new Vector2(0.04f, 0.34f);
            editorRect.anchorMax = new Vector2(0.64f, 0.52f);
            editorRect.offsetMin = Vector2.zero;
            editorRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                decorationEditor.transform,
                font,
                "世界裝飾編輯",
                14,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.02f, 0.8f),
                new Vector2(0.98f, 0.98f));
            GameObject list = CreateList(
                decorationEditor.transform,
                "WorldDecorationEditorList",
                new Vector2(0.02f, 0.28f),
                new Vector2(0.98f, 0.8f));
            RenderDecorationEntries(list.transform);

            CreatePlacementControlButton(
                decorationEditor.transform,
                "左轉",
                HabitHeroWorldPlacementControl.RotateLeft,
                new Vector2(0.02f, 0.03f),
                new Vector2(0.16f, 0.24f));
            CreatePlacementControlButton(
                decorationEditor.transform,
                "右轉",
                HabitHeroWorldPlacementControl.RotateRight,
                new Vector2(0.18f, 0.03f),
                new Vector2(0.32f, 0.24f));
            CreatePlacementControlButton(
                decorationEditor.transform,
                "縮小",
                HabitHeroWorldPlacementControl.ScaleDown,
                new Vector2(0.34f, 0.03f),
                new Vector2(0.48f, 0.24f));
            CreatePlacementControlButton(
                decorationEditor.transform,
                "放大",
                HabitHeroWorldPlacementControl.ScaleUp,
                new Vector2(0.5f, 0.03f),
                new Vector2(0.64f, 0.24f));
            Button saveButton = HabitHeroUiFactory.CreateButton(
                decorationEditor.transform,
                font,
                "儲存",
                new Vector2(0.66f, 0.03f),
                new Vector2(0.8f, 0.24f));
            saveButton.interactable = placeWorldEntity != null || updateWorldEntity != null;
            saveButton.onClick.AddListener(() => ConfirmDecorationPlacementAsync(saveButton));
            Button cancelButton = HabitHeroUiFactory.CreateButton(
                decorationEditor.transform,
                font,
                "取消",
                new Vector2(0.82f, 0.03f),
                new Vector2(0.98f, 0.24f));
            cancelButton.onClick.AddListener(CancelDecorationPlacement);
        }

        private void RenderDecorationEntries(Transform parent)
        {
            int visibleCount = 0;
            if (latestGameData != null)
            {
                foreach (SupabaseChildInventoryItemRecord inventory in
                    latestGameData.inventory ?? new SupabaseChildInventoryItemRecord[0])
                {
                    if (inventory == null || inventory.quantity <= 0) continue;
                    SupabaseGameCatalogItemRecord item = FindCatalogItemForInventory(inventory.id);
                    if (item == null || item.item_type != "decoration") continue;

                    string inventoryId = inventory.id;
                    SupabaseChildWorldEntityRecord entity = FindActiveDecoration(inventoryId);
                    GameObject row = new GameObject(
                        "WorldDecorationEntry_" + inventoryId,
                        typeof(RectTransform),
                        typeof(HorizontalLayoutGroup));
                    row.transform.SetParent(parent, false);
                    row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 30f);
                    HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
                    layout.spacing = 3f;
                    layout.childControlWidth = true;
                    layout.childControlHeight = true;
                    layout.childForceExpandWidth = false;
                    layout.childForceExpandHeight = true;
                    Text label = HabitHeroUiFactory.CreateText(
                        row.transform,
                        font,
                        item.name + (entity == null ? "　未放置" : "　已放置"),
                        12,
                        TextAnchor.MiddleLeft,
                        Color.white,
                        Vector2.zero,
                        Vector2.one);
                    LayoutElement labelLayout = label.gameObject.AddComponent<LayoutElement>();
                    labelLayout.flexibleWidth = 1f;

                    Button editButton = HabitHeroUiFactory.CreateButton(
                        row.transform,
                        font,
                        entity == null ? "放置" : "編輯",
                        Vector2.zero,
                        Vector2.one);
                    LayoutElement editLayout = editButton.gameObject.AddComponent<LayoutElement>();
                    editLayout.preferredWidth = 60f;
                    editLayout.minWidth = 60f;
                    editButton.onClick.AddListener(() => BeginDecorationPlacement(inventoryId));

                    if (entity != null)
                    {
                        Button removeButton = HabitHeroUiFactory.CreateButton(
                            row.transform,
                            font,
                            "收回",
                            Vector2.zero,
                            Vector2.one);
                        LayoutElement removeLayout = removeButton.gameObject.AddComponent<LayoutElement>();
                        removeLayout.preferredWidth = 60f;
                        removeLayout.minWidth = 60f;
                        removeButton.interactable = removeWorldEntity != null;
                        removeButton.onClick.AddListener(() => RemoveDecorationAsync(
                            inventoryId,
                            entity,
                            removeButton));
                    }

                    visibleCount += 1;
                    if (visibleCount >= 4) break;
                }
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    parent,
                    font,
                    "背包中沒有可編輯的裝飾。",
                    12,
                    TextAnchor.MiddleLeft,
                    new Color(0.75f, 0.8f, 0.88f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void CreatePlacementControlButton(
            Transform parent,
            string label,
            HabitHeroWorldPlacementControl control,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                anchorMin,
                anchorMax);
            button.onClick.AddListener(() => ApplyPlacementControl(control));
        }

        private void CreateMovementJoystick(Transform parent)
        {
            worldJoystick = HabitHeroWorldJoystickInput.Create(
                parent,
                new Color(0.12f, 0.2f, 0.3f, 0.78f),
                HabitHeroUiFactory.AccentColor);
            worldJoystick.Changed += HandleWorldJoystickChanged;
        }

        private void HandleWorldJoystickChanged(Vector2 direction)
        {
            joystickDirection = direction;
            if (direction.sqrMagnitude <= 0.0001f && playerAnimation != null)
            {
                playerAnimation.SetMoving(false);
            }
        }

        private void CreateCameraButton(
            Transform parent,
            string label,
            Vector2 anchorMin,
            Vector2 anchorMax,
            Action action)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                anchorMin,
                anchorMax);
            button.onClick.AddListener(() => action());
        }

        private void MovePlayer(Vector2 direction)
        {
            MovePlayer(direction, 0.8f, true);
        }

        private void UpdatePlayerFromJoystick(float deltaSeconds)
        {
            if (joystickDirection.sqrMagnitude <= 0.0001f) return;
            MovePlayer(joystickDirection, Mathf.Max(0f, deltaSeconds) * 3.2f, false);
        }

        private void MovePlayer(
            Vector2 direction,
            float distance,
            bool updateStatus)
        {
            if (player == null) return;
            Vector3 position = player.transform.position;
            Vector2 previousPosition = new Vector2(position.x, position.z);
            float movementBoundary = activeSceneProfile == null
                ? 8f
                : activeSceneProfile.MovementBoundary;
            Vector2 next = HabitHeroWorldCollision.MoveCharacter(
                new Vector2(position.x, position.z),
                new Vector2(
                    position.x + direction.x * distance,
                    position.z + direction.y * distance),
                0.35f,
                worldCollisionProxies,
                movementBoundary);
            position.x = next.x;
            position.z = next.y;
            player.transform.position = position;
            if (playerAnimation != null)
            {
                playerAnimation.transform.position = position;
            }
            bool moved = Vector2.Distance(previousPosition, next) > 0.0001f;
            if (playerAnimation != null)
            {
                if (moved) playerAnimation.FaceDirection(direction);
                playerAnimation.SetMoving(moved);
            }
            UpdateWorldCamera();
            if (updateStatus)
            {
                SetStatus(
                    "孩子角色已移動到 "
                        + position.x.ToString("0.0")
                        + ", "
                        + position.z.ToString("0.0")
                        + "。",
                    false);
            }
        }

        private void UpdateWorldCamera()
        {
            if (worldCamera == null || player == null || worldCameraState == null) return;
            Vector3 target = player.transform.position;
            target.y = player.transform.position.y - 1f + worldCameraState.GetTargetHeight();
            Vector3 cameraPosition = target + HabitHeroWorldCameraMath.GetOffset(
                worldCameraState.Yaw,
                worldCameraState.Pitch,
                worldCameraState.Distance);
            worldCamera.transform.position = cameraPosition;
            worldCamera.transform.LookAt(target);
        }

        private void ApplyCameraDrag(Vector2 delta)
        {
            if (worldCameraState == null) return;
            worldCameraState.ApplyDrag(delta);
            UpdateWorldCamera();
        }

        private void HandleWorldTap(Vector2 screenPosition)
        {
            if (placementItem == null
                || worldCamera == null
                || cameraGestureRect == null)
            {
                return;
            }

            Vector2 localPoint;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
                cameraGestureRect,
                screenPosition,
                null,
                out localPoint))
            {
                return;
            }

            Rect rect = cameraGestureRect.rect;
            if (rect.width <= 0f || rect.height <= 0f) return;
            Vector2 viewport = new Vector2(
                Mathf.InverseLerp(rect.xMin, rect.xMax, localPoint.x),
                Mathf.InverseLerp(rect.yMin, rect.yMax, localPoint.y));
            Ray ray = worldCamera.ViewportPointToRay(
                new Vector3(viewport.x, viewport.y, 0f));
            Vector2 position;
            float groundY = activeSceneProfile == null
                ? 0f
                : activeSceneProfile.SpawnPosition.y;
            if (!HabitHeroWorldPlacement.TryGetGroundPosition(ray, groundY, out position))
            {
                return;
            }

            placementDraft.X = position.x;
            placementDraft.Z = position.y;
            placementDraft = HabitHeroWorldPlacement.ClampToWorld(
                placementDraft,
                placementCollisionRadius,
                activeSceneProfile == null ? 8f : activeSceneProfile.MovementBoundary);
            RefreshPlacementPreview();
            SetStatus(
                "裝飾預覽已移動到 "
                    + placementDraft.X.ToString("0.0")
                    + ", "
                    + placementDraft.Z.ToString("0.0")
                    + "。",
                false);
        }

        private void ApplyCameraZoom(float zoomDelta)
        {
            if (worldCameraState == null) return;
            worldCameraState.ApplyZoomDelta(zoomDelta);
            UpdateWorldCamera();
        }

        private void ResetCamera()
        {
            if (worldCameraState == null) return;
            worldCameraState.Reset();
            UpdateWorldCamera();
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

            StopWorldBackgroundMusic();
            ClearPlacementState();

            if (cameraInput != null)
            {
                cameraInput.Dragged -= ApplyCameraDrag;
                cameraInput.Zoomed -= ApplyCameraZoom;
                cameraInput.Tapped -= HandleWorldTap;
            }
            cameraInput = null;
            cameraGestureRect = null;

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

            decorationEditor = null;

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
            foreach (Texture2D texture in runtimeTextures)
            {
                if (texture != null) UnityEngine.Object.Destroy(texture);
            }

            runtimeTextures.Clear();
            worldShadowMaterial = null;
            worldCamera = null;
            worldCameraState = null;
            worldSun = null;
            worldFill = null;
            rainParticles = null;
            worldMusicToggle = null;
            atmosphereRefreshTimer = 0f;
            player = null;
            playerAnimation = null;
            if (worldJoystick != null)
            {
                worldJoystick.Changed -= HandleWorldJoystickChanged;
            }
            worldJoystick = null;
            joystickDirection = Vector2.zero;
            petActors.Clear();
            worldLabelBindings.Clear();
            worldShadowBindings.Clear();
            playerShadow = null;
            worldCollisionProxies = new HabitHeroWorldCollisionProxy[0];
            authoredCollisionProxyIndices.Clear();
            activeSceneProfile = null;
            sceneStatus = null;
            if (notify && onClose != null) onClose();
        }

        private string GetChildProfileId()
        {
            if (latestData != null && !string.IsNullOrWhiteSpace(latestData.childProfileId))
            {
                return latestData.childProfileId;
            }

            return latestGameData == null ? string.Empty : latestGameData.childProfileId;
        }

        private void SetWorldMusicEnabled(bool enabled)
        {
            HabitHeroWorldBackgroundMusic.SetEnabled(GetChildProfileId(), enabled);
            if (enabled)
            {
                StartWorldBackgroundMusic(sceneId);
            }
            else
            {
                StopWorldBackgroundMusic();
            }
        }

        private void StartWorldBackgroundMusic(string targetSceneId)
        {
            if (worldRoot == null
                || !HabitHeroWorldBackgroundMusic.GetEnabled(GetChildProfileId()))
            {
                return;
            }

            string musicUrl = HabitHeroWorldBackgroundMusic.BuildUrl(
                gameAssetBaseUrl,
                targetSceneId);
            if (string.IsNullOrWhiteSpace(musicUrl)) return;

            HabitHeroWorldBackgroundMusicConfig config =
                HabitHeroWorldBackgroundMusic.GetConfig(targetSceneId);
            if (worldMusicAudio == null)
            {
                GameObject audioObject = new GameObject("WorldBackgroundMusic");
                audioObject.transform.SetParent(worldRoot.transform, false);
                worldMusicAudio = audioObject.AddComponent<AudioSource>();
                worldMusicAudio.playOnAwake = false;
                worldMusicAudio.loop = true;
                worldMusicAudio.spatialBlend = 0f;
                worldMusicAudio.volume = config.Volume;
            }

            if (worldMusicCancellation != null)
            {
                worldMusicCancellation.Cancel();
                worldMusicCancellation.Dispose();
            }

            worldMusicCancellation = new CancellationTokenSource();
            AudioSource expectedAudio = worldMusicAudio;
            GameObject expectedWorldRoot = worldRoot;
            _ = LoadWorldBackgroundMusicAsync(
                musicUrl,
                config,
                expectedAudio,
                expectedWorldRoot,
                worldMusicCancellation.Token);
        }

        private async Task LoadWorldBackgroundMusicAsync(
            string musicUrl,
            HabitHeroWorldBackgroundMusicConfig config,
            AudioSource expectedAudio,
            GameObject expectedWorldRoot,
            CancellationToken cancellationToken)
        {
            try
            {
                using (UnityWebRequest webRequest = UnityWebRequestMultimedia.GetAudioClip(
                    musicUrl,
                    AudioType.MPEG))
                {
                    UnityWebRequestAsyncOperation operation = webRequest.SendWebRequest();
                    while (!operation.isDone)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        await Task.Yield();
                    }

                    cancellationToken.ThrowIfCancellationRequested();
                    if (webRequest.result != UnityWebRequest.Result.Success)
                    {
                        Debug.LogWarning(
                            "HabitHero could not load world background music "
                            + musicUrl + ": " + webRequest.error);
                        return;
                    }

                    AudioClip clip = DownloadHandlerAudioClip.GetContent(webRequest);
                    if (clip == null
                        || expectedAudio == null
                        || worldMusicAudio != expectedAudio
                        || worldRoot != expectedWorldRoot
                        || !HabitHeroWorldBackgroundMusic.GetEnabled(GetChildProfileId()))
                    {
                        if (clip != null) UnityEngine.Object.Destroy(clip);
                        return;
                    }

                    if (worldMusicClip != null)
                    {
                        UnityEngine.Object.Destroy(worldMusicClip);
                    }

                    worldMusicClip = clip;
                    expectedAudio.clip = clip;
                    expectedAudio.loop = true;
                    expectedAudio.volume = config.Volume;
                    expectedAudio.Play();
                }
            }
            catch (OperationCanceledException)
            {
                // Toggling music or closing the world cancels the remote audio load.
            }
            catch (Exception exception)
            {
                Debug.LogWarning(
                    "HabitHero world background music failed: " + exception.Message);
            }
        }

        private void StopWorldBackgroundMusic()
        {
            if (worldMusicCancellation != null)
            {
                worldMusicCancellation.Cancel();
                worldMusicCancellation.Dispose();
                worldMusicCancellation = null;
            }

            if (worldMusicAudio != null)
            {
                worldMusicAudio.Stop();
                worldMusicAudio.clip = null;
                UnityEngine.Object.Destroy(worldMusicAudio.gameObject);
            }

            if (worldMusicClip != null)
            {
                UnityEngine.Object.Destroy(worldMusicClip);
                worldMusicClip = null;
            }

            worldMusicAudio = null;
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
