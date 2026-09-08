using System;
using System.Collections.Generic;
using UnityEngine;

namespace HabitHero.Platform
{
    /// <summary>
    /// Resolves the same public GLB assets used by the Web client.
    ///
    /// The server only sends a stable asset_key. Keeping the path allow-list
    /// here prevents a catalog value from becoming an arbitrary URL in the
    /// native client while allowing WebGL to reuse the Vercel asset files.
    /// </summary>
    public static class HabitHeroGameAssetCatalog
    {
        private static readonly Dictionary<string, string> ModelPaths =
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                { "character.arthur", "assets/characters/arthur.glb" },
                { "character.collette", "assets/characters/collette.glb" },
                { "character.elina", "assets/characters/elina.glb" },
                { "character.elio", "assets/characters/elio.glb" },
                { "character.gilt", "assets/characters/gilt.glb" },
                { "character.lunalia", "assets/characters/lunalia.glb" },
                { "character.moss", "assets/characters/moss.glb" },
                { "character.noah", "assets/characters/noah.glb" },
                { "character.sia", "assets/characters/sia.glb" },
                { "character.violette", "assets/characters/violette.glb" },
                { "decoration.adventure-table", "assets/decorations/adventure-table.glb" },
                { "decoration.bed", "assets/decorations/bed.glb" },
                { "decoration.blue-rug", "assets/decorations/blue-rug.glb" },
                { "decoration.bookcase", "assets/decorations/bookcase.glb" },
                { "decoration.computer-desk", "assets/decorations/computer-desk.glb" },
                { "decoration.curtain-wall", "assets/decorations/curtain-wall.glb" },
                { "decoration.floor-lamp", "assets/decorations/floor-lamp.glb" },
                { "decoration.fountain", "assets/decorations/fountain.glb" },
                { "decoration.gaming-chair", "assets/decorations/gaming-chair.glb" },
                { "decoration.lavender-pattern-rug", "assets/decorations/lavender-pattern-rug.glb" },
                { "decoration.nightstand", "assets/decorations/nightstand.glb" },
                { "decoration.patchwork-rug", "assets/decorations/patchwork-rug.glb" },
                { "decoration.pawprint-rug", "assets/decorations/pawprint-rug.glb" },
                { "decoration.royal-crest-rug", "assets/decorations/royal-crest-rug.glb" },
                { "decoration.sofa", "assets/decorations/sofa.glb" },
                { "decoration.stone-fire-pit", "assets/decorations/stone-fire-pit.glb" },
                { "decoration.study-chair", "assets/decorations/study-chair.glb" },
                { "decoration.study-desk", "assets/decorations/study-desk.glb" },
                { "decoration.wall", "assets/decorations/wall.glb" },
                { "world.sunrise-village.forest-house", "assets/world/sunrise-village/forest-house.glb" },
                { "world.sunrise-village.golden-tree-house", "assets/world/sunrise-village/golden-tree-house.glb" },
                { "world.sunrise-village.golden-tree", "assets/world/sunrise-village/golden-tree.glb" },
                { "world.sunrise-village.island", "assets/world/sunrise-village/island.glb" },
                { "world.sunrise-village.market-stall", "assets/world/sunrise-village/market-stall.glb" },
                { "world.sunrise-village.notice-board", "assets/world/sunrise-village/notice-board.glb" },
                { "world.sunrise-village.rooster-house", "assets/world/sunrise-village/rooster-house.glb" },
                { "world.sunrise-village.round-stone-road", "assets/world/sunrise-village/round-stone-road.glb" },
                { "world.sunrise-village.straight-stone-road", "assets/world/sunrise-village/straight-stone-road.glb" },
                { "world.forest-valley.island", "assets/world/sunrise-village/island.glb" },
                { "world.forest-valley.circular-boardwalk", "assets/world/forest-valley/circular-boardwalk.glb" },
                { "world.forest-valley.moon-spring", "assets/world/forest-valley/moon-spring.glb" },
                { "world.forest-valley.notice-board", "assets/world/sunrise-village/notice-board.glb" },
                { "world.forest-valley.root-gate", "assets/world/forest-valley/root-gate.glb" },
                { "world.forest-valley.multi-tree-stone-gate", "assets/world/forest-valley/multi-tree-stone-gate.glb" },
                { "world.forest-valley.purple-mushroom-tree", "assets/world/forest-valley/purple-mushroom-tree.glb" },
                { "world.forest-valley.tree-hollow-one", "assets/world/forest-valley/tree-hollow-one.glb" },
                { "world.forest-valley.tree-hollow-three", "assets/world/forest-valley/tree-hollow-three.glb" },
                { "world.forest-valley.tree-hollow-house-one", "assets/world/forest-valley/tree-hollow-house-one.glb" },
                { "world.forest-valley.tree-hollow-house-two", "assets/world/forest-valley/tree-hollow-house-two.glb" },
                { "world.forest-valley.tree-hollow-two", "assets/world/forest-valley/tree-hollow-two.glb" },
                { "world.cloud-workshop.airship-dock-1", "assets/world/cloud-workshop/airship-dock-1.glb" },
                { "world.cloud-workshop.airship-dock-2", "assets/world/cloud-workshop/airship-dock-2.glb" },
                { "world.cloud-workshop.cloud-bridge-1", "assets/world/cloud-workshop/cloud-bridge-1.glb" },
                { "world.cloud-workshop.cloud-bridge-2", "assets/world/cloud-workshop/cloud-bridge-2.glb" },
                { "world.cloud-workshop.cloud-ground-1", "assets/world/cloud-workshop/cloud-ground-1.glb" },
                { "world.cloud-workshop.cloud-ground-2", "assets/world/cloud-workshop/cloud-ground-2.glb" },
                { "world.cloud-workshop.cloud-ground-3", "assets/world/cloud-workshop/cloud-ground-3.glb" },
                { "world.cloud-workshop.cloud-core-workshop-1", "assets/world/cloud-workshop/cloud-core-workshop-1.glb" },
                { "world.cloud-workshop.cloud-core-workshop-2", "assets/world/cloud-workshop/cloud-core-workshop-2.glb" },
                { "world.cloud-workshop.cloud-material-hut-1", "assets/world/cloud-workshop/cloud-material-hut-1.glb" },
                { "world.cloud-workshop.cloud-material-hut-2", "assets/world/cloud-workshop/cloud-material-hut-2.glb" },
                { "world.cloud-workshop.cloud-stair-railing-1", "assets/world/cloud-workshop/cloud-stair-railing-1.glb" },
                { "world.cloud-workshop.cloud-stair-railing-2", "assets/world/cloud-workshop/cloud-stair-railing-2.glb" },
                { "world.cloud-workshop.cloud-stair-railing-3", "assets/world/cloud-workshop/cloud-stair-railing-3.glb" },
                { "world.cloud-workshop.notice-board", "assets/world/sunrise-village/notice-board.glb" },
                { "world.cloud-workshop.sky-garden-1", "assets/world/cloud-workshop/sky-garden-1.glb" },
                { "world.cloud-workshop.sky-garden-2", "assets/world/cloud-workshop/sky-garden-2.glb" },
                { "world.cloud-workshop.sky-garden-3", "assets/world/cloud-workshop/sky-garden-3.glb" },
                { "world.cloud-workshop.small-cloud-airship-1", "assets/world/cloud-workshop/small-cloud-airship-1.glb" },
                { "world.cloud-workshop.small-cloud-airship-2", "assets/world/cloud-workshop/small-cloud-airship-2.glb" },
                { "world.cloud-workshop.small-cloud-airship-3", "assets/world/cloud-workshop/small-cloud-airship-3.glb" },
                { "world.cloud-workshop.small-cloud-airship-4", "assets/world/cloud-workshop/small-cloud-airship-4.glb" },
                { "world.cloud-workshop.small-cloud-airship-5", "assets/world/cloud-workshop/small-cloud-airship-5.glb" },
                { "world.cloud-workshop.windmill-highland-2", "assets/world/cloud-workshop/windmill-highland-2.glb" },
                { "world.cloud-workshop.windmill-highland-1", "assets/world/cloud-workshop/windmill-highland-1.glb" },
                { "world.tideglow-archipelago.main-island", "assets/world/tideglow-archipelago/main-island.glb" },
                { "world.tideglow-archipelago.tidal-harbor", "assets/world/tideglow-archipelago/tidal-harbor.glb" },
                { "world.tideglow-archipelago.lighthouse", "assets/world/tideglow-archipelago/lighthouse.glb" },
                { "world.tideglow-archipelago.harbor-huts-1", "assets/world/tideglow-archipelago/harbor-huts-1.glb" },
                { "world.tideglow-archipelago.harbor-huts-2", "assets/world/tideglow-archipelago/harbor-huts-2.glb" },
                { "world.tideglow-archipelago.seaside-market", "assets/world/tideglow-archipelago/seaside-market.glb" },
                { "world.tideglow-archipelago.glowing-coral-reef-island", "assets/world/tideglow-archipelago/glowing-coral-reef-island.glb" },
                { "world.tideglow-archipelago.mangrove-mist-island", "assets/world/tideglow-archipelago/mangrove-mist-island.glb" },
                { "world.tideglow-archipelago.navigation-connection", "assets/world/tideglow-archipelago/navigation-connection.glb" },
                { "world.tideglow-archipelago.notice-board", "assets/world/sunrise-village/notice-board.glb" },
                { "world.tideglow-archipelago.tidal-rock-pool", "assets/world/tideglow-archipelago/tidal-rock-pool.glb" },
                { "world.tideglow-archipelago.tideglow-energy-core", "assets/world/tideglow-archipelago/tideglow-energy-core.glb" },
                { "world.star-sand-wasteland.ancient-city-entrance", "assets/world/star-sand-wasteland/ancient-city-entrance.glb" },
                { "world.star-sand-wasteland.boulder", "assets/world/star-sand-wasteland/boulder.glb" },
                { "world.star-sand-wasteland.caravan-rest", "assets/world/star-sand-wasteland/caravan-rest.glb" },
                { "world.star-sand-wasteland.caravan-sunshade", "assets/world/star-sand-wasteland/caravan-sunshade.glb" },
                { "world.star-sand-wasteland.council-tent", "assets/world/star-sand-wasteland/council-tent.glb" },
                { "world.star-sand-wasteland.desert-dome-house", "assets/world/star-sand-wasteland/desert-dome-house.glb" },
                { "world.star-sand-wasteland.luminous-star-sand", "assets/world/star-sand-wasteland/luminous-star-sand.glb" },
                { "world.star-sand-wasteland.notice-board", "assets/world/sunrise-village/notice-board.glb" },
                { "world.star-sand-wasteland.star-sand-wasteland", "assets/world/star-sand-wasteland/star-sand-wasteland.glb" },
                { "world.star-sand-wasteland.weathered-pillar-1", "assets/world/star-sand-wasteland/weathered-pillar-1.glb" },
                { "world.star-sand-wasteland.weathered-pillar", "assets/world/star-sand-wasteland/weathered-pillar.glb" },
                { "world.star-sand-wasteland.windbreak-tent", "assets/world/star-sand-wasteland/windbreak-tent.glb" },
                { "pet.ailite", "assets/pets/ailite.glb" },
                { "pet.arcadia", "assets/pets/arcadia.glb" },
                { "pet.baruku-mushroom", "assets/pets/baruku-mushroom.glb" },
                { "pet.belilos-fox", "assets/pets/belilos-fox.glb" },
                { "pet.buleifu-tiger", "assets/pets/buleifu-tiger.glb" },
                { "pet.christo", "assets/pets/christo.glb" },
                { "pet.chrono-rabbit", "assets/pets/chrono-rabbit.glb" },
                { "pet.forest-guardian", "assets/starlight-sprout-pet.glb" },
                { "pet.jasmine", "assets/pets/jasmine.glb" },
                { "pet.kaldo", "assets/pets/kaldo.glb" },
                { "pet.magellan-rabbit", "assets/pets/magellan-rabbit.glb" },
                { "pet.moko", "assets/pets/moko.glb" },
                { "pet.murphy-bear", "assets/pets/murphy-bear.glb" },
                { "pet.nibus", "assets/pets/nibus.glb" },
                { "pet.orian", "assets/pets/orian.glb" },
                { "pet.oum", "assets/pets/oum.glb" },
                { "pet.qifu-er", "assets/pets/qifu-er.glb" },
                { "pet.silf-owl", "assets/pets/silf-owl.glb" },
                { "pet.star-diver", "assets/pets/star-diver.glb" },
                { "pet.starlight-sprout", "assets/starlight-sprout-pet.glb" },
                { "pet.yaoguang-deer", "assets/pets/yaoguang-deer.glb" },
            };

        public static bool TryResolveModelUrl(
            string assetKey,
            string configuredBaseUrl,
            out string modelUrl)
        {
            modelUrl = null;
            string relativePath;
            if (string.IsNullOrWhiteSpace(assetKey)
                || !ModelPaths.TryGetValue(assetKey.Trim(), out relativePath))
            {
                return false;
            }

            string baseUrl = string.IsNullOrWhiteSpace(configuredBaseUrl)
                ? Application.absoluteURL
                : configuredBaseUrl.Trim();
            Uri baseUri;
            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out baseUri)
                || (baseUri.Scheme != Uri.UriSchemeHttp
                    && baseUri.Scheme != Uri.UriSchemeHttps))
            {
                return false;
            }

            Uri origin = new Uri(baseUri.GetLeftPart(UriPartial.Authority) + "/");
            modelUrl = new Uri(origin, relativePath).ToString();
            return true;
        }

        public static bool HasModel(string assetKey)
        {
            return !string.IsNullOrWhiteSpace(assetKey)
                && ModelPaths.ContainsKey(assetKey.Trim());
        }
    }
}
