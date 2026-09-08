using System;
using System.Collections.Generic;
using UnityEngine;

namespace HabitHero.Platform
{
    /// <summary>
    /// Scene-level movement data shared with the authored Web world.
    ///
    /// The profile is intentionally separate from Supabase records: a server
    /// scene id selects one of these known profiles, but cannot change the
    /// client's walkable area or spawn position.
    /// </summary>
    public sealed class HabitHeroWorldSceneProfile
    {
        public HabitHeroWorldSceneProfile(
            string sceneId,
            Vector3 spawnPosition,
            float movementBoundary)
        {
            SceneId = sceneId;
            SpawnPosition = spawnPosition;
            MovementBoundary = movementBoundary;
        }

        public string SceneId { get; private set; }
        public Vector3 SpawnPosition { get; private set; }
        public float MovementBoundary { get; private set; }
    }

    public static class HabitHeroWorldSceneProfileCatalog
    {
        private static readonly Dictionary<string, HabitHeroWorldSceneProfile> Profiles =
            new Dictionary<string, HabitHeroWorldSceneProfile>(StringComparer.Ordinal)
            {
                {
                    "sunrise-village",
                    new HabitHeroWorldSceneProfile(
                        "sunrise-village",
                        new Vector3(-0.18f, 0f, -0.95f),
                        12.4f)
                },
                {
                    "forest-valley",
                    new HabitHeroWorldSceneProfile(
                        "forest-valley",
                        new Vector3(-0.12276f, 0f, 3.69f),
                        18.9f)
                },
                {
                    "cloud-workshop",
                    new HabitHeroWorldSceneProfile(
                        "cloud-workshop",
                        Vector3.zero,
                        18.9f)
                },
                {
                    "tideglow-archipelago",
                    new HabitHeroWorldSceneProfile(
                        "tideglow-archipelago",
                        new Vector3(3.477667f, 0f, 3.35779f),
                        6.25f)
                },
                {
                    "star-sand-wasteland",
                    new HabitHeroWorldSceneProfile(
                        "star-sand-wasteland",
                        new Vector3(-0.0610376f, 0f, 4.41796f),
                        7.225f)
                },
            };

        public static bool TryGetProfile(
            string sceneId,
            out HabitHeroWorldSceneProfile profile)
        {
            profile = null;
            if (string.IsNullOrWhiteSpace(sceneId)) return false;
            return Profiles.TryGetValue(sceneId.Trim(), out profile);
        }
    }
}
