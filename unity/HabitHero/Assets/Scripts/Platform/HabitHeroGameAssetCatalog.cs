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
