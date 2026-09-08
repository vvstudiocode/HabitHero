using System;
using UnityEngine;

namespace HabitHero.App
{
    public sealed class HabitHeroNotificationTarget
    {
        internal HabitHeroNotificationTarget(
            string taskId,
            string scheduleId,
            string eventName)
        {
            TaskId = taskId;
            ScheduleId = scheduleId;
            Event = eventName;
        }

        public string TaskId { get; private set; }
        public string ScheduleId { get; private set; }
        public string Event { get; private set; }

        public string ReferenceId
        {
            get
            {
                return !string.IsNullOrWhiteSpace(TaskId) ? TaskId : ScheduleId;
            }
        }
    }

    public static class HabitHeroNotificationPayload
    {
        [Serializable]
        private sealed class RawPayload
        {
            public string taskId;
            public string scheduleId;
            public string @event;
            public string data;
        }

        public static bool TryParse(
            string raw,
            out HabitHeroNotificationTarget target)
        {
            target = null;
            if (string.IsNullOrWhiteSpace(raw)) return false;

            string trimmed = raw.Trim();
            Guid directReference;
            if (Guid.TryParse(trimmed, out directReference))
            {
                return TryCreate(
                    directReference.ToString("D"),
                    null,
                    "created",
                    out target);
            }

            return TryParseJson(trimmed, 0, out target);
        }

        public static bool TryCreate(
            string taskId,
            string scheduleId,
            string eventName,
            out HabitHeroNotificationTarget target)
        {
            target = null;
            string normalizedTaskId = NormalizeReference(taskId);
            string normalizedScheduleId = NormalizeReference(scheduleId);
            if (string.IsNullOrWhiteSpace(normalizedTaskId)
                == string.IsNullOrWhiteSpace(normalizedScheduleId))
            {
                return false;
            }

            string normalizedEvent = string.IsNullOrWhiteSpace(eventName)
                ? "created"
                : eventName.Trim().ToLowerInvariant();
            if (normalizedEvent != "created"
                && normalizedEvent != "submitted"
                && normalizedEvent != "reviewed")
            {
                return false;
            }

            target = new HabitHeroNotificationTarget(
                normalizedTaskId,
                normalizedScheduleId,
                normalizedEvent);
            return true;
        }

        private static bool TryParseJson(
            string raw,
            int depth,
            out HabitHeroNotificationTarget target)
        {
            target = null;
            if (depth > 1) return false;

            RawPayload payload;
            try
            {
                payload = JsonUtility.FromJson<RawPayload>(raw);
            }
            catch (ArgumentException)
            {
                return false;
            }

            if (payload == null) return false;
            if (!string.IsNullOrWhiteSpace(payload.data)
                && TryParseJson(payload.data.Trim(), depth + 1, out target))
            {
                return true;
            }

            return TryCreate(
                payload.taskId,
                payload.scheduleId,
                payload.@event,
                out target);
        }

        private static string NormalizeReference(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            Guid reference;
            if (!Guid.TryParse(value.Trim(), out reference)) return null;
            return reference.ToString("D");
        }
    }
}
