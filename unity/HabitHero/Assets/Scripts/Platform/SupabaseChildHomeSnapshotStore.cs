using System;
using System.Collections.Generic;
using UnityEngine;

namespace HabitHero.Platform
{
    public interface ISupabaseChildHomeSnapshotStore
    {
        string Load(string ownerUserId);

        void Save(string ownerUserId, string serializedSnapshot);

        void Clear(string ownerUserId);
    }

    public sealed class SupabaseChildHomeSnapshotCache
    {
        private readonly ISupabaseChildHomeSnapshotStore store;

        public SupabaseChildHomeSnapshotCache(ISupabaseChildHomeSnapshotStore store)
        {
            if (store == null) throw new ArgumentNullException("store");
            this.store = store;
        }

        public bool TryLoad(
            string ownerUserId,
            out SupabaseChildHomeSnapshot snapshot)
        {
            if (!TryLoadSerialized(ownerUserId, out snapshot))
            {
                return false;
            }

            if (!IsOwnedByUser(ownerUserId, snapshot))
            {
                snapshot = null;
                return false;
            }

            Normalize(snapshot);
            return true;
        }

        public bool TryLoadScoped(
            string ownerUserId,
            string familyId,
            string childProfileId,
            out SupabaseChildHomeSnapshot snapshot)
        {
            if (!TryLoadSerialized(ownerUserId, out snapshot))
            {
                return false;
            }

            if (snapshot.familyId != familyId
                || snapshot.child == null
                || snapshot.child.id != childProfileId)
            {
                snapshot = null;
                return false;
            }

            Normalize(snapshot);
            return true;
        }

        public void Save(string ownerUserId, SupabaseChildHomeSnapshot snapshot)
        {
            if (!IsValid(ownerUserId, snapshot))
            {
                throw new ArgumentException(
                    "Child home snapshot is incomplete or belongs to another user.",
                    "snapshot");
            }

            Normalize(snapshot);
            store.Save(ownerUserId, JsonUtility.ToJson(snapshot));
        }

        public void SaveScoped(
            string ownerUserId,
            string familyId,
            string childProfileId,
            SupabaseChildHomeSnapshot snapshot)
        {
            if (string.IsNullOrWhiteSpace(familyId)
                || string.IsNullOrWhiteSpace(childProfileId)
                || !IsValidSnapshot(snapshot)
                || snapshot.familyId != familyId
                || snapshot.child.id != childProfileId)
            {
                throw new ArgumentException(
                    "Scoped child home snapshot is incomplete or belongs to another child.",
                    "snapshot");
            }

            Normalize(snapshot);
            store.Save(ownerUserId, JsonUtility.ToJson(snapshot));
        }

        public void Clear(string ownerUserId)
        {
            if (string.IsNullOrWhiteSpace(ownerUserId)) return;
            store.Clear(ownerUserId);
        }

        private static bool IsValid(
            string ownerUserId,
            SupabaseChildHomeSnapshot snapshot)
        {
            return !string.IsNullOrWhiteSpace(ownerUserId)
                && IsValidSnapshot(snapshot)
                && IsOwnedByUser(ownerUserId, snapshot);
        }

        private bool TryLoadSerialized(
            string ownerUserId,
            out SupabaseChildHomeSnapshot snapshot)
        {
            snapshot = null;
            if (string.IsNullOrWhiteSpace(ownerUserId)) return false;

            string serialized = store.Load(ownerUserId);
            if (string.IsNullOrWhiteSpace(serialized)) return false;

            try
            {
                snapshot = JsonUtility.FromJson<SupabaseChildHomeSnapshot>(serialized);
            }
            catch (Exception)
            {
                snapshot = null;
            }

            if (!IsValidSnapshot(snapshot))
            {
                snapshot = null;
                return false;
            }

            return true;
        }

        private static bool IsValidSnapshot(SupabaseChildHomeSnapshot snapshot)
        {
            return snapshot != null
                && snapshot.child != null
                && !string.IsNullOrWhiteSpace(snapshot.child.id)
                && !string.IsNullOrWhiteSpace(snapshot.familyId);
        }

        private static bool IsOwnedByUser(
            string ownerUserId,
            SupabaseChildHomeSnapshot snapshot)
        {
            return IsValidSnapshot(snapshot)
                && (string.IsNullOrWhiteSpace(snapshot.child.profile_id)
                    || snapshot.child.profile_id == ownerUserId);
        }

        private static void Normalize(SupabaseChildHomeSnapshot snapshot)
        {
            if (snapshot.tasks == null) snapshot.tasks = new SupabaseChildTaskRecord[0];
            if (snapshot.rewards == null)
            {
                snapshot.rewards = new SupabaseChildRewardRecord[0];
            }
            if (snapshot.wishlist == null)
            {
                snapshot.wishlist = new SupabaseChildWishlistRecord[0];
            }
            if (snapshot.tickets == null)
            {
                snapshot.tickets = new SupabaseChildTicketRecord[0];
            }
            if (snapshot.ledger == null)
            {
                snapshot.ledger = new SupabaseChildLedgerRecord[0];
            }
            if (snapshot.timers == null)
            {
                snapshot.timers = new SupabaseTaskTimerSessionRecord[0];
            }
        }
    }

    public sealed class PlayerPrefsSupabaseChildHomeSnapshotStore
        : ISupabaseChildHomeSnapshotStore
    {
        private const string KeyPrefix = "habithero.child-home-snapshot.";

        public string Load(string ownerUserId)
        {
            return PlayerPrefs.GetString(GetKey(ownerUserId), string.Empty);
        }

        public void Save(string ownerUserId, string serializedSnapshot)
        {
            PlayerPrefs.SetString(GetKey(ownerUserId), serializedSnapshot ?? string.Empty);
            PlayerPrefs.Save();
        }

        public void Clear(string ownerUserId)
        {
            PlayerPrefs.DeleteKey(GetKey(ownerUserId));
            PlayerPrefs.Save();
        }

        private static string GetKey(string ownerUserId)
        {
            return KeyPrefix + Uri.EscapeDataString(ownerUserId ?? string.Empty);
        }
    }

    public sealed class InMemorySupabaseChildHomeSnapshotStore
        : ISupabaseChildHomeSnapshotStore
    {
        private readonly Dictionary<string, string> values =
            new Dictionary<string, string>();

        public string Load(string ownerUserId)
        {
            string value;
            return values.TryGetValue(ownerUserId ?? string.Empty, out value)
                ? value
                : null;
        }

        public void Save(string ownerUserId, string serializedSnapshot)
        {
            values[ownerUserId ?? string.Empty] = serializedSnapshot;
        }

        public void Clear(string ownerUserId)
        {
            values.Remove(ownerUserId ?? string.Empty);
        }
    }
}
