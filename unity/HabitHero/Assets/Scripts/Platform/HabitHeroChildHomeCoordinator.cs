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
        private readonly SupabaseChildCoopAdventureClient coopAdventureClient;
        private readonly SupabaseChildFriendWorldClient friendWorldClient;
        private readonly SupabaseChildWorldChatClient worldChatClient;
        private readonly SupabaseChildFriendWorldRealtimeClient friendWorldRealtimeClient;
        private readonly Transform canvasTransform;
        private readonly Font font;
        private readonly string gameAssetBaseUrl;
        private readonly Action openNotificationSettings;
        private HabitHeroChildHomeView view;
        private IDisposable worldChatRealtimeSubscription;
        private CancellationTokenSource worldChatRealtimeCancellation;
        private string worldChatRealtimeOwner;
        private int worldChatRealtimeVersion;
        private SupabaseChildFriendWorldRealtimeSubscription friendWorldRealtimeSubscription;
        private CancellationTokenSource friendWorldRealtimeCancellation;
        private string friendWorldRealtimeOwner;
        private string friendWorldRealtimeChildProfileId;
        private readonly string friendWorldRealtimeConnectionId = Guid.NewGuid().ToString("N");
        private SupabaseFriendWorldAvatarState latestLocalFriendWorldAvatarState;
        private bool friendWorldRealtimeCrowded;
        private int friendWorldRevisionRefreshVersion;
        private int friendWorldRealtimeVersion;
        private string activeFamilyId;
        private string activeChildProfileId;
        private bool activeParentChildMode;

        public HabitHeroChildHomeCoordinator(
            SupabaseChildHomeClient client,
            SupabaseChildGameClient gameClient,
            SupabaseChildWorldClient worldClient,
            SupabaseChildSocialClient socialClient,
            SupabaseChildCoopAdventureClient coopAdventureClient,
            SupabaseChildFriendWorldClient friendWorldClient,
            SupabaseChildWorldChatClient worldChatClient,
            SupabaseChildFriendWorldRealtimeClient friendWorldRealtimeClient,
            Transform canvasTransform,
            Font font,
            string gameAssetBaseUrl,
            Action openNotificationSettings = null)
        {
            if (client == null) throw new ArgumentNullException("client");
            if (gameClient == null) throw new ArgumentNullException("gameClient");
            if (worldClient == null) throw new ArgumentNullException("worldClient");
            if (socialClient == null) throw new ArgumentNullException("socialClient");
            if (coopAdventureClient == null)
            {
                throw new ArgumentNullException("coopAdventureClient");
            }
            if (friendWorldClient == null) throw new ArgumentNullException("friendWorldClient");
            if (worldChatClient == null) throw new ArgumentNullException("worldChatClient");
            if (friendWorldRealtimeClient == null)
            {
                throw new ArgumentNullException("friendWorldRealtimeClient");
            }
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.client = client;
            this.gameClient = gameClient;
            this.worldClient = worldClient;
            this.socialClient = socialClient;
            this.coopAdventureClient = coopAdventureClient;
            this.friendWorldClient = friendWorldClient;
            this.worldChatClient = worldChatClient;
            this.friendWorldRealtimeClient = friendWorldRealtimeClient;
            this.canvasTransform = canvasTransform;
            this.font = font;
            this.gameAssetBaseUrl = gameAssetBaseUrl == null
                ? string.Empty
                : gameAssetBaseUrl.Trim();
            this.openNotificationSettings = openNotificationSettings;
        }

        public string ActiveFamilyId { get { return activeFamilyId; } }

        public string ActiveChildProfileId { get { return activeChildProfileId; } }

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

                ShowLoadedView(
                    snapshot,
                    gameData,
                    worldData,
                    socialData,
                    false,
                    cancellationToken,
                    onSignOut,
                    null);
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

        public async Task<bool> TryShowParentChildAsync(
            string familyId,
            string childProfileId,
            CancellationToken cancellationToken,
            Action<string, bool> setStatus,
            Action onSignOut,
            Action onSwitchToParent,
            Action hideLogin,
            Action showLogin)
        {
            if (string.IsNullOrWhiteSpace(familyId)
                || string.IsNullOrWhiteSpace(childProfileId))
            {
                return false;
            }

            setStatus("正在載入孩子互動模式…", false);
            try
            {
                SupabaseChildHomeSnapshot snapshot = await client.LoadForParentAsync(
                    familyId,
                    childProfileId,
                    cancellationToken);
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

                ShowLoadedView(
                    snapshot,
                    gameData,
                    worldData,
                    null,
                    true,
                    cancellationToken,
                    onSignOut,
                    onSwitchToParent);
                hideLogin();
                return true;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                if (showLogin != null) showLogin();
                setStatus("載入孩子互動模式失敗：" + exception.Message, true);
                return false;
            }
        }

        private void ShowLoadedView(
            SupabaseChildHomeSnapshot snapshot,
            SupabaseChildGameData gameData,
            SupabaseChildWorldData worldData,
            SupabaseChildSocialData socialData,
            bool parentChildMode,
            CancellationToken cancellationToken,
            Action onSignOut,
            Action onSwitchToParent)
        {
            activeFamilyId = snapshot.familyId;
            activeChildProfileId = snapshot.child.id;
            activeParentChildMode = parentChildMode;
            if (view == null)
            {
                view = new HabitHeroChildHomeView(
                    canvasTransform,
                    font,
                    gameAssetBaseUrl);
            }

            Func<Task<SupabaseChildSocialData>> refreshSocial = null;
            Func<string, Task<SupabaseChildSocialData>> sendFriendRequest = null;
            Func<string, Task<SupabaseChildSocialData>> acceptFriendRequest = null;
            Func<string, Task<SupabaseChildSocialData>> declineFriendRequest = null;
            Func<string, Task<SupabaseChildSocialData>> removeFriend = null;
            Func<string, Task<SupabaseChildSocialData>> blockFriend = null;
            Func<string, bool, Task<SupabaseChildSocialData>> toggleFriendWorldCollaboration = null;
            Func<
                string,
                string,
                long,
                SupabaseFriendWorldTransform,
                Task<SupabaseChildFriendWorldData>> placeSharedDecoration = null;
            Func<
                string,
                string,
                long,
                SupabaseFriendWorldTransform,
                Task<SupabaseChildFriendWorldData>> updateSharedDecoration = null;
            Func<string, string, long, Task<SupabaseChildFriendWorldData>> removeSharedDecoration = null;
            Func<string, Task<SupabaseChildFriendWorldData>> visitFriendWorld = null;
            Func<string, Task<SupabaseChildWorldChatData>> loadWorldChat = null;
            Func<string, string, Task<SupabaseChildWorldChatData>> sendWorldChat = null;
            Func<string, string, Task<SupabaseChildWorldChatData>> markWorldChatRead = null;
            Func<string, string, Task<SupabaseChildWorldChatData>> reportWorldChat = null;
            Func<string, Task<SupabaseCoopAdventureSummary[]>> listCoopAdventures = null;
            Func<string, Task<SupabaseCoopAdventureState>> loadCoopAdventureState = null;
            Func<string, Task<SupabaseCoopAdventureNotification>> createCoopAdventure = null;
            Func<string, Task<SupabaseCoopMutationResult>> joinCoopAdventure = null;
            Func<
                string,
                SupabaseCoopCompletionInput,
                Task<SupabaseCoopMutationResult>> submitCoopCompletion = null;
            if (!parentChildMode)
            {
                refreshSocial = () => RefreshSocialAsync(snapshot.child.id, cancellationToken);
                sendFriendRequest = (friendCode) => SendFriendRequestAndRefreshAsync(
                    snapshot.child.id,
                    friendCode,
                    cancellationToken);
                acceptFriendRequest = (requestId) => AcceptFriendRequestAndRefreshAsync(
                    snapshot.child.id,
                    requestId,
                    cancellationToken);
                declineFriendRequest = (requestId) => DeclineFriendRequestAndRefreshAsync(
                    snapshot.child.id,
                    requestId,
                    cancellationToken);
                removeFriend = (friendChildProfileId) => RemoveFriendAndRefreshAsync(
                    snapshot.child.id,
                    friendChildProfileId,
                    cancellationToken);
                blockFriend = (friendChildProfileId) => BlockFriendAndRefreshAsync(
                    snapshot.child.id,
                    friendChildProfileId,
                    cancellationToken);
                toggleFriendWorldCollaboration = (friendChildProfileId, canCollaborate) =>
                    SetFriendWorldCollaborationAndRefreshAsync(
                        snapshot.child.id,
                        friendChildProfileId,
                        canCollaborate,
                        cancellationToken);
                placeSharedDecoration = (worldOwnerChildProfileId, sourceInventoryItemId, expectedRevision, transform) =>
                    PlaceSharedDecorationAndRefreshAsync(
                        worldOwnerChildProfileId,
                        sourceInventoryItemId,
                        expectedRevision,
                        transform,
                        cancellationToken);
                updateSharedDecoration = (worldOwnerChildProfileId, sharedEntityId, expectedRevision, transform) =>
                    UpdateSharedDecorationAndRefreshAsync(
                        worldOwnerChildProfileId,
                        sharedEntityId,
                        expectedRevision,
                        transform,
                        cancellationToken);
                removeSharedDecoration = (worldOwnerChildProfileId, sharedEntityId, expectedRevision) =>
                    RemoveSharedDecorationAndRefreshAsync(
                        worldOwnerChildProfileId,
                        sharedEntityId,
                        expectedRevision,
                        cancellationToken);
                visitFriendWorld = (friendChildProfileId) => LoadFriendWorldAsync(
                    snapshot.child.id,
                    snapshot.child.character_id,
                    friendChildProfileId,
                    cancellationToken);
                loadWorldChat = (friendChildProfileId) => LoadWorldChatAsync(
                    friendChildProfileId,
                    cancellationToken);
                sendWorldChat = (friendChildProfileId, body) => SendWorldChatAndRefreshAsync(
                    friendChildProfileId,
                    body,
                    cancellationToken);
                markWorldChatRead = (friendChildProfileId, messageId) => MarkWorldChatReadAndRefreshAsync(
                    friendChildProfileId,
                    messageId,
                    cancellationToken);
                reportWorldChat = (friendChildProfileId, messageId) => ReportWorldChatAndRefreshAsync(
                    friendChildProfileId,
                    messageId,
                    cancellationToken);
                listCoopAdventures = (worldOwnerChildProfileId) =>
                    coopAdventureClient.ListAsync(
                        worldOwnerChildProfileId,
                        cancellationToken);
                loadCoopAdventureState = (adventureId) =>
                    coopAdventureClient.LoadStateAsync(
                        adventureId,
                        cancellationToken);
                createCoopAdventure = (taskId) =>
                    coopAdventureClient.CreateFromGeneralTaskAsync(
                        taskId,
                        cancellationToken);
                joinCoopAdventure = (adventureId) =>
                    coopAdventureClient.JoinAsync(
                        adventureId,
                        cancellationToken);
                submitCoopCompletion = (participantId, input) =>
                    coopAdventureClient.SubmitCompletionAsync(
                        participantId,
                        input,
                        cancellationToken);
            }

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
                refreshSocial,
                sendFriendRequest,
                acceptFriendRequest,
                declineFriendRequest,
                removeFriend,
                blockFriend,
                toggleFriendWorldCollaboration,
                placeSharedDecoration,
                updateSharedDecoration,
                removeSharedDecoration,
                visitFriendWorld,
                loadWorldChat,
                sendWorldChat,
                markWorldChatRead,
                reportWorldChat,
                listCoopAdventures,
                loadCoopAdventureState,
                createCoopAdventure,
                joinCoopAdventure,
                submitCoopCompletion,
                (task, draft) => SubmitTaskAsync(task, draft, cancellationToken),
                (taskId) => client.StartAdventureTimerAsync(taskId, cancellationToken),
                (taskId) => client.PauseAdventureTimerAsync(taskId, cancellationToken),
                (taskId) => client.ResumeAdventureTimerAsync(taskId, cancellationToken),
                (taskId) => AbandonAdventureForActiveScopeAsync(
                    taskId,
                    cancellationToken),
                (input) => ProposeChildGoalForActiveScopeAsync(
                    snapshot.familyId,
                    snapshot.child.id,
                    input,
                    cancellationToken),
                (rewardId) => RedeemRewardForActiveScopeAsync(
                    rewardId,
                    cancellationToken),
                (name) => AddWishlistForActiveScopeAsync(
                    snapshot.familyId,
                    snapshot.child.id,
                    name,
                    cancellationToken),
                (wishlistId) => DeleteWishlistForActiveScopeAsync(
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
                (inventoryItemId, expectedRevision, transform, behaviorMode, roamingSlot) =>
                    PlaceWorldEntityAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        inventoryItemId,
                        expectedRevision,
                        transform,
                        behaviorMode,
                        roamingSlot,
                        cancellationToken),
                (inventoryItemId, entityId, expectedRevision, transform) =>
                    UpdateWorldEntityAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        inventoryItemId,
                        entityId,
                        expectedRevision,
                        transform,
                        cancellationToken),
                (inventoryItemId, entityId, expectedRevision) =>
                    RemoveWorldEntityAndRefreshAsync(
                        snapshot.familyId,
                        snapshot.child.id,
                        inventoryItemId,
                        entityId,
                        expectedRevision,
                        cancellationToken),
                (expectedRevision) => CollectWorldDecorationsAndRefreshAsync(
                    snapshot.familyId,
                    snapshot.child.id,
                    expectedRevision,
                    cancellationToken),
                onSignOut,
                onSwitchToParent,
                openNotificationSettings);
        }

        private Task<SupabaseChildHomeSnapshot> LoadActiveHomeAsync(
            CancellationToken cancellationToken)
        {
            if (activeParentChildMode)
            {
                return client.LoadForParentAsync(
                    activeFamilyId,
                    activeChildProfileId,
                    cancellationToken);
            }

            return client.LoadAsync(cancellationToken);
        }

        private async Task<SupabaseChildHomeSnapshot> RefreshActiveHomeAsync(
            CancellationToken cancellationToken)
        {
            SupabaseChildHomeSnapshot snapshot = await LoadActiveHomeAsync(
                cancellationToken);
            if (snapshot != null && view != null)
            {
                view.ApplySnapshot(snapshot);
            }

            return snapshot;
        }

        private async Task<SupabaseTaskCompletionResult> SubmitTaskAsync(
            SupabaseChildTaskRecord task,
            SupabaseTaskCompletionDraft draft,
            CancellationToken cancellationToken)
        {
            if (task == null) throw new ArgumentNullException("task");
            if (draft == null) draft = new SupabaseTaskCompletionDraft();
            SupabaseTaskCompletionResult result;
            if (activeParentChildMode)
            {
                result = await client.SubmitTaskCompletionAsync(
                    task.id,
                    draft.quickReport,
                    draft.reflection,
                    draft.mood,
                    draft.difficulty,
                    cancellationToken);
                if (!result.QueuedForRetry)
                {
                    try
                    {
                        result.RefreshedSnapshot = await RefreshActiveHomeAsync(
                            cancellationToken);
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception exception)
                    {
                        result.RefreshError = exception.Message;
                    }
                }
            }
            else
            {
                result = await client.SubmitTaskCompletionAndRefreshAsync(
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
            }

            return result;
        }

        private async Task<SupabaseChildHomeSnapshot> AbandonAdventureForActiveScopeAsync(
            string taskId,
            CancellationToken cancellationToken)
        {
            await client.AbandonAdventureAsync(taskId, cancellationToken);
            return await RefreshActiveHomeAsync(cancellationToken);
        }

        private async Task<SupabaseChildGoalProposalResult>
            ProposeChildGoalForActiveScopeAsync(
                string familyId,
                string childProfileId,
                SupabaseChildGoalProposalInput input,
                CancellationToken cancellationToken)
        {
            SupabaseChildGoalProposalResult result =
                new SupabaseChildGoalProposalResult
                {
                    Task = await client.ProposeChildGoalAsync(
                        familyId,
                        childProfileId,
                        input,
                        cancellationToken),
                };
            try
            {
                result.RefreshedSnapshot = await RefreshActiveHomeAsync(
                    cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                result.RefreshError = exception.Message;
            }

            return result;
        }

        private async Task<SupabaseRewardRedemptionResult> RedeemRewardForActiveScopeAsync(
            string rewardId,
            CancellationToken cancellationToken)
        {
            SupabaseRewardRedemptionResult result =
                new SupabaseRewardRedemptionResult
                {
                    Ticket = await client.RedeemRewardAsync(
                        rewardId,
                        cancellationToken),
                };
            try
            {
                result.RefreshedSnapshot = await RefreshActiveHomeAsync(
                    cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                result.RefreshError = exception.Message;
            }

            return result;
        }

        private async Task<SupabaseWishlistMutationResult> AddWishlistForActiveScopeAsync(
            string familyId,
            string childProfileId,
            string name,
            CancellationToken cancellationToken)
        {
            await client.AddWishlistItemAsync(
                familyId,
                childProfileId,
                name,
                cancellationToken);
            return await RefreshWishlistForActiveScopeAsync(cancellationToken);
        }

        private async Task<SupabaseWishlistMutationResult> DeleteWishlistForActiveScopeAsync(
            string wishlistId,
            CancellationToken cancellationToken)
        {
            await client.DeleteWishlistItemAsync(wishlistId, cancellationToken);
            return await RefreshWishlistForActiveScopeAsync(cancellationToken);
        }

        private async Task<SupabaseWishlistMutationResult> RefreshWishlistForActiveScopeAsync(
            CancellationToken cancellationToken)
        {
            SupabaseWishlistMutationResult result =
                new SupabaseWishlistMutationResult();
            try
            {
                result.RefreshedSnapshot = await RefreshActiveHomeAsync(
                    cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                result.RefreshError = exception.Message;
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

        private async Task<SupabaseChildGameData> PlaceWorldEntityAndRefreshAsync(
            string familyId,
            string childProfileId,
            string inventoryItemId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            string behaviorMode,
            int? roamingSlot,
            CancellationToken cancellationToken)
        {
            await gameClient.PlaceWorldEntityAsync(
                childProfileId,
                inventoryItemId,
                expectedRevision,
                transform,
                behaviorMode,
                roamingSlot,
                cancellationToken);
            return await gameClient.LoadAsync(familyId, childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildGameData> UpdateWorldEntityAndRefreshAsync(
            string familyId,
            string childProfileId,
            string inventoryItemId,
            string entityId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            CancellationToken cancellationToken)
        {
            await gameClient.UpdateWorldEntityTransformAsync(
                childProfileId,
                inventoryItemId,
                entityId,
                expectedRevision,
                transform,
                cancellationToken);
            return await gameClient.LoadAsync(familyId, childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildGameData> RemoveWorldEntityAndRefreshAsync(
            string familyId,
            string childProfileId,
            string inventoryItemId,
            string entityId,
            long expectedRevision,
            CancellationToken cancellationToken)
        {
            await gameClient.RemoveWorldEntityAsync(
                childProfileId,
                inventoryItemId,
                entityId,
                expectedRevision,
                cancellationToken);
            return await gameClient.LoadAsync(familyId, childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildGameData> CollectWorldDecorationsAndRefreshAsync(
            string familyId,
            string childProfileId,
            long expectedRevision,
            CancellationToken cancellationToken)
        {
            await gameClient.CollectAllWorldDecorationsAsync(
                childProfileId,
                expectedRevision,
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

        private async Task<SupabaseChildSocialData> SetFriendWorldCollaborationAndRefreshAsync(
            string childProfileId,
            string friendChildProfileId,
            bool canCollaborate,
            CancellationToken cancellationToken)
        {
            await friendWorldClient.SetDecorationCollaborationAsync(
                childProfileId,
                friendChildProfileId,
                canCollaborate,
                cancellationToken);
            return await RefreshSocialAsync(childProfileId, cancellationToken);
        }

        private async Task<SupabaseChildFriendWorldData> PlaceSharedDecorationAndRefreshAsync(
            string worldOwnerChildProfileId,
            string sourceInventoryItemId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            CancellationToken cancellationToken)
        {
            await friendWorldClient.PlaceSharedDecorationAsync(
                worldOwnerChildProfileId,
                sourceInventoryItemId,
                expectedRevision,
                transform,
                cancellationToken);
            return await friendWorldClient.LoadAsync(
                worldOwnerChildProfileId,
                cancellationToken);
        }

        private async Task<SupabaseChildFriendWorldData> UpdateSharedDecorationAndRefreshAsync(
            string worldOwnerChildProfileId,
            string sharedEntityId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            CancellationToken cancellationToken)
        {
            await friendWorldClient.UpdateSharedDecorationTransformAsync(
                worldOwnerChildProfileId,
                sharedEntityId,
                expectedRevision,
                transform,
                cancellationToken);
            return await friendWorldClient.LoadAsync(
                worldOwnerChildProfileId,
                cancellationToken);
        }

        private async Task<SupabaseChildFriendWorldData> RemoveSharedDecorationAndRefreshAsync(
            string worldOwnerChildProfileId,
            string sharedEntityId,
            long expectedRevision,
            CancellationToken cancellationToken)
        {
            await friendWorldClient.RemoveSharedDecorationAsync(
                worldOwnerChildProfileId,
                sharedEntityId,
                expectedRevision,
                cancellationToken);
            return await friendWorldClient.LoadAsync(
                worldOwnerChildProfileId,
                cancellationToken);
        }

        private async Task<SupabaseChildFriendWorldData> LoadFriendWorldAsync(
            string viewerChildProfileId,
            string viewerCharacterAssetKey,
            string friendChildProfileId,
            CancellationToken cancellationToken)
        {
            SupabaseChildFriendWorldData data = await friendWorldClient.LoadAsync(
                friendChildProfileId,
                cancellationToken);
            _ = EnsureFriendWorldRealtimeAsync(
                viewerChildProfileId,
                viewerCharacterAssetKey,
                friendChildProfileId,
                cancellationToken);
            return data;
        }

        private async Task EnsureFriendWorldRealtimeAsync(
            string viewerChildProfileId,
            string viewerCharacterAssetKey,
            string friendChildProfileId,
            CancellationToken cancellationToken)
        {
            string normalizedViewer = (viewerChildProfileId ?? string.Empty).Trim();
            string normalizedOwner = (friendChildProfileId ?? string.Empty).Trim();
            if (string.Equals(
                    friendWorldRealtimeOwner,
                    normalizedOwner,
                    StringComparison.Ordinal)
                && string.Equals(
                    friendWorldRealtimeChildProfileId,
                    normalizedViewer,
                    StringComparison.Ordinal)
                && friendWorldRealtimeSubscription != null)
            {
                return;
            }

            StopFriendWorldRealtime();
            int requestVersion = friendWorldRealtimeVersion;
            CancellationTokenSource subscriptionCancellation =
                CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            friendWorldRealtimeCancellation = subscriptionCancellation;
            try
            {
                SupabaseChildFriendWorldRealtimeSubscription subscription =
                    await friendWorldRealtimeClient.SubscribeAsync(
                        normalizedOwner,
                        friendWorldRealtimeConnectionId,
                        normalizedViewer,
                        HandleFriendWorldPresence,
                        HandleFriendWorldAvatarState,
                        HandleFriendWorldAvatarStateRequest,
                        HandleFriendWorldRevision,
                        subscriptionCancellation.Token,
                        HandleFriendWorldCapacityChanged);
                if (subscriptionCancellation.IsCancellationRequested
                    || requestVersion != friendWorldRealtimeVersion
                    || view == null)
                {
                    subscription.Dispose();
                    return;
                }

                friendWorldRealtimeSubscription = subscription;
                friendWorldRealtimeOwner = normalizedOwner;
                friendWorldRealtimeChildProfileId = normalizedViewer;
                friendWorldRealtimeCrowded = !subscription.IsAdmissionAccepted;
                latestLocalFriendWorldAvatarState = null;
                view.AttachFriendWorldRealtime(
                    friendWorldRealtimeConnectionId,
                    normalizedViewer,
                    viewerCharacterAssetKey,
                    HandleLocalFriendWorldAvatarState);
                view.NotifyFriendWorldPresence(
                    subscription.GetPresenceSnapshot(),
                    friendWorldRealtimeConnectionId);
                view.NotifyFriendWorldRealtimeStatus(
                    friendWorldRealtimeCrowded
                        ? "這個好友世界目前已滿，最多只能 3 人；仍可查看唯讀快照。"
                        : "多人世界已連線；正在同步線上角色。",
                    friendWorldRealtimeCrowded);
                _ = RequestLatestFriendWorldAvatarStatesAsync(subscription);
            }
            catch (OperationCanceledException)
            {
                // The current child session or selected world was replaced.
            }
            catch (Exception)
            {
                if (view != null)
                {
                    view.NotifyFriendWorldRealtimeStatus(
                        "多人世界暫時離線；仍可使用好友世界唯讀預覽。",
                        true);
                }
            }
            finally
            {
                if (ReferenceEquals(
                        friendWorldRealtimeCancellation,
                        subscriptionCancellation))
                {
                    friendWorldRealtimeCancellation = null;
                }

                subscriptionCancellation.Dispose();
            }
        }

        private void HandleFriendWorldPresence(
            SupabaseFriendWorldPresenceMember[] members)
        {
            if (view == null) return;
            view.NotifyFriendWorldPresence(
                members,
                friendWorldRealtimeConnectionId);
        }

        private void HandleFriendWorldCapacityChanged(bool crowded)
        {
            friendWorldRealtimeCrowded = crowded;
            if (view != null)
            {
                view.NotifyFriendWorldRealtimeStatus(
                    crowded
                        ? "這個好友世界目前已滿，最多只能 3 人；仍可查看唯讀快照。"
                        : "多人世界已連線；正在同步線上角色。",
                    crowded);
            }
        }

        private void HandleFriendWorldAvatarState(
            SupabaseFriendWorldAvatarState state)
        {
            if (view == null) return;
            view.NotifyFriendWorldAvatarState(
                state,
                friendWorldRealtimeConnectionId);
        }

        private void HandleFriendWorldAvatarStateRequest()
        {
            SupabaseFriendWorldAvatarState state = latestLocalFriendWorldAvatarState;
            if (state == null
                || friendWorldRealtimeSubscription == null
                || !friendWorldRealtimeSubscription.IsAdmissionAccepted)
                return;
            _ = BroadcastFriendWorldAvatarStateAsync(
                friendWorldRealtimeSubscription,
                state);
        }

        private void HandleFriendWorldRevision()
        {
            if (view == null || friendWorldRealtimeSubscription == null) return;
            int requestVersion = friendWorldRealtimeVersion;
            int refreshVersion = ++friendWorldRevisionRefreshVersion;
            _ = RefreshFriendWorldSnapshotAsync(
                friendWorldRealtimeOwner,
                requestVersion,
                refreshVersion);
        }

        private async Task RefreshFriendWorldSnapshotAsync(
            string worldOwnerChildProfileId,
            int requestVersion,
            int refreshVersion)
        {
            if (string.IsNullOrWhiteSpace(worldOwnerChildProfileId)) return;
            if (view != null)
            {
                view.NotifyFriendWorldRealtimeStatus(
                    "好友世界資料已更新，正在重新同步…",
                    false);
            }

            try
            {
                SupabaseChildFriendWorldData refreshedData =
                    await friendWorldClient.LoadAsync(
                        worldOwnerChildProfileId,
                        friendWorldRealtimeCancellation == null
                            ? CancellationToken.None
                            : friendWorldRealtimeCancellation.Token);
                if (view == null
                    || friendWorldRealtimeSubscription == null
                    || requestVersion != friendWorldRealtimeVersion
                    || refreshVersion != friendWorldRevisionRefreshVersion
                    || !SupabaseFriendWorldRevisionPolicy.ShouldApply(
                        view.FriendWorldCurrentRevision,
                        refreshedData.revision))
                {
                    return;
                }

                view.ApplyFriendWorldData(refreshedData);
                view.NotifyFriendWorldRealtimeStatus(
                    friendWorldRealtimeCrowded
                        ? "這個好友世界目前已滿，最多只能 3 人；仍可查看唯讀快照。"
                        : "好友世界已更新；正在同步線上角色。",
                    friendWorldRealtimeCrowded);
            }
            catch (OperationCanceledException)
            {
                // The selected world or child session was replaced.
            }
            catch
            {
                if (view != null
                    && requestVersion == friendWorldRealtimeVersion
                    && refreshVersion == friendWorldRevisionRefreshVersion)
                {
                    view.NotifyFriendWorldRealtimeStatus(
                        "好友世界更新暫時失敗；目前仍顯示上一版唯讀快照。",
                        true);
                }
            }
        }

        private void HandleLocalFriendWorldAvatarState(
            SupabaseFriendWorldAvatarState state)
        {
            if (state == null
                || friendWorldRealtimeSubscription == null
                || !friendWorldRealtimeSubscription.IsAdmissionAccepted)
                return;
            latestLocalFriendWorldAvatarState = state;
            _ = BroadcastFriendWorldAvatarStateAsync(
                friendWorldRealtimeSubscription,
                state);
        }

        private async Task BroadcastFriendWorldAvatarStateAsync(
            SupabaseChildFriendWorldRealtimeSubscription subscription,
            SupabaseFriendWorldAvatarState state)
        {
            try
            {
                await subscription.BroadcastAvatarStateAsync(
                    state,
                    friendWorldRealtimeCancellation == null
                        ? CancellationToken.None
                        : friendWorldRealtimeCancellation.Token);
            }
            catch (OperationCanceledException)
            {
                // The selected world or child session was replaced.
            }
            catch
            {
                if (view != null)
                {
                    view.NotifyFriendWorldRealtimeStatus(
                        "多人角色同步暫時失敗；本機移動仍保留在唯讀預覽。",
                        true);
                }
            }
        }

        private async Task RequestLatestFriendWorldAvatarStatesAsync(
            SupabaseChildFriendWorldRealtimeSubscription subscription)
        {
            try
            {
                await subscription.RequestLatestAvatarStateAsync(CancellationToken.None);
            }
            catch (OperationCanceledException)
            {
                // The selected world or child session was replaced.
            }
            catch
            {
                // The initial snapshot remains usable if the live request fails.
            }
        }

        private void StopFriendWorldRealtime()
        {
            friendWorldRealtimeVersion += 1;
            friendWorldRevisionRefreshVersion += 1;
            if (view != null) view.ClearFriendWorldRealtime();
            if (friendWorldRealtimeCancellation != null)
            {
                friendWorldRealtimeCancellation.Cancel();
                friendWorldRealtimeCancellation = null;
            }

            if (friendWorldRealtimeSubscription != null)
            {
                friendWorldRealtimeSubscription.Dispose();
                friendWorldRealtimeSubscription = null;
            }

            friendWorldRealtimeOwner = null;
            friendWorldRealtimeChildProfileId = null;
            friendWorldRealtimeCrowded = false;
            latestLocalFriendWorldAvatarState = null;
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

        public void Tick(float deltaSeconds)
        {
            if (view != null) view.Tick(deltaSeconds);
        }

        public void Dispose()
        {
            StopFriendWorldRealtime();
            StopWorldChatRealtime();
            activeFamilyId = null;
            activeChildProfileId = null;
            activeParentChildMode = false;
            if (view != null)
            {
                view.Dispose();
                view = null;
            }
        }
    }
}
