#if UNITY_EDITOR
using System;
using System.IO;
using System.Xml;
using HabitHero.Platform;
using UnityEditor;
using UnityEditor.Android;
using UnityEditor.Callbacks;
using UnityEngine;

namespace HabitHero.Editor
{
    public sealed class HabitHeroDeepLinkPostProcess : IPostGenerateGradleAndroidProject
    {
        private const string AndroidNamespace = "http://schemas.android.com/apk/res/android";
        private const string FirebaseMessagingDependency =
            "implementation 'com.google.firebase:firebase-messaging:25.1.2'";
        private const string GoogleServicesPlugin =
            "id 'com.google.gms.google-services' version '4.5.0' apply false";

        public int callbackOrder
        {
            get { return 100; }
        }

        public void OnPostGenerateGradleAndroidProject(string path)
        {
            string projectRoot = FindGradleProjectRoot(path);
            AddAndroidIntentFilter(projectRoot ?? path);
            AddAndroidFirebaseMessaging(projectRoot ?? path);
        }

        [PostProcessBuild(100)]
        public static void OnPostprocessBuild(BuildTarget target, string buildPath)
        {
            if (target == BuildTarget.iOS)
            {
                AddIosUrlScheme(buildPath);
                return;
            }

            if (target == BuildTarget.Android)
            {
                if (Directory.Exists(buildPath))
                {
                    AddAndroidIntentFilter(buildPath);
                    return;
                }

                if (File.Exists(buildPath))
                {
                    Debug.Log(
                        "HabitHero Android deep link was applied during Gradle project generation: " +
                        buildPath);
                    return;
                }

                Debug.LogWarning("HabitHero Android build output was not found: " + buildPath);
            }
        }

        private static void AddIosUrlScheme(string buildPath)
        {
            string plistPath = Path.Combine(buildPath, "Info.plist");
            if (!File.Exists(plistPath))
            {
                Debug.LogWarning("HabitHero iOS Info.plist was not found: " + plistPath);
                return;
            }

            XmlDocument document = new XmlDocument();
            document.Load(plistPath);
            XmlElement dictionary = document.SelectSingleNode("/plist/dict") as XmlElement;
            if (dictionary == null)
            {
                Debug.LogWarning("HabitHero iOS Info.plist has no root dict.");
                return;
            }

            XmlElement urlTypes = FindArrayForKey(document, dictionary, "CFBundleURLTypes");
            if (urlTypes == null)
            {
                XmlElement key = document.CreateElement("key");
                key.InnerText = "CFBundleURLTypes";
                dictionary.AppendChild(key);
                urlTypes = document.CreateElement("array");
                dictionary.AppendChild(urlTypes);
            }

            foreach (XmlNode entry in urlTypes.SelectNodes("dict"))
            {
                if (ContainsString(entry.SelectSingleNode("array"), AuthCallbackParser.AppUrlScheme))
                {
                    WriteXml(document, plistPath);
                    return;
                }
            }

            XmlElement urlEntry = document.CreateElement("dict");
            AppendKeyString(document, urlEntry, "CFBundleTypeRole", "Editor");
            XmlElement schemesKey = document.CreateElement("key");
            schemesKey.InnerText = "CFBundleURLSchemes";
            urlEntry.AppendChild(schemesKey);
            XmlElement schemes = document.CreateElement("array");
            XmlElement scheme = document.CreateElement("string");
            scheme.InnerText = AuthCallbackParser.AppUrlScheme;
            schemes.AppendChild(scheme);
            urlEntry.AppendChild(schemes);
            urlTypes.AppendChild(urlEntry);
            WriteXml(document, plistPath);
        }

        private static void AddAndroidIntentFilter(string buildPath)
        {
            string manifestPath = FindAndroidManifest(buildPath);
            if (manifestPath == null)
            {
                Debug.LogWarning("HabitHero AndroidManifest.xml was not found under: " + buildPath);
                return;
            }

            XmlDocument document = new XmlDocument();
            document.Load(manifestPath);
            XmlNamespaceManager namespaces = new XmlNamespaceManager(document.NameTable);
            namespaces.AddNamespace("android", AndroidNamespace);
            XmlElement activity = document.SelectSingleNode(
                "/manifest/application/activity[not(@android:enabled='false') and intent-filter/action[@android:name='android.intent.action.MAIN']]",
                namespaces) as XmlElement;
            if (activity == null)
            {
                Debug.LogWarning("HabitHero launcher activity was not found in: " + manifestPath);
                return;
            }

            foreach (XmlNode filter in activity.SelectNodes("intent-filter"))
            {
                if (ContainsAndroidScheme(filter, namespaces, AuthCallbackParser.AppUrlScheme))
                {
                    WriteXml(document, manifestPath);
                    return;
                }
            }

            XmlElement filterElement = document.CreateElement("intent-filter");
            AppendAndroidElement(document, filterElement, "action", "name", "android.intent.action.VIEW");
            AppendAndroidElement(document, filterElement, "category", "name", "android.intent.category.DEFAULT");
            AppendAndroidElement(document, filterElement, "category", "name", "android.intent.category.BROWSABLE");
            XmlElement data = document.CreateElement("data");
            SetAndroidAttribute(data, "scheme", AuthCallbackParser.AppUrlScheme);
            filterElement.AppendChild(data);
            activity.AppendChild(filterElement);
            WriteXml(document, manifestPath);
        }

