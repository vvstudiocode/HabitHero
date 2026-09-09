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
        public IEnumerator ParentSignupViewRequiresConsentAndCompletesWithValidInput()
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
                "ParentSignupFixtureCanvas",
                typeof(RectTransform),
                typeof(Canvas),
                typeof(CanvasScaler),
                typeof(GraphicRaycaster));
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            HabitHeroParentSignupView signupView = new HabitHeroParentSignupView(
                canvas.transform,
                font);
            bool submitCalled = false;
            bool completed = false;
            bool closed = false;

            try
            {
                signupView.Show(
                    (email, password) =>
                    {
                        submitCalled = email == "parent@example.com"
                            && password == "Abcdef12";
                        return Task.FromResult(new SupabaseSession
                        {
                            access_token = "fixture-access-token",
                            refresh_token = "fixture-refresh-token",
                            user = new SupabaseUser
                            {
                                id = "fixture-parent",
                                email = email,
                            },
                        });
                    },
                    session => completed = session != null,
                    () => closed = true);

                GameObject signupPanel = GameObject.Find("ParentSignupPanel");
                Assert.IsNotNull(signupPanel);
                Button consentDocumentButton = FindButton(signupPanel, "閱讀同意說明");
                Assert.IsNotNull(consentDocumentButton);
                consentDocumentButton.onClick.Invoke();
                GameObject legalPanel = GameObject.Find("ParentLegalDocumentPanel");
                Assert.IsNotNull(legalPanel);
                Button closeLegalButton = FindButton(legalPanel, "返回設定");
                Assert.IsNotNull(closeLegalButton);
                closeLegalButton.onClick.Invoke();
                yield return null;
                Assert.IsNotNull(GameObject.Find("ParentSignupPanel"));

                InputField[] inputs = signupPanel.GetComponentsInChildren<InputField>(true);
                Assert.AreEqual(3, inputs.Length);
                inputs[0].text = "parent@example.com";
                inputs[1].text = "Abcdef12";
                inputs[2].text = "Abcdef13";
                Button submitButton = FindButton(signupPanel, "建立帳號");
                Assert.IsNotNull(submitButton);
                submitButton.onClick.Invoke();
                yield return null;
                Assert.IsFalse(submitCalled);
                Assert.IsFalse(completed);

                Toggle consentToggle = signupPanel.GetComponentInChildren<Toggle>(true);
                Assert.IsNotNull(consentToggle);
                consentToggle.isOn = true;
                inputs[2].text = "Abcdef12";
                submitButton.onClick.Invoke();
                yield return null;
                Assert.IsTrue(submitCalled);
                Assert.IsTrue(completed);
                Assert.IsNull(GameObject.Find("ParentSignupPanel"));
                Assert.IsFalse(closed);
            }
            finally
            {
                signupView.Dispose();
                Object.Destroy(canvasObject);
                Application.logMessageReceived -= callback;
            }

            yield return null;
            Assert.IsNull(GameObject.Find("ParentSignupPanel"));
            Assert.IsNull(GameObject.Find("ParentLegalDocumentPanel"));
            Assert.IsEmpty(errors, "Parent signup emitted runtime errors: " + string.Join(" | ", errors));
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
            bool childTaskSubmitted = false;
            bool timerStarted = false;
            bool timerPaused = false;
            bool timerResumed = false;
            bool parentTaskReviewed = false;
            bool parentReviewApproved = false;
            int parentReviewPoints = -1;
            SupabaseChildTaskRecord reportTask = new SupabaseChildTaskRecord
            {
                id = "fixture-report-task",
                family_id = "fixture-family",
                child_profile_id = "fixture-child",
                name = "喝水",
                points = 5,
                status = "todo",
                completion_report_mode = "quick",
            };
            SupabaseChildTaskRecord timerTask = new SupabaseChildTaskRecord
            {
                id = "fixture-timer-task",
                family_id = "fixture-family",
                child_profile_id = "fixture-child",
                name = "閱讀10分鐘",
                points = 8,
                status = "todo",
                duration_minutes = 1,
                requires_timer = true,
                completion_report_mode = "none",
            };
            SupabaseChildHomeSnapshot childSnapshot = new SupabaseChildHomeSnapshot
            {
                familyId = "fixture-family",
                child = child,
                tasks = new[] { reportTask, timerTask },
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
            SupabaseChildTaskRecord reviewTask = new SupabaseChildTaskRecord
            {
                id = "fixture-review-task",
                family_id = "fixture-family",
                child_profile_id = "fixture-child",
                name = "整理書桌",
                points = 7,
                status = "pending",
                child_reflection_text = "我已經把書本分類好了。",
                child_mood = "proud",
                child_difficulty = 2,
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
                tasks = new[] { reviewTask },
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
                    listCoopAdventures: childId =>
                        Task.FromResult(new SupabaseCoopAdventureSummary[0]),
                    loadCoopAdventureState: adventureId =>
                        Task.FromResult<SupabaseCoopAdventureState>(null),
                    createCoopAdventure: childId =>
                        Task.FromResult<SupabaseCoopAdventureNotification>(null),
                    joinCoopAdventure: adventureId =>
                        Task.FromResult<SupabaseCoopMutationResult>(null),
                    submitCoopCompletion: (adventureId, input) =>
                        Task.FromResult<SupabaseCoopMutationResult>(null),
                    submitTask: (task, draft) =>
                    {
                        childTaskSubmitted = task != null
                            && task.id == "fixture-report-task"
                            && draft != null
                            && draft.quickReport == "smooth";
                        task.status = "pending";
                        return Task.FromResult(new SupabaseTaskCompletionResult
                        {
                            IdempotencyKey = "fixture-completion",
                            RefreshedSnapshot = childSnapshot,
                        });
                    },
                    startTimer: taskId =>
                    {
                        timerStarted = taskId == "fixture-timer-task";
                        return Task.FromResult(new SupabaseTaskTimerSessionRecord
                        {
                            id = "fixture-timer-session",
                            task_id = taskId,
                            status = "running",
                            accumulated_seconds = 0,
                        });
                    },
                    pauseTimer: taskId =>
                    {
                        timerPaused = taskId == "fixture-timer-task";
                        return Task.FromResult(new SupabaseTaskTimerSessionRecord
                        {
                            id = "fixture-timer-session",
                            task_id = taskId,
                            status = "paused",
                            accumulated_seconds = 1,
                        });
                    },
                    resumeTimer: taskId =>
                    {
                        timerResumed = taskId == "fixture-timer-task";
                        return Task.FromResult(new SupabaseTaskTimerSessionRecord
                        {
                            id = "fixture-timer-session",
                            task_id = taskId,
                            status = "running",
                            accumulated_seconds = 1,
                        });
                    },
                    abandonAdventure: null,
                    proposeGoal: input =>
                        Task.FromResult<SupabaseChildGoalProposalResult>(null),
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
                Assert.IsNotNull(FindButton(childHomePanel, "通知"));
                Assert.IsNotNull(FindButton(childHomePanel, "登出"));
                Assert.IsNotNull(FindButton(childHomePanel, "家長模式"));
                AssertButtonsDoNotOverlap(
                    childHomePanel,
                    "合作冒險",
                    "家長模式");
                Button reportTaskButton = FindButtonContaining(childHomePanel, "喝水");
                Assert.IsNotNull(reportTaskButton);
                reportTaskButton.onClick.Invoke();
                GameObject reportPanel = GameObject.Find("TaskReportPanel");
                Assert.IsNotNull(reportPanel);
                Button quickReportButton = FindButton(reportPanel, "順利完成");
                Assert.IsNotNull(quickReportButton);
                quickReportButton.onClick.Invoke();
                yield return null;
                Assert.IsTrue(childTaskSubmitted, "Child completion callback was not invoked.");
                Assert.IsNull(GameObject.Find("TaskReportPanel"));

                Button timerTaskButton = FindButtonContaining(childHomePanel, "閱讀10分鐘");
                Assert.IsNotNull(timerTaskButton);
                timerTaskButton.onClick.Invoke();
                GameObject timerPanel = GameObject.Find("TaskTimerPanel");
                Assert.IsNotNull(timerPanel);
                Button timerActionButton = FindButton(timerPanel, "開始計時");
                Assert.IsNotNull(timerActionButton);
                timerActionButton.onClick.Invoke();
                yield return null;
                Assert.IsTrue(timerStarted, "Timer start callback was not invoked.");
                timerActionButton = FindButton(timerPanel, "暫停計時");
                Assert.IsNotNull(timerActionButton);
                timerActionButton.onClick.Invoke();
                yield return null;
                Assert.IsTrue(timerPaused, "Timer pause callback was not invoked.");
                timerActionButton = FindButton(timerPanel, "繼續計時");
                Assert.IsNotNull(timerActionButton);
                timerActionButton.onClick.Invoke();
                yield return null;
                Assert.IsTrue(timerResumed, "Timer resume callback was not invoked.");
                FindButton(timerPanel, "關閉").onClick.Invoke();
                yield return null;

                OpenPanelFromHome(childHomePanel, "冒險商店", "ChildGamePanel");
                OpenPanelFromHome(childHomePanel, "世界", "ChildWorldPanel");
                OpenPanelFromHome(childHomePanel, "好友", "ChildSocialPanel");
                OpenPanelFromHome(childHomePanel, "獎勵商店", "RewardPanel");
                OpenPanelFromHome(childHomePanel, "點數紀錄", "ChildLedgerPanel");
                OpenPanelFromHome(childHomePanel, "成長", "ChildGrowthPanel");
                OpenPanelFromHome(childHomePanel, "設定", "ChildSettingsPanel");
                OpenPanelFromHome(childHomePanel, "建立冒險", "ChildGoalProposalPanel");
                OpenPanelFromHome(childHomePanel, "合作冒險", "ChildCoopAdventurePanel");

                parentView.Show(
                    snapshot: parentSnapshot,
                    reviewTask: (task, approved, points, feedback, mood, difficulty, reflection) =>
                    {
                        parentTaskReviewed = task != null && task.id == "fixture-review-task";
                        parentReviewApproved = approved;
                        parentReviewPoints = points ?? -1;
                        task.status = approved ? "completed" : "revision_requested";
                        child.points_balance += points ?? 0;
                        return Task.FromResult(new SupabaseParentTaskReviewResult
                        {
                            Task = task,
                            RefreshedSnapshot = parentSnapshot,
                        });
                    },
                    batchReviewDailyAdventures: taskIds =>
                        Task.FromResult<SupabaseParentBatchReviewResult>(null),
                    revokeTaskApproval: taskId =>
                        Task.FromResult<SupabaseParentTaskApprovalReversalResult>(null),
                    confirmChildGoal: (task, feedback, points, mood) =>
                        Task.FromResult<SupabaseParentTaskReviewResult>(null),
                    returnChildGoal: (task, feedback) =>
                        Task.FromResult<SupabaseParentTaskReviewResult>(null),
                    approveWishlist: (wishlist, points) =>
                        Task.FromResult<SupabaseParentRewardMutationResult>(null),
                    fulfillTicket: ticketId =>
                        Task.FromResult<SupabaseParentRewardMutationResult>(null),
                    createTask: input =>
                        Task.FromResult<SupabaseParentTaskMutationResult>(null),
                    updateTask: (taskId, input) =>
                        Task.FromResult<SupabaseParentTaskMutationResult>(null),
                    deleteTask: taskId =>
                        Task.FromResult<SupabaseParentTaskMutationResult>(null),
                    createTaskTemplate: input =>
                        Task.FromResult<SupabaseParentTaskTemplateMutationResult>(null),
                    updateTaskTemplate: (templateId, input) =>
                        Task.FromResult<SupabaseParentTaskTemplateMutationResult>(null),
                    deleteTaskTemplate: templateId =>
                        Task.FromResult<SupabaseParentTaskTemplateMutationResult>(null),
                    createGeneralAdventure: input =>
                        Task.FromResult<SupabaseParentAdventureMutationResult>(null),
                    updateGeneralAdventureTitle: (groupId, title) =>
                        Task.FromResult<SupabaseParentAdventureTitleMutationResult>(null),
                    loadAdventureSchedules: () =>
                        Task.FromResult(new SupabaseParentAdventureScheduleRecord[0]),
                    createAdventureSchedule: input =>
                        Task.FromResult(new string[0]),
                    updateAdventureSchedule: (scheduleId, input) =>
                        Task.FromResult<SupabaseParentAdventureScheduleRecord>(null),
                    disableAdventureSchedule: scheduleId =>
                        Task.FromResult<SupabaseParentAdventureScheduleRecord>(null),
                    createReward: input =>
                        Task.FromResult<SupabaseParentRewardMutationResult>(null),
                    updateReward: (reward, name, points) =>
                        Task.FromResult<SupabaseParentRewardMutationResult>(null),
                    deleteReward: rewardId =>
                        Task.FromResult<SupabaseParentRewardMutationResult>(null),
                    adjustPoints: (childId, points, reason) =>
                        Task.FromResult<SupabaseParentPointMutationResult>(null),
                    createChildAccount: input =>
                        Task.FromResult<SupabaseParentChildAccountMutationResult>(null),
                    resetChildPassword: (childId, password) =>
                        Task.FromResult<SupabaseParentChildAccountMutationResult>(null),
                    updateChildName: (childId, name) =>
                        Task.FromResult<SupabaseParentChildAccountMutationResult>(null),
                    deleteChildAccount: childId =>
                        Task.FromResult<SupabaseParentChildAccountMutationResult>(null),
                    loadGameStore: () => Task.FromResult(childGameData),
                    setGamePrice: (catalogItemId, price) =>
                        Task.FromResult(childGameData),
                    resetGamePrice: catalogItemId => Task.FromResult(childGameData),
                    listCoopAdventures: childId =>
                        Task.FromResult(new SupabaseCoopAdventureSummary[0]),
                    loadCoopAdventureState: adventureId =>
                        Task.FromResult<SupabaseCoopAdventureState>(null),
                    reviewCoopCompletion: (completionId, input) =>
                        Task.FromResult<SupabaseCoopMutationResult>(null),
                    recordParentConsent: version =>
                        Task.FromResult<SupabaseParentConsentRecord>(null),
                    updateParentPassword: (currentPassword, newPassword) =>
                        Task.CompletedTask,
                    deleteParentAccount: () => Task.CompletedTask,
                    enterChildMode: childId => Task.FromResult(false),
                    onSignOut: () => { },
                    onOpenNotificationSettings: () => { });

                GameObject parentHomePanel = GameObject.Find("ParentHomePanel");
                Assert.IsNotNull(parentHomePanel);
                Assert.IsNotNull(FindButton(parentHomePanel, "通知"));
                Assert.IsNotNull(FindButton(parentHomePanel, "登出"));
                Button pendingTaskButton = FindButtonContaining(parentHomePanel, "整理書桌");
                Assert.IsNotNull(pendingTaskButton);
                pendingTaskButton.onClick.Invoke();
                GameObject reviewPanel = GameObject.Find("ParentTaskReviewPanel");
                Assert.IsNotNull(reviewPanel);
                Button approveTaskButton = FindButton(reviewPanel, "核准完成");
                Assert.IsNotNull(approveTaskButton);
                approveTaskButton.onClick.Invoke();
                yield return null;
                Assert.IsTrue(parentTaskReviewed, "Parent review callback was not invoked.");
                Assert.IsTrue(parentReviewApproved, "Parent review did not approve the task.");
                Assert.AreEqual(7, parentReviewPoints);
                Assert.IsNull(GameObject.Find("ParentTaskReviewPanel"));
                OpenPanelFromHome(parentHomePanel, "設定", "ParentSettingsPanel");
                OpenPanelFromHome(parentHomePanel, "孩子視角", "ParentChildPreviewPanel");
                OpenPanelFromHome(parentHomePanel, "任務管理", "ParentTaskManagementPanel");
                OpenPanelFromHome(parentHomePanel, "建立孩子任務", "ParentTaskCreatePanel");
                OpenPanelFromHome(parentHomePanel, "任務模板", "ParentTaskTemplatePanel");
                OpenPanelFromHome(
                    parentHomePanel,
                    "一般冒險",
                    "ParentGeneralAdventureManagementPanel");
                OpenPanelFromHome(
                    parentHomePanel,
                    "每日排程",
                    "ParentAdventureSchedulePanel");
                OpenPanelFromHome(parentHomePanel, "孩子帳號", "ParentChildAccountPanel");
                OpenPanelFromHome(parentHomePanel, "合作批改", "ParentCoopAdventurePanel");
                OpenPanelFromHome(parentHomePanel, "商店價格", "ParentGamePricePanel");
                OpenPanelFromHome(parentHomePanel, "成長", "ParentGrowthPanel");
                OpenPanelFromHome(parentHomePanel, "批核", "ParentBatchReviewPanel");
                OpenPanelFromHome(parentHomePanel, "願望與獎勵券", "ParentRewardPanel");
                GameObject parentRewardPanel = GameObject.Find("ParentRewardPanel");
                Assert.IsNotNull(parentRewardPanel);
                Button manageRewardButton = FindButton(parentRewardPanel, "管理獎勵");
                Assert.IsNotNull(manageRewardButton);
                manageRewardButton.onClick.Invoke();
                Assert.IsNotNull(GameObject.Find("ParentRewardManagementPanel"));
                OpenPanelFromHome(parentHomePanel, "願望與獎勵券", "ParentRewardPanel");
                parentRewardPanel = GameObject.Find("ParentRewardPanel");
                Assert.IsNotNull(parentRewardPanel);
                Button adjustPointsButton = FindButton(parentRewardPanel, "調整點數");
                Assert.IsNotNull(adjustPointsButton);
                adjustPointsButton.onClick.Invoke();
                Assert.IsNotNull(GameObject.Find("ParentPointAdjustmentPanel"));
                OpenPanelFromHome(parentHomePanel, "願望與獎勵券", "ParentRewardPanel");
                parentRewardPanel = GameObject.Find("ParentRewardPanel");
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
            Assert.IsNull(GameObject.Find("ChildGrowthPanel"));
            Assert.IsNull(GameObject.Find("ChildSettingsPanel"));
            Assert.IsNull(GameObject.Find("ChildGoalProposalPanel"));
            Assert.IsNull(GameObject.Find("ChildCoopAdventurePanel"));
            Assert.IsNull(GameObject.Find("TaskTimerPanel"));
            Assert.IsNull(GameObject.Find("TaskReportPanel"));
            Assert.IsNull(GameObject.Find("ParentHomePanel"));
            Assert.IsNull(GameObject.Find("ParentTaskReviewPanel"));
            Assert.IsNull(GameObject.Find("ParentSettingsPanel"));
            Assert.IsNull(GameObject.Find("ParentChildPreviewPanel"));
            Assert.IsNull(GameObject.Find("ParentTaskManagementPanel"));
            Assert.IsNull(GameObject.Find("ParentTaskCreatePanel"));
            Assert.IsNull(GameObject.Find("ParentTaskTemplatePanel"));
            Assert.IsNull(GameObject.Find("ParentGeneralAdventureManagementPanel"));
            Assert.IsNull(GameObject.Find("ParentAdventureSchedulePanel"));
            Assert.IsNull(GameObject.Find("ParentChildAccountPanel"));
            Assert.IsNull(GameObject.Find("ParentCoopAdventurePanel"));
            Assert.IsNull(GameObject.Find("ParentGamePricePanel"));
            Assert.IsNull(GameObject.Find("ParentGrowthPanel"));
            Assert.IsNull(GameObject.Find("ParentBatchReviewPanel"));
            Assert.IsNull(GameObject.Find("ParentRewardPanel"));
            Assert.IsNull(GameObject.Find("ParentRewardManagementPanel"));
            Assert.IsNull(GameObject.Find("ParentPointAdjustmentPanel"));
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
            GameObject panel = GameObject.Find(panelName);
            Assert.IsNotNull(panel, "Panel did not open: " + panelName);
            AssertNoOverlappingButtons(panel);
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

        private static Button FindButtonContaining(GameObject root, string labelFragment)
        {
            foreach (Button button in root.GetComponentsInChildren<Button>(true))
            {
                Text text = button.GetComponentInChildren<Text>(true);
                if (text != null && text.text.Contains(labelFragment))
                {
                    return button;
                }
            }

            return null;
        }

        private static void AssertButtonsDoNotOverlap(
            GameObject root,
            string firstLabel,
            string secondLabel)
        {
            Button first = FindButton(root, firstLabel);
            Button second = FindButton(root, secondLabel);
            Assert.IsNotNull(first, "Missing first overlap-check button: " + firstLabel);
            Assert.IsNotNull(second, "Missing second overlap-check button: " + secondLabel);

            RectTransform firstRect = first.GetComponent<RectTransform>();
            RectTransform secondRect = second.GetComponent<RectTransform>();
            Vector3[] firstCorners = new Vector3[4];
            Vector3[] secondCorners = new Vector3[4];
            firstRect.GetWorldCorners(firstCorners);
            secondRect.GetWorldCorners(secondCorners);

            bool overlaps = firstCorners[0].x < secondCorners[2].x
                && firstCorners[2].x > secondCorners[0].x
                && firstCorners[0].y < secondCorners[2].y
                && firstCorners[2].y > secondCorners[0].y;
            Assert.IsFalse(
                overlaps,
                "Buttons overlap: " + firstLabel + " / " + secondLabel);
        }

        private static void AssertNoOverlappingButtons(GameObject root)
        {
            Canvas.ForceUpdateCanvases();
            Button[] buttons = root.GetComponentsInChildren<Button>(true);
            for (int firstIndex = 0; firstIndex < buttons.Length; firstIndex += 1)
            {
                RectTransform firstRect = buttons[firstIndex].GetComponent<RectTransform>();
                if (firstRect == null) continue;
                Vector3[] firstCorners = new Vector3[4];
                firstRect.GetWorldCorners(firstCorners);
                for (int secondIndex = firstIndex + 1;
                    secondIndex < buttons.Length;
                    secondIndex += 1)
                {
                    RectTransform secondRect = buttons[secondIndex].GetComponent<RectTransform>();
                    if (secondRect == null) continue;
                    Vector3[] secondCorners = new Vector3[4];
                    secondRect.GetWorldCorners(secondCorners);
                    bool overlaps = firstCorners[0].x < secondCorners[2].x
                        && firstCorners[2].x > secondCorners[0].x
                        && firstCorners[0].y < secondCorners[2].y
                        && firstCorners[2].y > secondCorners[0].y;
                    if (!overlaps) continue;

                    Text firstText = buttons[firstIndex].GetComponentInChildren<Text>(true);
                    Text secondText = buttons[secondIndex].GetComponentInChildren<Text>(true);
                    string firstLabel = firstText == null ? buttons[firstIndex].name : firstText.text;
                    string secondLabel = secondText == null ? buttons[secondIndex].name : secondText.text;
                    Assert.Fail(
                        "Buttons overlap in " + root.name + ": "
                        + firstLabel + " / " + secondLabel);
                }
            }
        }
    }
}
