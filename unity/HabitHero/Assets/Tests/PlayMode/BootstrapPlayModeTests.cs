using System.Collections;
using System.Collections.Generic;
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
                foreach (MonoBehaviour component in Object.FindObjectsByType<MonoBehaviour>(
                    FindObjectsInactive.Include,
                    FindObjectsSortMode.None))
                {
                    if (component != null && component.GetType().FullName ==
                        "HabitHero.App.HabitHeroBootstrap")
                    {
                        hasBootstrap = true;
                        break;
                    }
                }

                Assert.IsTrue(hasBootstrap, "Bootstrap component was not created.");

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
    }
}
