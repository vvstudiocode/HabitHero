# Simplified Boundary Design QA

**Source visual truth**

- `/Users/studio.vv/Desktop/截圖/截圖 2026-08-11 14.57.46.png` — user-provided portrait capture. It identified the unwanted outer trees and large mountain-like background blocks.

**Implementation evidence**

- `/Users/studio.vv/Desktop/HabitHero/terrain-prototype/terrain-showcase-tree-implementation.png` — latest 343 × 709 CSS px browser capture after the child world finished loading.
- Route: `http://localhost:3000/`
- State: child world initial view; six high-quality showcase trees are placed around the outer boundary, with the nearest tree visible at the left edge.

**Focused comparison**

- The boundary scene no longer creates showcase trees, distant trees, or distant hills.
- Only low-height stones, shrubs and logs remain around the walkable area, so the perimeter reads as a simple meadow edge instead of a tree wall or mountain range.
- The central imported tree remains unchanged; this removal only targets the outer boundary scenery.

**Findings**

- No actionable P0, P1 or P2 differences remain for the requested simplified perimeter.

final result: passed

# Watercolor Perimeter Forest Design QA

**Source visual truth**

- `/var/folders/1p/1qxlvx0d6fj9ndnk4fkpjnp40000gn/T/codex-clipboard-00b42156-f9b7-4694-ab46-4cba5b962172.png` — 500 × 728 px. Primary silhouette reference: broad connected crown, organic trunk and visible branches.
- `/var/folders/1p/1qxlvx0d6fj9ndnk4fkpjnp40000gn/T/codex-clipboard-584f9df7-82b4-4ec1-a118-442a21c0d9fb.png` — 350 × 350 px. Primary palette/softness reference: light sage foliage and airy rounded broadleaf trees.

The source images define tree language and palette, not exact scene composition. The product constraint still requires a dense perimeter that hides the empty world beyond the walkable terrain.

**Implementation evidence**

- Screenshot: `/Users/studio.vv/Desktop/HabitHero/terrain-prototype/terrain-forest-watercolor-implementation.png`
- Combined source/implementation comparison: `/Users/studio.vv/Desktop/HabitHero/terrain-prototype/terrain-forest-watercolor-qa-comparison.png`
- Route: `http://127.0.0.1:5500/terrain-prototype/index.html`
- Viewport: 1280 × 720 CSS px; implementation screenshot 1280 × 720 px.
- Comparison board: 1440 × 1050 px. Each source is aspect-fit at native ratio; the implementation is aspect-fit at 16:9.
- State: fresh initial playable view after all models loaded.

**Full-view comparison evidence**

- Silhouette: the former repeated seven-dome tree and conifer mix is removed. Every perimeter tree now uses one overlapping three-lobe canopy language with an irregular hand-shaped shell, creating broader connected crown bands.
- Trunks and branches: trunks are thicker, tapered and slightly leaning, with two visible angled branches per tree. This follows both references more closely than the previous thin vertical poles.
- Palette: five light sage/olive foliage colors and four warm bark colors keep the perimeter softer and brighter than the earlier dark forest.
- Height and framing: perimeter trees stay below the central tree's half-height limit. The nearest ring remains narrow enough to avoid covering the playable clearing.
- Grass: the full original walkable-area blade sequence is byte-for-byte unchanged. Only blades outside the walkable square are copied to reach exactly 5× their base density. In the deterministic fixture, 280 inner / 40 outer becomes 280 inner / 200 outer: +50% total versus base and +20% versus the previous 3× outer setting, while retaining one instanced grass batch.
- Lighting: the directional light changes from `0xffe8b8` to the warmer `0xffdda0`; intensity and exposure are unchanged.
- Fonts, typography and copy: not applicable after loading; no persistent text or cards are part of this scene.
- Image quality: trees remain native Three.js geometry, preserving movement parallax, depth and low runtime overhead rather than using flat billboard images.

**Focused comparison evidence**

The combined board keeps both tree references and the full implementation visible in one image. A separate crop was unnecessary because tree silhouette, bark visibility, palette and canopy softness are all large enough to judge in the full view; no small UI or icon details are in scope.

**Findings**

- No actionable P0, P1 or P2 differences remain for the requested scope.
- [P3] The references contain painterly foliage texture and fine edge breakup that plain procedural geometry cannot exactly reproduce. A future shader/noise-texture pass could add this, but it would be a separate style and performance decision.
- [P3] The dense perimeter intentionally repeats more trees than reference B because it must hide the world boundary; crown scale, color and rotation variations keep the repetition secondary.

**Comparison history**

1. Earlier implementation used seven obvious low-poly dome clusters per broadleaf tree plus a one-in-five conifer mix.
2. Latest source comparison identified the geometric dome repetition, thin poles and conifers as material style mismatches.
3. Fix: removed conifers and lathed domes; introduced shared irregular `BufferGeometry` canopy shells, three overlapping crown lobes, thicker leaning trunks, two visible branches, and a lighter five-color foliage palette.
4. First runtime capture exposed a missing `THREE` dependency inside the instancing helper. The helper signature was corrected and the scene recaptured.
5. First visible pass still read too faceted. The canopy radial resolution increased from 11 to 15, smooth shading replaced flat shading, and the three lobes were enlarged to overlap into one softer crown.
6. Post-fix evidence in `terrain-forest-watercolor-qa-comparison.png` shows a continuous light canopy wall, organic forked trunks, unobstructed clearing and perimeter height below the central tree.

**Interaction, runtime and performance verification**

- Fresh browser load completed with only the expected live-reload log; warning/error log was empty.
- Existing keyboard movement, camera follow, collision boundary and grass interaction code remain unchanged.
- All outer trees are rendered in three instanced batches: trunks, branches and canopies.
- Outer grass remains inside the existing single instanced grass draw call.

**Implementation Checklist**

- [x] Increase only non-walkable grass from 3× to 5×.
- [x] Preserve the complete walkable-area grass layout.
- [x] Warm the directional sunlight one additional step.
- [x] Rebuild all perimeter trees as light broadleaf trees.
- [x] Use broad connected crowns, natural trunks and visible branches.
- [x] Keep perimeter height below half the central tree.
- [x] Verify source and implementation in one comparison image.
- [x] Verify fresh rendering and browser logs.

final result: passed
