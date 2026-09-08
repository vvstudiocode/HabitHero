using System;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;

namespace HabitHero.App
{
    public sealed class HabitHeroChildHomeCoordinator
    {
        private const string ChildEmailDomain = "@children.habithero.local";

        private readonly SupabaseChildHomeClient client;
        private readonly SupabaseChildGameClient gameClient;
        private readonly SupabaseChildWorldClient worldClient;
        private readonly SupabaseChildSocialClient socialClient;
        private readonly SupabaseChildFriendWorldClient friendWorldClient;
        private readonly SupabaseChildWorldChatClient worldChatClient;
        private readonly Transform canvasTransform;
        private readonly Font font;
        private HabitHeroChildHomeView view;
        private IDisposable worldChatRealtimeSubscription;
        private CancellationTokenSource worldChatRealtimeCancellation;
        private string worldChatRealtimeOwner;
        private int worldChatRealtimeVersion;

        public HabitHeroChildHomeCoordinator(
            SupabaseChildHomeClient client,
            SupabaseChildGameClient gameClient,
            SupabaseChildWorldClient worldClient,
            SupabaseChildSocialClient socialClient,
            SupabaseChildFriendWorldClient friendWorldClient,
            SupabaseChildWorldChatClient worldChatClient,
            Transform canvasTransform,
            Font font)
        {
            if (client == null) throw new ArgumentNullException("client");
            if (gameClient == null) throw new ArgumentNullException("gameClient");
            if (worldClient == null) throw new ArgumentNullException("worldClient");
            if (socialClient == null) throw new ArgumentNullException("socialClient");
            if (friendWorldClient == null) throw new ArgumentNullException("friendWorldClient");
            if (worldChatClient == null) throw new ArgumentNullException("worldChatClient");
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.client = client;
            this.gameClient = gameClient;
            this.worldClient = worldClient;
            this.socialClient = socialClient;
            this.friendWorldClient = friendWorldClient;
            this.worldChatClient = worldChatClient;
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public async Task<bool> TryShowAsync(
            SupabaseSession session,
            CancellationToken cancellationToken,
            Action<string, bool> setStatus,
            Action onSignOut,
            Action hideLogin,
            Action showLogin)
        {
            string email = session == null || session.User == null ? string.Empty : session.User.Email;
            bool isChildSession = !string.IsNullOrWhiteSpace(email)
                && email.EndsWith(ChildEmailDomain, StringComparison.OrdinalIgnoreCase);
            if (!isChildSession) return false;

            setStatus("正在載入今日任務…", false);
            try
            {
                SupabaseChildHomeSnapshot snapshot = await client.LoadAsync(cancellationToken);
                SupabaseChildGameData gameData = null;
                try
                {
                    gameData = await gameClient.LoadAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception exception)
                {
                    setStatus("任務已載入；冒險商店暫時無法連線：" + exception.Message, true);
                }

                SupabaseChildWorldData worldData = null;
                try
                {
                    worldData = await worldClient.LoadAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception exception)
                {
                    setStatus("任務已載入；NPC 商品來源暫時無法同步：" + exception.Message, true);
                }

                SupabaseChildSocialData socialData = null;
                try
                {
                    socialData = await socialClient.LoadAsync(
                        snapshot.child.id,
                        cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception exception)
                {
                    setStatus("任務已載入；好友資料暫時無法同步：" + exception.Message, true);
                }

                if (view == null) view = new HabitHeroChildHomeView(canvasTransform, font);
                view.Show(
                    snapshot,
                    gameData,
                    worldData,
                    socialData,
                    (sceneId) => UnlockWorldSceneAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        sceneId,
                        cancellationToken),
                    (npcId) => CompleteNpcDialogueAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        npcId,
                        cancellationToken),
                    () => RefreshSocialAsync(snapshot.child.id, cancellationToken),
                    (friendCode) => SendFriendRequestAndRefreshAsync(
                        snapshot.child.id,
                        friendCode,
                        cancellationToken),
                    (requestId) => AcceptFriendRequestAndRefreshAsync(
                        snapshot.child.id,
                        requestId,
                        cancellationToken),
                    (requestId) => DeclineFriendRequestAndRefreshAsync(
                        snapshot.child.id,
                        requestId,
                        cancellationToken),
                    (friendChildProfileId) => RemoveFriendAndRefreshAsync(
                        snapshot.child.id,
                        friendChildProfileId,
                        cancellationToken),
                    (friendChildProfileId) => BlockFriendAndRefreshAsync(
                        snapshot.child.id,
                        friendChildProfileId,
                        cancellationToken),
                    (friendChildProfileId) => LoadFriendWorldAsync(
                        friendChildProfileId,
                        cancellationToken),
                    (friendChildProfileId) => LoadWorldChatAsync(
                        friendChildProfileId,
                        cancellationToken),
                    (friendChildProfileId, body) => SendWorldChatAndRefreshAsync(
                        friendChildProfileId,
                        body,
                        cancellationToken),
                    (friendChildProfileId, messageId) => MarkWorldChatReadAndRefreshAsync(
                        friendChildProfileId,
                        messageId,
                        cancellationToken),
                    (friendChildProfileId, messageId) => ReportWorldChatAndRefreshAsync(
                        friendChildProfileId,
                        messageId,
                        cancellationToken),
                    (task, draft) => SubmitTaskAsync(task, draft, cancellationToken),
                    (taskId) => client.StartAdventureTimerAsync(taskId, cancellationToken),
                    (taskId) => client.PauseAdventureTimerAsync(taskId, cancellationToken),
                    (taskId) => client.ResumeAdventureTimerAsync(taskId, cancellationToken),
                    (taskId) => client.AbandonAdventureAndRefreshAsync(
                        taskId,
                        cancellationToken),
                    (rewardId) => client.RedeemRewardAndRefreshAsync(rewardId, cancellationToken),
                    (name) => client.AddWishlistItemAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        name,
                        cancellationToken),
                    (wishlistId) => client.DeleteWishlistItemAndRefreshAsync(
                        wishlistId,
                        cancellationToken),
                    (catalogItemId, quantity, sourceNpcId) => PurchaseGameItemAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        catalogItemId,
                        quantity,
                        sourceNpcId,
                        cancellationToken),
                    (inventoryItemId) => EquipGameCharacterAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        inventoryItemId,
                        cancellationToken),
                    (inventoryItemIds) => SetFollowingPetsAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        inventoryItemIds,
                        cancellationToken),
                    (inventoryItemIds) => SetRoamingPetsAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        inventoryItemIds,
                        cancellationToken),
                    onSignOut);
                hideLogin();
                return true;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                showLogin();
                setStatus("載入孩子資料失敗：" + exception.Message, true);
                return false;
            }
        }

        private async Task<SupabaseTaskCompletionResult> SubmitTaskAsync(
            SupabaseChildTaskRecord task,
            SupabaseTaskCompletionDraft draft,
            CancellationToken cancellationToken)
        {
            if (task == null) throw new ArgumentNullException("task");
            if (draft == null) draft = new SupabaseTaskCompletionDraft();
            SupabaseTaskCompletionResult result = await client.SubmitTaskCompletionAndRefreshAsync(
                task.id,
                draft.quickReport,
                draft.reflection,
                draft.mood,
                draft.difficulty,
                cancellationToken);
            if (result.RefreshedSnapshot != null && view != null)
            {
                view.ApplySnapshot(result.RefreshedSnapshot);
            }

            return result;
        }

        private async Task<SupabaseChildGameData> PurchaseGameItemAndRefreshAsync(
            string familyId,
            string childProfileId,
            string catalogItemId,
            int quantity,
            string sourceNpcId,
            CancellationToken cancellationToken)
        {
            await gameClient.PurchaseGameItemAsync(
                childProfileId,
                catalogItemId,
                quantity,
                SupabaseChildGameClient.CreatePurchaseIdempotencyKey(),
                sourceNpcId,
                cancellationToken);
            return await gameClient.LoadAsync(familyId, childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildGameData> EquipGameCharacterAndRefreshAsync(
            string familyId,
            string childProfileId,
            string inventoryItemId,
            CancellationToken cancellationToken)
        {
            await gameClient.EquipGameCharacterAsync(
                childProfileId,
                inventoryItemId,
                cancellationToken);
            return await gameClient.LoadAsync(familyId, childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildWorldData> UnlockWorldSceneAndRefreshAsync(
            string familyId,
            string childProfileId,
            string sceneId,
            CancellationToken cancellationToken)
        {
            await worldClient.UnlockSceneAsync(
                sceneId,
                childProfileId,
                cancellationToken);
            return await worldClient.LoadAsync(
                familyId,
                childProfileId,
                cancellationToken);
        }

        private async Task<SupabaseChildWorldData> CompleteNpcDialogueAndRefreshAsync(
            string familyId,
            string childProfileId,
            string npcId,
            CancellationToken cancellationToken)
        {
            await worldClient.CompleteNpcDialogueAsync(
                npcId,
                childProfileId,
                cancellationToken);
            return await worldClient.LoadAsync(
                familyId,
                childProfileId,
                cancellationToken);
        }

        private Task<SupabaseChildSocialData> RefreshSocialAsync(
            string childProfileId,
            CancellationToken cancellationToken)
        {
            return socialClient.LoadAsync(childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildSocialData> SendFriendRequestAndRefreshAsync(
            string childProfileId,
            string friendCode,
            CancellationToken cancellationToken)
        {
            await socialClient.SendFriendRequestAsync(friendCode, cancellationToken);
            return await RefreshSocialAsync(childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildSocialData> AcceptFriendRequestAndRefreshAsync(
            string childProfileId,
            string requestId,
            CancellationToken cancellationToken)
        {
            await socialClient.AcceptFriendRequestAsync(requestId, cancellationToken);
            return await RefreshSocialAsync(childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildSocialData> DeclineFriendRequestAndRefreshAsync(
            string childProfileId,
            string requestId,
            CancellationToken cancellationToken)
        {
            await socialClient.DeclineFriendRequestAsync(requestId, cancellationToken);
            return await RefreshSocialAsync(childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildSocialData> RemoveFriendAndRefreshAsync(
            string childProfileId,
            string friendChildProfileId,
            CancellationToken cancellationToken)
        {
            await socialClient.RemoveFriendAsync(friendChildProfileId, cancellationToken);
            return await RefreshSocialAsync(childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildSocialData> BlockFriendAndRefreshAsync(
            string childProfileId,
            string friendChildProfileId,
            CancellationToken cancellationToken)
        {
            await socialClient.BlockFriendAsync(friendChildProfileId, cancellationToken);
            return await RefreshSocialAsync(childProfileId, cancellationToken);
        }

        private Task<SupabaseChildFriendWorldData> LoadFriendWorldAsync(
            string friendChildProfileId,
            CancellationToken cancellationToken)
        {
            return friendWorldClient.LoadAsync(
                friendChildProfileId,
                cancellationToken);
        }

        private Task<SupabaseChildWorldChatData> LoadWorldChatAsync(
            string friendChildProfileId,
            CancellationToken cancellationToken)
        {
            return LoadWorldChatAndSubscribeAsync(
                friendChildProfileId,
                cancellationToken);
        }

        private async Task<SupabaseChildWorldChatData> LoadWorldChatAndSubscribeAsync(
            string friendChildProfileId,
            CancellationToken cancellationToken)
        {
            SupabaseChildWorldChatData data = await worldChatClient.LoadAsync(
                friendChildProfileId,
                cancellationToken);
            _ = EnsureWorldChatRealtimeAsync(
                friendChildProfileId,
                cancellationToken);
            return data;
        }

        private async Task EnsureWorldChatRealtimeAsync(
            string friendChildProfileId,
            CancellationToken cancellationToken)
        {
            string normalizedOwner = (friendChildProfileId ?? string.Empty).Trim();
            if (string.Equals(
                    worldChatRealtimeOwner,
                    normalizedOwner,
                    StringComparison.Ordinal)
                && worldChatRealtimeSubscription != null)
            {
                return;
            }

            StopWorldChatRealtime();
            int requestVersion = worldChatRealtimeVersion;
            CancellationTokenSource subscriptionCancellation =
                CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            worldChatRealtimeCancellation = subscriptionCancellation;
            try
            {
                IDisposable subscription = await worldChatClient.SubscribeAsync(
                    normalizedOwner,
                    HandleWorldChatRealtimeMessage,
                    subscriptionCancellation.Token);
                if (subscriptionCancellation.IsCancellationRequested
                    || requestVersion != worldChatRealtimeVersion
                    || view == null)
                {
                    subscription.Dispose();
                    return;
                }

                worldChatRealtimeSubscription = subscription;
                worldChatRealtimeOwner = normalizedOwner;
            }
            catch (OperationCanceledException)
            {
                // The current child session or selected world was replaced.
            }
            catch (Exception)
            {
                // Chat history and RPC mutations remain available if Realtime is unavailable.
            }
            finally
            {
                if (ReferenceEquals(
                        worldChatRealtimeCancellation,
                        subscriptionCancellation))
                {
                    worldChatRealtimeCancellation = null;
                }

                subscriptionCancellation.Dispose();
            }
        }

        private void HandleWorldChatRealtimeMessage(
            SupabaseWorldChatMessageRecord message)
        {
            if (message == null || view == null) return;
            view.NotifyWorldChatChanged(message.world_owner_child_profile_id);
        }

        private void StopWorldChatRealtime()
        {
            worldChatRealtimeVersion += 1;
            if (worldChatRealtimeCancellation != null)
            {
                worldChatRealtimeCancellation.Cancel();
                worldChatRealtimeCancellation = null;
            }

            if (worldChatRealtimeSubscription != null)
            {
                worldChatRealtimeSubscription.Dispose();
                worldChatRealtimeSubscription = null;
            }

            worldChatRealtimeOwner = null;
        }

        private async Task<SupabaseChildWorldChatData> SendWorldChatAndRefreshAsync(
            string friendChildProfileId,
            string body,
            CancellationToken cancellationToken)
        {
            await worldChatClient.SendAsync(
                friendChildProfileId,
                body,
                cancellationToken);
            return await LoadWorldChatAsync(friendChildProfileId, cancellationToken);
        }

        private async Task<SupabaseChildWorldChatData> MarkWorldChatReadAndRefreshAsync(
            string friendChildProfileId,
            string messageId,
            CancellationToken cancellationToken)
        {
            await worldChatClient.MarkReadAsync(
                friendChildProfileId,
                messageId,
                cancellationToken);
            return await LoadWorldChatAsync(friendChildProfileId, cancellationToken);
        }

        private async Task<SupabaseChildWorldChatData> ReportWorldChatAndRefreshAsync(
            string friendChildProfileId,
            string messageId,
            CancellationToken cancellationToken)
        {
            await worldChatClient.ReportAsync(
                messageId,
                "未提供原因",
                cancellationToken);
            return await LoadWorldChatAsync(friendChildProfileId, cancellationToken);
        }

        private async Task<SupabaseChildGameData> SetFollowingPetsAndRefreshAsync(
            string familyId,
            string childProfileId,
            string[] inventoryItemIds,
            CancellationToken cancellationToken)
        {
            await gameClient.SetFollowingPetsAsync(
                childProfileId,
                inventoryItemIds,
                cancellationToken);
            return await gameClient.LoadAsync(familyId, childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildGameData> SetRoamingPetsAndRefreshAsync(
            string familyId,
            string childProfileId,
            string[] inventoryItemIds,
            CancellationToken cancellationToken)
        {
            await gameClient.SetRoamingPetsAsync(
                childProfileId,
                inventoryItemIds,
                cancellationToken);
            return await gameClient.LoadAsync(familyId, childProfileId, cancellationToken);
        }

        public void Dispose()
        {
            StopWorldChatRealtime();
            if (view == null) return;
            view.Dispose();
            view = null;
        }
    }
}
