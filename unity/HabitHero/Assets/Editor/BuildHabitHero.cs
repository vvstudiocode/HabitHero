using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;

namespace HabitHero.Editor
{
    public static class BuildHabitHero
    {
        public static void BuildWebGL()
        {
            Build(
                BuildTarget.WebGL,
                ResolveOutputPath("Builds/WebGL"));
        }

        public static void BuildMacStandalone()
        {
            Build(
                BuildTarget.StandaloneOSX,
                ResolveOutputPath("Builds/HabitHero.app"));
        }

        private static void Build(BuildTarget target, string outputPath)
        {
            string[] scenes = EditorBuildSettings.scenes
                .Where(scene => scene.enabled && !string.IsNullOrWhiteSpace(scene.path))
                .Select(scene => scene.path)
                .ToArray();
            if (scenes.Length == 0)
            {
                throw new InvalidOperationException(
                    "HabitHero build requires at least one enabled scene.");
            }

            string parentDirectory = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrWhiteSpace(parentDirectory))
            {
                Directory.CreateDirectory(parentDirectory);
            }

            BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = outputPath,
                target = target,
                options = BuildOptions.StrictMode,
            });
            if (report.summary.result != BuildResult.Succeeded)
            {
                throw new InvalidOperationException(
                    "HabitHero Unity build failed: " + report.summary.result);
            }

            UnityEngine.Debug.Log(
                "HabitHero Unity build succeeded: " + target + " -> " + outputPath);
        }

        private static string ResolveOutputPath(string fallback)
        {
            string configured = Environment.GetEnvironmentVariable(
                "HABITHERO_UNITY_BUILD_PATH");
            return string.IsNullOrWhiteSpace(configured)
                ? fallback
                : configured.Trim();
        }
    }
}
