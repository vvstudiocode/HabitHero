#if UNITY_EDITOR
using System.Xml;
using HabitHero.Editor;
using NUnit.Framework;

namespace HabitHero.Tests
{
    public sealed class HabitHeroDeepLinkPostProcessTests
    {
        [Test]
        public void IosPlistNormalizationRemovesUnityEmptyInternalSubset()
        {
            const string malformedHeader =
                "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" +
                "<!DOCTYPE plist PUBLIC \"-//Apple Computer//DTD PLIST 1.0//EN\" " +
                "\"http://www.apple.com/DTDs/PropertyList-1.0.dtd\"[]>\n" +
                "<plist version=\"1.0\"><dict /></plist>";

            string normalized = HabitHeroDeepLinkPostProcess.NormalizeIosPlistXml(
                malformedHeader);

            StringAssert.DoesNotContain("\"[]>", normalized);
            StringAssert.DoesNotContain("<!DOCTYPE", normalized);
            XmlDocument document = new XmlDocument();
            Assert.DoesNotThrow(() => document.LoadXml(normalized));
        }
    }
}
#endif
