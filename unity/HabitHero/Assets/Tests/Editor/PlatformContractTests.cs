using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
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

        [Test]
        public void SupabaseSessionPersistsOnlyThroughTheInjectedStore()
        {
            SupabaseSession session = new SupabaseSession
            {
                access_token = "access-token",
                refresh_token = "refresh-token",
                expires_at = 1234567890,
                user = new SupabaseUser { id = "user-1", email = "parent@example.com" },
            };
            string serialized = SupabaseSessionSerializer.Serialize(session);
            SupabaseSession restored;
            string error;

            Assert.IsTrue(
                SupabaseSessionSerializer.TryDeserialize(serialized, out restored, out error),
                error);
            Assert.AreEqual("access-token", restored.AccessToken);
            Assert.AreEqual("refresh-token", restored.RefreshToken);
            Assert.AreEqual("user-1", restored.User.Id);

            InMemorySupabaseSessionStore store = new InMemorySupabaseSessionStore();
            store.Save(serialized);
            Assert.AreEqual(serialized, store.Load());
            store.Clear();
            Assert.IsNull(store.Load());
        }

        [Test]
        public void IncompleteSavedSupabaseSessionsAreRejected()
        {
            SupabaseSession session;
            string error;

            Assert.IsFalse(
                SupabaseSessionSerializer.TryDeserialize(
                    "{\"access_token\":\"only-access\"}",
                    out session,
                    out error));
            StringAssert.Contains("incomplete", error);
        }

        [Test]
        public void SupabaseAuthResponseParserBuildsARefreshableSession()
        {
            SupabaseSession session;
            string error;

            bool parsed = SupabaseAuthResponseParser.TryParseSession(
                "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"user-1\",\"email\":\"parent@example.com\"}}",
                1000,
                out session,
                out error);

            Assert.IsTrue(parsed, error);
            Assert.AreEqual(4600, session.ExpiresAt);
            Assert.AreEqual("parent@example.com", session.User.Email);
        }

        [Test]
        public void SupabaseAuthErrorParserReturnsProviderMessage()
        {
            Assert.AreEqual(
                "Invalid login credentials",
                SupabaseAuthResponseParser.GetErrorMessage(
                    "{\"error_code\":\"invalid_credentials\",\"msg\":\"Invalid login credentials\"}",
                    400));
        }

        [Test]
        public void SupabaseAuthResponseParserRejectsMalformedSessionPayloads()
        {
            SupabaseSession session;
            string error;

            Assert.IsFalse(
                SupabaseAuthResponseParser.TryParseSession(
                    "{\"access_token\":\"access-token\",\"refresh_token\":",
                    1000,
                    out session,
                    out error));
            StringAssert.Contains("invalid", error);
        }

        [Test]
        public async Task AuthClientSignInPersistsSessionAndUsesThePublicClientHeaders()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore store = new InMemorySupabaseSessionStore();
            FakeSupabaseTransport transport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"user-1\",\"email\":\"parent@example.com\"}}",
                    null));
            SupabaseAuthClient client = new SupabaseAuthClient(settings, store, transport);
            SupabaseAuthEvent observedEvent = SupabaseAuthEvent.InitialSession;
            client.AuthStateChanged += (eventType, session) => observedEvent = eventType;

            SupabaseSession session = await client.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            Assert.AreEqual("user-1", session.User.Id);
            Assert.AreEqual(SupabaseAuthEvent.SignedIn, observedEvent);
            Assert.AreEqual(1, transport.Requests.Count);
            Assert.AreEqual("sb_publishable_test-key", transport.Requests[0].Headers["apikey"]);
            Assert.AreEqual(
                "https://example.supabase.co/auth/v1/token?grant_type=password",
                transport.Requests[0].Url);

            SupabaseSession persisted;
            string error;
            Assert.IsTrue(
                SupabaseSessionSerializer.TryDeserialize(store.Load(), out persisted, out error),
                error);
            Assert.AreEqual("refresh-token", persisted.RefreshToken);
        }

        [Test]
        public async Task AuthClientRefreshesAnExpiringPersistedSessionBeforeUse()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore store = new InMemorySupabaseSessionStore();
            store.Save(SupabaseSessionSerializer.Serialize(new SupabaseSession
            {
                access_token = "old-access-token",
                refresh_token = "old-refresh-token",
                expires_at = 1,
            }));
            FakeSupabaseTransport transport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"access_token\":\"new-access-token\",\"refresh_token\":\"new-refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"user-1\"}}",
                    null));
            SupabaseAuthClient client = new SupabaseAuthClient(settings, store, transport);

            SupabaseSession session = await client.InitializeAsync(CancellationToken.None);

            Assert.AreEqual("new-access-token", session.AccessToken);
            Assert.AreEqual(1, transport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/auth/v1/token?grant_type=refresh_token",
                transport.Requests[0].Url);
            Assert.AreEqual(
                "{\"refresh_token\":\"old-refresh-token\"}",
                transport.Requests[0].Body);
        }

        [Test]
        public async Task AuthClientClearsLocalSessionEvenWhenRemoteLogoutFails()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore store = new InMemorySupabaseSessionStore();
            FakeSupabaseTransport transport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(0, string.Empty, "offline"));
            SupabaseAuthClient client = new SupabaseAuthClient(settings, store, transport);
            SupabaseSession session;
            string error;
            Assert.IsTrue(
                client.TrySetSessionFromCallback(
                    "access-token",
                    "refresh-token",
                    false,
                    out session,
                    out error),
                error);

            bool threw = false;
            try
            {
                await client.SignOutAsync(CancellationToken.None);
            }
            catch (SupabaseAuthException)
            {
                threw = true;
            }

            Assert.IsTrue(threw);
            Assert.IsNull(client.CurrentSession);
            Assert.IsTrue(string.IsNullOrEmpty(store.Load()));
        }

        [Test]
        public void BootstrapSceneIsTheConfiguredUnityEntryPoint()
        {
            SceneAsset scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(
                "Assets/Scenes/Bootstrap.unity");
            Assert.IsNotNull(scene);

            bool isInBuildSettings = false;
            foreach (EditorBuildSettingsScene buildScene in EditorBuildSettings.scenes)
            {
                if (buildScene.path == "Assets/Scenes/Bootstrap.unity" && buildScene.enabled)
                {
                    isInBuildSettings = true;
                    break;
                }
            }

            Assert.IsTrue(isInBuildSettings);
        }

        private static SupabaseClientSettings CreateSettings()
        {
            SupabaseClientSettings settings;
            string error;
            Assert.IsTrue(
                SupabaseClientSettings.TryCreate(
                    "https://example.supabase.co",
                    "sb_publishable_test-key",
                    out settings,
                    out error),
                error);
            return settings;
        }

        private sealed class FakeSupabaseTransport : ISupabaseTransport
        {
            private readonly SupabaseHttpResponse response;

            public FakeSupabaseTransport(SupabaseHttpResponse response)
            {
                this.response = response;
            }

            public List<SupabaseRequestContract> Requests { get; } = new List<SupabaseRequestContract>();

            public Task<SupabaseHttpResponse> SendAsync(
                SupabaseRequestContract request,
                CancellationToken cancellationToken)
            {
                Requests.Add(request);
                return Task.FromResult(response);
            }
        }
    }
}
