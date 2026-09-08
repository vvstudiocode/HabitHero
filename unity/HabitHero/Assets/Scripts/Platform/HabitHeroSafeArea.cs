using System.Collections.Generic;
using UnityEngine;

namespace HabitHero.App
{
    public sealed class HabitHeroSafeArea : MonoBehaviour
    {
        private sealed class AnchorSnapshot
        {
            public Vector2 Min;
            public Vector2 Max;
        }

        private readonly Dictionary<RectTransform, AnchorSnapshot> snapshots =
            new Dictionary<RectTransform, AnchorSnapshot>();

        private Rect lastSafeArea;
        private Vector2 lastScreenSize;

        private void OnEnable()
        {
            ApplySafeArea(true);
        }

        private void LateUpdate()
        {
            ApplySafeArea(false);
        }

        public static void MapAnchorsToSafeArea(
            Rect safeArea,
            Vector2 screenSize,
            Vector2 originalMin,
            Vector2 originalMax,
            out Vector2 mappedMin,
            out Vector2 mappedMax)
        {
            if (screenSize.x <= 0f
                || screenSize.y <= 0f
                || safeArea.width <= 0f
                || safeArea.height <= 0f)
            {
                mappedMin = originalMin;
                mappedMax = originalMax;
                return;
            }

            Vector2 safeMin = new Vector2(
                safeArea.xMin / screenSize.x,
                safeArea.yMin / screenSize.y);
            Vector2 safeSize = new Vector2(
                safeArea.width / screenSize.x,
                safeArea.height / screenSize.y);

            mappedMin = safeMin + Vector2.Scale(originalMin, safeSize);
            mappedMax = safeMin + Vector2.Scale(originalMax, safeSize);
        }

        private void ApplySafeArea(bool force)
        {
            Vector2 screenSize = new Vector2(Screen.width, Screen.height);
            Rect safeArea = Screen.safeArea;
            if (screenSize.x <= 0f || screenSize.y <= 0f)
            {
                return;
            }

            if (!force && screenSize == lastScreenSize && safeArea == lastSafeArea)
            {
                return;
            }

            HashSet<RectTransform> activeRects = new HashSet<RectTransform>();
            for (int index = 0; index < transform.childCount; index += 1)
            {
                Transform child = transform.GetChild(index);
                if (child.name == "Background")
                {
                    continue;
                }

                RectTransform rect = child as RectTransform;
                if (rect == null)
                {
                    continue;
                }

                activeRects.Add(rect);
                AnchorSnapshot snapshot;
                if (!snapshots.TryGetValue(rect, out snapshot))
                {
                    snapshot = new AnchorSnapshot
                    {
                        Min = rect.anchorMin,
                        Max = rect.anchorMax
                    };
                    snapshots[rect] = snapshot;
                }

                Vector2 mappedMin;
                Vector2 mappedMax;
                MapAnchorsToSafeArea(
                    safeArea,
                    screenSize,
                    snapshot.Min,
                    snapshot.Max,
                    out mappedMin,
                    out mappedMax);
                rect.anchorMin = mappedMin;
                rect.anchorMax = mappedMax;
            }

            List<RectTransform> staleRects = new List<RectTransform>();
            foreach (RectTransform rect in snapshots.Keys)
            {
                if (rect == null || !activeRects.Contains(rect))
                {
                    staleRects.Add(rect);
                }
            }

            foreach (RectTransform rect in staleRects)
            {
                snapshots.Remove(rect);
            }

            lastScreenSize = screenSize;
            lastSafeArea = safeArea;
        }
    }
}
