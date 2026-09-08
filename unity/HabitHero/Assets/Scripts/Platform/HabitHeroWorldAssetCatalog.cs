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
                            "world.sunrise-village.straight-stone-road",
                            new Vector3(136.83165f, -21.075048f, -33.910358f),
                            new Quaternion(-0.999942f, 0.001856f, -0.009235f, 0.005180f),
                            new Vector3(160.10051f, 2.366987f, 53.092686f),
                            false,
                            0f),
                        Sunrise(
                            "world.sunrise-village.round-stone-road",
                            new Vector3(-22.874138f, -20.476508f, -19.388096f),
                            new Quaternion(0f, 0.707107f, -0.707107f, 0f),
                            new Vector3(122.281494f, 107.72142f, 1.028364f),
                            false,
                            0f),
                        Sunrise(
                            "world.sunrise-village.golden-tree",
                            new Vector3(-19.837658f, -24.351622f, -20.158743f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(55.290092f, 62.805775f, 73.89452f),
                            true,
                            0.45f),
                        Sunrise(
                            "world.sunrise-village.forest-house",
                            new Vector3(10.855151f, -37.310062f, 87.97762f),
                            new Quaternion(0.517218f, -0.482167f, 0.482167f, 0.517218f),
                            new Vector3(113.43371f, 109.73043f, 191.69008f),
                            true,
                            0.62f),
                        Sunrise(
                            "world.sunrise-village.rooster-house",
                            new Vector3(-38.38211f, -35.283134f, -166.08124f),
                            new Quaternion(0.682963f, 0.1832f, -0.1832f, 0.682962f),
                            new Vector3(104.88682f, 82.85099f, 163.33562f),
                            true,
                            0.62f),
                        Sunrise(
                            "world.sunrise-village.golden-tree-house",
                            new Vector3(-144.55809f, -31.81654f, -50.18248f),
                            new Quaternion(0.069545f, 0.703678f, -0.703679f, 0.069545f),
                            new Vector3(121.71304f, 136.2896f, 176.28566f),
                            true,
                            0.62f),
                        Sunrise(
                            "world.sunrise-village.notice-board",
                            new Vector3(30.444988f, -21.451921f, 13.047876f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(16.680473f, 20.588661f, 23.136599f),
                            true,
                            0.62f),
                        Sunrise(
                            "world.sunrise-village.market-stall",
                            new Vector3(101.201744f, -19.823338f, -102.57149f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(108.149895f, 103.77256f, 125.0265f),
                            true,
                            0.62f),
                        Sunrise(
                            "world.sunrise-village.island",
                            new Vector3(-0.699848f, -21.245949f, -11.55571f),
                            new Quaternion(0f, 0.707107f, -0.707107f, 0f),
                            new Vector3(-446.1269f, -426.7864f, -469.3935f),
                            false,
                            0f),
                        Sunrise(
                            "world.sunrise-village.straight-stone-road",
                            new Vector3(-153.320694f, -21.018242f, 56.07132f),
                            new Quaternion(0.950953f, -0.002356f, -0.309326f, 0.000154f),
                            new Vector3(171.92734f, 2.367481f, 62.42163f),
                            false,
                            0f),
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
                            "world.forest-valley.multi-tree-stone-gate",
                            new Vector3(8.2046f, -0.824699f, -21.15f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(9.5882f, 13.2643f, 8.7366f),
                            true,
                            0.56f),
                        Forest(
                            "world.forest-valley.purple-mushroom-tree",
                            new Vector3(-7.364091f, -5.2f, -11.440944f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(13f, 13f, 13f),
                            false,
                            0f),
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
                            "world.forest-valley.circular-boardwalk",
                            new Vector3(-3.564091f, -0.109359f, -3.240944f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(3.7086f, 4.3038f, 5.3201f),
                            false,
                            0f),
                        Forest(
                            "world.forest-valley.tree-hollow-one",
                            new Vector3(5.473932f, -0.398288f, -7.699164f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(4.5546f, 6.3045f, 8.3627f),
                            true,
                            0.58f),
                        Forest(
                            "world.forest-valley.notice-board",
                            new Vector3(0.160581f, 0.070814f, 1.289553f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(1.3900f, 1.7157f, 1.9280f),
                            true,
                            0.62f),
                        Forest(
                            "world.forest-valley.tree-hollow-three",
                            new Vector3(7.924215f, -0.238022f, 9.155286f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(3.1505f, 4.8708f, 7.3557f),
                            true,
                            0.58f),
                        Forest(
                            "world.forest-valley.tree-hollow-house-one",
                            new Vector3(13.125493f, -0.166715f, 2.163961f),
                            new Quaternion(0.606673f, -0.363246f, 0.363246f, 0.606673f),
                            new Vector3(6.0195f, 7.7290f, 7.0511f),
                            true,
                            0.56f),
                        Forest(
                            "world.forest-valley.tree-hollow-house-two",
                            new Vector3(-0.170517f, 0.070814f, -17.30698f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(5.0531f, 6.6464f, 6.4283f),
                            true,
                            0.58f),
                    }
                },
                {
                    "cloud-workshop",
                    new[]
                    {
                        Cloud(
                            "world.cloud-workshop.cloud-stair-railing-2",
                            new Vector3(-5.42154f, 0.605515f, 10.808601f),
                            new Quaternion(0.299787f, 0.640412f, -0.640412f, 0.299787f),
                            new Vector3(4.3414f, 4.3633f, 3.6853f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.sky-garden-3",
                            new Vector3(13.600777f, 6.06283f, -38.944847f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(4.3414f, 4.3633f, 2.9123f),
                            true,
                            0.58f),
                        Cloud(
                            "world.cloud-workshop.sky-garden-2",
                            new Vector3(-18.817284f, 3.324733f, -11.419928f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(6.4891f, 7.7835f, 9.1883f),
                            true,
                            0.58f),
                        Cloud(
                            "world.cloud-workshop.sky-garden-1",
                            new Vector3(14.762848f, 1.710608f, -13.604042f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(5.9106f, 5.2937f, 3.4749f),
                            true,
                            0.58f),
                        Cloud(
                            "world.cloud-workshop.cloud-material-hut-2",
                            new Vector3(-5.721454f, 0.461118f, 5.072284f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(4.3414f, 4.3633f, 2.9123f),
                            true,
                            0.62f),
                        Cloud(
                            "world.cloud-workshop.cloud-material-hut-1",
                            new Vector3(12.558412f, 4.00361f, -3.313997f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(5.4745f, 4.9099f, 4.7870f),
                            true,
                            0.62f),
                        Cloud(
                            "world.cloud-workshop.small-cloud-airship-5",
                            new Vector3(14.974216f, 4.654183f, 7.667232f),
                            new Quaternion(0.607784f, -0.361385f, 0.361385f, 0.607784f),
                            new Vector3(16.3205f, 22.5478f, 10.9155f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.small-cloud-airship-4",
                            new Vector3(12.5358f, 4.72822f, -19.694786f),
                            new Quaternion(-0.596245f, -0.380121f, 0.380121f, -0.596245f),
                            new Vector3(10.5649f, 24.1130f, 9.2682f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.small-cloud-airship-3",
                            new Vector3(-10.788319f, 2.562693f, -18.199547f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(8.6661f, 9.5417f, 6.3731f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.small-cloud-airship-2",
                            new Vector3(5.688611f, -3.16176f, -12.534347f),
                            new Quaternion(0.674122f, -0.213447f, 0.213447f, 0.674122f),
                            new Vector3(7.6546f, 7.1124f, 7.2548f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.small-cloud-airship-1",
                            new Vector3(4.129849f, 5.377812f, 17.491947f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(7.4300f, 9.3051f, 9.3443f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.airship-dock-2",
                            new Vector3(-11.232282f, -2.437723f, 14.244297f),
                            new Quaternion(0.397084f, 0.585085f, -0.585085f, 0.397084f),
                            new Vector3(6.9396f, 8.7703f, 8.6955f),
                            true,
                            0.56f),
                        Cloud(
                            "world.cloud-workshop.airship-dock-1",
                            new Vector3(-10.931229f, 0.866029f, -0.197237f),
                            new Quaternion(0.541033f, 0.455284f, -0.455284f, 0.541033f),
                            new Vector3(5.2952f, 5.2649f, 6.2652f),
                            true,
                            0.56f),
                        Cloud(
                            "world.cloud-workshop.windmill-highland-1",
                            new Vector3(-16.079582f, 4.124313f, 7.319924f),
                            new Quaternion(0.231883f, 0.668005f, -0.668005f, 0.231883f),
                            new Vector3(8.9118f, 8.9315f, 7.2045f),
                            true,
                            0.56f),
                        Cloud(
                            "world.cloud-workshop.cloud-core-workshop-2",
                            new Vector3(-0.133675f, 3.182963f, -22.260759f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(6.2934f, 8.5662f, 6.2327f),
                            true,
                            0.62f),
                        Cloud(
                            "world.cloud-workshop.cloud-bridge-2",
                            new Vector3(6.672983f, -0.108262f, 12.971371f),
                            new Quaternion(0.652293f, -0.272972f, 0.272972f, 0.652293f),
                            new Vector3(7.2655f, 6.8317f, 5.3142f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.cloud-bridge-1",
                            new Vector3(-10.93528f, 3.416403f, -30.008635f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(4.3414f, 4.3633f, 2.9123f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.cloud-ground-3",
                            new Vector3(-2.51525f, 3.712343f, 16.559797f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(4.3414f, 4.3633f, 2.9123f),
                            false,
                            0f),
                        Cloud(
                            "world.cloud-workshop.cloud-ground-2",
                            new Vector3(-0.05743f, 2.638747f, -22.489912f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(6.8165f, 8.6221f, 2.9123f),
                            false,
                            0f),
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
                            "world.tideglow-archipelago.tidal-harbor",
                            new Vector3(-4.898774f, 0.064913f, 0.470489f),
                            new Quaternion(0.519985f, -0.479182f, 0.479182f, 0.519985f),
                            new Vector3(2.6919f, 4.0809f, 5.0844f),
                            true,
                            0.56f),
                        Module(
                            "world.tideglow-archipelago.lighthouse",
                            new Vector3(2.372684f, 0.295654f, 0.090972f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(6.2791f, 6.1253f, 5.1263f),
                            true,
                            0.56f),
                        Module(
                            "world.tideglow-archipelago.harbor-huts-1",
                            new Vector3(-2.580128f, 0.412785f, -3.516385f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(3.0312f, 2.7270f, 2.4261f),
                            true,
                            0.62f),
                        Module(
                            "world.tideglow-archipelago.harbor-huts-2",
                            new Vector3(0.85479f, 0.407162f, -4.060483f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(3.4753f, 2.6409f, 2.7182f),
                            true,
                            0.62f),
                        Module(
                            "world.tideglow-archipelago.seaside-market",
                            new Vector3(3.564279f, 0.36973f, -2.580076f),
                            new Quaternion(0.702762f, 0.078271f, -0.078271f, 0.702762f),
                            new Vector3(3.4255f, 3.3253f, 3.7417f),
                            true,
                            0.62f),
                        Module(
                            "world.tideglow-archipelago.glowing-coral-reef-island",
                            new Vector3(-4.919091f, -0.165582f, 1.800628f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(1.2011f, 1.4278f, 2.5172f),
                            false,
                            0f),
                        Module(
                            "world.tideglow-archipelago.tidal-rock-pool",
                            new Vector3(-2.400526f, 0.400635f, 3.761719f),
                            new Quaternion(0.015839f, -0.706929f, 0.706929f, 0.015839f),
                            new Vector3(4.0185f, 3.4868f, 4.0680f),
                            false,
                            0f),
                        Module(
                            "world.tideglow-archipelago.navigation-connection",
                            new Vector3(3.82f, -0.160002f, 4.56f),
                            new Quaternion(0.22878f, -0.669074f, 0.669074f, 0.22878f),
                            new Vector3(4.2133f, 6.7787f, 4.9868f),
                            true,
                            0.38f),
                        Module(
                            "world.tideglow-archipelago.tideglow-energy-core",
                            new Vector3(-4.677935f, 0.323906f, -1.624698f),
                            new Quaternion(-0.591789f, -0.387022f, 0.387022f, -0.591789f),
                            new Vector3(3.1157f, 2.4564f, 2.8077f),
                            true,
                            0.56f),
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
                            "world.star-sand-wasteland.boulder",
                            new Vector3(3.132037f, 0.334210f, 0.733702f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(1.3060f, 1.3869f, 1.2492f),
                            true,
                            0.6f),
                        StarSand(
                            "world.star-sand-wasteland.weathered-pillar-1",
                            new Vector3(-2.819842f, 0.571609f, 3.712737f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(1.2003f, 1.3103f, 2.9049f),
                            true,
                            0.52f),
                        StarSand(
                            "world.star-sand-wasteland.caravan-sunshade",
                            new Vector3(1.558703f, 0.604594f, -0.440932f),
                            new Quaternion(-0.532968f, 0.456752f, -0.427037f, -0.570054f),
                            new Vector3(1.2282f, 1.2416f, 2.0266f),
                            true,
                            0.62f),
                        StarSand(
                            "world.star-sand-wasteland.desert-dome-house",
                            new Vector3(-2.360572f, 0.605321f, 2.444227f),
                            new Quaternion(0.406314f, 0.578714f, -0.578714f, 0.406314f),
                            new Vector3(1.1786f, 1.1443f, 1.5757f),
                            true,
                            0.62f),
                        StarSand(
                            "world.star-sand-wasteland.luminous-star-sand",
                            new Vector3(-3.497077f, 0.488947f, 2.976419f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(1.8166f, 2.4652f, 2.6669f),
                            false,
                            0f),
                        StarSand(
                            "world.star-sand-wasteland.weathered-pillar",
                            new Vector3(0.71621f, 0.593404f, -3.077565f),
                            new Quaternion(0.707107f, 0f, 0f, 0.707107f),
                            new Vector3(1.8580f, 1.6853f, 2.3255f),
                            true,
                            0.52f),
                        StarSand(
                            "world.star-sand-wasteland.caravan-rest",
                            new Vector3(-3.194193f, 0.62942f, -0.081914f),
                            new Quaternion(0.367340f, 0.604203f, -0.604203f, 0.367340f),
                            new Vector3(1.5809f, 1.3627f, 1.3277f),
                            true,
                            0.62f),
                        StarSand(
                            "world.star-sand-wasteland.windbreak-tent",
                            new Vector3(2.098218f, 0.723718f, 1.561276f),
                            new Quaternion(0.349237f, -0.675051f, 0.594654f, 0.262157f),
                            new Vector3(1.1348f, 1.1427f, 1.7205f),
                            true,
                            0.62f),
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
