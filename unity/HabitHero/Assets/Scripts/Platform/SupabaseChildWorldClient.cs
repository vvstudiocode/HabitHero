using System;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseGameWorldSceneRecord
    {
        public string id;
        public string name;
        public int sort_order;
        public int required_completed_count;
        public int required_general_count;
        public int unlock_rule_version;
        public bool is_active;
    }

    [Serializable]
    public sealed class SupabaseGameWorldRoamBoundsRecord
    {
        public float minX;
        public float maxX;
        public float minZ;
        public float maxZ;
    }

    [Serializable]
    public sealed class SupabaseGameWorldNpcRecord
    {
        public string id;
        public string scene_id;
        public string npc_type;
        public string name;
        public string asset_key;
        public string catalog_item_id;
        public float position_x;
        public float position_y;
        public float position_z;
        public string behavior_mode;
        public string animation_name;
        public SupabaseGameWorldRoamBoundsRecord roam_bounds;
        public bool is_active;
    }

    [Serializable]
    public sealed class SupabaseGameWorldNpcOfferingRecord
    {
        public string npc_id;
        public string catalog_item_id;
        public int sort_order;
        public int dialogue_version;
        public bool is_primary_source;
        public bool is_active;
    }

    [Serializable]
    public sealed class SupabaseChildWorldSceneUnlockRecord
    {
        public string family_id;
        public string child_profile_id;
        public string scene_id;
        public int unlock_rule_version;
        public string unlocked_at;
    }

    [Serializable]
    public sealed class SupabaseChildWorldNpcDialogueProgressRecord
    {
        public string family_id;
        public string child_profile_id;
        public string npc_id;
        public int dialogue_version;
        public string first_talked_at;
        public string last_talked_at;
    }

    [Serializable]
    public sealed class SupabaseWorldSceneUnlockResult
    {
        public string scene_id;
        public bool unlocked;
        public int unlock_rule_version;
        public string unlocked_at;
        public int completed_count;
        public int general_completed_count;
    }

    [Serializable]
    public sealed class SupabaseWorldNpcDialogueOfferingRecord
    {
        public string catalog_item_id;
        public string asset_key;
        public string name;
        public string item_type;
        public int scroll_price;
        public int sort_order;
        public string source_scene_id;
        public string source_npc_id;
        public int source_dialogue_version;
    }

    [Serializable]
    public sealed class SupabaseWorldNpcDialogueResult
    {
        public string npc_id;
        public string scene_id;
        public int dialogue_version;
        public SupabaseWorldNpcDialogueOfferingRecord[] offerings;
    }

    public sealed class SupabaseGamePurchaseGate
    {
        public bool visible;
        public bool purchasable;
        public string reason;
        public string source_npc_id;
        public string source_label;
    }

    public sealed class SupabaseChildWorldData
    {
        public string familyId;
        public string childProfileId;
        public SupabaseGameWorldSceneRecord[] scenes;
        public SupabaseGameWorldNpcRecord[] npcs;
        public SupabaseGameWorldNpcOfferingRecord[] offerings;
        public SupabaseChildWorldSceneUnlockRecord[] sceneUnlocks;
        public SupabaseChildWorldNpcDialogueProgressRecord[] dialogueProgress;

        public SupabaseGamePurchaseGate GetPurchaseGate(
            string catalogItemId,
            string itemType)
        {
            SupabaseGameWorldNpcOfferingRecord[] itemOfferings = FindOfferings(catalogItemId, itemType);
            if (itemOfferings.Length == 0)
            {
                return new SupabaseGamePurchaseGate
                {
                    visible = false,
                    purchasable = false,
                    reason = "not_offered",
                };
            }

            SupabaseGameWorldNpcOfferingRecord displayOffering = itemOfferings[0];
            SupabaseGameWorldNpcRecord displayNpc = FindNpc(displayOffering.npc_id);
            if (!IsSceneUnlocked(displayNpc == null ? string.Empty : displayNpc.scene_id))
            {
                return CreateBlockedGate("scene_locked", displayNpc);
            }

            foreach (SupabaseGameWorldNpcOfferingRecord offering in itemOfferings)
            {
                SupabaseGameWorldNpcRecord npc = FindNpc(offering.npc_id);
                if (npc == null
                    || !IsSceneUnlocked(npc.scene_id)
                    || !HasDialogue(npc.id, offering.dialogue_version))
                {
                    continue;
                }

                return new SupabaseGamePurchaseGate
                {
                    visible = true,
                    purchasable = true,
                    reason = string.Empty,
                    source_npc_id = npc.id,
                    source_label = GetSourceLabel(npc),
                };
            }

            return CreateBlockedGate("dialogue_required", displayNpc);
        }

        private SupabaseGameWorldNpcOfferingRecord[] FindOfferings(
            string catalogItemId,
            string itemType)
        {
            System.Collections.Generic.List<SupabaseGameWorldNpcOfferingRecord> matches =
                new System.Collections.Generic.List<SupabaseGameWorldNpcOfferingRecord>();
            foreach (SupabaseGameWorldNpcOfferingRecord offering in offerings ?? new SupabaseGameWorldNpcOfferingRecord[0])
            {
                if (offering == null || !offering.is_active || offering.catalog_item_id != catalogItemId)
                {
                    continue;
                }

                SupabaseGameWorldNpcRecord npc = FindNpc(offering.npc_id);
                if (itemType == "pet" && (npc == null || npc.npc_type != "roaming_pet")) continue;
                matches.Add(offering);
            }

            matches.Sort((left, right) =>
            {
                if (left.is_primary_source != right.is_primary_source)
                {
                    return left.is_primary_source ? -1 : 1;
                }

                return left.sort_order.CompareTo(right.sort_order);
            });
            return matches.ToArray();
        }

        private SupabaseGameWorldNpcRecord FindNpc(string npcId)
        {
            foreach (SupabaseGameWorldNpcRecord npc in npcs ?? new SupabaseGameWorldNpcRecord[0])
            {
                if (npc != null && npc.id == npcId && npc.is_active) return npc;
            }

            return null;
        }

        private bool IsSceneUnlocked(string sceneId)
        {
            foreach (SupabaseChildWorldSceneUnlockRecord unlock in sceneUnlocks ?? new SupabaseChildWorldSceneUnlockRecord[0])
            {
                if (unlock != null && unlock.scene_id == sceneId) return true;
            }

            return false;
        }

        private bool HasDialogue(string npcId, int requiredVersion)
        {
            foreach (SupabaseChildWorldNpcDialogueProgressRecord progress in dialogueProgress ?? new SupabaseChildWorldNpcDialogueProgressRecord[0])
            {
                if (progress != null && progress.npc_id == npcId && progress.dialogue_version >= requiredVersion)
                {
                    return true;
                }
            }

            return false;
        }

        private SupabaseGamePurchaseGate CreateBlockedGate(
            string reason,
            SupabaseGameWorldNpcRecord npc)
        {
            return new SupabaseGamePurchaseGate
            {
                visible = true,
                purchasable = false,
                reason = reason,
                source_npc_id = npc == null ? null : npc.id,
                source_label = npc == null ? string.Empty : GetSourceLabel(npc),
            };
        }

        private string GetSourceLabel(SupabaseGameWorldNpcRecord npc)
        {
            SupabaseGameWorldSceneRecord scene = null;
            foreach (SupabaseGameWorldSceneRecord candidate in scenes ?? new SupabaseGameWorldSceneRecord[0])
            {
                if (candidate != null && candidate.id == npc.scene_id)
                {
                    scene = candidate;
                    break;
                }
            }

            return (scene == null ? npc.scene_id : scene.name) + "，找" + npc.name;
        }
    }

    public sealed class SupabaseChildWorldClient
    {
        private readonly SupabaseRestClient restClient;

        public SupabaseChildWorldClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<SupabaseChildWorldData> LoadAsync(
            string familyId,
            string childProfileId,
            CancellationToken cancellationToken)
        {
            RequireScope(familyId, childProfileId);
            SupabaseRestFilter[] childFilters =
            {
                new SupabaseRestFilter("family_id", "eq", familyId),
                new SupabaseRestFilter("child_profile_id", "eq", childProfileId),
            };
            Task<SupabaseGameWorldSceneRecord[]> scenes = restClient.SelectManyAsync<SupabaseGameWorldSceneRecord>(
                "game_world_scenes",
                new[] { new SupabaseRestFilter("is_active", "eq", "true") },
                "*",
                "sort_order.asc",
                0,
                cancellationToken);
            Task<SupabaseGameWorldNpcRecord[]> npcs = restClient.SelectManyAsync<SupabaseGameWorldNpcRecord>(
                "game_world_npcs",
                new[] { new SupabaseRestFilter("is_active", "eq", "true") },
                "*",
                null,
                0,
                cancellationToken);
            Task<SupabaseGameWorldNpcOfferingRecord[]> offerings = restClient.SelectManyAsync<SupabaseGameWorldNpcOfferingRecord>(
                "game_world_npc_offerings",
                new[] { new SupabaseRestFilter("is_active", "eq", "true") },
                "*",
                "sort_order.asc",
                0,
                cancellationToken);
            Task<SupabaseChildWorldSceneUnlockRecord[]> sceneUnlocks = restClient.SelectManyAsync<SupabaseChildWorldSceneUnlockRecord>(
                "child_world_scene_unlocks",
                childFilters,
                "*",
                null,
                0,
                cancellationToken);
            Task<SupabaseChildWorldNpcDialogueProgressRecord[]> dialogueProgress = restClient.SelectManyAsync<SupabaseChildWorldNpcDialogueProgressRecord>(
                "child_world_npc_dialogue_progress",
                childFilters,
                "*",
                null,
                0,
                cancellationToken);
            await Task.WhenAll(scenes, npcs, offerings, sceneUnlocks, dialogueProgress);
            return new SupabaseChildWorldData
            {
                familyId = familyId,
                childProfileId = childProfileId,
                scenes = scenes.Result ?? new SupabaseGameWorldSceneRecord[0],
                npcs = npcs.Result ?? new SupabaseGameWorldNpcRecord[0],
                offerings = offerings.Result ?? new SupabaseGameWorldNpcOfferingRecord[0],
                sceneUnlocks = sceneUnlocks.Result ?? new SupabaseChildWorldSceneUnlockRecord[0],
                dialogueProgress = dialogueProgress.Result ?? new SupabaseChildWorldNpcDialogueProgressRecord[0],
            };
        }

        public async Task<SupabaseWorldSceneUnlockResult> UnlockSceneAsync(
            string sceneId,
            string childProfileId,
            CancellationToken cancellationToken)
        {
            RequireValue(sceneId, "場景");
            RequireValue(childProfileId, "孩子資料");
            string response = await restClient.CallRpcAsync(
                "unlock_world_scene_if_eligible",
                "{\"target_scene_id\":" + SupabaseJson.Quote(sceneId)
                    + ",\"target_child_profile_id\":" + SupabaseJson.Quote(childProfileId) + "}",
                cancellationToken);
            return ParseObject<SupabaseWorldSceneUnlockResult>(response, "場景解鎖結果");
        }

        public async Task<SupabaseWorldNpcDialogueResult> CompleteNpcDialogueAsync(
            string npcId,
            string childProfileId,
            CancellationToken cancellationToken)
        {
            RequireValue(npcId, "NPC");
            RequireValue(childProfileId, "孩子資料");
            string response = await restClient.CallRpcAsync(
                "complete_world_npc_dialogue",
                "{\"target_npc_id\":" + SupabaseJson.Quote(npcId)
                    + ",\"target_child_profile_id\":" + SupabaseJson.Quote(childProfileId) + "}",
                cancellationToken);
            SupabaseWorldNpcDialogueResult result = ParseObject<SupabaseWorldNpcDialogueResult>(
                response,
                "NPC 對話結果");
            if (result.offerings == null) result.offerings = new SupabaseWorldNpcDialogueOfferingRecord[0];
            return result;
        }

        private static T ParseObject<T>(string response, string label)
        {
            T value;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(response, out value, out error))
            {
                throw new SupabaseDataException(label + "無法解析：" + error);
            }

            return value;
        }

        private static void RequireScope(string familyId, string childProfileId)
        {
            RequireValue(familyId, "家庭資料");
            RequireValue(childProfileId, "孩子資料");
        }

        private static void RequireValue(string value, string label)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new SupabaseDataException(label + "不可為空白。");
            }
        }
    }
}
