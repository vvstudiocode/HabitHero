using System;
using System.Collections.Generic;
using UnityEngine;

namespace HabitHero.Platform
{
    /// <summary>
    /// Authored scene modules shared with the Web world runtime.
    ///
    /// The catalog deliberately stores only public asset keys and immutable
    /// placement data. Supabase may select a scene, but it cannot turn that
    /// value into an arbitrary URL or an arbitrary Unity object.
    /// </summary>
    public sealed class HabitHeroWorldAssetModule
    {
        public HabitHeroWorldAssetModule(
            string assetKey,
            Vector3 position,
            Quaternion rotation,
            Vector3 scale,
            bool collision,
            float collisionFootprintScale)
        {
            AssetKey = assetKey;
            Position = position;
            Rotation = rotation;
            Scale = scale;
            Collision = collision;
            CollisionFootprintScale = collisionFootprintScale;
        }

        public string AssetKey { get; private set; }
        public Vector3 Position { get; private set; }
        public Quaternion Rotation { get; private set; }
        public Vector3 Scale { get; private set; }
        public bool Collision { get; private set; }
        public float CollisionFootprintScale { get; private set; }
    }

    public static class HabitHeroWorldAssetCatalog
    {
        private static readonly Dictionary<string, HabitHeroWorldAssetModule[]> SceneModules =
            new Dictionary<string, HabitHeroWorldAssetModule[]>(StringComparer.Ordinal)
            {
                {
                    "sunrise-village",
                    new[]
                    {
                        Sunrise(
                            "world.sunrise-village.island",
                            new Vector3(-0.699848f, -21.245949f, -11.55571f),
                            new Quaternion(0f, 0.707107f, -0.707107f, 0f),
                            new Vector3(-446.1269f, -426.7864f, -469.3935f),
                            false,
                            0f),
                        Sunrise(
                            "world.sunrise-village.round-stone-road",
                            new Vector3(-22.874138f, -20.476508f, -19.388096f),
                            new Quaternion(0f, 0.707107f, -0.707107f, 0f),
                            new Vector3(122.2815f, 107.7214f, 1.0284f),
                            false,
                            0f),
                        Sunrise(
                            "world.sunrise-village.golden-tree",
                            new Vector3(-19.837658f, -24.351622f, -20.158743f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(55.2901f, 62.8058f, 73.8945f),
                            true,
                            0.45f),
                        Sunrise(
                            "world.sunrise-village.market-stall",
                            new Vector3(101.201744f, -19.823338f, -102.57149f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(108.1499f, 103.7726f, 125.0265f),
                            true,
                            0.62f),
                        Sunrise(
                            "world.sunrise-village.notice-board",
                            new Vector3(30.444988f, -21.451921f, 13.047876f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(16.6805f, 20.5887f, 23.1366f),
                            true,
                            0.62f),
                    }
                },
                {
                    "forest-valley",
                    new[]
                    {
                        Forest(
                            "world.forest-valley.island",
                            new Vector3(6.314954f, 0.070814f, -6.358922f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(52.3785f, 59.5202f, 0.9107f),
                            false,
                            0f),
                        Forest(
                            "world.forest-valley.root-gate",
                            new Vector3(-0.2046f, 0.036952f, 8.511224f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(6.8541f, 7.4316f, 5.1373f),
                            true,
                            0.56f),
                        Forest(
                            "world.forest-valley.tree-hollow-two",
                            new Vector3(-3.633645f, 0.070814f, -3.462852f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(6.0736f, 6.0545f, 8.1811f),
                            true,
                            0.58f),
                        Forest(
                            "world.forest-valley.moon-spring",
                            new Vector3(15.393996f, 0.070814f, -13.961643f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(5.6949f, 6.9367f, 6.8700f),
                            true,
                            0.55f),
                        Forest(
                            "world.forest-valley.notice-board",
                            new Vector3(0.160581f, 0.070814f, 1.289553f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(1.3900f, 1.7157f, 1.9280f),
                            true,
                            0.62f),
                    }
                },
                {
                    "cloud-workshop",
                    new[]
                    {
                        Cloud(
                            "world.cloud-workshop.cloud-ground-1",
                            new Vector3(-0.054438f, -8.434945f, -0.407657f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(25.5934f, 27.1851f, 18.4747f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.cloud-core-workshop-1",
                            new Vector3(2.330486f, 0.908118f, 3.677336f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(4.3414f, 4.3633f, 2.9123f),
                            true,
                            0.62f),
                        Cloud(
                            "world.cloud-workshop.windmill-highland-2",
                            new Vector3(0.643265f, 0.710145f, -3.040414f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(4.8077f, 5.1037f, 2.9123f),
                            true,
                            0.56f),
                        Cloud(
                            "world.cloud-workshop.notice-board",
                            new Vector3(5.8f, 0.75f, 0.8f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(1.3900f, 1.7157f, 1.9280f),
                            true,
                            0.62f),
                    }
                },
                {
                    "tideglow-archipelago",
                    new[]
                    {
                        Module(
                            "world.tideglow-archipelago.main-island",
                            new Vector3(0f, 0f, 0f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(10.7188f, 10.0431f, 11.6459f),
                            false,
                            0f),
                        Module(
                            "world.tideglow-archipelago.lighthouse",
                            new Vector3(2.372684f, 0.295654f, 0.090972f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(6.2791f, 6.1253f, 5.1263f),
                            true,
                            0.56f),
                        Module(
                            "world.tideglow-archipelago.navigation-connection",
                            new Vector3(3.82f, -0.160002f, 4.56f),
                            new Quaternion(0.22878f, -0.669074f, 0.669074f, 0.22878f),
                            new Vector3(4.2133f, 6.7787f, 4.9868f),
                            true,
                            0.38f),
                        Module(
                            "world.tideglow-archipelago.notice-board",
                            new Vector3(-1.2f, 0.75f, -1.6f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(0.8340f, 1.0294f, 1.1568f),
                            true,
                            0.62f),
                    }
                },
                {
                    "star-sand-wasteland",
                    new[]
                    {
                        StarSand(
                            "world.star-sand-wasteland.star-sand-wasteland",
                            new Vector3(-0.035904f, 0.015988f, 0.131342f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(10.7430f, 10.9867f, 8.2548f),
                            false,
                            0f),
                        StarSand(
                            "world.star-sand-wasteland.ancient-city-entrance",
                            new Vector3(-0.035904f, 0.474255f, 3.948800f),
                            new Quaternion(0.003966f, -0.707096f, 0.707096f, 0.003966f),
                            new Vector3(2.5135f, 2.5244f, 3.8174f),
                            true,
                            0.5f),
                        StarSand(
                            "world.star-sand-wasteland.council-tent",
                            new Vector3(-0.909334f, 0.652009f, -1.863267f),
                            new Quaternion(0.705946f, 0.040504f, -0.040504f, 0.705946f),
                            new Vector3(2.0174f, 2.0751f, 1.8375f),
                            true,
                            0.62f),
                        StarSand(
                            "world.star-sand-wasteland.notice-board",
                            new Vector3(-0.8f, 0.657647f, 1.2f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(0.4906f, 0.6055f, 0.6805f),
                            true,
                            0.62f),
                    }
                },
            };

        public static bool TryGetModules(
            string sceneId,
            out HabitHeroWorldAssetModule[] modules)
        {
            modules = null;
            if (string.IsNullOrWhiteSpace(sceneId)) return false;

            HabitHeroWorldAssetModule[] storedModules;
            if (!SceneModules.TryGetValue(sceneId.Trim(), out storedModules)) return false;

            modules = (HabitHeroWorldAssetModule[])storedModules.Clone();
            return true;
        }

        private static HabitHeroWorldAssetModule Sunrise(
            string assetKey,
            Vector3 position,
            Quaternion rotation,
            Vector3 scale,
            bool collision,
            float collisionFootprintScale)
        {
            return Transformed(
                assetKey,
                position,
                rotation,
                scale,
                collision,
                collisionFootprintScale,
                0.05f,
                new Vector3(0.82f, 1.12f, 0.28f));
        }

        private static HabitHeroWorldAssetModule Forest(
            string assetKey,
            Vector3 position,
            Quaternion rotation,
            Vector3 scale,
            bool collision,
            float collisionFootprintScale)
        {
            return Transformed(
                assetKey,
                position,
                rotation,
                scale,
                collision,
                collisionFootprintScale,
                0.6f,
                Vector3.zero);
        }

        private static HabitHeroWorldAssetModule Cloud(
            string assetKey,
            Vector3 position,
            Quaternion rotation,
            Vector3 scale,
            bool collision,
            float collisionFootprintScale)
        {
            return Transformed(
                assetKey,
                position,
                rotation,
                scale,
                collision,
                collisionFootprintScale,
                0.6f,
                Vector3.zero);
        }

        private static HabitHeroWorldAssetModule StarSand(
            string assetKey,
            Vector3 position,
            Quaternion rotation,
            Vector3 scale,
            bool collision,
            float collisionFootprintScale)
        {
            return Transformed(
                assetKey,
                position,
                rotation,
                scale,
                collision,
                collisionFootprintScale,
                1.7f,
                Vector3.zero);
        }

        private static HabitHeroWorldAssetModule Transformed(
            string assetKey,
            Vector3 position,
            Quaternion rotation,
            Vector3 scale,
            bool collision,
            float collisionFootprintScale,
            float sceneScale,
            Vector3 scenePosition)
        {
            return new HabitHeroWorldAssetModule(
                assetKey,
                scenePosition + position * sceneScale,
                rotation,
                scale * sceneScale,
                collision,
                collisionFootprintScale);
        }

        private static HabitHeroWorldAssetModule Module(
            string assetKey,
            Vector3 position,
            Quaternion rotation,
            Vector3 scale,
            bool collision,
            float collisionFootprintScale)
        {
            return new HabitHeroWorldAssetModule(
                assetKey,
                position,
                rotation,
                scale,
                collision,
                collisionFootprintScale);
        }
    }
}
