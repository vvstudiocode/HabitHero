#if UNITY_EDITOR
using System;
using System.IO;
using System.Xml;
using HabitHero.Platform;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEngine;

namespace HabitHero.Editor
{
    public static class HabitHeroDeepLinkPostProcess
    {
        private const string AndroidNamespace = "http://schemas.android.com/apk/res/android";

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
                AddAndroidIntentFilter(buildPath);
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
                "/manifest/application/activity[intent-filter/action[@android:name='android.intent.action.MAIN']]",
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

        private static string FindAndroidManifest(string buildPath)
        {
            string[] candidates = Directory.GetFiles(
                buildPath,
                "AndroidManifest.xml",
                SearchOption.AllDirectories);
            foreach (string candidate in candidates)
            {
                if (candidate.Replace('\\', '/').Contains("/launcher/src/main/"))
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
