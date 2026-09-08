using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildFriendWorldView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private readonly List<Material> runtimeMaterials = new List<Material>();
        private GameObject panel;
        private GameObject worldRoot;
        private Camera worldCamera;
        private RenderTexture renderTexture;
        private GameObject player;
        private Text statusText;
        private Text liveStatusText;
        private SupabaseChildFriendWorldData latestData;
        private SupabaseChildGameData gameData;
        private Func<string, long, SupabaseFriendWorldTransform, Task<SupabaseChildFriendWorldData>> placeSharedDecoration;
        private Func<string, long, SupabaseFriendWorldTransform, Task<SupabaseChildFriendWorldData>> updateSharedDecoration;
        private Func<string, long, Task<SupabaseChildFriendWorldData>> removeSharedDecoration;
        private Action onClose;
        private readonly Dictionary<string, GameObject> remoteAvatars =
            new Dictionary<string, GameObject>();
        private readonly Dictionary<string, SupabaseFriendWorldAvatarState> remoteAvatarStates =
            new Dictionary<string, SupabaseFriendWorldAvatarState>();
        private readonly Dictionary<string, float> remoteAvatarLastReceivedSeconds =
            new Dictionary<string, float>();
        private SupabaseFriendWorldPresenceMember[] latestPresenceMembers;
        private string localConnectionId;
        private string localChildProfileId;
        private string localCharacterAssetKey;
        private long localAvatarSequence;
        private Action<SupabaseFriendWorldAvatarState> onLocalAvatarStateChanged;
        private float realtimeSeconds;

        public HabitHeroChildFriendWorldView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildFriendWorldData data,
            SupabaseChildGameData gameData,
            Func<string, long, SupabaseFriendWorldTransform, Task<SupabaseChildFriendWorldData>> placeSharedDecoration,
            Func<string, long, SupabaseFriendWorldTransform, Task<SupabaseChildFriendWorldData>> updateSharedDecoration,
            Func<string, long, Task<SupabaseChildFriendWorldData>> removeSharedDecoration,
            Action onClose)
        {
            ClearRealtime();
            CloseInternal(false);
            latestData = data;
            this.gameData = gameData;
            this.placeSharedDecoration = placeSharedDecoration;
            this.updateSharedDecoration = updateSharedDecoration;
            this.removeSharedDecoration = removeSharedDecoration;
            this.onClose = onClose;
        }

        public bool IsOpen
        {
            get { return panel != null && worldRoot != null; }
        }

        public long CurrentRevision
        {
            get { return latestData == null ? 0 : latestData.revision; }
        }

        public void ApplyData(SupabaseChildFriendWorldData data)
        {
            if (data == null) throw new ArgumentNullException("data");
            latestData = data;
            if (!IsOpen) return;

            PruneStaleRemoteAvatarStates();
            CloseInternal(false);
            CreateWorld();
            CreateOverlay();
            ApplyPresence(latestPresenceMembers, localConnectionId);
            foreach (SupabaseFriendWorldAvatarState state in remoteAvatarStates.Values)
            {
                RenderRemoteAvatarState(state);
            }
            PublishLocalAvatarState();
        }

        public void Open()
        {
            if (latestData == null) return;
            PruneStaleRemoteAvatarStates();
            CloseInternal(false);
            CreateWorld();
            CreateOverlay();
            ApplyPresence(latestPresenceMembers, localConnectionId);
            foreach (SupabaseFriendWorldAvatarState state in remoteAvatarStates.Values)
            {
                RenderRemoteAvatarState(state);
            }
            PublishLocalAvatarState();
        }

        public void Close()
        {
            CloseInternal(false);
        }

        public void Dispose()
        {
            CloseInternal(false);
            latestData = null;
            gameData = null;
            placeSharedDecoration = null;
            updateSharedDecoration = null;
            removeSharedDecoration = null;
            onClose = null;
            ClearRealtime();
        }

        public void SetRealtime(
            string connectionId,
            string childProfileId,
            string characterAssetKey,
            Action<SupabaseFriendWorldAvatarState> onLocalAvatarStateChanged)
        {
            localConnectionId = string.IsNullOrWhiteSpace(connectionId)
                ? null
                : connectionId.Trim();
            localChildProfileId = string.IsNullOrWhiteSpace(childProfileId)
                ? null
                : childProfileId.Trim();
            localCharacterAssetKey = string.IsNullOrWhiteSpace(characterAssetKey)
                ? null
                : characterAssetKey.Trim();
            this.onLocalAvatarStateChanged = onLocalAvatarStateChanged;
            if (IsOpen) PublishLocalAvatarState();
        }

        public void ClearRealtime()
        {
            localConnectionId = null;
            localChildProfileId = null;
            localCharacterAssetKey = null;
            onLocalAvatarStateChanged = null;
            latestPresenceMembers = null;
            remoteAvatarStates.Clear();
            remoteAvatarLastReceivedSeconds.Clear();
            realtimeSeconds = 0f;
            foreach (GameObject avatar in remoteAvatars.Values)
            {
                if (avatar != null) UnityEngine.Object.Destroy(avatar);
            }

            remoteAvatars.Clear();
        }

        public void SetRealtimeStatus(string message, bool isError)
        {
            if (liveStatusText == null) return;
            liveStatusText.text = message ?? string.Empty;
            liveStatusText.color = isError
                ? new Color(1f, 0.58f, 0.58f, 1f)
                : new Color(0.72f, 0.92f, 1f, 1f);
        }

        public void ApplyPresence(
            SupabaseFriendWorldPresenceMember[] members,
            string ignoredLocalConnectionId)
        {
            latestPresenceMembers = members ?? new SupabaseFriendWorldPresenceMember[0];
            if (!IsOpen) return;
            Dictionary<string, bool> activeConnections =
                new Dictionary<string, bool>();
            int count = 0;
            foreach (SupabaseFriendWorldPresenceMember member in
                members ?? new SupabaseFriendWorldPresenceMember[0])
            {
                if (member == null || string.IsNullOrWhiteSpace(member.connectionId)) continue;
                activeConnections[member.connectionId] = true;
                count = Mathf.Min(
                    count + 1,
                    SupabaseFriendWorldRealtimeContracts.MaxWorldMembers);
            }

            List<string> removedConnections = new List<string>();
            foreach (string connectionId in remoteAvatars.Keys)
            {
                if (!activeConnections.ContainsKey(connectionId))
                    removedConnections.Add(connectionId);
            }

            foreach (string connectionId in removedConnections)
            {
                RemoveRemoteAvatar(connectionId);
                remoteAvatarStates.Remove(connectionId);
                remoteAvatarLastReceivedSeconds.Remove(connectionId);
            }

            List<string> removedCachedStates = new List<string>();
            foreach (string connectionId in remoteAvatarStates.Keys)
            {
                if (!activeConnections.ContainsKey(connectionId))
                    removedCachedStates.Add(connectionId);
            }

            foreach (string connectionId in removedCachedStates)
            {
                remoteAvatarStates.Remove(connectionId);
                remoteAvatarLastReceivedSeconds.Remove(connectionId);
            }

            SetRealtimeStatus(
                "多人狀態：線上角色 "
                    + count.ToString(CultureInfo.InvariantCulture)
                    + "/"
                    + SupabaseFriendWorldRealtimeContracts.MaxWorldMembers
                    + "。",
                false);
        }

        public void ApplyAvatarState(
            SupabaseFriendWorldAvatarState state,
            string ignoredLocalConnectionId)
        {
            if (state == null) return;
            if (state.connectionId == localConnectionId
                || state.connectionId == ignoredLocalConnectionId)
            {
                return;
            }

            remoteAvatarStates[state.connectionId] = state;
            remoteAvatarLastReceivedSeconds[state.connectionId] = realtimeSeconds;
            if (!IsOpen) return;
            RenderRemoteAvatarState(state);
        }

        public void Tick(float deltaSeconds)
        {
            float safeDeltaSeconds = Mathf.Max(0f, deltaSeconds);
            realtimeSeconds += safeDeltaSeconds;
            PruneStaleRemoteAvatarStates();
            if (!IsOpen) return;

            float interpolationStep =
                SupabaseFriendWorldAvatarMotionPolicy.GetInterpolationStep(
                    safeDeltaSeconds);
            foreach (KeyValuePair<string, SupabaseFriendWorldAvatarState> entry in
                remoteAvatarStates)
            {
                GameObject avatar;
                if (!remoteAvatars.TryGetValue(entry.Key, out avatar)
                    || avatar == null)
                {
                    RenderRemoteAvatarState(entry.Value);
                    continue;
                }

                Vector3 targetPosition = GetAvatarPosition(entry.Value);
                avatar.transform.localPosition = Vector3.Lerp(
                    avatar.transform.localPosition,
                    targetPosition,
                    interpolationStep);
                Vector3 angles = avatar.transform.localEulerAngles;
                angles.y = Mathf.LerpAngle(
                    angles.y,
                    entry.Value.rotationY,
                    interpolationStep);
                avatar.transform.localEulerAngles = angles;
            }
        }

        private void RenderRemoteAvatarState(SupabaseFriendWorldAvatarState state)
        {
            if (state == null || string.IsNullOrWhiteSpace(state.connectionId)) return;
            GameObject avatar;
            bool isNewAvatar = false;
            if (!remoteAvatars.TryGetValue(state.connectionId, out avatar)
                || avatar == null)
            {
                avatar = CreatePrimitive(
                    PrimitiveType.Capsule,
                    "FriendWorldRemoteAvatar_" + state.connectionId,
                    new Vector3(0f, 1f, 0f),
                    new Vector3(0.72f, 1f, 0.72f),
                    new Color(0.35f, 0.9f, 0.95f, 1f));
                remoteAvatars[state.connectionId] = avatar;
                isNewAvatar = true;
            }

            if (isNewAvatar)
            {
                avatar.transform.localPosition = GetAvatarPosition(state);
                avatar.transform.localRotation = Quaternion.Euler(0f, state.rotationY, 0f);
            }
            SetRealtimeStatus(
                "多人狀態：已同步遠端角色 "
                    + remoteAvatarStates.Count.ToString(CultureInfo.InvariantCulture)
                    + " 位。",
                false);
        }

        private Vector3 GetAvatarPosition(SupabaseFriendWorldAvatarState state)
        {
            return new Vector3(
                Mathf.Clamp(
                    state.x,
                    -SupabaseFriendWorldRealtimeContracts.WorldBoundary,
                    SupabaseFriendWorldRealtimeContracts.WorldBoundary),
                1f,
                Mathf.Clamp(
                    state.z,
                    -SupabaseFriendWorldRealtimeContracts.WorldBoundary,
                    SupabaseFriendWorldRealtimeContracts.WorldBoundary));
        }

        private void PruneStaleRemoteAvatarStates()
        {
            List<string> staleConnections = new List<string>();
            foreach (KeyValuePair<string, float> entry in remoteAvatarLastReceivedSeconds)
            {
                if (SupabaseFriendWorldAvatarMotionPolicy.IsStale(
                        realtimeSeconds - entry.Value))
                {
                    staleConnections.Add(entry.Key);
                }
            }

            foreach (string connectionId in staleConnections)
            {
                RemoveRemoteAvatar(connectionId);
                remoteAvatarStates.Remove(connectionId);
                remoteAvatarLastReceivedSeconds.Remove(connectionId);
            }
        }

        private void RemoveRemoteAvatar(string connectionId)
        {
            GameObject avatar;
            if (remoteAvatars.TryGetValue(connectionId, out avatar)
                && avatar != null)
            {
                UnityEngine.Object.Destroy(avatar);
            }

            remoteAvatars.Remove(connectionId);
        }

        private void CreateWorld()
        {
            worldRoot = new GameObject("FriendWorldRuntime");
            GameObject cameraObject = new GameObject("FriendWorldCamera");
            cameraObject.transform.SetParent(worldRoot.transform, false);
            worldCamera = cameraObject.AddComponent<Camera>();
            worldCamera.clearFlags = CameraClearFlags.SolidColor;
            worldCamera.backgroundColor = new Color(0.12f, 0.18f, 0.28f, 1f);
            worldCamera.orthographic = true;
            worldCamera.orthographicSize = 9f;
            worldCamera.transform.position = new Vector3(0f, 12f, -14f);
            worldCamera.transform.LookAt(new Vector3(0f, 0f, 0f));

            CreatePrimitive(
                PrimitiveType.Plane,
                "FriendWorldGround",
                new Vector3(0f, 0f, 0f),
                new Vector3(2f, 1f, 2f),
                new Color(0.16f, 0.35f, 0.3f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "FriendWorldNorthBoundary",
                new Vector3(0f, 0.35f, 9.5f),
                new Vector3(20f, 0.7f, 0.35f),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "FriendWorldSouthBoundary",
                new Vector3(0f, 0.35f, -9.5f),
                new Vector3(20f, 0.7f, 0.35f),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "FriendWorldEastBoundary",
                new Vector3(9.5f, 0.35f, 0f),
                new Vector3(0.35f, 0.7f, 20f),
                new Color(0.08f, 0.14f, 0.2f, 1f));
            CreatePrimitive(
                PrimitiveType.Cube,
                "FriendWorldWestBoundary",
                new Vector3(-9.5f, 0.35f, 0f),
                new Vector3(0.35f, 0.7f, 20f),
                new Color(0.08f, 0.14f, 0.2f, 1f));

            player = CreatePrimitive(
                PrimitiveType.Capsule,
                "FriendWorldVisitorPlaceholder",
                new Vector3(0f, 1f, -4f),
                new Vector3(0.75f, 1f, 0.75f),
                HabitHeroUiFactory.AccentColor);
            CreatePrimitive(
                PrimitiveType.Capsule,
                "FriendWorldOwnerPlaceholder",
                new Vector3(0f, 1f, 0f),
                new Vector3(0.8f, 1f, 0.8f),
                new Color(0.95f, 0.55f, 0.75f, 1f));
            RenderEntityPlaceholders();

            renderTexture = new RenderTexture(720, 960, 24, RenderTextureFormat.ARGB32);
            renderTexture.name = "HabitHeroFriendWorldRenderTexture";
            renderTexture.Create();
            worldCamera.targetTexture = renderTexture;
        }

        private void RenderEntityPlaceholders()
        {
            int rendered = 0;
            foreach (SupabaseFriendWorldEntityRecord entity in
                latestData.entities ?? new SupabaseFriendWorldEntityRecord[0])
            {
                if (entity == null || rendered >= 40) continue;
                bool isPet = entity.entity_kind == "pet";
                bool isDecoration = entity.entity_kind == "decoration";
                PrimitiveType primitive = isPet
                    ? PrimitiveType.Sphere
                    : isDecoration ? PrimitiveType.Cube : PrimitiveType.Capsule;
                float height = isPet ? 0.75f : isDecoration ? 0.45f : 1f;
                float size = Mathf.Clamp(
                    entity.scale <= 0f ? 1f : entity.scale,
                    0.35f,
                    2.5f);
                Vector3 position = new Vector3(
                    Mathf.Clamp(entity.position_x, -8f, 8f),
                    Mathf.Clamp(entity.position_y, 0f, 4f) + height,
                    Mathf.Clamp(entity.position_z, -8f, 8f));
                GameObject placeholder = CreatePrimitive(
                    primitive,
                    "FriendEntity_" + entity.id,
                    position,
                    new Vector3(size, size, size),
                    isPet
                        ? new Color(0.95f, 0.68f, 0.38f, 1f)
                        : isDecoration
                            ? new Color(0.62f, 0.48f, 0.82f, 1f)
                            : new Color(0.52f, 0.68f, 0.95f, 1f));
                placeholder.transform.localRotation = Quaternion.Euler(
                    entity.rotation_x,
                    entity.rotation_y,
                    entity.rotation_z);
                rendered += 1;
            }
        }

        private void CreateOverlay()
        {
            panel = new GameObject(
                "ChildFriendWorldPanel",
                typeof(RectTransform),
                typeof(Image));
            panel.transform.SetParent(canvasTransform, false);
            Image panelImage = panel.GetComponent<Image>();
            panelImage.color = new Color(0f, 0f, 0f, 0f);
            panelImage.raycastTarget = false;
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.anchorMin = Vector2.zero;
            panelRect.anchorMax = Vector2.one;
            panelRect.offsetMin = Vector2.zero;
            panelRect.offsetMax = Vector2.zero;

            RawImage worldImage = new GameObject(
                "FriendWorldRender",
                typeof(RectTransform),
                typeof(RawImage)).GetComponent<RawImage>();
            worldImage.transform.SetParent(panel.transform, false);
            worldImage.texture = renderTexture;
            worldImage.color = Color.white;
            worldImage.raycastTarget = false;
            RectTransform imageRect = worldImage.GetComponent<RectTransform>();
            imageRect.anchorMin = Vector2.zero;
            imageRect.anchorMax = Vector2.one;
            imageRect.offsetMin = Vector2.zero;
            imageRect.offsetMax = Vector2.zero;

            GameObject hud = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                new Color(0.03f, 0.05f, 0.08f, 0.86f),
                "FriendWorldHud");
            RectTransform hudRect = hud.GetComponent<RectTransform>();
            hudRect.anchorMin = new Vector2(0.03f, 0.78f);
            hudRect.anchorMax = new Vector2(0.97f, 0.98f);
            hudRect.offsetMin = Vector2.zero;
            hudRect.offsetMax = Vector2.zero;
            HabitHeroUiFactory.CreateText(
                hud.transform,
                font,
                latestData.displayName + " 的好友世界　"
                    + (latestData.canShareDecorations ? "可共同布置" : "唯讀"),
                25,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.04f, 0.52f),
                new Vector2(0.96f, 0.96f));
            HabitHeroUiFactory.CreateText(
                hud.transform,
                font,
                "世界版本 " + latestData.revision + "　角色 " + latestData.characterAssetKey,
                13,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.04f, 0.08f),
                new Vector2(0.96f, 0.5f));

            GameObject entityList = CreateList(
                panel.transform,
                "FriendWorldEntityList",
                new Vector2(0.04f, 0.34f),
                new Vector2(0.47f, 0.75f));
            RenderEntityList(entityList.transform);

            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "共享裝飾",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.5f, 0.75f),
                new Vector2(0.96f, 0.8f));
            GameObject decorationList = CreateList(
                panel.transform,
                "SharedDecorationList",
                new Vector2(0.5f, 0.34f),
                new Vector2(0.96f, 0.75f));
            RenderSharedDecorationList(decorationList.transform);

            GameObject controls = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                new Color(0.03f, 0.05f, 0.08f, 0.86f),
                "FriendWorldMovementControls");
            RectTransform controlsRect = controls.GetComponent<RectTransform>();
            controlsRect.anchorMin = new Vector2(0.69f, 0.04f);
            controlsRect.anchorMax = new Vector2(0.96f, 0.32f);
            controlsRect.offsetMin = Vector2.zero;
            controlsRect.offsetMax = Vector2.zero;
            CreateMovementButton(
                controls.transform,
                "上",
                new Vector2(0.34f, 0.56f),
                new Vector2(0.66f, 0.9f),
                new Vector2(0f, 1f));
            CreateMovementButton(
                controls.transform,
                "左",
                new Vector2(0.04f, 0.24f),
                new Vector2(0.36f, 0.58f),
                new Vector2(-1f, 0f));
            CreateMovementButton(
                controls.transform,
                "右",
                new Vector2(0.64f, 0.24f),
                new Vector2(0.96f, 0.58f),
                new Vector2(1f, 0f));
            CreateMovementButton(
                controls.transform,
                "下",
                new Vector2(0.34f, 0.02f),
                new Vector2(0.66f, 0.36f),
                new Vector2(0f, -1f));

            statusText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                latestData.canShareDecorations
                    ? "你可以把自己的裝飾放入好友世界；所有位置仍由伺服器驗證。"
                    : "這是好友世界的安全唯讀投影；好友尚未開放共享布置。",
                14,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.04f, 0.24f),
                new Vector2(0.64f, 0.33f));
            liveStatusText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "多人狀態：等待 Realtime 連線…",
                13,
                TextAnchor.MiddleCenter,
                new Color(0.72f, 0.92f, 1f, 1f),
                new Vector2(0.04f, 0.18f),
                new Vector2(0.64f, 0.24f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "返回好友",
                new Vector2(0.35f, 0.04f),
                new Vector2(0.64f, 0.12f));
            closeButton.onClick.AddListener(CloseFromButton);
        }

        private void RenderEntityList(Transform parent)
        {
            int rendered = 0;
            foreach (SupabaseFriendWorldEntityRecord entity in
                latestData.entities ?? new SupabaseFriendWorldEntityRecord[0])
            {
                if (entity == null || rendered >= 8) continue;
                string label = string.IsNullOrWhiteSpace(entity.display_name)
                    ? entity.asset_key
                    : entity.display_name;
                GameObject row = CreateRow(parent, "FriendWorldEntityRow");
                Text entityLabel = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    label + "　" + entity.entity_kind
                        + (entity.placement_scope == "shared" ? "　共享" : string.Empty),
                    14,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                AddFlexibleLayout(entityLabel.gameObject);
                if (entity.placement_scope == "shared" && entity.can_transform)
                {
                    Button moveButton = CreateEntityButton(row.transform, "右移");
                    moveButton.interactable = updateSharedDecoration != null;
                    moveButton.onClick.AddListener(() => MoveSharedDecorationAsync(
                        entity,
                        0.8f,
                        moveButton));
                }
                if (entity.placement_scope == "shared" && entity.can_remove)
                {
                    Button removeButton = CreateEntityButton(row.transform, "移除");
                    removeButton.interactable = removeSharedDecoration != null;
                    removeButton.onClick.AddListener(() => RemoveSharedDecorationAsync(
                        entity,
                        removeButton));
                }
                rendered += 1;
            }

            if (rendered == 0)
            {
                HabitHeroUiFactory.CreateText(
                    parent,
                    font,
                    "這個世界目前沒有公開物件。",
                    14,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one).gameObject.AddComponent<LayoutElement>().preferredHeight = 30f;
            }
        }

        private void RenderSharedDecorationList(Transform parent)
        {
            if (!latestData.canShareDecorations)
            {
                CreateEmptyRow(parent, "好友尚未允許你共享布置。");
                return;
            }

            if (gameData == null || placeSharedDecoration == null)
            {
                CreateEmptyRow(parent, "目前沒有可用的裝飾背包資料。");
                return;
            }

            int rendered = 0;
            foreach (SupabaseChildInventoryItemRecord inventory in
                gameData.inventory ?? new SupabaseChildInventoryItemRecord[0])
            {
                if (inventory == null || inventory.quantity <= 0) continue;
                SupabaseGameCatalogItemRecord item = FindCatalogItem(inventory.catalog_item_id);
                if (item == null || item.item_type != "decoration") continue;
                GameObject row = CreateRow(parent, "SharedDecorationInventoryRow");
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    item.name + " ×" + inventory.quantity,
                    14,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                AddFlexibleLayout(label.gameObject);
                Button placeButton = CreateEntityButton(
                    row.transform,
                    "放入");
                placeButton.onClick.AddListener(() => PlaceSharedDecorationAsync(
                    inventory.id,
                    item,
                    placeButton));

                rendered += 1;
                if (rendered >= 8) break;
            }

            if (rendered == 0)
            {
                CreateEmptyRow(parent, "背包中沒有可共享的裝飾。");
            }
        }

        private async void PlaceSharedDecorationAsync(
            string sourceInventoryItemId,
            SupabaseGameCatalogItemRecord item,
            Button button)
        {
            if (placeSharedDecoration == null || item == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在把裝飾放入好友世界…", false);
            try
            {
                SupabaseChildFriendWorldData refreshed = await placeSharedDecoration(
                    sourceInventoryItemId,
                    CurrentRevision,
                    CreateDefaultTransform(item));
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新好友世界資料。");
                }

                ApplyData(refreshed);
                SetStatus("共享裝飾已放入好友世界。", false);
            }
            catch (Exception exception)
            {
                SetStatus("共享裝飾放置失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void MoveSharedDecorationAsync(
            SupabaseFriendWorldEntityRecord entity,
            float deltaX,
            Button button)
        {
            if (entity == null || updateSharedDecoration == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在更新共享裝飾位置…", false);
            try
            {
                SupabaseFriendWorldTransform transform = CreateTransform(entity);
                transform.x = Mathf.Clamp(transform.x + deltaX, -13f, 13f);
                SupabaseChildFriendWorldData refreshed = await updateSharedDecoration(
                    entity.id,
                    CurrentRevision,
                    transform);
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新好友世界資料。");
                }

                ApplyData(refreshed);
                SetStatus("共享裝飾位置已更新。", false);
            }
            catch (Exception exception)
            {
                SetStatus("共享裝飾移動失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void RemoveSharedDecorationAsync(
            SupabaseFriendWorldEntityRecord entity,
            Button button)
        {
            if (entity == null || removeSharedDecoration == null) return;
            if (button != null) button.interactable = false;
            SetStatus("正在移除共享裝飾…", false);
            try
            {
                SupabaseChildFriendWorldData refreshed = await removeSharedDecoration(
                    entity.id,
                    CurrentRevision);
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新好友世界資料。");
                }

                ApplyData(refreshed);
                SetStatus("共享裝飾已移除。", false);
            }
            catch (Exception exception)
            {
                SetStatus("共享裝飾移除失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private SupabaseGameCatalogItemRecord FindCatalogItem(string catalogItemId)
        {
            foreach (SupabaseGameCatalogItemRecord item in
                gameData == null
                    ? new SupabaseGameCatalogItemRecord[0]
                    : gameData.catalog ?? new SupabaseGameCatalogItemRecord[0])
            {
                if (item != null && item.id == catalogItemId) return item;
            }

            return null;
        }

        private SupabaseFriendWorldTransform CreateDefaultTransform(
            SupabaseGameCatalogItemRecord item)
        {
            int sharedCount = 0;
            foreach (SupabaseFriendWorldEntityRecord entity in
                latestData.entities ?? new SupabaseFriendWorldEntityRecord[0])
            {
                if (entity != null && entity.placement_scope == "shared") sharedCount += 1;
            }

            int column = sharedCount % 3;
            int row = sharedCount / 3;
            float minScale = item.min_scale > 0f ? item.min_scale : 0.75f;
            float maxScale = item.max_scale >= minScale ? item.max_scale : minScale;
            return new SupabaseFriendWorldTransform
            {
                x = -4.5f + column * 2.8f,
                y = 0f,
                z = -5.5f + row * 2.8f,
                rotationX = 0f,
                rotationY = 0f,
                rotationZ = 0f,
                scale = Mathf.Clamp(1f, minScale, maxScale),
            };
        }

        private static SupabaseFriendWorldTransform CreateTransform(
            SupabaseFriendWorldEntityRecord entity)
        {
            return new SupabaseFriendWorldTransform
            {
                x = entity.position_x,
                y = entity.position_y,
                z = entity.position_z,
                rotationX = entity.rotation_x,
                rotationY = entity.rotation_y,
                rotationZ = entity.rotation_z,
                scale = entity.scale <= 0f ? 1f : entity.scale,
            };
        }

        private Button CreateEntityButton(Transform parent, string label)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                Vector2.zero,
                Vector2.one);
            LayoutElement layout = button.gameObject.AddComponent<LayoutElement>();
            layout.preferredWidth = 54f;
            layout.minWidth = 54f;
            return button;
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
            position.x = Mathf.Clamp(
                position.x + direction.x * 0.8f,
                -SupabaseFriendWorldRealtimeContracts.WorldBoundary,
                SupabaseFriendWorldRealtimeContracts.WorldBoundary);
            position.z = Mathf.Clamp(
                position.z + direction.y * 0.8f,
                -SupabaseFriendWorldRealtimeContracts.WorldBoundary,
                SupabaseFriendWorldRealtimeContracts.WorldBoundary);
            player.transform.position = position;
            SetStatus(
                "訪客角色已移動到 "
                    + position.x.ToString("0.0")
                    + ", "
                    + position.z.ToString("0.0")
                    + "；好友世界仍為唯讀。",
                false);
            PublishLocalAvatarState();
        }

        private void PublishLocalAvatarState()
        {
            if (player == null
                || string.IsNullOrWhiteSpace(localConnectionId)
                || string.IsNullOrWhiteSpace(localChildProfileId)
                || onLocalAvatarStateChanged == null)
            {
                return;
            }

            localAvatarSequence += 1;
            double sentAt = (DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds;
            SupabaseFriendWorldAvatarState state =
                SupabaseFriendWorldAvatarStateFactory.Create(
                    localConnectionId,
                    localChildProfileId,
                    localCharacterAssetKey,
                    localAvatarSequence,
                    player.transform.localPosition.x,
                    player.transform.localPosition.z,
                    player.transform.localEulerAngles.y,
                    sentAt);
            onLocalAvatarStateChanged(state);
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

        private GameObject CreateRow(Transform parent, string name)
        {
            GameObject row = new GameObject(
                name,
                typeof(RectTransform),
                typeof(HorizontalLayoutGroup));
            row.transform.SetParent(parent, false);
            row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 30f);
            HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
            layout.spacing = 4f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = false;
            layout.childForceExpandHeight = true;
            return row;
        }

        private static void AddFlexibleLayout(GameObject target)
        {
            target.AddComponent<LayoutElement>().flexibleWidth = 1f;
        }

        private void CreateEmptyRow(Transform parent, string message)
        {
            GameObject row = CreateRow(parent, "FriendWorldEmptyRow");
            Text text = HabitHeroUiFactory.CreateText(
                row.transform,
                font,
                message,
                14,
                TextAnchor.MiddleCenter,
                Color.white,
                Vector2.zero,
                Vector2.one);
            AddFlexibleLayout(text.gameObject);
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
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
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
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
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
            remoteAvatars.Clear();
            worldCamera = null;
            player = null;
            statusText = null;
            liveStatusText = null;
            if (notify && onClose != null) onClose();
        }
    }
}
