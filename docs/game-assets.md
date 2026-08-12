# Game assets

## Anime Maiden

`terrain-prototype/assets/anime-maiden.glb` is the starter character used by the first world catalog entry (`character.anime-maiden`). It is covered by the license bundled beside the asset at `terrain-prototype/assets/AnimeMaiden-LICENSE.txt`.

The license permits use in commercial and non-commercial games, editing for project use, and publishing game/web work that uses the asset. It does not permit reselling or repackaging the original or modified asset, use in logos/trademarks, printed media, or inclusion in game-making tools, templates, or NFT/crypto/play-to-earn projects.

## Forest Guardian pet

`public/assets/starlight-sprout-pet.glb` is the user-provided Starlight Sprout biped model presented in the store as `森林守護者`. Its matching transparent store thumbnail is `public/assets/forest-guardian-thumbnail.png`. The store entry keeps the stable `pet.starlight-sprout` key and the world runtime loads its embedded materials and walking animation through the same GLTF/SkeletonUtils path as the other 3D characters. Bounds normalization keeps the pet at the existing star-sprout world scale, with a 1.3x in-world visual size multiplier for the equipped and roaming model, despite the source file's authored armature scale.

The replacement migration (`20260812101223_replace_legacy_pets_with_starlight_sprout.sql`) removes all previous pet catalog rows, prices, inventory, world entities, purchases, and purchase ledger entries before inserting the single active pet. The rename migration (`20260812103059_rename_starlight_sprout_to_forest_guardian.sql`) updates the display name, while `20260812104044_update_forest_guardian_thumbnail.sql` points the catalog at the supplied transparent thumbnail. The supplied model's original source/license provenance should be recorded before a production distribution.

## Big Tree

`terrain-prototype/assets/big-tree.glb` is the side-back focal tree asset used by the production world runtime. Both quality tiers load this asset because it is part of the browser-visible world; an Anime Maiden GLB is also loaded when that catalog character is equipped, while other characters remain procedural. High quality preserves the prototype visual budget: viewport-aware grass with an outer-density multiplier of 36 plus a 10-layer walkable-edge grass band spread across a wider soft boundary, a fuller base population across the large outer field, the full flower budget, a soft near-white afternoon sun, and a 360-degree ring of softened distant tree silhouettes and hills, pixel ratio capped at 2, and 2048px soft shadows. Low quality (reduced motion, `deviceMemory <= 2`, or `hardwareConcurrency <= 2`) scales the viewport-aware grass and flower budgets down, keeps a reduced outer grass density of 24 with a 6-layer walkable-edge band and a fuller outer-field base population, keeps the 360-degree distant tree silhouettes at low density, caps pixel ratio at 1, reduces sway, and disables renderer shadows. Aborted or disposed loads release their GLTF roots, materials, and textures; failed loads surface the runtime error while the UI keeps its static fallback available. The asset's SHA-256 is `c806f86b9b37d13306ef4691cbade2f0c9998bccb78b525900cd3484ff327328`.

The repository does not currently contain provenance or a license notice for this binary. The asset is therefore an outstanding release/legal risk: record the original source and license beside the asset before distributing a production build.
