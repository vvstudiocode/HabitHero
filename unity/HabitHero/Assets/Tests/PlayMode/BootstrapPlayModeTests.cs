using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using HabitHero.App;
using HabitHero.Platform;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace HabitHero.Tests
{
    public sealed class BootstrapPlayModeTests
    {
        [UnityTest]
        public IEnumerator BootstrapBuildsTheLoginShellWithoutRuntimeErrors()
        {
            List<string> errors = new List<string>();
            Application.LogCallback callback = (message, stackTrace, type) =>
            {
                if (type == LogType.Error || type == LogType.Exception)
                {
                    errors.Add(message);
                }
            };
            Application.logMessageReceived += callback;

            AsyncOperation load = SceneManager.LoadSceneAsync(
                "Bootstrap",
                LoadSceneMode.Single);
            Assert.IsNotNull(load);
            while (!load.isDone) yield return null;
            yield return null;
            yield return null;

            try
            {
                bool hasBootstrap = false;
                bool hasSafeArea = false;
                foreach (MonoBehaviour component in Object.FindObjectsByType<MonoBehaviour>(
                    FindObjectsInactive.Include,
                    FindObjectsSortMode.None))
                {
                    if (component != null && component.GetType().FullName ==
                        "HabitHero.App.HabitHeroBootstrap")
                    {
                        hasBootstrap = true;
                    }

                    if (component != null && component.GetType().FullName ==
                        "HabitHero.App.HabitHeroSafeArea")
                    {
                        hasSafeArea = true;
                    }
                }

                Assert.IsTrue(hasBootstrap, "Bootstrap component was not created.");
                Assert.IsTrue(hasSafeArea, "Safe-area component was not created.");

                GameObject canvasObject = GameObject.Find("HabitHeroCanvas");
                Assert.IsNotNull(canvasObject);
                Canvas canvas = canvasObject.GetComponent<Canvas>();
                Assert.IsNotNull(canvas);
                Assert.AreEqual(RenderMode.ScreenSpaceOverlay, canvas.renderMode);
                Assert.IsNotNull(Object.FindAnyObjectByType<EventSystem>());

                bool hasTitle = false;
                foreach (Text text in canvasObject.GetComponentsInChildren<Text>(true))
                {
                    if (text != null && text.text == "習慣冒險島")
                    {
                        hasTitle = true;
                        break;
                    }
                }

                Assert.IsTrue(hasTitle, "Bootstrap login title was not rendered.");
            }
            finally
            {
                Application.logMessageReceived -= callback;
            }

            Assert.IsEmpty(errors, "Bootstrap emitted runtime errors: " + string.Join(" | ", errors));
        }

        [UnityTest]
        public IEnumerator ChildWorldRendersFixtureActorsAndCleansUpRuntimeResources()
        {
            List<string> errors = new List<string>();
            Application.LogCallback callback = (message, stackTrace, type) =>
            {
                if (type == LogType.Error || type == LogType.Exception)
                {
                    errors.Add(message);
                }
            };
            Application.logMessageReceived += callback;

            GameObject canvasObject = new GameObject(
                "WorldFixtureCanvas",
                typeof(RectTransform),
                typeof(Canvas),
                typeof(CanvasScaler),
                typeof(GraphicRaycaster));
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            HabitHeroChildWorldSceneView worldView =
                new HabitHeroChildWorldSceneView(canvas.transform, font, string.Empty);

            SupabaseChildWorldData worldData = new SupabaseChildWorldData
            {
                familyId = "fixture-family",
                childProfileId = "fixture-child",
                scenes = new[]
                {
                    new SupabaseGameWorldSceneRecord
                    {
                        id = "sunrise-village",
                        name = "晨光村",
                        is_active = true,
                    },
                },
                npcs = new[]
                {
                    new SupabaseGameWorldNpcRecord
                    {
                        id = "fixture-vendor",
                        scene_id = "sunrise-village",
                        npc_type = "vendor",
                        name = "小販",
                        position_x = 2f,
                        position_y = 0f,
                        position_z = 1f,
                        is_active = true,
                    },
                    new SupabaseGameWorldNpcRecord
                    {
                        id = "fixture-roaming-pet",
                        scene_id = "sunrise-village",
                        npc_type = "roaming_pet",
                        name = "小熊",
                        position_x = -2f,
                        position_y = 0f,
                        position_z = 1f,
                        behavior_mode = "wander",
                        roam_bounds = new SupabaseGameWorldRoamBoundsRecord
                        {
                            minX = -3f,
                            maxX = 3f,
                            minZ = -2f,
                            maxZ = 3f,
                        },
                        is_active = true,
                    },
                },
                weather = new SupabaseWorldWeatherRecord
                {
                    condition = "clear",
                    intensity = 0f,
                },
            };
            SupabaseChildGameData gameData = new SupabaseChildGameData
            {
                familyId = "fixture-family",
                childProfileId = "fixture-child",
                worldRevision = 4,
                catalog = new[]
                {
                    new SupabaseGameCatalogItemRecord
                    {
                        id = "fixture-sofa-catalog",
                        item_type = "decoration",
                        name = "藍色沙發",
                        asset_key = "decoration.sofa",
                        collision_radius = 0.65f,
                        min_scale = 0.75f,
                        max_scale = 1.25f,
                    },
                    new SupabaseGameCatalogItemRecord
                    {
                        id = "fixture-pet-catalog",
                        item_type = "pet",
                        name = "小熊",
                        asset_key = "pet.murphy-bear",
                        collision_radius = 0.35f,
                    },
                },
                inventory = new[]
                {
                    new SupabaseChildInventoryItemRecord
                    {
                        id = "fixture-sofa-inventory",
                        catalog_item_id = "fixture-sofa-catalog",
                        quantity = 1,
                    },
                    new SupabaseChildInventoryItemRecord
                    {
                        id = "fixture-pet-inventory",
                        catalog_item_id = "fixture-pet-catalog",
                        quantity = 1,
                        display_name = "豆豆",
                    },
                },
                loadout = new SupabaseChildGameLoadoutRecord
                {
                    following_pet_inventory_ids = new[] { "fixture-pet-inventory" },
                },
                worldEntities = new[]
                {
                    new SupabaseChildWorldEntityRecord
                    {
                        id = "fixture-sofa-entity",
                        inventory_item_id = "fixture-sofa-inventory",
                        entity_kind = "decoration",
                        position_x = 1.5f,
                        position_y = 0f,
                        position_z = -1.5f,
                        scale = 1f,
                        is_active = true,
                    },
                },
                sharedWorldDecorations = new SupabaseChildSharedWorldDecorationRecord[0],
            };

            try
            {
                worldView.Show(worldData, gameData, "sunrise-village", null, null);
                worldView.Open();
                worldView.Tick(0.25f);
                yield return null;

                Assert.IsNotNull(GameObject.Find("ChildWorldRuntime"));
                Assert.IsNotNull(GameObject.Find("ChildWorldCamera"));
                Assert.IsNotNull(GameObject.Find("WorldGround"));
                Assert.IsNotNull(GameObject.Find("WorldEntity_fixture-sofa-entity"));

                int shadowCount = 0;
                foreach (Transform transform in Object.FindObjectsByType<Transform>(
                    FindObjectsInactive.Include,
                    FindObjectsSortMode.None))
                {
                    if (transform != null && transform.name == "WorldGroundShadow")
                    {
                        shadowCount += 1;
                    }
                }

                Assert.GreaterOrEqual(shadowCount, 3, "World actors did not receive ground shadows.");

                bool hasPetLabel = false;
                foreach (TextMesh label in Object.FindObjectsByType<TextMesh>(
                    FindObjectsInactive.Include,
                    FindObjectsSortMode.None))
                {
                    if (label != null && (label.text == "小熊" || label.text == "豆豆"))
                    {
                        hasPetLabel = true;
                        break;
                    }
                }

                Assert.IsTrue(hasPetLabel, "World pet labels were not created.");
                Assert.IsNotNull(GameObject.Find("ChildWorldScenePanel"));
                Assert.IsNotNull(GameObject.Find("WorldDecorationEditor"));
                Assert.IsTrue(worldView.BeginDecorationPlacement("fixture-sofa-inventory"));
                Assert.IsNotNull(GameObject.Find("WorldPlacementPreview"));
                Assert.IsTrue(worldView.ApplyPlacementControl(
                    HabitHeroWorldPlacementControl.RotateRight));
                worldView.CancelDecorationPlacement();
                yield return null;
                Assert.IsNull(GameObject.Find("WorldPlacementPreview"));
            }
            finally
            {
                worldView.Dispose();
                Object.Destroy(canvasObject);
                Application.logMessageReceived -= callback;
            }

            yield return null;
            Assert.IsNull(GameObject.Find("ChildWorldRuntime"));
            Assert.IsNull(GameObject.Find("ChildWorldScenePanel"));
            Assert.IsEmpty(errors, "Child world emitted runtime errors: " + string.Join(" | ", errors));
        }

        [UnityTest]
        public IEnumerator ChildAndParentHomeViewsOpenMajorPanelsFromFixtureData()
        {
            List<string> errors = new List<string>();
            Application.LogCallback callback = (message, stackTrace, type) =>
            {
                if (type == LogType.Error || type == LogType.Exception)
                {
                    errors.Add(message);
                }
            };
            Application.logMessageReceived += callback;

            GameObject canvasObject = new GameObject(
                "HomeSurfaceFixtureCanvas",
                typeof(RectTransform),
                typeof(Canvas),
                typeof(CanvasScaler),
                typeof(GraphicRaycaster));
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

            SupabaseChildProfileRecord child = new SupabaseChildProfileRecord
            {
                id = "fixture-child",
                family_id = "fixture-family",
                display_name = "小勇者",
                points_balance = 10,
            };
            SupabaseChildHomeSnapshot childSnapshot = new SupabaseChildHomeSnapshot
            {
                familyId = "fixture-family",
                child = child,
                tasks = new SupabaseChildTaskRecord[0],
                rewards = new SupabaseChildRewardRecord[0],
                wishlist = new SupabaseChildWishlistRecord[0],
                tickets = new SupabaseChildTicketRecord[0],
                ledger = new SupabaseChildLedgerRecord[0],
                timers = new SupabaseTaskTimerSessionRecord[0],
            };
            SupabaseChildGameData childGameData = new SupabaseChildGameData
            {
                familyId = "fixture-family",
                childProfileId = "fixture-child",
                walletBalance = 10,
                catalog = new SupabaseGameCatalogItemRecord[0],
                prices = new SupabaseGamePriceRecord[0],
                inventory = new SupabaseChildInventoryItemRecord[0],
                loadout = new SupabaseChildGameLoadoutRecord(),
                worldEntities = new SupabaseChildWorldEntityRecord[0],
                sharedWorldDecorations = new SupabaseChildSharedWorldDecorationRecord[0],
                worldRevision = 0,
            };
            SupabaseChildWorldData childWorldData = new SupabaseChildWorldData
            {
                familyId = "fixture-family",
                childProfileId = "fixture-child",
                scenes = new[]
                {
                    new SupabaseGameWorldSceneRecord
                    {
                        id = "sunrise-village",
                        name = "晨光村",
                        is_active = true,
                    },
                },
                npcs = new SupabaseGameWorldNpcRecord[0],
                offerings = new SupabaseGameWorldNpcOfferingRecord[0],
                sceneUnlocks = new[]
                {
                    new SupabaseChildWorldSceneUnlockRecord
                    {
                        scene_id = "sunrise-village",
                    },
                },
                dialogueProgress = new SupabaseChildWorldNpcDialogueProgressRecord[0],
                weather = new SupabaseWorldWeatherRecord
                {
                    condition = "clear",
                    intensity = 0f,
                },
            };
            SupabaseChildSocialData childSocialData = new SupabaseChildSocialData
            {
                childProfileId = "fixture-child",
                friendCode = "FIXTURE",
                friends = new SupabaseFriendSummaryRecord[0],
                requests = new SupabaseFriendRequestRecord[0],
            };
            SupabaseParentHomeSnapshot parentSnapshot = new SupabaseParentHomeSnapshot
            {
                familyId = "fixture-family",
                family = new SupabaseFamilyRecord
                {
                    id = "fixture-family",
                    name = "測試家庭",
                },
                children = new[] { child },
                tasks = new SupabaseChildTaskRecord[0],
                rewards = new SupabaseChildRewardRecord[0],
                wishlist = new SupabaseChildWishlistRecord[0],
                tickets = new SupabaseChildTicketRecord[0],
                ledger = new SupabaseChildLedgerRecord[0],
                taskTemplates = new SupabaseParentTaskTemplateRecord[0],
                adventureGroups = new SupabaseParentAdventureGroupRecord[0],
            };

            HabitHeroChildHomeView childView = new HabitHeroChildHomeView(
                canvas.transform,
                font,
                string.Empty);
            HabitHeroParentHomeView parentView = new HabitHeroParentHomeView(
                canvas.transform,
                font,
                string.Empty);

            try
            {
                childView.Show(
                    snapshot: childSnapshot,
                    gameData: childGameData,
                    worldData: childWorldData,
                    socialData: childSocialData,
                    unlockWorldScene: null,
                    completeNpcDialogue: null,
                    refreshSocial: null,
                    sendFriendRequest: null,
                    acceptFriendRequest: null,
                    declineFriendRequest: null,
                    removeFriend: null,
                    blockFriend: null,
                    toggleFriendWorldCollaboration: null,
                    placeSharedDecoration: null,
                    updateSharedDecoration: null,
                    removeSharedDecoration: null,
                    visitFriendWorld: null,
                    loadWorldChat: null,
                    sendWorldChat: null,
                    markWorldChatRead: null,
                    reportWorldChat: null,
                    listCoopAdventures: null,
                    loadCoopAdventureState: null,
                    createCoopAdventure: null,
                    joinCoopAdventure: null,
                    submitCoopCompletion: null,
                    submitTask: null,
                    startTimer: null,
                    pauseTimer: null,
                    resumeTimer: null,
                    abandonAdventure: null,
                    proposeGoal: null,
                    redeemReward: id =>
                        Task.FromResult<SupabaseRewardRedemptionResult>(null),
                    addWishlist: null,
                    deleteWishlist: null,
                    purchaseGameItem: null,
                    equipGameCharacter: null,
                    setPetDisplayName: null,
                    setFollowingPets: null,
                    setRoamingPets: null,
                    placeWorldEntity: null,
                    updateWorldEntity: null,
                    removeWorldEntity: null,
                    collectWorldDecorations: null,
                    onSignOut: () => { },
                    onSwitchToParent: () => { },
                    onOpenNotificationSettings: () => { });

                GameObject childHomePanel = GameObject.Find("ChildHomePanel");
                Assert.IsNotNull(childHomePanel);
                OpenPanelFromHome(childHomePanel, "冒險商店", "ChildGamePanel");
                OpenPanelFromHome(childHomePanel, "世界", "ChildWorldPanel");
                OpenPanelFromHome(childHomePanel, "好友", "ChildSocialPanel");
                OpenPanelFromHome(childHomePanel, "獎勵商店", "RewardPanel");
                OpenPanelFromHome(childHomePanel, "點數紀錄", "ChildLedgerPanel");

                parentView.Show(
                    snapshot: parentSnapshot,
                    reviewTask: null,
                    batchReviewDailyAdventures: null,
                    revokeTaskApproval: null,
                    confirmChildGoal: null,
                    returnChildGoal: null,
                    approveWishlist: (wishlist, points) =>
                        Task.FromResult<SupabaseParentRewardMutationResult>(null),
                    fulfillTicket: ticketId =>
                        Task.FromResult<SupabaseParentRewardMutationResult>(null),
                    createTask: null,
                    updateTask: null,
                    deleteTask: null,
                    createTaskTemplate: null,
                    updateTaskTemplate: null,
                    deleteTaskTemplate: null,
                    createGeneralAdventure: null,
                    updateGeneralAdventureTitle: null,
                    loadAdventureSchedules: null,
                    createAdventureSchedule: null,
                    updateAdventureSchedule: null,
                    disableAdventureSchedule: null,
                    createReward: null,
                    updateReward: null,
                    deleteReward: null,
                    adjustPoints: null,
                    createChildAccount: null,
                    resetChildPassword: null,
                    updateChildName: null,
                    deleteChildAccount: null,
                    loadGameStore: null,
                    setGamePrice: null,
                    resetGamePrice: null,
                    listCoopAdventures: null,
                    loadCoopAdventureState: null,
                    reviewCoopCompletion: null,
                    recordParentConsent: null,
                    updateParentPassword: null,
                    deleteParentAccount: null,
                    enterChildMode: null,
                    onSignOut: () => { },
                    onOpenNotificationSettings: () => { });

                GameObject parentHomePanel = GameObject.Find("ParentHomePanel");
                Assert.IsNotNull(parentHomePanel);
                OpenPanelFromHome(parentHomePanel, "設定", "ParentSettingsPanel");
                OpenPanelFromHome(parentHomePanel, "成長", "ParentGrowthPanel");
                OpenPanelFromHome(parentHomePanel, "願望與獎勵券", "ParentRewardPanel");
                GameObject parentRewardPanel = GameObject.Find("ParentRewardPanel");
                Assert.IsNotNull(parentRewardPanel);
                Button parentLedgerButton = FindButton(parentRewardPanel, "點數紀錄");
                Assert.IsNotNull(parentLedgerButton);
                parentLedgerButton.onClick.Invoke();
                Assert.IsNotNull(GameObject.Find("ParentLedgerPanel"));
            }
            finally
            {
                childView.Dispose();
                parentView.Dispose();
                Object.Destroy(canvasObject);
                Application.logMessageReceived -= callback;
            }

            yield return null;
            Assert.IsNull(GameObject.Find("ChildHomePanel"));
            Assert.IsNull(GameObject.Find("ChildGamePanel"));
            Assert.IsNull(GameObject.Find("ChildWorldPanel"));
            Assert.IsNull(GameObject.Find("ChildSocialPanel"));
            Assert.IsNull(GameObject.Find("RewardPanel"));
            Assert.IsNull(GameObject.Find("ChildLedgerPanel"));
            Assert.IsNull(GameObject.Find("ParentHomePanel"));
            Assert.IsNull(GameObject.Find("ParentSettingsPanel"));
            Assert.IsNull(GameObject.Find("ParentGrowthPanel"));
            Assert.IsNull(GameObject.Find("ParentRewardPanel"));
            Assert.IsNull(GameObject.Find("ParentLedgerPanel"));
            Assert.IsEmpty(errors, "Home views emitted runtime errors: " + string.Join(" | ", errors));
        }

        private static void OpenPanelFromHome(
            GameObject homePanel,
            string buttonLabel,
            string panelName)
        {
            Button button = FindButton(homePanel, buttonLabel);
            Assert.IsNotNull(button, "Missing home button: " + buttonLabel);
            Assert.IsTrue(button.interactable, "Home button is disabled: " + buttonLabel);
            button.onClick.Invoke();
            Assert.IsNotNull(GameObject.Find(panelName), "Panel did not open: " + panelName);
        }

        private static Button FindButton(GameObject root, string label)
        {
            foreach (Button button in root.GetComponentsInChildren<Button>(true))
            {
                Text text = button.GetComponentInChildren<Text>(true);
                if (text != null && text.text == label)
                {
                    return button;
                }
            }

            return null;
        }
    }
}
