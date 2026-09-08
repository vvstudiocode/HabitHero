using System;
using System.Collections.Generic;
using UnityEngine;

namespace HabitHero.Platform
{
    public sealed class HabitHeroWorldCollisionProxy
    {
        public HabitHeroWorldCollisionProxy(float x, float z, float radius)
        {
            X = x;
            Z = z;
            Radius = radius;
            IsRectangle = false;
            HalfWidth = radius;
            HalfDepth = radius;
            RotationY = 0f;
            NavigationInset = 0f;
        }

        public HabitHeroWorldCollisionProxy(
            float x,
            float z,
            float halfWidth,
            float halfDepth,
            float rotationY,
            float navigationInset)
        {
            X = x;
            Z = z;
            Radius = Mathf.Max(
                0.05f,
                Mathf.Max(Mathf.Abs(halfWidth), Mathf.Abs(halfDepth)));
            IsRectangle = true;
            HalfWidth = Mathf.Abs(halfWidth);
            HalfDepth = Mathf.Abs(halfDepth);
            RotationY = rotationY;
            NavigationInset = Mathf.Max(0f, navigationInset);
        }

        public float X { get; private set; }
        public float Z { get; private set; }
        public float Radius { get; private set; }
        public bool IsRectangle { get; private set; }
        public float HalfWidth { get; private set; }
        public float HalfDepth { get; private set; }
        public float RotationY { get; private set; }
        public float NavigationInset { get; private set; }
    }

    /// <summary>
    /// Keeps Unity's authored-world movement contract aligned with the Web
    /// runtime. Unity starts with an axis-aligned rectangle derived from the
    /// authored transform, then can replace it with the loaded GLB bounds;
    /// circles remain for Supabase decorations that only publish
    /// collision_radius.
    /// </summary>
    public static class HabitHeroWorldCollision
    {
        private const float MinimumCharacterRadius = 0.05f;
        private const float MinimumProxyRadius = 0.05f;
        public const float AuthoredNavigationInset = 0.18f;
        private const float SpawnGridStep = 1.25f;

        public static bool TryGetAuthoredProxies(
            string sceneId,
            out HabitHeroWorldCollisionProxy[] proxies)
        {
            proxies = null;
            HabitHeroWorldAssetModule[] modules;
            if (!HabitHeroWorldAssetCatalog.TryGetModules(sceneId, out modules)) return false;

            List<HabitHeroWorldCollisionProxy> result =
                new List<HabitHeroWorldCollisionProxy>();
            foreach (HabitHeroWorldAssetModule module in modules)
            {
                if (module == null || !module.Collision) continue;
                float footprintScale = module.CollisionFootprintScale > 0f
                    ? module.CollisionFootprintScale
                    : 1f;
                Vector3 halfExtents = GetAuthoredHorizontalHalfExtents(
                    module.Scale,
                    module.Rotation,
                    footprintScale);
                HabitHeroWorldCollisionProxy proxy = CreateRectangleProxy(
                    module.Position.x,
                    module.Position.z,
                    halfExtents.x,
                    halfExtents.z,
                    0f,
                    AuthoredNavigationInset);
                if (proxy != null) result.Add(proxy);
            }

            proxies = result.ToArray();
            return true;
        }

        public static HabitHeroWorldCollisionProxy CreateRectangleProxy(
            float x,
            float z,
            float halfWidth,
            float halfDepth,
            float rotationY,
            float navigationInset)
        {
            if (!IsFinite(x)
                || !IsFinite(z)
                || !IsFinite(halfWidth)
                || !IsFinite(halfDepth)
                || !IsFinite(rotationY)
                || !IsFinite(navigationInset)
                || halfWidth <= 0f
                || halfDepth <= 0f
                || navigationInset < 0f)
            {
                return null;
            }

            return new HabitHeroWorldCollisionProxy(
                x,
                z,
                halfWidth,
                halfDepth,
                rotationY,
                navigationInset);
        }

        public static HabitHeroWorldCollisionProxy CreateBoundsProxy(
            Bounds bounds,
            float footprintScale,
            float navigationInset)
        {
            if (!IsFinite(footprintScale)
                || footprintScale <= 0f
                || !IsFinite(bounds.center.x)
                || !IsFinite(bounds.center.z)
                || !IsFinite(bounds.size.x)
                || !IsFinite(bounds.size.y)
                || !IsFinite(bounds.size.z)
                || bounds.size.x < 0.12f
                || bounds.size.z < 0.12f
                || bounds.size.y < 0.22f
                || (bounds.size.x >= 8f
                    && bounds.size.z >= 8f
                    && bounds.size.y <= 2.5f))
            {
                return null;
            }

            return CreateRectangleProxy(
                bounds.center.x,
                bounds.center.z,
                bounds.size.x * 0.5f * footprintScale,
                bounds.size.z * 0.5f * footprintScale,
                0f,
                navigationInset);
        }

        public static Vector2 MoveCharacter(
            Vector2 current,
            Vector2 desired,
            float radius,
            HabitHeroWorldCollisionProxy[] obstacles,
            float boundary)
        {
            float safeRadius = Mathf.Max(MinimumCharacterRadius, radius);
            float safeBoundary = Mathf.Max(safeRadius, boundary);
            Vector2 next = new Vector2(
                Clamp(current.x, safeRadius, safeBoundary),
                Clamp(current.y, safeRadius, safeBoundary));

            Vector2 xCandidate = new Vector2(
                Clamp(desired.x, safeRadius, safeBoundary),
                next.y);
            if (!OverlapsAny(xCandidate, safeRadius, obstacles)) next.x = xCandidate.x;

            Vector2 zCandidate = new Vector2(
                next.x,
                Clamp(desired.y, safeRadius, safeBoundary));
            if (!OverlapsAny(zCandidate, safeRadius, obstacles)) next.y = zCandidate.y;

            return next;
        }

