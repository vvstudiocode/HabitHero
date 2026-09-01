"""Export the supplied Cloud Workshop GLBs as compact, material-preserving assets.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/optimize_cloud_workshop_assets.py

The source files remain untouched. Geometry is kept intact; Draco compresses the
mesh and WebP compresses the embedded base-color, normal, and ORM textures.
"""

from __future__ import annotations

from pathlib import Path

import bpy


SOURCE_DIR = Path('/Users/studio.vv/Downloads')
OUTPUT_DIR = Path(__file__).resolve().parents[1] / 'public/assets/world/cloud-workshop'

ASSETS = {
    '雲梯與安全欄杆1.glb': 'cloud-stair-railing-1.glb',
    '雲梯與安全欄杆2.glb': 'cloud-stair-railing-2.glb',
    '雲梯與安全欄杆3.glb': 'cloud-stair-railing-3.glb',
    '天空菜園1.glb': 'sky-garden-1.glb',
    '天空菜園2.glb': 'sky-garden-2.glb',
    '天空菜園3.glb': 'sky-garden-3.glb',
    '雲朵材料小屋1.glb': 'cloud-material-hut-1.glb',
    '雲朵材料小屋2.glb': 'cloud-material-hut-2.glb',
    '小型雲朵飛艇1.glb': 'small-cloud-airship-1.glb',
    '小型雲朵飛艇2.glb': 'small-cloud-airship-2.glb',
    '小型雲朵飛艇3.glb': 'small-cloud-airship-3.glb',
    '小型雲朵飛艇4.glb': 'small-cloud-airship-4.glb',
    '小型雲朵飛艇5.glb': 'small-cloud-airship-5.glb',
    '飛艇停泊台1.glb': 'airship-dock-1.glb',
    '飛艇停泊台2.glb': 'airship-dock-2.glb',
    '風車高台1.glb': 'windmill-highland-1.glb',
    '風車高台2.glb': 'windmill-highland-2.glb',
    '雲核主工坊1.glb': 'cloud-core-workshop-1.glb',
    '雲核主工坊2.glb': 'cloud-core-workshop-2.glb',
    '雲橋1.glb': 'cloud-bridge-1.glb',
    '雲橋2.glb': 'cloud-bridge-2.glb',
    '雲地1.glb': 'cloud-ground-1.glb',
    '雲地2.glb': 'cloud-ground-2.glb',
    '雲地3.glb': 'cloud-ground-3.glb',
}


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export_asset(source_name: str, output_name: str) -> None:
    source_path = SOURCE_DIR / source_name
    output_path = OUTPUT_DIR / output_name
    if not source_path.is_file():
        raise FileNotFoundError(source_path)

    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(source_path))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',
        export_image_format='WEBP',
        export_image_quality=82,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    print(f'EXPORTED {source_name} -> {output_path} ({output_path.stat().st_size} bytes)')


for source_name, output_name in ASSETS.items():
    export_asset(source_name, output_name)

