using System;
using System.Collections.Generic;
using UnityEngine;

namespace HabitHero.Platform
{
    public interface ISupabaseTaskCompletionQueueStore
    {
        string Load(string ownerUserId);

        void Save(string ownerUserId, string serializedQueue);

        void Clear(string ownerUserId);
    }

    [Serializable]
    public sealed class SupabaseTaskCompletionQueueEntry
    {
        public string ownerUserId;
        public string taskId;
        public string idempotencyKey;
        public string quickReport;
        public string reflection;
        public string mood;
        public int difficulty;
        public bool hasDifficulty;
        public string queuedAt;
    }

    [Serializable]
    internal sealed class SupabaseTaskCompletionQueueEnvelope
    {
        public List<SupabaseTaskCompletionQueueEntry> entries =
            new List<SupabaseTaskCompletionQueueEntry>();
    }

    public sealed class SupabaseTaskCompletionQueue
    {
        private readonly ISupabaseTaskCompletionQueueStore store;

        public SupabaseTaskCompletionQueue(ISupabaseTaskCompletionQueueStore store)
        {
            if (store == null) throw new ArgumentNullException("store");
            this.store = store;
        }

        public List<SupabaseTaskCompletionQueueEntry> Load(string ownerUserId)
        {
            if (string.IsNullOrWhiteSpace(ownerUserId))
            {
                return new List<SupabaseTaskCompletionQueueEntry>();
            }

            string serialized = store.Load(ownerUserId);
            if (string.IsNullOrWhiteSpace(serialized))
            {
                return new List<SupabaseTaskCompletionQueueEntry>();
            }

            try
            {
                SupabaseTaskCompletionQueueEnvelope envelope =
                    JsonUtility.FromJson<SupabaseTaskCompletionQueueEnvelope>(serialized);
                if (envelope == null || envelope.entries == null)
                {
                    return new List<SupabaseTaskCompletionQueueEntry>();
                }

                List<SupabaseTaskCompletionQueueEntry> validEntries =
                    new List<SupabaseTaskCompletionQueueEntry>();
                foreach (SupabaseTaskCompletionQueueEntry entry in envelope.entries)
                {
                    if (IsValid(entry, ownerUserId)) validEntries.Add(entry);
                }

                return validEntries;
            }
            catch (Exception)
            {
                return new List<SupabaseTaskCompletionQueueEntry>();
            }
        }

        public void Enqueue(SupabaseTaskCompletionQueueEntry entry)
        {
            if (!IsValid(entry, entry == null ? null : entry.ownerUserId))
            {
                throw new ArgumentException("Task completion queue entry is incomplete.", "entry");
            }

            List<SupabaseTaskCompletionQueueEntry> entries = Load(entry.ownerUserId);
            for (int index = 0; index < entries.Count; index += 1)
            {
                SupabaseTaskCompletionQueueEntry existing = entries[index];
                if (existing.taskId == entry.taskId
                    || existing.idempotencyKey == entry.idempotencyKey)
                {
                    entries[index] = entry;
                    Save(entry.ownerUserId, entries);
                    return;
                }
            }

            entries.Add(entry);
            Save(entry.ownerUserId, entries);
        }

        public void Remove(string ownerUserId, string idempotencyKey)
        {
            if (string.IsNullOrWhiteSpace(ownerUserId)
                || string.IsNullOrWhiteSpace(idempotencyKey)) return;

            List<SupabaseTaskCompletionQueueEntry> entries = Load(ownerUserId);
            entries.RemoveAll((entry) => entry.idempotencyKey == idempotencyKey);
            Save(ownerUserId, entries);
        }

        private void Save(
            string ownerUserId,
            List<SupabaseTaskCompletionQueueEntry> entries)
        {
            if (entries == null || entries.Count == 0)
            {
                store.Clear(ownerUserId);
                return;
            }

            SupabaseTaskCompletionQueueEnvelope envelope =
                new SupabaseTaskCompletionQueueEnvelope { entries = entries };
            store.Save(ownerUserId, JsonUtility.ToJson(envelope));
        }

        private static bool IsValid(
            SupabaseTaskCompletionQueueEntry entry,
            string ownerUserId)
        {
            return entry != null
                && !string.IsNullOrWhiteSpace(ownerUserId)
                && entry.ownerUserId == ownerUserId
                && !string.IsNullOrWhiteSpace(entry.taskId)
                && !string.IsNullOrWhiteSpace(entry.idempotencyKey)
                && !string.IsNullOrWhiteSpace(entry.queuedAt);
        }
    }

    public sealed class PlayerPrefsSupabaseTaskCompletionQueueStore
        : ISupabaseTaskCompletionQueueStore
    {
        private const string KeyPrefix = "habithero.task-completion-queue.";

        public string Load(string ownerUserId)
        {
            return PlayerPrefs.GetString(GetKey(ownerUserId), string.Empty);
        }

        public void Save(string ownerUserId, string serializedQueue)
        {
            PlayerPrefs.SetString(GetKey(ownerUserId), serializedQueue ?? string.Empty);
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

    public sealed class InMemorySupabaseTaskCompletionQueueStore
        : ISupabaseTaskCompletionQueueStore
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

        public void Save(string ownerUserId, string serializedQueue)
        {
            values[ownerUserId ?? string.Empty] = serializedQueue;
        }

        public void Clear(string ownerUserId)
        {
            values.Remove(ownerUserId ?? string.Empty);
        }
    }
}
