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
        public void RestBuilderScopesTableReadsToTheCurrentSession()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseRequestContract request;
            string error;

            bool created = SupabaseRestRequestBuilder.TryBuildTableSelect(
                settings,
                "tasks",
                new[] { new SupabaseRestFilter("child_profile_id", "eq", "child-1") },
                "*",
                "created_at.desc",
                100,
                "access-token",
                out request,
                out error);

            Assert.IsTrue(created, error);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/tasks?select=*&child_profile_id=eq.child-1&order=created_at.desc&limit=100",
                request.Url);
            Assert.AreEqual("Bearer access-token", request.Headers["Authorization"]);
            Assert.AreEqual("sb_publishable_test-key", request.Headers["apikey"]);
        }

        [Test]
        public void JsonArrayParserMapsPostgrestChildTaskRows()
        {
            SupabaseChildTaskRecord[] tasks;
            string error;

            bool parsed = SupabaseJsonArrayParser.TryParseArray(
                "[{\"id\":\"task-1\",\"name\":\"整理書包\",\"points\":10,\"status\":\"todo\"}]",
                out tasks,
                out error);

            Assert.IsTrue(parsed, error);
            Assert.AreEqual(1, tasks.Length);
            Assert.AreEqual("task-1", tasks[0].id);
            Assert.AreEqual("整理書包", tasks[0].name);
            Assert.AreEqual(10, tasks[0].points);
            Assert.AreEqual("todo", tasks[0].status);
        }

        [Test]
        public async Task ChildHomeClientLoadsRlsScopedDataAndSubmitsReflection()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            FakeSupabaseTransport authTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                    null));
            SupabaseAuthClient authClient = new SupabaseAuthClient(settings, authStore, authTransport);
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"role\":\"child\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"display_name\":\"小明\",\"points_balance\":12}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"task-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"整理書包\",\"points\":10,\"status\":\"todo\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null));
            SupabaseRestClient restClient = new SupabaseRestClient(settings, authClient, dataTransport);
            SupabaseChildHomeClient childClient = new SupabaseChildHomeClient(restClient);

            SupabaseChildHomeSnapshot snapshot = await childClient.LoadAsync(CancellationToken.None);

            Assert.AreEqual("family-1", snapshot.familyId);
            Assert.AreEqual("child-1", snapshot.child.id);
            Assert.AreEqual(12, snapshot.child.points_balance);
            Assert.AreEqual(1, snapshot.tasks.Length);
            Assert.AreEqual("task-1", snapshot.tasks[0].id);
            Assert.AreEqual(8, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/family_members?select=*&profile_id=eq.child-user-1",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/ensure_daily_adventure_occurrences",
                dataTransport.Requests[2].Url);
            Assert.AreEqual(
                "{\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[2].Body);

            SupabaseTaskCompletionResult reflectionResult =
                await childClient.SubmitTaskCompletionAsync(
                "task-1",
                null,
                "完成了",
                "happy",
                3,
                CancellationToken.None);
            Assert.AreEqual(9, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/submit_adventure_completion",
                dataTransport.Requests[8].Url);
            StringAssert.Contains(
                "{\"target_task_id\":\"task-1\",\"idempotency_key\":\""
                    + reflectionResult.IdempotencyKey
                    + "\",\"quick_report\":null,\"reflection\":\"完成了\",\"mood\":\"happy\",\"difficulty\":3}",
                dataTransport.Requests[8].Body);
        }

        [Test]
        public void TaskCompletionQueueDeduplicatesByTaskAndPersistsOwnerScope()
        {
            InMemorySupabaseTaskCompletionQueueStore store =
                new InMemorySupabaseTaskCompletionQueueStore();
            SupabaseTaskCompletionQueue queue = new SupabaseTaskCompletionQueue(store);
            SupabaseTaskCompletionQueueEntry first = new SupabaseTaskCompletionQueueEntry
            {
                ownerUserId = "user-1",
                taskId = "task-1",
                idempotencyKey = "key-1",
                queuedAt = "2026-09-08T06:00:00Z",
                reflection = "完成了",
                mood = "happy",
                difficulty = 3,
                hasDifficulty = true,
            };

            queue.Enqueue(first);
            queue.Enqueue(new SupabaseTaskCompletionQueueEntry
            {
                ownerUserId = "user-1",
                taskId = "task-1",
                idempotencyKey = "key-2",
                queuedAt = "2026-09-08T06:01:00Z",
                reflection = "更新後的回報",
            });

            List<SupabaseTaskCompletionQueueEntry> entries = queue.Load("user-1");
            Assert.AreEqual(1, entries.Count);
            Assert.AreEqual("key-2", entries[0].idempotencyKey);
            Assert.AreEqual(0, queue.Load("other-user").Count);

            queue.Remove("user-1", "key-2");
            Assert.AreEqual(0, queue.Load("user-1").Count);
        }

        [Test]
        public async Task ChildCompletionUsesIdempotentRpcAndFlushesOfflineQueue()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            FakeSupabaseTransport authTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                    null));
            SupabaseAuthClient authClient = new SupabaseAuthClient(settings, authStore, authTransport);
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            InMemorySupabaseTaskCompletionQueueStore queueStore =
                new InMemorySupabaseTaskCompletionQueueStore();
            FakeSupabaseTransport onlineTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "{}", null));
            SupabaseChildHomeClient onlineClient = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, onlineTransport),
                queueStore,
                () => true);

            SupabaseTaskCompletionResult onlineResult =
                await onlineClient.SubmitTaskCompletionAsync(
                    "task-1",
                    null,
                    null,
                    null,
                    null,
                    CancellationToken.None);

            Assert.IsFalse(onlineResult.QueuedForRetry);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/submit_adventure_completion",
                onlineTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_task_id\":\"task-1\",\"idempotency_key\":\""
                    + onlineResult.IdempotencyKey
                    + "\",\"quick_report\":null,\"reflection\":null,\"mood\":null,\"difficulty\":null}",
                onlineTransport.Requests[0].Body);

            FakeSupabaseTransport offlineTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(0, string.Empty, "offline"));
            SupabaseChildHomeClient offlineClient = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, offlineTransport),
                queueStore,
                () => false);
            SupabaseTaskCompletionResult queuedResult =
                await offlineClient.SubmitTaskCompletionAsync(
                    "task-2",
                    "smooth",
                    null,
                    null,
                    null,
                    CancellationToken.None);

            Assert.IsTrue(queuedResult.QueuedForRetry);
            Assert.AreEqual(1, offlineClient.PendingCompletionCount);
            Assert.AreEqual(0, offlineTransport.Requests.Count);

            FakeSupabaseTransport flushTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "{}", null));
            SupabaseChildHomeClient flushClient = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, flushTransport),
                queueStore,
                () => true);
            SupabaseTaskCompletionFlushResult flushResult =
                await flushClient.FlushPendingCompletionsAsync(CancellationToken.None);

            Assert.AreEqual(1, flushResult.SucceededCount);
            Assert.AreEqual(0, flushResult.RemainingCount);
            Assert.AreEqual(1, flushTransport.Requests.Count);
            StringAssert.Contains(
                "\"idempotency_key\":\"" + queuedResult.IdempotencyKey + "\"",
                flushTransport.Requests[0].Body);
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
            private readonly Queue<SupabaseHttpResponse> responses;

            public FakeSupabaseTransport(SupabaseHttpResponse response)
                : this(new[] { response })
            {
            }

            public FakeSupabaseTransport(params SupabaseHttpResponse[] responses)
            {
                this.responses = new Queue<SupabaseHttpResponse>(responses);
            }

            public List<SupabaseRequestContract> Requests { get; } = new List<SupabaseRequestContract>();

            public Task<SupabaseHttpResponse> SendAsync(
                SupabaseRequestContract request,
                CancellationToken cancellationToken)
            {
                Requests.Add(request);
                SupabaseHttpResponse response = responses.Count > 1
                    ? responses.Dequeue()
                    : responses.Peek();
                return Task.FromResult(response);
            }
        }
    }
}
