using System.Collections;
using System.Collections.Generic;
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
    }
}