        private static void AddAndroidFirebaseMessaging(string buildPath)
        {
            string projectRoot = FindGradleProjectRoot(buildPath);
            if (projectRoot == null) return;

            AddGradleDependency(
                Path.Combine(projectRoot, "unityLibrary", "build.gradle"));
            AddGradleDependency(
                Path.Combine(projectRoot, "launcher", "build.gradle"));

            string sourcePath = Path.Combine(
                Application.dataPath,
                "Plugins",
                "Android",
                "google-services.json");
            if (!File.Exists(sourcePath)) return;

            string launcherConfigPath = Path.Combine(
                projectRoot,
                "launcher",
                "google-services.json");
            File.Copy(sourcePath, launcherConfigPath, true);

            string rootBuildPath = Path.Combine(projectRoot, "build.gradle");
            string rootBuild = File.Exists(rootBuildPath)
                ? File.ReadAllText(rootBuildPath)
                : string.Empty;
            rootBuild = InsertIntoGradleBlock(
                rootBuild,
                "plugins {",
                GoogleServicesPlugin);
            File.WriteAllText(rootBuildPath, rootBuild);

            string launcherBuildPath = Path.Combine(
                projectRoot,
                "launcher",
                "build.gradle");
            string launcherBuild = File.Exists(launcherBuildPath)
                ? File.ReadAllText(launcherBuildPath)
                : string.Empty;
            if (!launcherBuild.Contains("com.google.gms.google-services"))
            {
                launcherBuild = "apply plugin: 'com.google.gms.google-services'\n"
                    + launcherBuild;
                File.WriteAllText(launcherBuildPath, launcherBuild);
            }
        }

        private static void AddGradleDependency(string path)
        {
            if (!File.Exists(path)) return;
            string source = File.ReadAllText(path);
            string updated = InsertIntoGradleBlock(
                source,
                "dependencies {",
                FirebaseMessagingDependency);
            if (updated != source) File.WriteAllText(path, updated);
        }

        private static string InsertIntoGradleBlock(
            string source,
            string blockStart,
            string line)
        {
            if (string.IsNullOrWhiteSpace(source)
                || source.Contains(line)) return source;
            int blockIndex = source.IndexOf(blockStart, StringComparison.Ordinal);
            if (blockIndex < 0) return source;
            int insertIndex = blockIndex + blockStart.Length;
            return source.Insert(insertIndex, "\n    " + line);
        }

        private static string FindGradleProjectRoot(string buildPath)
        {
            if (string.IsNullOrWhiteSpace(buildPath)) return null;
            DirectoryInfo current = new DirectoryInfo(buildPath);
            for (int depth = 0; current != null && depth < 6; depth += 1)
            {
                if (File.Exists(Path.Combine(current.FullName, "build.gradle"))
                    && File.Exists(Path.Combine(current.FullName, "launcher", "build.gradle"))
                    && File.Exists(Path.Combine(current.FullName, "unityLibrary", "build.gradle")))
                {
                    return current.FullName;
                }
                current = current.Parent;
            }

            return null;
        }

        private static string FindAndroidManifest(string buildPath)
        {
            string[] candidates = Directory.GetFiles(
                buildPath,
                "AndroidManifest.xml",
                SearchOption.AllDirectories);
            foreach (string candidate in candidates)
            {
                string source = File.ReadAllText(candidate);
                if (source.IndexOf(
                        "android.intent.action.MAIN",
                        StringComparison.Ordinal) >= 0)
                {
                    return candidate;
                }
            }

            return candidates.Length == 0 ? null : candidates[0];
        }

        private static XmlElement FindArrayForKey(
            XmlDocument document,
            XmlElement dictionary,
            string keyName)
        {
            XmlNodeList children = dictionary.ChildNodes;
            for (int index = 0; index < children.Count - 1; index += 1)
            {
                XmlElement key = children[index] as XmlElement;
                if (key == null || key.Name != "key" || key.InnerText != keyName) continue;
                return children[index + 1] as XmlElement;
            }

            return null;
        }

        private static bool ContainsString(XmlNode array, string value)
        {
            if (array == null) return false;
            foreach (XmlNode item in array.SelectNodes("string"))
            {
                if (item.InnerText == value) return true;
            }

            return false;
        }

        private static bool ContainsAndroidScheme(
            XmlNode filter,
            XmlNamespaceManager namespaces,
            string scheme)
        {
            string expression = "data[@android:scheme='" + scheme + "']";
            return filter.SelectSingleNode(expression, namespaces) != null;
        }

        private static void AppendKeyString(
            XmlDocument document,
            XmlElement dictionary,
            string keyName,
            string value)
        {
            XmlElement key = document.CreateElement("key");
            key.InnerText = keyName;
            dictionary.AppendChild(key);
            XmlElement element = document.CreateElement("string");
            element.InnerText = value;
            dictionary.AppendChild(element);
        }

        private static void AppendAndroidElement(
            XmlDocument document,
            XmlElement parent,
            string name,
            string attributeName,
            string value)
        {
            XmlElement element = document.CreateElement(name);
            SetAndroidAttribute(element, attributeName, value);
            parent.AppendChild(element);
        }

        private static void SetAndroidAttribute(
            XmlElement element,
            string name,
            string value)
        {
            XmlAttribute attribute = element.OwnerDocument.CreateAttribute(
                "android",
                name,
                AndroidNamespace);
            attribute.Value = value;
            element.Attributes.Append(attribute);
        }

        private static void WriteXml(XmlDocument document, string path)
        {
            XmlWriterSettings settings = new XmlWriterSettings
            {
                Indent = true,
                OmitXmlDeclaration = false,
            };
            using (XmlWriter writer = XmlWriter.Create(path, settings))
            {
                document.Save(writer);
            }
        }
    }
}
#endif
