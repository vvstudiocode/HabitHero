using HabitHero.Platform;
using NUnit.Framework;
using UnityEditor;

namespace HabitHero.Tests
{
    public sealed class PlatformContractTests
    {
        [Test]
        public void ValidSupabaseSettingsKeepThePublicClientBoundary()
        {
            SupabaseClientSettings settings;
            string error;

            bool created = SupabaseClientSettings.TryCreate(
                "https://example.supabase.co",
                "sb_publishable_test-key",
                out settings,
                out error);

            Assert.IsTrue(created, error);
            Assert.AreEqual("https://example.supabase.co", settings.Url);
            Assert.AreEqual("sb_publishable_test-key", settings.PublishableKey);
        }

        [Test]
        public void ServerSecretsAreRejectedByTheUnityClient()
        {
            SupabaseClientSettings settings;
            string error;

            bool created = SupabaseClientSettings.TryCreate(
                "https://example.supabase.co",
                "service_role_secret",
                out settings,
                out error);

            Assert.IsFalse(created);
            StringAssert.Contains("server secret", error);
        }

        [Test]
        public void RecoveryFragmentProducesTheSameIntentAsTheWebClient()
        {
            string callback = "https://habit-hero.vercel.app/#access_token=access-123&refresh_token=refresh-456&type=recovery";
            AuthCallbackPayload payload = AuthCallbackParser.Parse(callback);

            Assert.IsTrue(payload.HasSessionPayload);
            Assert.AreEqual("access-123", payload.AccessToken);
            Assert.AreEqual(AuthIntent.PasswordRecovery, AuthCallbackParser.GetIntent(callback));
        }

        [Test]
        public void LoginDeepLinkPreservesOAuthCode()
        {
            string callback = "com.vvstudiocode.habithero://login?code=oauth-code";
            AuthCallbackPayload payload = AuthCallbackParser.Parse(callback);

            Assert.AreEqual("oauth-code", payload.Code);
            Assert.AreEqual(AuthIntent.Login, AuthCallbackParser.GetIntent(callback));
        }

        [Test]
        public void RpcBuilderUsesPublishableKeyAndSessionToken()
        {
            SupabaseClientSettings settings;
            string error;
            SupabaseClientSettings.TryCreate(
                "https://example.supabase.co",
                "sb_publishable_test-key",
                out settings,
                out error);

            SupabaseRequestContract request;
            bool created = SupabaseRequestBuilder.TryBuildRpc(
                settings,
                "purchase_game_item",
                "access-token",
                "{\"item_id\":\"item-1\"}",
                out request,
                out error);

            Assert.IsTrue(created, error);
            Assert.AreEqual("Bearer access-token", request.Headers["Authorization"]);
            Assert.AreEqual("sb_publishable_test-key", request.Headers["apikey"]);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/purchase_game_item",
                request.Url);
        }

        [Test]
        public void ProductionStoreIdentityMatchesTheExistingApp()
        {
            Assert.AreEqual(
                "com.vvstudiocode.habithero",
                PlayerSettings.GetApplicationIdentifier(BuildTargetGroup.iOS));
            Assert.AreEqual(
                "com.vvstudiocode.habithero",
                PlayerSettings.GetApplicationIdentifier(BuildTargetGroup.Android));
        }
    }
}
