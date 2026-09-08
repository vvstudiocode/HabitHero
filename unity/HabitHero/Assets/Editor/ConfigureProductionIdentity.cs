using UnityEditor;

namespace HabitHero.Editor
{
    public static class ConfigureProductionIdentity
    {
        private const string CompanyName = "vvstudiocode";
        private const string ProductName = "習慣冒險島";
        private const string BundleIdentifier = "com.vvstudiocode.habithero";
        private const string BundleVersion = "1.44";
        private const string BuildNumber = "49";

        [MenuItem("HabitHero/Configure Production Identity")]
        public static void Apply()
        {
            PlayerSettings.companyName = CompanyName;
            PlayerSettings.productName = ProductName;
            PlayerSettings.bundleVersion = BundleVersion;
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.iOS, BundleIdentifier);
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, BundleIdentifier);
            PlayerSettings.iOS.buildNumber = BuildNumber;
            PlayerSettings.Android.bundleVersionCode = int.Parse(BuildNumber);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            UnityEngine.Debug.Log("HabitHero production identity configured.");
        }
    }
}