        public static HabitHeroWorldCollisionProxy CreateScaledProxy(
            float x,
            float z,
            float collisionRadius,
            float scale)
        {
            if (!IsFinite(x)
                || !IsFinite(z)
                || !IsFinite(collisionRadius)
                || !IsFinite(scale)
                || collisionRadius <= 0f
                || scale <= 0f)
            {
                return null;
            }

            float safeScale = Mathf.Clamp(scale, 0.25f, 3f);
            return new HabitHeroWorldCollisionProxy(
                x,
                z,
                Mathf.Max(MinimumProxyRadius, collisionRadius * safeScale));
        }

        public static Vector2 FindClearSpawn(
            Vector2 preferred,
            float radius,
            float boundary,
            HabitHeroWorldCollisionProxy[] obstacles)
        {
            float safeRadius = Mathf.Max(MinimumCharacterRadius, radius);
            if (!IsFinite(boundary) || boundary <= safeRadius) return preferred;

            Vector2[] origins = { preferred, Vector2.zero };
            HashSet<string> visited = new HashSet<string>(StringComparer.Ordinal);
            int maxRing = Mathf.CeilToInt(boundary / SpawnGridStep);
            foreach (Vector2 origin in origins)
            {
                for (int ring = 0; ring <= maxRing; ring += 1)
                {
                    for (int xIndex = -ring; xIndex <= ring; xIndex += 1)
                    {
                        for (int zIndex = -ring; zIndex <= ring; zIndex += 1)
                        {
                            if (Mathf.Max(Mathf.Abs(xIndex), Mathf.Abs(zIndex)) != ring) continue;
                            Vector2 candidate = origin + new Vector2(
                                xIndex * SpawnGridStep,
                                zIndex * SpawnGridStep);
                            string key = candidate.x.ToString("R") + ":" + candidate.y.ToString("R");
                            if (!visited.Add(key)) continue;
                            if (Mathf.Abs(candidate.x) + safeRadius > boundary
                                || Mathf.Abs(candidate.y) + safeRadius > boundary)
                            {
                                continue;
                            }

                            if (!OverlapsAny(candidate, safeRadius, obstacles)) return candidate;
                        }
                    }
                }
            }

            return preferred;
        }

        private static bool OverlapsAny(
            Vector2 position,
            float radius,
            HabitHeroWorldCollisionProxy[] obstacles)
        {
            if (obstacles == null) return false;
            foreach (HabitHeroWorldCollisionProxy obstacle in obstacles)
            {
                if (obstacle == null) continue;
                if (obstacle.IsRectangle)
                {
                    if (CircleOverlapsRectangle(position, radius, obstacle)) return true;
                    continue;
                }
                float distance = Vector2.Distance(
                    position,
                    new Vector2(obstacle.X, obstacle.Z));
                if (distance < radius + obstacle.Radius + 0.02f) return true;
            }

            return false;
        }

        private static bool CircleOverlapsRectangle(
            Vector2 position,
            float radius,
            HabitHeroWorldCollisionProxy rectangle)
        {
            float deltaX = position.x - rectangle.X;
            float deltaZ = position.y - rectangle.Z;
            float cosine = Mathf.Cos(rectangle.RotationY);
            float sine = Mathf.Sin(rectangle.RotationY);
            float localX = cosine * deltaX - sine * deltaZ;
            float localZ = sine * deltaX + cosine * deltaZ;
            float closestX = Mathf.Clamp(localX, -rectangle.HalfWidth, rectangle.HalfWidth);
            float closestZ = Mathf.Clamp(localZ, -rectangle.HalfDepth, rectangle.HalfDepth);
            float navigationRadius = Mathf.Max(
                MinimumCharacterRadius,
                radius - rectangle.NavigationInset);
            return Vector2.Distance(
                new Vector2(localX, localZ),
                new Vector2(closestX, closestZ))
                < navigationRadius + 0.02f;
        }

        private static Vector3 GetAuthoredHorizontalHalfExtents(
            Vector3 scale,
            Quaternion rotation,
            float footprintScale)
        {
            Vector3 localHalfExtents = new Vector3(
                Mathf.Abs(scale.x) * 0.5f * footprintScale,
                Mathf.Abs(scale.y) * 0.5f * footprintScale,
                Mathf.Abs(scale.z) * 0.5f * footprintScale);
            float halfWidth = 0f;
            float halfDepth = 0f;
            for (int xSign = -1; xSign <= 1; xSign += 2)
            {
                for (int ySign = -1; ySign <= 1; ySign += 2)
                {
                    for (int zSign = -1; zSign <= 1; zSign += 2)
                    {
                        Vector3 rotatedCorner = rotation * new Vector3(
                            localHalfExtents.x * xSign,
                            localHalfExtents.y * ySign,
                            localHalfExtents.z * zSign);
                        halfWidth = Mathf.Max(halfWidth, Mathf.Abs(rotatedCorner.x));
                        halfDepth = Mathf.Max(halfDepth, Mathf.Abs(rotatedCorner.z));
                    }
                }
            }

            return new Vector3(halfWidth, 0f, halfDepth);
        }

        private static float Clamp(float value, float radius, float boundary)
        {
            return Mathf.Min(
                boundary - radius,
                Mathf.Max(-boundary + radius, value));
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }
    }
}
