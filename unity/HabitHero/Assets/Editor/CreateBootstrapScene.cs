using System.Collections.Generic;
using System.IO;
using HabitHero.App;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace HabitHero.Editor
{
    public static class CreateBootstrapScene
    {
        private const string ScenePath = "Assets/Scenes/Bootstrap.unity";

        [MenuItem("HabitHero/Create Bootstrap Scene")]
        public static void Apply()
        {
            string scenesDirectory = Path.Combine(Application.dataPath, "Scenes");
            if (!Directory.Exists(scenesDirectory))
            {
                Directory.CreateDirectory(scenesDirectory);
            }

            Scene scene = EditorSceneManager.NewScene(
                NewSceneSetup.EmptyScene,
                NewSceneMode.Single);
            GameObject bootstrapObject = new GameObject("HabitHeroBootstrap");
            bootstrapObject.AddComponent<HabitHeroBootstrap>();
            SceneManager.MoveGameObjectToScene(bootstrapObject, scene);
            EditorSceneManager.SaveScene(scene, ScenePath);

            List<EditorBuildSettingsScene> buildScenes = new List<EditorBuildSettingsScene>();
            foreach (EditorBuildSettingsScene buildScene in EditorBuildSettings.scenes)
            {
                if (buildScene.path != ScenePath)
                {
                    buildScenes.Add(buildScene);
                }
            }

            buildScenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = buildScenes.ToArray();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("HabitHero Bootstrap scene created and added to Build Settings.");
        }
    }
}
