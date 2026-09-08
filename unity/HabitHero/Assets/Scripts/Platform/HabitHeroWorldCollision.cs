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
        }

        public float X { get; private set; }
        public float Z { get; private set; }
        public float Radius { get; private set; }
    }

    /// <summary>
    /// Keeps Unity's authored-world movement contract aligned with the Web
    /// runtime. The Web derives rectangle proxies from loaded GLB bounds;
    /// Unity uses the authored horizontal scale as a conservative circular
    /// proxy until the remote model finishes loading.
    /// </summary>
    public static class HabitHeroWorldCollision
    {
        private const float MinimumCharacterRadius = 0.05f;
        private const float MinimumProxyRadius = 0.05f;
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
                float horizontalScale = Mathf.Max(
                    Mathf.Abs(module.Scale.x),
                    Mathf.Abs(module.Scale.z));
                float footprintScale = module.CollisionFootprintScale > 0f
                    ? module.CollisionFootprintScale
                    : 1f;
                float radius = horizontalScale * 0.5f * footprintScale;
                if (float.IsNaN(radius) || float.IsInfinity(radius)) continue;
                if (radius < MinimumProxyRadius) radius = MinimumProxyRadius;
                result.Add(new HabitHeroWorldCollisionProxy(
                    module.Position.x,
                    module.Position.z,
                    radius));
            }

            proxies = result.ToArray();
            return true;
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
                float distance = Vector2.Distance(
                    position,
                    new Vector2(obstacle.X, obstacle.Z));
                if (distance < radius + obstacle.Radius + 0.02f) return true;
            }

            return false;
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
