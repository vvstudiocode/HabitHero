using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.App;
using HabitHero.Platform;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

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
        public void GameAssetCatalogResolvesOnlyAllowListedPublicModels()
        {
            string modelUrl;
            bool resolved = HabitHeroGameAssetCatalog.TryResolveModelUrl(
                "pet.moko",
                "https://habit-hero-gilt.vercel.app",
                out modelUrl);

            Assert.IsTrue(resolved);
            Assert.AreEqual(
                "https://habit-hero-gilt.vercel.app/assets/pets/moko.glb",
                modelUrl);
            Assert.IsTrue(HabitHeroGameAssetCatalog.HasModel("character.arthur"));
            Assert.IsFalse(HabitHeroGameAssetCatalog.HasModel("character.anime-maiden"));
            Assert.IsFalse(HabitHeroGameAssetCatalog.TryResolveModelUrl(
                "../../private-secret",
                "https://habit-hero-gilt.vercel.app",
                out modelUrl));
        }

        [Test]
        public void WorldAssetCatalogPreservesAuthoredSceneModules()
        {
            string modelUrl;
            bool resolved = HabitHeroGameAssetCatalog.TryResolveModelUrl(
                "world.sunrise-village.island",
                "https://habit-hero-gilt.vercel.app",
                out modelUrl);

            Assert.IsTrue(resolved);
            Assert.AreEqual(
                "https://habit-hero-gilt.vercel.app/assets/world/sunrise-village/island.glb",
                modelUrl);

            HabitHeroWorldAssetModule[] modules;
            Assert.IsTrue(HabitHeroWorldAssetCatalog.TryGetModules("sunrise-village", out modules));
            Assert.IsTrue(modules.Length >= 3);
            bool foundSunriseIsland = false;
            foreach (HabitHeroWorldAssetModule module in modules)
            {
                if (module.AssetKey != "world.sunrise-village.island") continue;
                foundSunriseIsland = true;
                Assert.Less(module.Scale.x, -20f);
                break;
            }
            Assert.IsTrue(foundSunriseIsland);
            Assert.IsTrue(HabitHeroWorldAssetCatalog.TryGetModules("tideglow-archipelago", out modules));
            Assert.IsTrue(modules.Length >= 1);
            foreach (HabitHeroWorldAssetModule module in modules)
            {
                Assert.IsTrue(
                    HabitHeroGameAssetCatalog.HasModel(module.AssetKey),
                    "Missing world asset allow-list entry for " + module.AssetKey);
            }
            Assert.IsFalse(HabitHeroWorldAssetCatalog.TryGetModules("private-scene", out modules));
            Assert.IsFalse(HabitHeroGameAssetCatalog.HasModel("world.sunrise-village.private-secret"));
        }

        [Test]
        public void WorldSceneProfilesPreserveAuthoredSpawnAndMovementBoundaries()
        {
            HabitHeroWorldSceneProfile profile;

            Assert.IsTrue(HabitHeroWorldSceneProfileCatalog.TryGetProfile(
                "sunrise-village",
                out profile));
            AssertVector3(new Vector3(-0.18f, 0f, -0.95f), profile.SpawnPosition);
            Assert.AreEqual(12.4f, profile.MovementBoundary, 0.0001f);

            Assert.IsTrue(HabitHeroWorldSceneProfileCatalog.TryGetProfile(
                "forest-valley",
                out profile));
            AssertVector3(new Vector3(-0.12276f, 0f, 3.69f), profile.SpawnPosition);
            Assert.AreEqual(18.9f, profile.MovementBoundary, 0.0001f);

            Assert.IsTrue(HabitHeroWorldSceneProfileCatalog.TryGetProfile(
                "cloud-workshop",
                out profile));
            AssertVector3(Vector3.zero, profile.SpawnPosition);
            Assert.AreEqual(18.9f, profile.MovementBoundary, 0.0001f);

            Assert.IsTrue(HabitHeroWorldSceneProfileCatalog.TryGetProfile(
                "tideglow-archipelago",
                out profile));
            AssertVector3(new Vector3(3.477667f, 0f, 3.35779f), profile.SpawnPosition);
            Assert.AreEqual(6.25f, profile.MovementBoundary, 0.0001f);

            Assert.IsTrue(HabitHeroWorldSceneProfileCatalog.TryGetProfile(
                "star-sand-wasteland",
                out profile));
            AssertVector3(new Vector3(-0.0610376f, 0f, 4.41796f), profile.SpawnPosition);
            Assert.AreEqual(7.225f, profile.MovementBoundary, 0.0001f);

            Assert.IsFalse(HabitHeroWorldSceneProfileCatalog.TryGetProfile(
                "my-world",
                out profile));
        }

        [Test]
        public void WorldAssetCatalogContainsEveryAuthoredSceneModule()
        {
            AssertAuthoredSceneModuleCount("sunrise-village", 10);
            AssertAuthoredSceneModuleCount("forest-valley", 12);
            AssertAuthoredSceneModuleCount("cloud-workshop", 23);
            AssertAuthoredSceneModuleCount("tideglow-archipelago", 11);
            AssertAuthoredSceneModuleCount("star-sand-wasteland", 12);
        }

        [Test]
        public void WorldCollisionUsesAuthoredProxiesAndBlocksMovement()
        {
            HabitHeroWorldCollisionProxy[] proxies;
            Assert.IsTrue(
                HabitHeroWorldCollision.TryGetAuthoredProxies("sunrise-village", out proxies));
            Assert.AreEqual(6, proxies.Length);
            foreach (HabitHeroWorldCollisionProxy proxy in proxies)
            {
                Assert.Greater(proxy.Radius, 0f);
            }

            HabitHeroWorldCollisionProxy[] obstacle =
            {
                new HabitHeroWorldCollisionProxy(1f, 0f, 0.8f),
            };
            Vector2 blocked = HabitHeroWorldCollision.MoveCharacter(
                new Vector2(0f, 0f),
                new Vector2(2f, 0f),
                0.35f,
                obstacle,
                4.8f);
            Assert.AreEqual(0f, blocked.x, 0.0001f);
            Assert.AreEqual(0f, blocked.y, 0.0001f);

            Vector2 clamped = HabitHeroWorldCollision.MoveCharacter(
                new Vector2(0f, 0f),
                new Vector2(8f, -8f),
                0.35f,
                new HabitHeroWorldCollisionProxy[0],
                4.8f);
            Assert.AreEqual(4.45f, clamped.x, 0.0001f);
            Assert.AreEqual(-4.45f, clamped.y, 0.0001f);

            HabitHeroWorldCollisionProxy scaled =
                HabitHeroWorldCollision.CreateScaledProxy(2f, -1f, 0.4f, 2f);
            Assert.IsNotNull(scaled);
            Assert.AreEqual(0.8f, scaled.Radius, 0.0001f);
            Assert.IsNull(HabitHeroWorldCollision.CreateScaledProxy(0f, 0f, 0f, 1f));
        }

        [Test]
        public void WorldCameraOffsetMatchesWebRuntimeDefaults()
        {
            Vector3 offset = HabitHeroWorldCameraMath.GetOffset(
                Mathf.PI / 2f,
                0.18f,
                4.1f);
            Assert.AreEqual(4.0338f, offset.x, 0.0002f);
            Assert.AreEqual(0.8940f, offset.y, 0.0002f);
            Assert.AreEqual(0f, offset.z, 0.0002f);
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
            string callback = "com.vvstudiocode.habithero://login?code=oauth-code&code_verifier=pkce-verifier";
            AuthCallbackPayload payload = AuthCallbackParser.Parse(callback);

            Assert.AreEqual("oauth-code", payload.Code);
            Assert.AreEqual("pkce-verifier", payload.CodeVerifier);
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
        public void EdgeFunctionBuilderUsesTheAuthenticatedPublicBoundary()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseRequestContract request;
            string error;

            bool created = SupabaseRequestBuilder.TryBuildFunction(
                settings,
                "manage-child-account",
                "access-token",
                "{\"action\":\"reset-password\"}",
                out request,
                out error);

            Assert.IsTrue(created, error);
            Assert.AreEqual("POST", request.Method);
            Assert.AreEqual(
                "https://example.supabase.co/functions/v1/manage-child-account",
                request.Url);
            Assert.AreEqual("sb_publishable_test-key", request.Headers["apikey"]);
            Assert.AreEqual("Bearer access-token", request.Headers["Authorization"]);
            Assert.AreEqual("application/json", request.Headers["Content-Type"]);
            Assert.AreEqual(
                "{\"action\":\"reset-password\"}",
                request.Body);
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
        public void RestBuilderCreatesScopedWishlistMutations()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseRequestContract insertRequest;
            SupabaseRequestContract deleteRequest;
            string error;

            bool insertCreated = SupabaseRestRequestBuilder.TryBuildTableInsert(
                settings,
                "wishlist_items",
                "{\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"新畫筆\"}",
                "access-token",
                out insertRequest,
                out error);
            Assert.IsTrue(insertCreated, error);
            Assert.AreEqual("POST", insertRequest.Method);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/wishlist_items",
                insertRequest.Url);
            Assert.AreEqual(
                "{\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"新畫筆\"}",
                insertRequest.Body);
            Assert.AreEqual("return=minimal", insertRequest.Headers["Prefer"]);
            Assert.AreEqual("Bearer access-token", insertRequest.Headers["Authorization"]);

            bool deleteCreated = SupabaseRestRequestBuilder.TryBuildTableDelete(
                settings,
                "wishlist_items",
                new[] { new SupabaseRestFilter("id", "eq", "wish-1") },
                "access-token",
                out deleteRequest,
                out error);
            Assert.IsTrue(deleteCreated, error);
            Assert.AreEqual("DELETE", deleteRequest.Method);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/wishlist_items?id=eq.wish-1",
                deleteRequest.Url);
            Assert.AreEqual("Bearer access-token", deleteRequest.Headers["Authorization"]);

            SupabaseRequestContract updateRequest;
            bool updateCreated = SupabaseRestRequestBuilder.TryBuildTableUpdate(
                settings,
                "reward_redemptions",
                new[] { new SupabaseRestFilter("id", "eq", "ticket-1") },
                "{\"status\":\"fulfilled\",\"fulfilled_at\":\"2026-09-08T00:00:00Z\"}",
                "access-token",
                out updateRequest,
                out error);
            Assert.IsTrue(updateCreated, error);
            Assert.AreEqual("PATCH", updateRequest.Method);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/reward_redemptions?id=eq.ticket-1",
                updateRequest.Url);
            Assert.AreEqual("application/json", updateRequest.Headers["Content-Type"]);
        }

        [Test]
        public void RealtimeJoinUsesThePrivateChannelAndAuthenticatedSession()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseRealtimeChannelOptions options = new SupabaseRealtimeChannelOptions
            {
                Private = true,
                PresenceEnabled = true,
                PresenceKey = "connection-1",
                BroadcastSelf = false,
                BroadcastAck = false,
            };
            options.PostgresChanges.Add(new SupabaseRealtimePostgresChange
            {
                Event = "INSERT",
                Schema = "public",
                Table = "friend_world_messages",
                Filter = "world_owner_child_profile_id=eq.owner-1",
            });

            Assert.AreEqual(
                "wss://example.supabase.co/realtime/v1/websocket?apikey=sb_publishable_test-key&vsn=1.0.0",
                SupabaseRealtimeProtocol.BuildWebSocketUrl(settings));

            string join = SupabaseRealtimeProtocol.BuildJoin(
                "friend-world:owner-1",
                "1",
                "1",
                "access-token",
                options);

            StringAssert.Contains("\"topic\":\"realtime:friend-world:owner-1\"", join);
            StringAssert.Contains("\"event\":\"phx_join\"", join);
            StringAssert.Contains("\"private\":true", join);
            StringAssert.Contains("\"enabled\":true", join);
            StringAssert.Contains("\"key\":\"connection-1\"", join);
            StringAssert.Contains("\"table\":\"friend_world_messages\"", join);
            StringAssert.Contains("\"access_token\":\"access-token\"", join);
        }

        [Test]
        public void RealtimeProtocolBuildsHeartbeatBroadcastPresenceAndLeaveMessages()
        {
            Assert.AreEqual(
                "{\"topic\":\"phoenix\",\"event\":\"heartbeat\",\"payload\":{},\"ref\":\"2\"}",
                SupabaseRealtimeProtocol.BuildHeartbeat("2"));
            Assert.AreEqual(
                "{\"topic\":\"realtime:friend-world:owner-1\",\"event\":\"broadcast\",\"payload\":{\"type\":\"broadcast\",\"event\":\"avatar_state_v1\",\"payload\":{\"x\":1}},\"ref\":\"3\",\"join_ref\":\"1\"}",
                SupabaseRealtimeProtocol.BuildBroadcast(
                    "friend-world:owner-1",
                    "1",
                    "3",
                    "avatar_state_v1",
                    "{\"x\":1}"));
            Assert.AreEqual(
                "{\"topic\":\"realtime:friend-world:owner-1\",\"event\":\"presence\",\"payload\":{\"type\":\"presence\",\"event\":\"track\",\"payload\":{\"connectionId\":\"connection-1\"}},\"ref\":\"4\",\"join_ref\":\"1\"}",
                SupabaseRealtimeProtocol.BuildTrack(
                    "friend-world:owner-1",
                    "1",
                    "4",
                    "{\"connectionId\":\"connection-1\"}"));
            Assert.AreEqual(
                "{\"topic\":\"realtime:friend-world:owner-1\",\"event\":\"phx_leave\",\"payload\":{},\"ref\":\"5\",\"join_ref\":\"1\"}",
                SupabaseRealtimeProtocol.BuildLeave("friend-world:owner-1", "1", "5"));
        }

        [Test]
        public void RealtimeEnvelopeParserKeepsIncomingPayloadsUntypedForFeatureAdapters()
        {
            SupabaseRealtimeEnvelope envelope;
            string error;

            bool parsed = SupabaseRealtimeMessageParser.TryParseEnvelope(
                "{\"topic\":\"realtime:friend-world:owner-1\",\"event\":\"broadcast\",\"payload\":{\"type\":\"broadcast\",\"event\":\"avatar_state_v1\",\"payload\":{\"x\":1}},\"ref\":null,\"join_ref\":\"1\"}",
                out envelope,
                out error);

            Assert.IsTrue(parsed, error);
            Assert.AreEqual("broadcast", envelope.Event);
            Assert.AreEqual("realtime:friend-world:owner-1", envelope.Topic);
            Assert.IsInstanceOf<Dictionary<string, object>>(envelope.Payload);
            Dictionary<string, object> payload = (Dictionary<string, object>)envelope.Payload;
            Assert.AreEqual("avatar_state_v1", payload["event"]);
            Assert.IsInstanceOf<Dictionary<string, object>>(payload["payload"]);
        }

        [Test]
        public async Task RealtimeChannelJoinsWithTheSessionAndSendsOnlyAfterJoin()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                new InMemorySupabaseSessionStore(),
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(200, "{}", null)));
            SupabaseSession ignoredSession;
            string error;
            Assert.IsTrue(
                authClient.TrySetSessionFromCallback(
                    "access-token",
                    "refresh-token",
                    false,
                    out ignoredSession,
                    out error),
                error);

            FakeRealtimeTransport transport = new FakeRealtimeTransport();
            SupabaseRealtimeChannel channel = new SupabaseRealtimeChannel(
                settings,
                authClient,
                () => transport);
            try
            {
                await channel.ConnectAsync(
                    "friend-world:owner-1",
                    new SupabaseRealtimeChannelOptions
                    {
                        Private = true,
                    },
                    CancellationToken.None);

                Assert.AreEqual(SupabaseRealtimeChannelState.Joined, channel.State);
                Assert.AreEqual(1, transport.SentMessages.Count);
                StringAssert.Contains("\"event\":\"phx_join\"", transport.SentMessages[0]);
                StringAssert.Contains("\"access_token\":\"access-token\"", transport.SentMessages[0]);

                await channel.BroadcastAsync(
                    "avatar_state_v1",
                    "{\"x\":1}",
                    CancellationToken.None);
                Assert.AreEqual(2, transport.SentMessages.Count);
                StringAssert.Contains("\"event\":\"broadcast\"", transport.SentMessages[1]);
            }
            finally
            {
                channel.Dispose();
            }
        }

        [Test]
        public async Task RealtimeChannelRejoinsAfterTheSocketCloses()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                new InMemorySupabaseSessionStore(),
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(200, "{}", null)));
            SupabaseSession ignoredSession;
            string error;
            Assert.IsTrue(
                authClient.TrySetSessionFromCallback(
                    "access-token",
                    "refresh-token",
                    false,
                    out ignoredSession,
                    out error),
                error);

            List<FakeRealtimeTransport> transports = new List<FakeRealtimeTransport>();
            SupabaseRealtimeChannel channel = new SupabaseRealtimeChannel(
                settings,
                authClient,
                () =>
                {
                    FakeRealtimeTransport transport = new FakeRealtimeTransport();
                    transports.Add(transport);
                    return transport;
                });
            TaskCompletionSource<bool> reconnecting =
                new TaskCompletionSource<bool>();
            channel.StateChanged += (state, ignoredMessage) =>
            {
                if (state == SupabaseRealtimeChannelState.Reconnecting)
                {
                    reconnecting.TrySetResult(true);
                }
            };

            try
            {
                await channel.ConnectAsync(
                    "friend-world:owner-1",
                    new SupabaseRealtimeChannelOptions
                    {
                        Private = true,
                    },
                    CancellationToken.None);
                transports[0].SimulateServerClose();

                Task completed = await Task.WhenAny(
                    reconnecting.Task,
                    Task.Delay(1000));
                Assert.AreSame(reconnecting.Task, completed);

                await channel.ReconnectAsync(CancellationToken.None);

                Assert.AreEqual(SupabaseRealtimeChannelState.Joined, channel.State);
                Assert.AreEqual(2, transports.Count);
                StringAssert.Contains(
                    "\"event\":\"phx_join\"",
                    transports[1].SentMessages[0]);
                StringAssert.Contains(
                    "\"access_token\":\"access-token\"",
                    transports[1].SentMessages[0]);
            }
            finally
            {
                channel.Dispose();
            }
        }

        [Test]
        public void FriendWorldLiveRealtimeMapsPresenceAndAvatarStateContracts()
        {
            SupabaseRealtimeEnvelope presenceEnvelope;
            SupabaseRealtimeEnvelope avatarEnvelope;
            string error;
            Assert.IsTrue(
                SupabaseRealtimeMessageParser.TryParseEnvelope(
                    "{\"topic\":\"realtime:friend-world-live:owner-1\",\"event\":\"presence_state\",\"payload\":{\"connection-a\":[{\"connectionId\":\"connection-a\",\"childProfileId\":\"child-a\",\"joinedAt\":\"2026-09-08T10:00:00Z\"}],\"connection-b\":[{\"connectionId\":\"connection-b\",\"childProfileId\":\"child-b\",\"joinedAt\":\"2026-09-08T10:01:00Z\"}]}}",
                    out presenceEnvelope,
                    out error),
                error);
            Assert.IsTrue(
                SupabaseRealtimeMessageParser.TryParseEnvelope(
                    "{\"topic\":\"realtime:friend-world-live:owner-1\",\"event\":\"broadcast\",\"payload\":{\"type\":\"broadcast\",\"event\":\"avatar_state_v1\",\"payload\":{\"v\":1,\"connectionId\":\"connection-b\",\"childProfileId\":\"child-b\",\"characterAssetKey\":\"character-fox\",\"seq\":7,\"x\":1.25,\"z\":-2.5,\"rotationY\":1.57,\"motion\":\"walk\",\"emote\":\"none\",\"sentAt\":1725789660000}}}",
                    out avatarEnvelope,
                    out error),
                error);

            SupabaseFriendWorldPresenceMember[] members;
            Assert.IsTrue(
                SupabaseChildFriendWorldRealtimeMapper.TryMapPresenceState(
                    presenceEnvelope,
                    "owner-1",
                    out members));
            Assert.AreEqual(2, members.Length);
            Assert.AreEqual("connection-a", members[0].connectionId);
            Assert.AreEqual("child-b", members[1].childProfileId);

            SupabaseFriendWorldAvatarState avatar;
            Assert.IsTrue(
                SupabaseChildFriendWorldRealtimeMapper.TryMapAvatarState(
                    avatarEnvelope,
                    "owner-1",
                    out avatar));
            Assert.AreEqual(1, avatar.version);
            Assert.AreEqual("connection-b", avatar.connectionId);
            Assert.AreEqual(7, avatar.sequence);
            Assert.AreEqual(1.25f, avatar.x, 0.001f);
            Assert.AreEqual("walk", avatar.motion);
        }

        [Test]
        public void FriendWorldLiveRealtimeRejectsInvalidAvatarStateAndStaleSequence()
        {
            SupabaseRealtimeEnvelope invalidEnvelope;
            SupabaseRealtimeEnvelope firstEnvelope;
            SupabaseRealtimeEnvelope staleEnvelope;
            string error;
            Assert.IsTrue(
                SupabaseRealtimeMessageParser.TryParseEnvelope(
                    "{\"topic\":\"realtime:friend-world-live:owner-1\",\"event\":\"broadcast\",\"payload\":{\"type\":\"broadcast\",\"event\":\"avatar_state_v1\",\"payload\":{\"v\":1,\"connectionId\":\"connection-b\",\"childProfileId\":\"child-b\",\"seq\":8,\"x\":9,\"z\":0,\"rotationY\":0,\"motion\":\"idle\",\"emote\":\"none\",\"sentAt\":1725789660000}}}",
                    out invalidEnvelope,
                    out error),
                error);
            Assert.IsTrue(
                SupabaseRealtimeMessageParser.TryParseEnvelope(
                    "{\"topic\":\"realtime:friend-world-live:owner-1\",\"event\":\"broadcast\",\"payload\":{\"type\":\"broadcast\",\"event\":\"avatar_state_v1\",\"payload\":{\"v\":1,\"connectionId\":\"connection-b\",\"childProfileId\":\"child-b\",\"seq\":8,\"x\":1,\"z\":0,\"rotationY\":0,\"motion\":\"idle\",\"emote\":\"none\",\"sentAt\":1725789660000}}}",
                    out firstEnvelope,
                    out error),
                error);
            Assert.IsTrue(
                SupabaseRealtimeMessageParser.TryParseEnvelope(
                    "{\"topic\":\"realtime:friend-world-live:owner-1\",\"event\":\"broadcast\",\"payload\":{\"type\":\"broadcast\",\"event\":\"avatar_state_v1\",\"payload\":{\"v\":1,\"connectionId\":\"connection-b\",\"childProfileId\":\"child-b\",\"seq\":7,\"x\":1,\"z\":0,\"rotationY\":0,\"motion\":\"idle\",\"emote\":\"none\",\"sentAt\":1725789660000}}}",
                    out staleEnvelope,
                    out error),
                error);

            SupabaseFriendWorldAvatarState avatar;
            Assert.IsFalse(
                SupabaseChildFriendWorldRealtimeMapper.TryMapAvatarState(
                    invalidEnvelope,
                    "owner-1",
                    out avatar));

            SupabaseFriendWorldAvatarStateTracker tracker =
                new SupabaseFriendWorldAvatarStateTracker();
            Assert.IsTrue(
                tracker.TryAccept(firstEnvelope, "owner-1", out avatar));
            Assert.IsFalse(
                tracker.TryAccept(staleEnvelope, "owner-1", out avatar));
        }

        [Test]
        public void FriendWorldLiveRealtimeSubscriptionUsesPrivateLiveTopicAndPresenceTrack()
        {
            Assert.AreEqual(
                "friend-world-live:owner-1",
                SupabaseChildFriendWorldRealtimeClient.GetLiveTopic("owner-1"));
            Assert.AreEqual(
                "{\"connectionId\":\"connection-1\",\"childProfileId\":\"child-1\",\"joinedAt\":\"2026-09-08T10:00:00Z\"}",
                SupabaseChildFriendWorldRealtimeClient.BuildPresencePayload(
                    "connection-1",
                    "child-1",
                    "2026-09-08T10:00:00Z"));
        }

        [Test]
        public void FriendWorldLocalAvatarStateFactoryCreatesAValidatedState()
        {
            SupabaseFriendWorldAvatarState state =
                SupabaseFriendWorldAvatarStateFactory.Create(
                    "connection-1",
                    "child-1",
                    "character-fox",
                    4,
                    1.5f,
                    -2.25f,
                    0.75f,
                    1725789660d);

            Assert.AreEqual(1, state.version);
            Assert.AreEqual("connection-1", state.connectionId);
            Assert.AreEqual("child-1", state.childProfileId);
            Assert.AreEqual(4, state.sequence);
            Assert.AreEqual("idle", state.motion);
            Assert.AreEqual("none", state.emote);
        }

        [Test]
        public void FriendWorldLocalAvatarStateFactoryRejectsAnOutOfBoundsState()
        {
            Assert.Throws<ArgumentException>(() =>
                SupabaseFriendWorldAvatarStateFactory.Create(
                    "connection-1",
                    "child-1",
                    null,
                    1,
                    SupabaseFriendWorldRealtimeContracts.WorldBoundary + 0.1f,
                    0f,
                    0f,
                    1725789660d));
        }

        [Test]
        public void FriendWorldPresenceAdmissionKeepsTheEarliestThreeMembers()
        {
            SupabaseFriendWorldPresenceMember[] members =
            {
                new SupabaseFriendWorldPresenceMember
                {
                    connectionId = "connection-late",
                    childProfileId = "child-late",
                    joinedAt = "2026-09-08T10:03:00Z",
                },
                new SupabaseFriendWorldPresenceMember
                {
                    connectionId = "connection-first",
                    childProfileId = "child-first",
                    joinedAt = "2026-09-08T10:00:00Z",
                },
                new SupabaseFriendWorldPresenceMember
                {
                    connectionId = "connection-third",
                    childProfileId = "child-third",
                    joinedAt = "2026-09-08T10:02:00Z",
                },
                new SupabaseFriendWorldPresenceMember
                {
                    connectionId = "connection-second",
                    childProfileId = "child-second",
                    joinedAt = "2026-09-08T10:01:00Z",
                },
            };

            SupabaseFriendWorldPresenceAdmissionDecision decision =
                SupabaseFriendWorldPresenceAdmission.Decide(
                    members,
                    "connection-late");

            Assert.IsFalse(decision.accepted);
            Assert.IsTrue(decision.shouldUntrack);
            CollectionAssert.AreEqual(
                new[] { "connection-first", "connection-second", "connection-third" },
                decision.acceptedConnectionIds);
            CollectionAssert.AreEqual(
                new[] { "connection-late" },
                decision.rejectedConnectionIds);
        }

        [Test]
        public void FriendWorldPresenceAdmissionAcceptsAnUntrackedMemberWhenASlotIsFree()
        {
            SupabaseFriendWorldPresenceAdmissionDecision decision =
                SupabaseFriendWorldPresenceAdmission.Decide(
                    new[]
                    {
                        new SupabaseFriendWorldPresenceMember
                        {
                            connectionId = "connection-first",
                            childProfileId = "child-first",
                            joinedAt = "2026-09-08T10:00:00Z",
                        },
                    },
                    "connection-local");

            Assert.IsTrue(decision.accepted);
            Assert.IsFalse(decision.shouldUntrack);
            CollectionAssert.Contains(
                decision.acceptedConnectionIds,
                "connection-local");
        }

        [Test]
        public async Task FriendWorldLiveRealtimeClientJoinsPrivateChannelAndTracksPresence()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                new InMemorySupabaseSessionStore(),
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(200, "{}", null)));
            SupabaseSession ignoredSession;
            string error;
            Assert.IsTrue(
                authClient.TrySetSessionFromCallback(
                    "access-token",
                    "refresh-token",
                    false,
                    out ignoredSession,
                    out error),
                error);

            FakeRealtimeTransport transport = new FakeRealtimeTransport();
            SupabaseChildFriendWorldRealtimeClient client =
                new SupabaseChildFriendWorldRealtimeClient(
                    new SupabaseRestClient(
                        settings,
                        authClient,
                        new FakeSupabaseTransport(
                            new SupabaseHttpResponse(200, "{}", null))),
                    () => transport);
            SupabaseChildFriendWorldRealtimeSubscription subscription =
                await client.SubscribeAsync(
                    "owner-1",
                    "connection-1",
                    "child-1",
                    null,
                    null,
                    null,
                    null,
                    CancellationToken.None);
            try
            {
                Assert.AreEqual(2, transport.SentMessages.Count);
                StringAssert.Contains(
                    "\"topic\":\"realtime:friend-world-live:owner-1\"",
                    transport.SentMessages[0]);
                StringAssert.Contains("\"private\":true", transport.SentMessages[0]);
                StringAssert.Contains("\"enabled\":true", transport.SentMessages[0]);
                StringAssert.Contains("\"key\":\"connection-1\"", transport.SentMessages[0]);
                StringAssert.Contains("\"event\":\"presence\"", transport.SentMessages[1]);
                StringAssert.Contains("\"connectionId\":\"connection-1\"", transport.SentMessages[1]);
                StringAssert.Contains("\"childProfileId\":\"child-1\"", transport.SentMessages[1]);
            }
            finally
            {
                subscription.Dispose();
            }
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
        public void JsonObjectParserMapsAdventureTimerRows()
        {
            SupabaseTaskTimerSessionRecord timer;
            string error;

            bool parsed = SupabaseJsonObjectParser.TryParseObject(
                "{\"id\":\"timer-1\",\"task_id\":\"task-1\",\"status\":\"running\",\"accumulated_seconds\":12}",
                out timer,
                out error);

            Assert.IsTrue(parsed, error);
            Assert.AreEqual("timer-1", timer.id);
            Assert.AreEqual("task-1", timer.task_id);
            Assert.AreEqual("running", timer.status);
            Assert.AreEqual(12, timer.accumulated_seconds);
        }

        [Test]
        public void FamilyPreviewSelectsARequestedChildAndFallsBackSafely()
        {
            SupabaseParentHomeSnapshot snapshot = new SupabaseParentHomeSnapshot
            {
                children = new[]
                {
                    new SupabaseChildProfileRecord { id = "child-1", display_name = "小明" },
                    new SupabaseChildProfileRecord { id = "child-2", display_name = "小安" },
                },
                tasks = new[]
                {
                    new SupabaseChildTaskRecord { id = "task-1", child_profile_id = "child-1" },
                    new SupabaseChildTaskRecord { id = "task-2", child_profile_id = "child-2" },
                },
            };

            Assert.AreEqual(
                "child-2",
                SupabaseFamilyPreview.SelectChild(snapshot, "child-2").id);
            Assert.AreEqual(
                "child-1",
                SupabaseFamilyPreview.SelectChild(snapshot, "missing-child").id);
            Assert.AreEqual(
                1,
                SupabaseFamilyPreview.FilterTasks(snapshot, "child-2").Length);
            Assert.AreEqual(
                "task-2",
                SupabaseFamilyPreview.FilterTasks(snapshot, "child-2")[0].id);
        }

        [Test]
        public void ChildHomeSnapshotCacheIsOwnerScopedAndRoundTripsNonSecretData()
        {
            InMemorySupabaseChildHomeSnapshotStore store =
                new InMemorySupabaseChildHomeSnapshotStore();
            SupabaseChildHomeSnapshotCache cache =
                new SupabaseChildHomeSnapshotCache(store);
            SupabaseChildHomeSnapshot original = new SupabaseChildHomeSnapshot
            {
                familyId = "family-1",
                child = new SupabaseChildProfileRecord
                {
                    id = "child-1",
                    profile_id = "user-1",
                    display_name = "小明",
                    points_balance = 24,
                },
                tasks = new[]
                {
                    new SupabaseChildTaskRecord
                    {
                        id = "task-1",
                        name = "整理書包",
                        status = "todo",
                    },
                },
            };

            cache.Save("user-1", original);

            SupabaseChildHomeSnapshot restored;
            Assert.IsTrue(cache.TryLoad("user-1", out restored));
            Assert.AreEqual("family-1", restored.familyId);
            Assert.AreEqual("小明", restored.child.display_name);
            Assert.AreEqual(24, restored.child.points_balance);
            Assert.AreEqual(1, restored.tasks.Length);
            Assert.IsFalse(cache.TryLoad("user-2", out restored));
        }

        [Test]
        public async Task ChildHomeClientLoadsTheOwnerSnapshotWhenOffline()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            InMemorySupabaseChildHomeSnapshotStore snapshotStore =
                new InMemorySupabaseChildHomeSnapshotStore();
            SupabaseChildHomeSnapshotCache cache =
                new SupabaseChildHomeSnapshotCache(snapshotStore);
            cache.Save("child-user-1", new SupabaseChildHomeSnapshot
            {
                familyId = "family-1",
                child = new SupabaseChildProfileRecord
                {
                    id = "child-1",
                    profile_id = "child-user-1",
                    display_name = "小明",
                    points_balance = 30,
                },
                tasks = new SupabaseChildTaskRecord[0],
            });

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "[]", null));
            SupabaseChildHomeClient client = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport),
                new InMemorySupabaseTaskCompletionQueueStore(),
                snapshotStore,
                () => false);

            SupabaseChildHomeSnapshot snapshot = await client.LoadAsync(CancellationToken.None);

            Assert.AreEqual("family-1", snapshot.familyId);
            Assert.AreEqual(30, snapshot.child.points_balance);
            Assert.AreEqual(0, dataTransport.Requests.Count);
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
            Assert.AreEqual(9, dataTransport.Requests.Count);
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
            Assert.AreEqual(10, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/submit_adventure_completion",
                dataTransport.Requests[9].Url);
            StringAssert.Contains(
                "{\"target_task_id\":\"task-1\",\"idempotency_key\":\""
                    + reflectionResult.IdempotencyKey
                    + "\",\"quick_report\":null,\"reflection\":\"完成了\",\"mood\":\"happy\",\"difficulty\":3}",
                dataTransport.Requests[9].Body);
        }

        [Test]
        public async Task ParentSessionLoadsAnExplicitChildScopeWithoutUsingChildIdentity()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"parent-access\",\"refresh_token\":\"parent-refresh\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"display_name\":\"小明\",\"points_balance\":18}]",
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
            SupabaseChildHomeClient client = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseChildHomeSnapshot snapshot = await client.LoadForParentAsync(
                "family-1",
                "child-1",
                CancellationToken.None);

            Assert.AreEqual("family-1", snapshot.familyId);
            Assert.AreEqual("child-1", snapshot.child.id);
            Assert.AreEqual(18, snapshot.child.points_balance);
            Assert.AreEqual(1, snapshot.tasks.Length);
            Assert.AreEqual(8, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/child_profiles?select=*&family_id=eq.family-1&id=eq.child-1",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/ensure_daily_adventure_occurrences",
                dataTransport.Requests[1].Url);
            Assert.AreEqual(
                "{\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[1].Body);
        }

        [Test]
        public void ParentScopedHomeCacheCannotBeReadAsAChildOwnedSnapshot()
        {
            InMemorySupabaseChildHomeSnapshotStore store =
                new InMemorySupabaseChildHomeSnapshotStore();
            SupabaseChildHomeSnapshotCache cache =
                new SupabaseChildHomeSnapshotCache(store);
            SupabaseChildHomeSnapshot snapshot = new SupabaseChildHomeSnapshot
            {
                familyId = "family-1",
                child = new SupabaseChildProfileRecord
                {
                    id = "child-1",
                    family_id = "family-1",
                    profile_id = "child-user-1",
                    display_name = "小明",
                },
            };

            cache.SaveScoped(
                "parent-user-1:child:child-1",
                "family-1",
                "child-1",
                snapshot);

            SupabaseChildHomeSnapshot loaded;
            Assert.IsTrue(cache.TryLoadScoped(
                "parent-user-1:child:child-1",
                "family-1",
                "child-1",
                out loaded));
            Assert.AreEqual("child-1", loaded.child.id);
            Assert.IsFalse(cache.TryLoad(
                "parent-user-1:child:child-1",
                out loaded));
            Assert.IsFalse(cache.TryLoadScoped(
                "parent-user-1:child:child-1",
                "family-1",
                "child-2",
                out loaded));
        }

        [Test]
        public async Task NotificationClientKeepsPreferenceAndDeviceBindingRlsScoped()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"parent-access\",\"refresh_token\":\"parent-refresh\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "[{\"notifications_enabled\":true}]", null),
                new SupabaseHttpResponse(200, "", null),
                new SupabaseHttpResponse(200, "", null),
                new SupabaseHttpResponse(200, "", null));
            SupabaseNotificationClient client = new SupabaseNotificationClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            Assert.IsTrue(await client.LoadPreferenceAsync(
                "parent-user-1",
                CancellationToken.None));
            await client.SetPreferenceAsync(
                "parent-user-1",
                false,
                CancellationToken.None);
            await client.RegisterDeviceAsync(
                "family-1",
                "parent-user-1",
                null,
                "ios",
                "token-12345678901234567890",
                CancellationToken.None);

            Assert.AreEqual(4, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/profiles?select=notifications_enabled&id=eq.parent-user-1",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/profiles?id=eq.parent-user-1",
                dataTransport.Requests[1].Url);
            Assert.AreEqual("{\"notifications_enabled\":false}", dataTransport.Requests[1].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/push_devices?profile_id=eq.parent-user-1",
                dataTransport.Requests[2].Url);
            Assert.AreEqual("{\"enabled\":false}", dataTransport.Requests[2].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/push_devices?on_conflict=profile_id%2Ctoken",
                dataTransport.Requests[3].Url);
            StringAssert.Contains(
                "\"family_id\":\"family-1\",\"profile_id\":\"parent-user-1\",\"child_profile_id\":null,\"platform\":\"ios\"",
                dataTransport.Requests[3].Body);
        }

        [Test]
        public async Task NotificationClientBindsOnlyAfterPlatformProviderReturnsToken()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"parent-access\",\"refresh_token\":\"parent-refresh\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "", null));
            SupabaseNotificationClient client = new SupabaseNotificationClient(
                new SupabaseRestClient(settings, authClient, dataTransport));
            FakePushTokenProvider tokenProvider = new FakePushTokenProvider(
                new SupabasePushTokenResult(
                    true,
                    true,
                    "ios-token-12345678901234567890",
                    null));

            SupabasePushTokenResult result = await client.RegisterCurrentDeviceAsync(
                tokenProvider,
                "family-1",
                "parent-user-1",
                null,
                "ios",
                CancellationToken.None);

            Assert.IsTrue(result.IsSupported);
            Assert.IsTrue(result.IsGranted);
            Assert.AreEqual(1, tokenProvider.RequestCount);
            Assert.AreEqual(1, dataTransport.Requests.Count);
            StringAssert.Contains(
                "\"token\":\"ios-token-12345678901234567890\"",
                dataTransport.Requests[0].Body);
        }

        [Test]
        public async Task NotificationSettingsRegistersBeforePersistingEnabledPreference()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"parent-access\",\"refresh_token\":\"parent-refresh\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "[{\"notifications_enabled\":false}]", null),
                new SupabaseHttpResponse(200, "", null),
                new SupabaseHttpResponse(200, "", null));
            SupabaseNotificationClient client = new SupabaseNotificationClient(
                new SupabaseRestClient(settings, authClient, dataTransport));
            FakePushTokenProvider tokenProvider = new FakePushTokenProvider(
                new SupabasePushTokenResult(
                    true,
                    true,
                    "ios-token-12345678901234567890",
                    null));
            HabitHeroNotificationSettingsController controller =
                new HabitHeroNotificationSettingsController(
                    client,
                    tokenProvider,
                    "family-1",
                    "parent-user-1",
                    null,
                    "ios");

            HabitHeroNotificationSettingsState state =
                await controller.SetEnabledAsync(true, CancellationToken.None);

            Assert.IsTrue(state.Enabled);
            Assert.AreEqual(3, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/profiles?select=notifications_enabled&id=eq.parent-user-1",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/push_devices?on_conflict=profile_id%2Ctoken",
                dataTransport.Requests[1].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/profiles?id=eq.parent-user-1",
                dataTransport.Requests[2].Url);
            Assert.AreEqual(
                "{\"notifications_enabled\":true}",
                dataTransport.Requests[2].Body);
        }

        [Test]
        public async Task NotificationSettingsDoesNotPersistWhenPermissionIsDenied()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"parent-access\",\"refresh_token\":\"parent-refresh\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "[{\"notifications_enabled\":false}]", null));
            SupabaseNotificationClient client = new SupabaseNotificationClient(
                new SupabaseRestClient(settings, authClient, dataTransport));
            FakePushTokenProvider tokenProvider = new FakePushTokenProvider(
                new SupabasePushTokenResult(
                    true,
                    false,
                    null,
                    "使用者未允許通知。"));
            HabitHeroNotificationSettingsController controller =
                new HabitHeroNotificationSettingsController(
                    client,
                    tokenProvider,
                    "family-1",
                    "parent-user-1",
                    null,
                    "ios");

            HabitHeroNotificationSettingsState state =
                await controller.SetEnabledAsync(true, CancellationToken.None);

            Assert.IsFalse(state.Enabled);
            Assert.IsFalse(state.Granted);
            Assert.AreEqual("使用者未允許通知。", state.Error);
            Assert.AreEqual(1, dataTransport.Requests.Count);
        }

        [Test]
        public async Task FriendWorldClientLoadsTheServerProjectionThroughRpc()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"world_owner_child_profile_id\":\"friend-child-1\",\"display_name\":\"小安\",\"character_asset_key\":\"character-fox\",\"revision\":7,\"can_share_decorations\":true,\"entities\":[{\"id\":\"entity-1\",\"entity_kind\":\"decoration\",\"asset_key\":\"decor-sofa\",\"position_x\":1.5,\"position_y\":0,\"position_z\":-2,\"rotation_x\":0,\"rotation_y\":45,\"rotation_z\":0,\"scale\":1.2,\"behavior_mode\":\"static\",\"placement_scope\":\"shared\",\"can_transform\":true,\"can_remove\":true,\"shared_by_me\":true,\"shared_source_display_name\":\"小明\"}]}",
                    null));
            SupabaseChildFriendWorldClient client = new SupabaseChildFriendWorldClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseChildFriendWorldData world = await client.LoadAsync(
                "friend-child-1",
                CancellationToken.None);

            Assert.AreEqual("friend-child-1", world.worldOwnerChildProfileId);
            Assert.AreEqual("小安", world.displayName);
            Assert.AreEqual("character-fox", world.characterAssetKey);
            Assert.AreEqual(7, world.revision);
            Assert.IsTrue(world.canShareDecorations);
            Assert.AreEqual(1, world.entities.Length);
            Assert.AreEqual("decor-sofa", world.entities[0].asset_key);
            Assert.AreEqual("shared", world.entities[0].placement_scope);
            Assert.IsTrue(world.entities[0].can_transform);
            Assert.IsTrue(world.entities[0].can_remove);
            Assert.IsTrue(world.entities[0].shared_by_me);
            Assert.AreEqual("小明", world.entities[0].shared_source_display_name);
            Assert.AreEqual(1, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/get_friend_world_snapshot",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_child_profile_id\":\"friend-child-1\"}",
                dataTransport.Requests[0].Body);
        }

        [Test]
        public async Task FriendWorldDecorationMutationsUseServerRpcContracts()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "{}", null),
                new SupabaseHttpResponse(
                    200,
                    "{\"revision\":8,\"entity\":{\"id\":\"shared-1\",\"entity_kind\":\"decoration\",\"asset_key\":\"decor-sofa\",\"behavior_mode\":\"static\",\"placement_scope\":\"shared\",\"can_transform\":true,\"can_remove\":true,\"shared_by_me\":true}}",
                    null),
                new SupabaseHttpResponse(200, "{\"revision\":9}", null),
                new SupabaseHttpResponse(200, "{\"revision\":10}", null),
                new SupabaseHttpResponse(200, "{\"revision\":11}", null));
            SupabaseChildFriendWorldClient client = new SupabaseChildFriendWorldClient(
                new SupabaseRestClient(settings, authClient, dataTransport));
            SupabaseFriendWorldTransform transform = new SupabaseFriendWorldTransform
            {
                x = 1.25f,
                y = 0f,
                z = -2.5f,
                rotationX = 0f,
                rotationY = 1.57f,
                rotationZ = 0f,
                scale = 1.2f,
            };

            await client.SetDecorationCollaborationAsync(
                "friend-child-1",
                "child-2",
                true,
                CancellationToken.None);
            SupabaseFriendWorldMutationResult placed =
                await client.PlaceSharedDecorationAsync(
                    "friend-child-1",
                    "inventory-1",
                    7,
                    transform,
                    CancellationToken.None);
            await client.UpdateSharedDecorationTransformAsync(
                "friend-child-1",
                "shared-1",
                placed.revision,
                transform,
                CancellationToken.None);
            await client.RemoveSharedDecorationAsync(
                "friend-child-1",
                "shared-1",
                9,
                CancellationToken.None);
            await client.CollectSharedDecorationsAsync(
                "friend-child-1",
                10,
                CancellationToken.None);

            Assert.AreEqual(8, placed.revision);
            Assert.AreEqual(5, dataTransport.Requests.Count);
            Assert.AreEqual(
                "{\"target_world_owner_child_profile_id\":\"friend-child-1\",\"target_collaborator_child_profile_id\":\"child-2\",\"target_can_collaborate\":true}",
                dataTransport.Requests[0].Body);
            StringAssert.Contains(
                "\"source_inventory_item_id\":\"inventory-1\",\"expected_revision\":7,\"position_x\":1.25,\"position_y\":0,\"position_z\":-2.5",
                dataTransport.Requests[1].Body);
            StringAssert.Contains(
                "\"shared_entity_id\":\"shared-1\",\"expected_revision\":8",
                dataTransport.Requests[2].Body);
            Assert.AreEqual(
                "{\"target_world_owner_child_profile_id\":\"friend-child-1\",\"shared_entity_id\":\"shared-1\",\"expected_revision\":9}",
                dataTransport.Requests[3].Body);
            Assert.AreEqual(
                "{\"target_world_owner_child_profile_id\":\"friend-child-1\",\"expected_revision\":10}",
                dataTransport.Requests[4].Body);
        }

        [Test]
        public void FriendWorldRevisionPolicyOnlyAcceptsNewerSnapshots()
        {
            Assert.IsTrue(SupabaseFriendWorldRevisionPolicy.ShouldApply(7, 8));
            Assert.IsFalse(SupabaseFriendWorldRevisionPolicy.ShouldApply(7, 7));
            Assert.IsFalse(SupabaseFriendWorldRevisionPolicy.ShouldApply(7, 6));
        }

        [Test]
        public void FriendWorldAvatarMotionPolicyUsesSmoothStepsAndBoundedStaleness()
        {
            Assert.AreEqual(
                0f,
                SupabaseFriendWorldAvatarMotionPolicy.GetInterpolationStep(0f),
                0.0001f);
            float step = SupabaseFriendWorldAvatarMotionPolicy.GetInterpolationStep(0.1f);
            Assert.Greater(step, 0f);
            Assert.Less(step, 1f);
            Assert.IsFalse(
                SupabaseFriendWorldAvatarMotionPolicy.IsStale(
                    SupabaseFriendWorldAvatarMotionPolicy.StaleAfterSeconds));
            Assert.IsTrue(
                SupabaseFriendWorldAvatarMotionPolicy.IsStale(
                    SupabaseFriendWorldAvatarMotionPolicy.StaleAfterSeconds + 0.01f));
        }

        [Test]
        public void FriendWorldClientRejectsAnEmptyTargetBeforeNetworkAccess()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                new InMemorySupabaseSessionStore(),
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(500, "{}", "unused")));
            SupabaseChildFriendWorldClient client = new SupabaseChildFriendWorldClient(
                new SupabaseRestClient(
                    settings,
                    authClient,
                    new FakeSupabaseTransport(
                        new SupabaseHttpResponse(500, "{}", "unused"))));

            Assert.ThrowsAsync<ArgumentException>(async delegate
            {
                await client.LoadAsync(string.Empty, CancellationToken.None);
            });
        }

        [Test]
        public async Task WorldChatClientLoadsVisibleHistoryAndUnreadCount()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"message-1\",\"world_owner_child_profile_id\":\"friend-child-1\",\"sender_child_profile_id\":\"child-1\",\"sender_display_name\":\"小明\",\"body\":\"一起冒險嗎\",\"status\":\"visible\",\"created_at\":\"2026-09-08T10:00:00Z\"}]",
                    null),
                new SupabaseHttpResponse(200, "2", null));
            SupabaseChildWorldChatClient client = new SupabaseChildWorldChatClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseChildWorldChatData chat = await client.LoadAsync(
                "friend-child-1",
                CancellationToken.None);

            Assert.AreEqual("friend-child-1", chat.worldOwnerChildProfileId);
            Assert.AreEqual(1, chat.messages.Length);
            Assert.AreEqual("message-1", chat.messages[0].id);
            Assert.AreEqual("一起冒險嗎", chat.messages[0].body);
            Assert.AreEqual(2, chat.unreadCount);
            Assert.AreEqual(2, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/friend_world_messages?select=*&world_owner_child_profile_id=eq.friend-child-1&status=eq.visible&order=created_at.asc&limit=50",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_world_owner_child_profile_id\":\"friend-child-1\"}",
                dataTransport.Requests[1].Body);
        }

        [Test]
        public async Task WorldChatClientSendsMarksReadAndReportsThroughServerRpcs()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"message-2\",\"world_owner_child_profile_id\":\"friend-child-1\",\"sender_child_profile_id\":\"child-1\",\"sender_display_name\":\"小明\",\"body\":\"收到\",\"status\":\"visible\",\"created_at\":\"2026-09-08T10:01:00Z\"}",
                    null),
                new SupabaseHttpResponse(200, "{}", null),
                new SupabaseHttpResponse(200, "{}", null));
            SupabaseChildWorldChatClient client = new SupabaseChildWorldChatClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseWorldChatMessageRecord sent = await client.SendAsync(
                "friend-child-1",
                "  收到  ",
                CancellationToken.None);
            await client.MarkReadAsync(
                "friend-child-1",
                "message-2",
                CancellationToken.None);
            await client.ReportAsync(
                "message-2",
                "不當內容",
                CancellationToken.None);

            Assert.AreEqual("message-2", sent.id);
            Assert.AreEqual(3, dataTransport.Requests.Count);
            Assert.AreEqual(
                "{\"target_world_owner_child_profile_id\":\"friend-child-1\",\"message_text\":\"收到\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "{\"target_world_owner_child_profile_id\":\"friend-child-1\",\"target_message_id\":\"message-2\"}",
                dataTransport.Requests[1].Body);
            Assert.AreEqual(
                "{\"target_message_id\":\"message-2\",\"report_reason\":\"不當內容\"}",
                dataTransport.Requests[2].Body);
        }

        [Test]
        public void WorldChatClientRejectsLinksBeforeCallingSupabase()
        {
            Assert.IsFalse(SupabaseChildWorldChatClient.IsValidMessage("請看 https://example.com"));
            Assert.IsFalse(SupabaseChildWorldChatClient.IsValidMessage(""));
            Assert.IsTrue(SupabaseChildWorldChatClient.IsValidMessage("一起玩吧"));
        }

        [Test]
        public void WorldChatRealtimeAcceptsOnlyVisiblePostgresInsertRowsForTheRequestedWorld()
        {
            SupabaseRealtimeEnvelope envelope;
            string error;
            Assert.IsTrue(
                SupabaseRealtimeMessageParser.TryParseEnvelope(
                    "{\"topic\":\"realtime:friend-world:friend-child-1\",\"event\":\"postgres_changes\",\"payload\":{\"data\":{\"type\":\"INSERT\",\"table\":\"friend_world_messages\",\"record\":{\"id\":\"message-3\",\"world_owner_child_profile_id\":\"friend-child-1\",\"sender_child_profile_id\":\"child-1\",\"sender_display_name\":\"小明\",\"body\":\"即時訊息\",\"status\":\"visible\",\"created_at\":\"2026-09-08T10:02:00Z\"}}},\"ref\":null,\"join_ref\":\"1\"}",
                    out envelope,
                    out error),
                error);

            SupabaseWorldChatMessageRecord message;
            Assert.IsTrue(
                SupabaseChildWorldChatClient.TryMapRealtimeMessage(
                    envelope,
                    "friend-child-1",
                    out message));
            Assert.AreEqual("message-3", message.id);
            Assert.AreEqual("即時訊息", message.body);

            SupabaseRealtimeEnvelope broadcast;
            Assert.IsTrue(
                SupabaseRealtimeMessageParser.TryParseEnvelope(
                    "{\"topic\":\"realtime:friend-world:friend-child-1\",\"event\":\"broadcast\",\"payload\":{\"type\":\"broadcast\",\"event\":\"chat_created_v1\",\"payload\":{\"id\":\"message-4\"}}}",
                    out broadcast,
                    out error),
                error);
            Assert.IsFalse(
                SupabaseChildWorldChatClient.TryMapRealtimeMessage(
                    broadcast,
                    "friend-child-1",
                    out message));
        }

        [Test]
        public async Task ChildCompletionRefreshesTheServerAuthoritativeLedger()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "{}", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"role\":\"child\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"display_name\":\"小明\",\"points_balance\":42}]",
                    null),
                new SupabaseHttpResponse(200, "{}", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"task-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"整理書包\",\"points\":10,\"status\":\"pending\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"ledger-1\",\"child_profile_id\":\"child-1\",\"task_id\":\"task-1\",\"points_delta\":10,\"entry_type\":\"task_submitted\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null));
            SupabaseChildHomeClient client = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport),
                new InMemorySupabaseTaskCompletionQueueStore(),
                new InMemorySupabaseChildHomeSnapshotStore(),
                () => true);

            SupabaseTaskCompletionResult result =
                await client.SubmitTaskCompletionAndRefreshAsync(
                    "task-1",
                    "smooth",
                    null,
                    null,
                    null,
                    CancellationToken.None);

            Assert.IsFalse(result.QueuedForRetry);
            Assert.IsNull(result.RefreshError);
            Assert.IsNotNull(result.RefreshedSnapshot);
            Assert.AreEqual(42, result.RefreshedSnapshot.child.points_balance);
            Assert.AreEqual(1, result.RefreshedSnapshot.ledger.Length);
            Assert.AreEqual(10, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/point_ledger?select=*&family_id=eq.family-1&child_profile_id=eq.child-1&order=created_at.desc&limit=100",
                dataTransport.Requests[8].Url);
        }

        [Test]
        public async Task RewardRedemptionUsesTheServerRpcAndRefreshesTheWallet()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"ticket-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"reward_id\":\"reward-1\",\"reward_name\":\"看一集動畫\",\"reward_icon\":\"Gift\",\"points_cost\":20,\"status\":\"pending\"}",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"role\":\"child\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"display_name\":\"小明\",\"points_balance\":22}]",
                    null),
                new SupabaseHttpResponse(200, "{}", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"reward-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"看一集動畫\",\"points\":20,\"icon\":\"Gift\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"ticket-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"reward_id\":\"reward-1\",\"reward_name\":\"看一集動畫\",\"reward_icon\":\"Gift\",\"points_cost\":20,\"status\":\"pending\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"ledger-1\",\"child_profile_id\":\"child-1\",\"points_delta\":-20,\"entry_type\":\"reward_redemption\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null));
            SupabaseChildHomeClient client = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport),
                new InMemorySupabaseTaskCompletionQueueStore(),
                new InMemorySupabaseChildHomeSnapshotStore(),
                () => true);

            SupabaseRewardRedemptionResult result =
                await client.RedeemRewardAndRefreshAsync("reward-1", CancellationToken.None);

            Assert.IsNotNull(result.Ticket);
            Assert.AreEqual("ticket-1", result.Ticket.id);
            Assert.IsNull(result.RefreshError);
            Assert.AreEqual(22, result.RefreshedSnapshot.child.points_balance);
            Assert.AreEqual("reward_redemption", result.RefreshedSnapshot.ledger[0].entry_type);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/redeem_reward",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_reward_id\":\"reward-1\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(10, dataTransport.Requests.Count);
        }

        [Test]
        public async Task WishlistMutationsUseRlsScopedRestCallsAndRefreshTheSnapshot()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(201, string.Empty, null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"role\":\"child\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"display_name\":\"小明\",\"points_balance\":30}]",
                    null),
                new SupabaseHttpResponse(200, "{}", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"wish-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"新畫筆\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(204, string.Empty, null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"role\":\"child\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"display_name\":\"小明\",\"points_balance\":30}]",
                    null),
                new SupabaseHttpResponse(200, "{}", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null));
            SupabaseChildHomeClient client = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport),
                new InMemorySupabaseTaskCompletionQueueStore(),
                new InMemorySupabaseChildHomeSnapshotStore(),
                () => true);

            SupabaseWishlistMutationResult addResult =
                await client.AddWishlistItemAndRefreshAsync(
                    "family-1",
                    "child-1",
                    "新畫筆",
                    CancellationToken.None);
            SupabaseWishlistMutationResult deleteResult =
                await client.DeleteWishlistItemAndRefreshAsync(
                    "wish-1",
                    CancellationToken.None);

            Assert.IsNull(addResult.RefreshError);
            Assert.IsNotNull(addResult.RefreshedSnapshot);
            Assert.AreEqual("新畫筆", addResult.RefreshedSnapshot.wishlist[0].name);
            Assert.IsNull(deleteResult.RefreshError);
            Assert.IsNotNull(deleteResult.RefreshedSnapshot);
            Assert.AreEqual(20, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/wishlist_items",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"新畫筆\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/wishlist_items?id=eq.wish-1",
                dataTransport.Requests[10].Url);
        }

        [Test]
        public async Task ParentHomeLoadsFamilyDataAndReviewsPendingTasksThroughRpc()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"parent-user-1\",\"role\":\"parent\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"family-1\",\"name\":\"小小冒險家\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"display_name\":\"小明\",\"points_balance\":20}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"task-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"整理書包\",\"points\":10,\"status\":\"pending\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"task-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"整理書包\",\"points\":10,\"status\":\"completed\",\"approved_points\":10}",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"parent-user-1\",\"role\":\"parent\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"family-1\",\"name\":\"小小冒險家\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"profile_id\":\"child-user-1\",\"display_name\":\"小明\",\"points_balance\":30}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"task-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"整理書包\",\"points\":10,\"status\":\"completed\",\"approved_points\":10}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"ledger-1\",\"child_profile_id\":\"child-1\",\"task_id\":\"task-1\",\"points_delta\":10,\"entry_type\":\"task_approved\"}]",
                    null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseParentHomeSnapshot snapshot =
                await client.LoadAsync(CancellationToken.None);
            SupabaseParentTaskReviewResult result =
                await client.ReviewTaskAndRefreshAsync(
                    snapshot.tasks[0],
                    true,
                    10,
                    "做得很好",
                    null,
                    "encouraging",
                    null,
                    CancellationToken.None);

            Assert.AreEqual("小小冒險家", snapshot.family.name);
            Assert.AreEqual(1, snapshot.children.Length);
            Assert.AreEqual("pending", snapshot.tasks[0].status);
            Assert.AreEqual("completed", result.Task.status);
            Assert.AreEqual(30, result.RefreshedSnapshot.children[0].points_balance);
            Assert.AreEqual(17, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/family_members?select=*&profile_id=eq.parent-user-1&role=eq.parent",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/review_task_completion",
                dataTransport.Requests[8].Url);
            Assert.AreEqual(
                "{\"target_task_id\":\"task-1\",\"approved\":true,\"approved_points\":10,\"feedback\":\"做得很好\",\"correction\":null,\"tone\":\"encouraging\",\"revision_note\":null}",
                dataTransport.Requests[8].Body);
        }

        [Test]
        public async Task ParentRewardActionsUseServerRpcAndRlsScopedTicketUpdate()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"reward-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"新畫筆\",\"points\":30,\"icon\":\"Star\"}",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"parent-user-1\",\"role\":\"parent\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(204, string.Empty, null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"parent-user-1\",\"role\":\"parent\"}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));
            SupabaseChildWishlistRecord wishlist = new SupabaseChildWishlistRecord
            {
                id = "wish-1",
                child_profile_id = "child-1",
                name = "新畫筆",
            };

            SupabaseParentRewardMutationResult rewardResult =
                await client.ApproveWishlistAndRefreshAsync(
                    "family-1",
                    wishlist,
                    30,
                    CancellationToken.None);
            SupabaseParentRewardMutationResult ticketResult =
                await client.FulfillTicketAndRefreshAsync(
                    "ticket-1",
                    CancellationToken.None);

            Assert.AreEqual("reward-1", rewardResult.Reward.id);
            Assert.IsNull(rewardResult.RefreshError);
            Assert.IsNull(ticketResult.RefreshError);
            Assert.AreEqual(18, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/approve_wishlist_item",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_family_id\":\"family-1\",\"target_child_profile_id\":\"child-1\",\"target_wishlist_id\":\"wish-1\",\"target_points\":30}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/reward_redemptions?id=eq.ticket-1",
                dataTransport.Requests[9].Url);
            StringAssert.Contains("\"status\":\"fulfilled\"", dataTransport.Requests[9].Body);
        }

        [Test]
        public async Task ParentTaskCreationUsesRlsScopedInsertAndRefresh()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(201, string.Empty, null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"member-1\",\"family_id\":\"family-1\",\"profile_id\":\"parent-user-1\",\"role\":\"parent\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"family-1\",\"name\":\"小小冒險家\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"child-1\",\"family_id\":\"family-1\",\"display_name\":\"小明\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"task-2\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"整理書包\",\"points\":10,\"status\":\"todo\",\"is_daily\":true}]",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(200, "[]", null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseParentTaskMutationResult result =
                await client.CreateTaskAndRefreshAsync(
                    "family-1",
                    new SupabaseParentTaskCreateInput
                    {
                        childProfileId = "child-1",
                        name = "整理書包",
                        points = 10,
                        icon = "Star",
                        durationMinutes = 15,
                        isDaily = true,
                        category = "life_habit",
                    },
                    CancellationToken.None);

            Assert.IsTrue(result.Created);
            Assert.IsNull(result.RefreshError);
            Assert.AreEqual("整理書包", result.RefreshedSnapshot.tasks[0].name);
            Assert.AreEqual(9, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/tasks",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"整理書包\",\"points\":10,\"icon\":\"Star\",\"duration_minutes\":15,\"is_daily\":true,\"due_on\":null,\"due_time\":null,\"end_time\":null,\"requires_review_before_next_task\":false,\"category\":\"life_habit\",\"origin\":\"parent_assigned\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/family_members?select=*&profile_id=eq.parent-user-1&role=eq.parent",
                dataTransport.Requests[1].Url);
        }

        [Test]
        public async Task ParentTaskManagementUsesFamilyScopedPatchAndDelete()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(204, string.Empty, null),
                new SupabaseHttpResponse(204, string.Empty, null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            await client.UpdateTaskAsync(
                "family-1",
                "task-1",
                new SupabaseParentTaskUpdateInput
                {
                    name = "整理書包與水壺",
                    points = 15,
                    icon = "Star",
                    durationMinutes = 20,
                    isDaily = true,
                    dueOn = "2026-09-08",
                    dueTime = "18:00",
                    endTime = "19:00",
                    category = "life_habit",
                },
                CancellationToken.None);
            await client.DeleteTaskAsync("family-1", "task-1", CancellationToken.None);

            Assert.AreEqual(2, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/tasks?family_id=eq.family-1&id=eq.task-1",
                dataTransport.Requests[0].Url);
            Assert.AreEqual("PATCH", dataTransport.Requests[0].Method);
            Assert.AreEqual(
                "{\"name\":\"整理書包與水壺\",\"points\":15,\"icon\":\"Star\",\"duration_minutes\":20,\"is_daily\":true,\"due_on\":\"2026-09-08\",\"due_time\":\"18:00\",\"end_time\":\"19:00\",\"category\":\"life_habit\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/tasks?family_id=eq.family-1&id=eq.task-1",
                dataTransport.Requests[1].Url);
            Assert.AreEqual("DELETE", dataTransport.Requests[1].Method);
        }

        [Test]
        public async Task ChildGameEconomyReadsFamilyAndChildScopedData()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"catalog-1\",\"item_type\":\"pet\",\"name\":\"星光鹿\",\"description\":\"跟隨寵物\",\"scroll_price\":30,\"asset_key\":\"pet.starlight-deer\",\"thumbnail_url\":null,\"is_active\":true,\"is_starter\":false,\"is_child_creation_selectable\":false,\"is_newly_obtainable\":true,\"is_stackable\":false,\"collision_radius\":0.35,\"min_scale\":0.75,\"max_scale\":1.25,\"sort_order\":1,\"metadata\":{\"visualScaleMultiplier\":2}}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"catalog_item_id\":\"catalog-1\",\"scroll_price\":25}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"child_profile_id\":\"child-1\",\"family_id\":\"family-1\",\"scroll_balance\":120}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"inventory-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"catalog_item_id\":\"catalog-1\",\"quantity\":2,\"acquired_via\":\"purchase\",\"acquired_at\":\"2026-09-08T00:00:00Z\",\"source_scene_id\":\"sunrise-village\",\"source_npc_id\":\"vendor-1\",\"source_dialogue_version\":1}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"child_profile_id\":\"child-1\",\"family_id\":\"family-1\",\"equipped_character_inventory_id\":\"character-inventory-1\",\"following_pet_inventory_id\":\"inventory-1\",\"following_pet_inventory_ids\":[\"inventory-1\"]}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"revision\":6}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"entity-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"inventory_item_id\":\"inventory-1\",\"entity_kind\":\"decoration\",\"position_x\":1.25,\"position_y\":0,\"position_z\":-2.5,\"rotation_x\":0,\"rotation_y\":15,\"rotation_z\":0,\"scale\":1,\"behavior_mode\":\"static\",\"roaming_slot\":null,\"world_layout_version\":1,\"is_active\":true}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"shared-1\",\"source_inventory_item_id\":null,\"catalog_item_id\":\"catalog-1\",\"asset_key\":\"decoration.study-desk\",\"position_x\":-2,\"position_y\":0,\"position_z\":2,\"rotation_x\":0,\"rotation_y\":0.5,\"rotation_z\":0,\"scale\":1,\"behavior_mode\":\"static\",\"is_active\":true,\"shared_by_me\":false,\"shared_source_display_name\":\"小明\"}]",
                    null));
            SupabaseChildGameClient client = new SupabaseChildGameClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseChildGameData data = await client.LoadAsync(
                "family-1",
                "child-1",
                CancellationToken.None);

            Assert.AreEqual("family-1", data.familyId);
            Assert.AreEqual("child-1", data.childProfileId);
            Assert.AreEqual("catalog-1", data.catalog[0].id);
            Assert.AreEqual(25, data.prices[0].scroll_price);
            Assert.AreEqual(120L, data.walletBalance);
            Assert.AreEqual("inventory-1", data.inventory[0].id);
            Assert.AreEqual(2L, data.inventory[0].quantity);
            Assert.AreEqual("vendor-1", data.inventory[0].source_npc_id);
            Assert.AreEqual("character-inventory-1", data.loadout.equipped_character_inventory_id);
            Assert.AreEqual(1, data.loadout.following_pet_inventory_ids.Length);
            Assert.AreEqual("inventory-1", data.loadout.following_pet_inventory_ids[0]);
            Assert.AreEqual(6L, data.worldRevision);
            Assert.AreEqual(1, data.worldEntities.Length);
            Assert.AreEqual("entity-1", data.worldEntities[0].id);
            Assert.AreEqual("decoration", data.worldEntities[0].entity_kind);
            Assert.AreEqual(15f, data.worldEntities[0].rotation_y);
            Assert.AreEqual(1, data.sharedWorldDecorations.Length);
            Assert.AreEqual("shared-1", data.sharedWorldDecorations[0].id);
            Assert.AreEqual("decoration.study-desk", data.sharedWorldDecorations[0].asset_key);
            Assert.AreEqual("小明", data.sharedWorldDecorations[0].shared_source_display_name);

            Assert.AreEqual(8, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/game_catalog_items?select=*&order=sort_order.asc",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/family_game_item_prices?select=catalog_item_id,scroll_price&family_id=eq.family-1",
                dataTransport.Requests[1].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/child_game_wallets?select=*&family_id=eq.family-1&child_profile_id=eq.child-1",
                dataTransport.Requests[2].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/child_inventory_items?select=*&family_id=eq.family-1&child_profile_id=eq.child-1&order=acquired_at.asc",
                dataTransport.Requests[3].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/child_game_loadouts?select=*&family_id=eq.family-1&child_profile_id=eq.child-1",
                dataTransport.Requests[4].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/child_world_states?select=*&family_id=eq.family-1&child_profile_id=eq.child-1",
                dataTransport.Requests[5].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/child_world_entities?select=*&family_id=eq.family-1&child_profile_id=eq.child-1&order=updated_at.asc",
                dataTransport.Requests[6].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/get_my_shared_world_decorations",
                dataTransport.Requests[7].Url);
            Assert.AreEqual(
                "{\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[7].Body);
        }

        [Test]
        public async Task ChildWorldEntityMutationsUseServerRpcContracts()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"revision\":7,\"entity\":{\"id\":\"entity-1\",\"inventory_item_id\":\"inventory-1\",\"entity_kind\":\"decoration\",\"position_x\":1.25,\"position_y\":0,\"position_z\":-2.5,\"rotation_x\":0,\"rotation_y\":15,\"rotation_z\":0,\"scale\":1,\"behavior_mode\":\"static\",\"is_active\":true}}",
                    null),
                new SupabaseHttpResponse(200, "{\"revision\":8}", null),
                new SupabaseHttpResponse(200, "{\"revision\":9}", null),
                new SupabaseHttpResponse(200, "{\"revision\":10}", null));
            SupabaseChildGameClient client = new SupabaseChildGameClient(
                new SupabaseRestClient(settings, authClient, dataTransport));
            SupabaseFriendWorldTransform transform = new SupabaseFriendWorldTransform
            {
                x = 1.25f,
                y = 0f,
                z = -2.5f,
                rotationX = 0f,
                rotationY = 15f,
                rotationZ = 0f,
                scale = 1f,
            };

            SupabaseGameMutationResult placed = await client.PlaceWorldEntityAsync(
                "child-1",
                "inventory-1",
                6,
                transform,
                "static",
                null,
                CancellationToken.None);
            SupabaseGameMutationResult updated = await client.UpdateWorldEntityTransformAsync(
                "child-1",
                "inventory-1",
                "entity-1",
                7,
                transform,
                CancellationToken.None);
            SupabaseGameMutationResult removed = await client.RemoveWorldEntityAsync(
                "child-1",
                "inventory-1",
                "entity-1",
                8,
                CancellationToken.None);
            SupabaseGameMutationResult collected = await client.CollectAllWorldDecorationsAsync(
                "child-1",
                9,
                CancellationToken.None);

            Assert.AreEqual(7L, placed.revision);
            Assert.AreEqual("entity-1", placed.entity.id);
            Assert.AreEqual(8L, updated.revision);
            Assert.AreEqual(9L, removed.revision);
            Assert.AreEqual(10L, collected.revision);
            Assert.AreEqual(4, dataTransport.Requests.Count);
            Assert.AreEqual("POST", dataTransport.Requests[0].Method);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/place_world_entity",
                dataTransport.Requests[0].Url);
            StringAssert.Contains(
                "\"target_inventory_item_id\":\"inventory-1\",\"expected_revision\":6,\"position_x\":1.25,\"position_y\":0,\"position_z\":-2.5,\"rotation_x\":0,\"rotation_y\":15,\"rotation_z\":0,\"target_scale\":1,\"target_behavior_mode\":\"static\",\"target_roaming_slot\":null,\"target_child_profile_id\":\"child-1\"",
                dataTransport.Requests[0].Body);
            StringAssert.Contains(
                "\"target_entity_id\":\"entity-1\"",
                dataTransport.Requests[1].Body);
            Assert.AreEqual(
                "{\"target_inventory_item_id\":\"inventory-1\",\"expected_revision\":8,\"target_entity_id\":\"entity-1\",\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[2].Body);
            Assert.AreEqual(
                "{\"expected_revision\":9,\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[3].Body);
        }

        [Test]
        public async Task ChildGameEconomyUsesServerAuthoritativePurchaseAndLoadoutRpcs()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"purchase_id\":\"purchase-1\",\"inventory_item_id\":\"inventory-1\",\"wallet_balance\":90,\"quantity\":2,\"source_scene_id\":\"sunrise-village\",\"source_npc_id\":\"vendor-1\",\"source_dialogue_version\":1}",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "{\"child_profile_id\":\"child-1\",\"equipped_character_inventory_id\":\"character-inventory-1\",\"following_pet_inventory_id\":null,\"following_pet_inventory_ids\":[]}",
                    null),
                new SupabaseHttpResponse(200, "{\"revision\":4}", null),
                new SupabaseHttpResponse(200, "{\"revision\":5}", null));
            SupabaseChildGameClient client = new SupabaseChildGameClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseGamePurchaseResult purchase = await client.PurchaseGameItemAsync(
                "child-1",
                "catalog-1",
                2,
                "purchase-key",
                "vendor-1",
                CancellationToken.None);
            SupabaseChildGameLoadoutRecord loadout = await client.EquipGameCharacterAsync(
                "child-1",
                "character-inventory-1",
                CancellationToken.None);
            SupabaseGameMutationResult following = await client.SetFollowingPetsAsync(
                "child-1",
                new[] { "pet-inventory-1", "pet-inventory-2" },
                CancellationToken.None);
            SupabaseGameMutationResult roaming = await client.SetRoamingPetsAsync(
                "child-1",
                new[] { "pet-inventory-3" },
                CancellationToken.None);

            Assert.AreEqual("purchase-1", purchase.purchase_id);
            Assert.AreEqual("inventory-1", purchase.inventory_item_id);
            Assert.AreEqual(90L, purchase.wallet_balance);
            Assert.AreEqual("character-inventory-1", loadout.equipped_character_inventory_id);
            Assert.AreEqual(4L, following.revision);
            Assert.AreEqual(5L, roaming.revision);
            Assert.AreEqual(4, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/purchase_game_item",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_catalog_item_id\":\"catalog-1\",\"target_quantity\":2,\"purchase_idempotency_key\":\"purchase-key\",\"target_child_profile_id\":\"child-1\",\"target_source_npc_id\":\"vendor-1\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "{\"target_inventory_item_id\":\"character-inventory-1\",\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[1].Body);
            Assert.AreEqual(
                "{\"target_inventory_item_ids\":[\"pet-inventory-1\",\"pet-inventory-2\"],\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[2].Body);
            Assert.AreEqual(
                "{\"target_inventory_item_ids\":[\"pet-inventory-3\"],\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[3].Body);
        }

        [Test]
        public async Task ChildWorldDataKeepsNpcPurchaseSourcesServerAuthoritative()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"sunrise-village\",\"name\":\"晨光村\",\"sort_order\":1,\"required_completed_count\":0,\"required_general_count\":0,\"unlock_rule_version\":1,\"is_active\":true}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"npc.oum\",\"scene_id\":\"sunrise-village\",\"npc_type\":\"roaming_pet\",\"name\":\"歐姆\",\"asset_key\":\"pet.oum\",\"catalog_item_id\":\"catalog-pet\",\"position_x\":-3,\"position_y\":0,\"position_z\":1,\"behavior_mode\":\"roaming\",\"animation_name\":\"Idle\",\"roam_bounds\":{\"minX\":-6,\"maxX\":6,\"minZ\":-4,\"maxZ\":4},\"is_active\":true}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"npc_id\":\"npc.oum\",\"catalog_item_id\":\"catalog-pet\",\"sort_order\":1,\"dialogue_version\":1,\"is_primary_source\":true,\"is_active\":true}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"scene_id\":\"sunrise-village\",\"unlock_rule_version\":1,\"unlocked_at\":\"2026-09-08T00:00:00Z\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"npc_id\":\"npc.oum\",\"dialogue_version\":1,\"first_talked_at\":\"2026-09-08T00:00:00Z\",\"last_talked_at\":\"2026-09-08T00:00:00Z\"}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "{\"scene_id\":\"sunrise-village\",\"unlocked\":true,\"unlock_rule_version\":1,\"unlocked_at\":\"2026-09-08T00:00:00Z\"}",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "{\"npc_id\":\"npc.oum\",\"scene_id\":\"sunrise-village\",\"dialogue_version\":1,\"offerings\":[{\"catalog_item_id\":\"catalog-pet\",\"asset_key\":\"pet.oum\",\"name\":\"歐姆\",\"item_type\":\"pet\",\"scroll_price\":20,\"sort_order\":1,\"source_scene_id\":\"sunrise-village\",\"source_npc_id\":\"npc.oum\",\"source_dialogue_version\":1}]}",
                    null));
            SupabaseChildWorldClient client = new SupabaseChildWorldClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseChildWorldData data = await client.LoadAsync(
                "family-1",
                "child-1",
                CancellationToken.None);
            SupabaseGamePurchaseGate gate = data.GetPurchaseGate(
                "catalog-pet",
                "pet");
            SupabaseWorldSceneUnlockResult unlock = await client.UnlockSceneAsync(
                "sunrise-village",
                "child-1",
                CancellationToken.None);
            SupabaseWorldNpcDialogueResult dialogue = await client.CompleteNpcDialogueAsync(
                "npc.oum",
                "child-1",
                CancellationToken.None);

            Assert.AreEqual("sunrise-village", data.scenes[0].id);
            Assert.AreEqual("npc.oum", data.npcs[0].id);
            Assert.AreEqual(12, data.npcs[0].roam_bounds.maxX - data.npcs[0].roam_bounds.minX);
            Assert.IsTrue(gate.visible);
            Assert.IsTrue(gate.purchasable);
            Assert.AreEqual("npc.oum", gate.source_npc_id);
            Assert.AreEqual("晨光村，找歐姆", gate.source_label);
            Assert.IsTrue(unlock.unlocked);
            Assert.AreEqual("npc.oum", dialogue.npc_id);
            Assert.AreEqual("catalog-pet", dialogue.offerings[0].catalog_item_id);
            Assert.AreEqual(7, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/game_world_scenes?select=*&is_active=eq.true&order=sort_order.asc",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/child_world_npc_dialogue_progress?select=*&family_id=eq.family-1&child_profile_id=eq.child-1",
                dataTransport.Requests[4].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/unlock_world_scene_if_eligible",
                dataTransport.Requests[5].Url);
            Assert.AreEqual(
                "{\"target_scene_id\":\"sunrise-village\",\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[5].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/complete_world_npc_dialogue",
                dataTransport.Requests[6].Url);
            Assert.AreEqual(
                "{\"target_npc_id\":\"npc.oum\",\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[6].Body);
        }

        [Test]
        public void ChildWorldPurchaseGateHidesUnlistedItemsAndExplainsBlockedSources()
        {
            SupabaseChildWorldData data = new SupabaseChildWorldData
            {
                scenes = new[]
                {
                    new SupabaseGameWorldSceneRecord { id = "sunrise-village", name = "晨光村" },
                    new SupabaseGameWorldSceneRecord { id = "forest-valley", name = "森語谷" },
                },
                npcs = new[]
                {
                    new SupabaseGameWorldNpcRecord
                    {
                        id = "npc.oum",
                        scene_id = "sunrise-village",
                        npc_type = "roaming_pet",
                        name = "歐姆",
                        is_active = true,
                    },
                },
                offerings = new[]
                {
                    new SupabaseGameWorldNpcOfferingRecord
                    {
                        npc_id = "npc.oum",
                        catalog_item_id = "catalog-pet",
                        dialogue_version = 1,
                        is_primary_source = true,
                        is_active = true,
                    },
                },
                sceneUnlocks = new SupabaseChildWorldSceneUnlockRecord[0],
                dialogueProgress = new SupabaseChildWorldNpcDialogueProgressRecord[0],
            };

            SupabaseGamePurchaseGate notOffered = data.GetPurchaseGate("catalog-character", "character");
            SupabaseGamePurchaseGate sceneLocked = data.GetPurchaseGate("catalog-pet", "pet");
            data.sceneUnlocks = new[]
            {
                new SupabaseChildWorldSceneUnlockRecord { scene_id = "sunrise-village" },
            };
            SupabaseGamePurchaseGate dialogueRequired = data.GetPurchaseGate("catalog-pet", "pet");

            Assert.IsFalse(notOffered.visible);
            Assert.AreEqual("not_offered", notOffered.reason);
            Assert.IsTrue(sceneLocked.visible);
            Assert.IsFalse(sceneLocked.purchasable);
            Assert.AreEqual("scene_locked", sceneLocked.reason);
            Assert.IsTrue(dialogueRequired.visible);
            Assert.IsFalse(dialogueRequired.purchasable);
            Assert.AreEqual("dialogue_required", dialogueRequired.reason);
        }

        [Test]
        public async Task ChildSocialClientLoadsFriendCodeFriendsAndRequests()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "\"ABCD1234\"", null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"child_profile_id\":\"friend-1\",\"display_name\":\"小安\",\"is_online\":true,\"world_revision\":4,\"can_collaborate_in_my_world\":true}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"request-1\",\"direction\":\"incoming\",\"child_profile_id\":\"friend-2\",\"display_name\":\"小明\",\"created_at\":\"2026-09-08T00:00:00Z\"}]",
                    null));
            SupabaseChildSocialClient client = new SupabaseChildSocialClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseChildSocialData data = await client.LoadAsync(
                "child-1",
                CancellationToken.None);

            Assert.AreEqual("child-1", data.childProfileId);
            Assert.AreEqual("ABCD1234", data.friendCode);
            Assert.AreEqual("friend-1", data.friends[0].child_profile_id);
            Assert.IsTrue(data.friends[0].is_online);
            Assert.IsTrue(data.friends[0].can_collaborate_in_my_world);
            Assert.AreEqual("request-1", data.requests[0].id);
            Assert.AreEqual("incoming", data.requests[0].direction);
            Assert.AreEqual(3, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/get_my_friend_code",
                dataTransport.Requests[0].Url);
            Assert.AreEqual("{}", dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/list_my_friends",
                dataTransport.Requests[1].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/list_my_friend_requests",
                dataTransport.Requests[2].Url);
        }

        [Test]
        public async Task ChildSocialClientKeepsFriendMutationsServerAuthoritative()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(204, string.Empty, null),
                new SupabaseHttpResponse(204, string.Empty, null),
                new SupabaseHttpResponse(204, string.Empty, null),
                new SupabaseHttpResponse(204, string.Empty, null),
                new SupabaseHttpResponse(204, string.Empty, null));
            SupabaseChildSocialClient client = new SupabaseChildSocialClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            await client.SendFriendRequestAsync(" abcd-1234 ", CancellationToken.None);
            await client.AcceptFriendRequestAsync("request-1", CancellationToken.None);
            await client.DeclineFriendRequestAsync("request-2", CancellationToken.None);
            await client.RemoveFriendAsync("friend-1", CancellationToken.None);
            await client.BlockFriendAsync("friend-2", CancellationToken.None);

            Assert.AreEqual(5, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/send_friend_request",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_friend_code\":\"abcd-1234\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "{\"target_request_id\":\"request-1\"}",
                dataTransport.Requests[1].Body);
            Assert.AreEqual(
                "{\"target_request_id\":\"request-2\"}",
                dataTransport.Requests[2].Body);
            Assert.AreEqual(
                "{\"target_child_profile_id\":\"friend-1\"}",
                dataTransport.Requests[3].Body);
            Assert.AreEqual(
                "{\"target_child_profile_id\":\"friend-2\"}",
                dataTransport.Requests[4].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/block_child",
                dataTransport.Requests[4].Url);
        }

        [Test]
        public async Task ParentGeneralAdventureUsesServerRpcForEachSelectedChild()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"adventure-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"閱讀冒險\",\"adventure_type\":\"general\",\"status\":\"todo\"}",
                    null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            string[] taskIds = await client.CreateGeneralAdventureAsync(
                "family-1",
                new SupabaseParentGeneralAdventureCreateInput
                {
                    childProfileIds = new[] { "child-1" },
                    name = "閱讀冒險",
                    description = "讀完一個章節",
                    points = 20,
                    icon = "Book",
                    category = "learning",
                    durationMinutes = 25,
                    dueOn = "2026-09-08",
                    startTime = "18:00",
                    endTime = "19:00",
                    reportMode = "reflection",
                    requiresTimer = true,
                    requiresReviewBeforeNextTask = true,
                },
                CancellationToken.None);

            Assert.AreEqual(1, taskIds.Length);
            Assert.AreEqual("adventure-1", taskIds[0]);
            Assert.AreEqual(1, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/create_general_adventure",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_family_id\":\"family-1\",\"target_child_profile_id\":\"child-1\",\"adventure_name\":\"閱讀冒險\",\"adventure_description\":\"讀完一個章節\",\"adventure_points\":20,\"adventure_icon\":\"Book\",\"adventure_category\":\"learning\",\"adventure_duration_minutes\":25,\"adventure_due_on\":\"2026-09-08\",\"adventure_start_time\":\"18:00\",\"adventure_end_time\":\"19:00\",\"adventure_completion_report_mode\":\"reflection\",\"adventure_requires_timer\":true,\"adventure_requires_review_before_next_task\":true}",
                dataTransport.Requests[0].Body);
        }

        [Test]
        public async Task ParentAdventureScheduleUsesScopedReadsAndServerRpcLifecycle()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "[{\"id\":\"schedule-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"每日閱讀\",\"description\":\"讀一章\",\"points\":20,\"icon\":\"Book\",\"category\":\"learning\",\"duration_minutes\":25,\"start_time\":\"18:00:00\",\"end_time\":\"19:00:00\",\"weekdays\":[1,2,3,4,5],\"timezone\":\"Asia/Taipei\",\"requires_timer\":true,\"requires_review_before_next_task\":false,\"active_from\":\"2026-09-08\",\"is_active\":true}]",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"schedule-2\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"每日閱讀\"}",
                    null),
                new SupabaseHttpResponse(200, "[]", null),
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"schedule-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"平日閱讀\",\"points\":30,\"duration_minutes\":30,\"weekdays\":[1,3,5],\"is_active\":true}",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"schedule-1\",\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"平日閱讀\",\"is_active\":false}",
                    null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseParentAdventureScheduleRecord[] schedules =
                await client.LoadAdventureSchedulesAsync(
                    "family-1",
                    CancellationToken.None);
            string[] createdIds = await client.CreateAdventureScheduleAsync(
                "family-1",
                new SupabaseParentAdventureScheduleCreateInput
                {
                    childProfileIds = new[] { "child-1" },
                    name = "每日閱讀",
                    description = "讀一章",
                    points = 20,
                    icon = "Book",
                    category = "learning",
                    durationMinutes = 25,
                    startTime = "18:00",
                    endTime = "19:00",
                    weekdays = new[] { 1, 2, 3, 4, 5 },
                    timezone = "Asia/Taipei",
                    requiresTimer = true,
                    activeFrom = "2026-09-08",
                },
                CancellationToken.None);
            SupabaseParentAdventureScheduleRecord updated =
                await client.UpdateAdventureScheduleAsync(
                    "schedule-1",
                    new SupabaseParentAdventureScheduleUpdateInput
                    {
                        name = "平日閱讀",
                        description = "讀兩章",
                        points = 30,
                        icon = "Book",
                        category = "learning",
                        durationMinutes = 30,
                        startTime = "18:00",
                        endTime = "19:00",
                        weekdays = new[] { 1, 3, 5 },
                        timezone = "Asia/Taipei",
                        requiresTimer = true,
                        activeFrom = "2026-09-08",
                        applyMode = "today_and_future",
                    },
                    CancellationToken.None);
            SupabaseParentAdventureScheduleRecord disabled =
                await client.DisableAdventureScheduleAsync(
                    "schedule-1",
                    CancellationToken.None);

            Assert.AreEqual(1, schedules.Length);
            Assert.AreEqual("schedule-1", schedules[0].id);
            Assert.AreEqual(5, schedules[0].weekdays.Length);
            Assert.AreEqual(1, createdIds.Length);
            Assert.AreEqual("schedule-2", createdIds[0]);
            Assert.AreEqual("平日閱讀", updated.name);
            Assert.IsFalse(disabled.is_active);
            Assert.AreEqual(5, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/task_schedules?select=*&family_id=eq.family-1&order=active_from.desc",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/create_adventure_schedule",
                dataTransport.Requests[1].Url);
            Assert.AreEqual(
                "{\"target_family_id\":\"family-1\",\"target_child_profile_id\":\"child-1\",\"schedule_name\":\"每日閱讀\",\"schedule_description\":\"讀一章\",\"schedule_points\":20,\"schedule_icon\":\"Book\",\"schedule_category\":\"learning\",\"schedule_duration_minutes\":25,\"schedule_start_time\":\"18:00\",\"schedule_end_time\":\"19:00\",\"schedule_weekdays\":[1,2,3,4,5],\"schedule_timezone\":\"Asia/Taipei\",\"schedule_requires_timer\":true,\"schedule_requires_review_before_next_task\":false,\"schedule_active_from\":\"2026-09-08\",\"schedule_active_until\":null}",
                dataTransport.Requests[1].Body);
            Assert.AreEqual(
                "{\"target_child_profile_id\":\"child-1\"}",
                dataTransport.Requests[2].Body);
            Assert.AreEqual(
                "{\"target_schedule_id\":\"schedule-1\",\"schedule_name\":\"平日閱讀\",\"schedule_description\":\"讀兩章\",\"schedule_points\":30,\"schedule_icon\":\"Book\",\"schedule_category\":\"learning\",\"schedule_duration_minutes\":30,\"schedule_start_time\":\"18:00\",\"schedule_end_time\":\"19:00\",\"schedule_weekdays\":[1,3,5],\"schedule_timezone\":\"Asia/Taipei\",\"schedule_requires_timer\":true,\"schedule_requires_review_before_next_task\":false,\"schedule_active_from\":\"2026-09-08\",\"schedule_active_until\":null,\"update_scope\":\"today_and_future\"}",
                dataTransport.Requests[3].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/disable_adventure_schedule",
                dataTransport.Requests[4].Url);
            Assert.AreEqual(
                "{\"target_schedule_id\":\"schedule-1\"}",
                dataTransport.Requests[4].Body);
        }

        [Test]
        public async Task ParentRewardCrudUsesRlsScopedPostgrestMutations()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(201, string.Empty, null),
                new SupabaseHttpResponse(204, string.Empty, null),
                new SupabaseHttpResponse(204, string.Empty, null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            await client.CreateRewardAsync(
                "family-1",
                new SupabaseParentRewardCreateInput
                {
                    childProfileId = "child-1",
                    name = "週末看電影",
                    points = 50,
                    icon = "Gift",
                },
                CancellationToken.None);
            await client.UpdateRewardAsync(
                new SupabaseChildRewardRecord
                {
                    id = "reward-1",
                    icon = "Gift",
                },
                "週末看電影加長版",
                60,
                CancellationToken.None);
            await client.DeleteRewardAsync("reward-1", CancellationToken.None);

            Assert.AreEqual(3, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rewards",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"family_id\":\"family-1\",\"child_profile_id\":\"child-1\",\"name\":\"週末看電影\",\"points\":50,\"icon\":\"Gift\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rewards?id=eq.reward-1",
                dataTransport.Requests[1].Url);
            Assert.AreEqual(
                "{\"name\":\"週末看電影加長版\",\"points\":60,\"icon\":\"Gift\"}",
                dataTransport.Requests[1].Body);
            Assert.AreEqual(
                "DELETE",
                dataTransport.Requests[2].Method);
        }

        [Test]
        public async Task ParentPointAdjustmentUsesServerAuthoritativeRpc()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"points_balance\":35,\"ledger_entry\":{\"id\":\"ledger-2\"}}",
                    null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            int balance = await client.AdjustChildPointsAsync(
                "child-1",
                15,
                "完成額外家事",
                CancellationToken.None);

            Assert.AreEqual(35, balance);
            Assert.AreEqual(1, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/adjust_child_points",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_child_profile_id\":\"child-1\",\"points_delta\":15,\"adjustment_note\":\"完成額外家事\"}",
                dataTransport.Requests[0].Body);
        }

        [Test]
        public async Task ParentChildAccountActionsUseTheAuthenticatedEdgeFunction()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"parent-user-1\",\"email\":\"parent@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "parent@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"child\":{\"id\":\"child-1\",\"display_name\":\"小明\",\"login_name\":\"kid_1\"}}",
                    null),
                new SupabaseHttpResponse(200, "{\"success\":true}", null),
                new SupabaseHttpResponse(200, "{\"success\":true}", null));
            SupabaseParentHomeClient client = new SupabaseParentHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport));

            SupabaseChildProfileRecord child = await client.CreateChildAccountAsync(
                "family-1",
                new SupabaseParentChildAccountCreateInput
                {
                    childProfileId = "child-1",
                    childName = "小明",
                    loginName = "kid_1",
                    password = "abc123",
                },
                CancellationToken.None);
            await client.ResetChildPasswordAsync(
                "family-1",
                "child-1",
                "new123",
                CancellationToken.None);
            await client.DeleteChildAccountAsync(
                "family-1",
                "child-1",
                CancellationToken.None);

            Assert.AreEqual("child-1", child.id);
            Assert.AreEqual(3, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/functions/v1/manage-child-account",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"action\":\"create\",\"familyId\":\"family-1\",\"childProfileId\":\"child-1\",\"childName\":\"小明\",\"loginName\":\"kid_1\",\"password\":\"abc123\"}",
                dataTransport.Requests[0].Body);
            Assert.AreEqual(
                "{\"action\":\"reset-password\",\"familyId\":\"family-1\",\"childProfileId\":\"child-1\",\"password\":\"new123\"}",
                dataTransport.Requests[1].Body);
            Assert.AreEqual(
                "{\"action\":\"delete\",\"familyId\":\"family-1\",\"childProfileId\":\"child-1\"}",
                dataTransport.Requests[2].Body);
        }

        [Test]
        public async Task ChildAdventureAbandonUsesTheServerRpc()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore authStore = new InMemorySupabaseSessionStore();
            SupabaseAuthClient authClient = new SupabaseAuthClient(
                settings,
                authStore,
                new FakeSupabaseTransport(
                    new SupabaseHttpResponse(
                        200,
                        "{\"access_token\":\"access-token\",\"refresh_token\":\"refresh-token\",\"expires_in\":3600,\"user\":{\"id\":\"child-user-1\",\"email\":\"child@example.com\"}}",
                        null)));
            await authClient.SignInWithPasswordAsync(
                "child@example.com",
                "secret-password",
                CancellationToken.None);

            FakeSupabaseTransport dataTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(200, "{}", null));
            SupabaseChildHomeClient client = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, dataTransport),
                new InMemorySupabaseTaskCompletionQueueStore(),
                new InMemorySupabaseChildHomeSnapshotStore(),
                () => true);

            await client.AbandonAdventureAsync("task-1", CancellationToken.None);

            Assert.AreEqual(1, dataTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/abandon_child_adventure",
                dataTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_task_id\":\"task-1\"}",
                dataTransport.Requests[0].Body);
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
        public async Task ChildTimerUsesServerAuthoritativeStartPauseAndResumeRpcs()
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

            FakeSupabaseTransport timerTransport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"timer-1\",\"task_id\":\"task-1\",\"status\":\"running\",\"accumulated_seconds\":0}",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"timer-1\",\"task_id\":\"task-1\",\"status\":\"paused\",\"accumulated_seconds\":42}",
                    null),
                new SupabaseHttpResponse(
                    200,
                    "{\"id\":\"timer-1\",\"task_id\":\"task-1\",\"status\":\"running\",\"accumulated_seconds\":42}",
                    null));
            SupabaseChildHomeClient client = new SupabaseChildHomeClient(
                new SupabaseRestClient(settings, authClient, timerTransport),
                new InMemorySupabaseTaskCompletionQueueStore(),
                () => true);

            SupabaseTaskTimerSessionRecord started =
                await client.StartAdventureTimerAsync("task-1", CancellationToken.None);
            SupabaseTaskTimerSessionRecord paused =
                await client.PauseAdventureTimerAsync("task-1", CancellationToken.None);
            SupabaseTaskTimerSessionRecord resumed =
                await client.ResumeAdventureTimerAsync("task-1", CancellationToken.None);

            Assert.AreEqual("running", started.status);
            Assert.AreEqual("paused", paused.status);
            Assert.AreEqual(42, paused.accumulated_seconds);
            Assert.AreEqual("running", resumed.status);
            Assert.AreEqual(3, timerTransport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/start_adventure_timer",
                timerTransport.Requests[0].Url);
            Assert.AreEqual(
                "{\"target_task_id\":\"task-1\"}",
                timerTransport.Requests[1].Body);
            Assert.AreEqual(
                "https://example.supabase.co/rest/v1/rpc/resume_adventure_timer",
                timerTransport.Requests[2].Url);
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
        public void AuthRequestBuilderBuildsTheSupabasePkceGrant()
        {
            SupabaseClientSettings settings = CreateSettings();
            SupabaseRequestContract request;
            string error;

            bool created = SupabaseAuthRequestBuilder.TryBuildPkceGrant(
                settings,
                "auth-code",
                "verifier-value",
                out request,
                out error);

            Assert.IsTrue(created, error);
            Assert.AreEqual(
                "https://example.supabase.co/auth/v1/token?grant_type=pkce",
                request.Url);
            Assert.AreEqual("sb_publishable_test-key", request.Headers["apikey"]);
            Assert.AreEqual("application/json", request.Headers["Content-Type"]);
            Assert.AreEqual(
                "{\"auth_code\":\"auth-code\",\"code_verifier\":\"verifier-value\"}",
                request.Body);
        }

        [Test]
        public async Task AuthClientExchangesPkceCodeAndPersistsSession()
        {
            SupabaseClientSettings settings = CreateSettings();
            InMemorySupabaseSessionStore store = new InMemorySupabaseSessionStore();
            FakeSupabaseTransport transport = new FakeSupabaseTransport(
                new SupabaseHttpResponse(
                    200,
                    "{\"access_token\":\"pkce-access\",\"refresh_token\":\"pkce-refresh\",\"expires_in\":3600,\"user\":{\"id\":\"user-pkce\",\"email\":\"parent@example.com\"}}",
                    null));
            SupabaseAuthClient client = new SupabaseAuthClient(settings, store, transport);

            SupabaseSession session = await client.ExchangeCodeForSessionAsync(
                "auth-code",
                "verifier-value",
                false,
                CancellationToken.None);

            Assert.AreEqual("user-pkce", session.User.Id);
            Assert.AreEqual(1, transport.Requests.Count);
            Assert.AreEqual(
                "https://example.supabase.co/auth/v1/token?grant_type=pkce",
                transport.Requests[0].Url);
            Assert.AreEqual(
                "{\"auth_code\":\"auth-code\",\"code_verifier\":\"verifier-value\"}",
                transport.Requests[0].Body);

            SupabaseSession persisted;
            string error;
            Assert.IsTrue(
                SupabaseSessionSerializer.TryDeserialize(store.Load(), out persisted, out error),
                error);
            Assert.AreEqual("pkce-refresh", persisted.RefreshToken);
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

        [Test]
        public void DeepLinkRuntimeAndMobileBuildHooksUseTheExistingAppScheme()
        {
            string projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            string bootstrap = File.ReadAllText(
                Path.Combine(projectRoot, "Assets/Scripts/Platform/HabitHeroBootstrap.cs"));
            string postProcess = File.ReadAllText(
                Path.Combine(projectRoot, "Assets/Editor/HabitHeroDeepLinkPostProcess.cs"));

            StringAssert.Contains("Application.deepLinkActivated", bootstrap);
            StringAssert.Contains("Application.absoluteURL", bootstrap);
            StringAssert.Contains("CFBundleURLTypes", postProcess);
            StringAssert.Contains("android.intent.action.VIEW", postProcess);
            StringAssert.Contains("AuthCallbackParser.AppUrlScheme", postProcess);
        }

        private static void AssertVector3(Vector3 expected, Vector3 actual)
        {
            Assert.AreEqual(expected.x, actual.x, 0.0001f);
            Assert.AreEqual(expected.y, actual.y, 0.0001f);
            Assert.AreEqual(expected.z, actual.z, 0.0001f);
        }

        private static void AssertAuthoredSceneModuleCount(
            string sceneId,
            int expectedCount)
        {
            HabitHeroWorldAssetModule[] modules;
            Assert.IsTrue(
                HabitHeroWorldAssetCatalog.TryGetModules(sceneId, out modules),
                "Missing authored scene catalog for " + sceneId);
            Assert.AreEqual(expectedCount, modules.Length, "Unexpected authored module count for " + sceneId);
            foreach (HabitHeroWorldAssetModule module in modules)
            {
                Assert.IsNotNull(module);
                Assert.IsTrue(
                    HabitHeroGameAssetCatalog.HasModel(module.AssetKey),
                    "Missing world asset allow-list entry for " + module.AssetKey);
            }
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

        private sealed class FakePushTokenProvider : ISupabasePushTokenProvider
        {
            private readonly SupabasePushTokenResult result;

            public FakePushTokenProvider(SupabasePushTokenResult result)
            {
                this.result = result;
            }

            public bool IsSupported
            {
                get { return result != null && result.IsSupported; }
            }

            public int RequestCount { get; private set; }

            public Task<SupabasePushTokenResult> RequestTokenAsync(
                CancellationToken cancellationToken)
            {
                RequestCount += 1;
                return Task.FromResult(result);
            }
        }

        private sealed class FakeRealtimeTransport : ISupabaseRealtimeTransport
        {
            private readonly Queue<string> incoming = new Queue<string>();
            private TaskCompletionSource<string> waitingReceive;
            private bool open;

            public List<string> SentMessages { get; } = new List<string>();

            public bool IsOpen { get { return open; } }

            public Task ConnectAsync(Uri uri, CancellationToken cancellationToken)
            {
                open = true;
                return Task.CompletedTask;
            }

            public Task SendTextAsync(string message, CancellationToken cancellationToken)
            {
                SentMessages.Add(message);
                if (message.Contains("\"event\":\"phx_join\"")
                    || message.Contains("\"event\":\"presence\"")
                    || message.Contains("\"event\":\"phx_leave\""))
                {
                    Enqueue(
                        "{\"topic\":\""
                        + ReadJsonString(message, "topic")
                        + "\",\"event\":\"phx_reply\",\"payload\":{\"status\":\"ok\",\"response\":{}},\"ref\":\""
                        + ReadJsonString(message, "ref")
                        + "\",\"join_ref\":\""
                        + ReadJsonString(message, "join_ref")
                        + "\"}");
                }

                return Task.CompletedTask;
            }

            public Task<string> ReceiveTextAsync(CancellationToken cancellationToken)
            {
                if (incoming.Count > 0) return Task.FromResult(incoming.Dequeue());
                waitingReceive = new TaskCompletionSource<string>();
                cancellationToken.Register(() => waitingReceive.TrySetCanceled());
                return waitingReceive.Task;
            }

            public Task CloseAsync(CancellationToken cancellationToken)
            {
                open = false;
                if (waitingReceive != null) waitingReceive.TrySetResult(null);
                return Task.CompletedTask;
            }

            public void Dispose()
            {
                open = false;
                if (waitingReceive != null) waitingReceive.TrySetResult(null);
            }

            public void SimulateServerClose()
            {
                open = false;
                if (waitingReceive == null) return;
                TaskCompletionSource<string> completion = waitingReceive;
                waitingReceive = null;
                completion.TrySetResult(null);
            }

            private static string ReadJsonString(string json, string key)
            {
                string marker = "\"" + key + "\":\"";
                int start = json.IndexOf(marker, StringComparison.Ordinal);
                if (start < 0) return string.Empty;
                start += marker.Length;
                int end = json.IndexOf('"', start);
                return end < 0 ? string.Empty : json.Substring(start, end - start);
            }

            private void Enqueue(string message)
            {
                if (waitingReceive != null)
                {
                    TaskCompletionSource<string> completion = waitingReceive;
                    waitingReceive = null;
                    completion.TrySetResult(message);
                    return;
                }

                incoming.Enqueue(message);
            }
        }
    }
}
