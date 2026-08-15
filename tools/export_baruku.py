"""Export the supplied Baruku mushroom pet as a compact animated GLB.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/export_baruku.py

The source blend stays in Downloads. The shipped asset keeps both walk actions,
uses a mobile-safe decimation pass, Draco geometry compression, and WebP
textures so the pet does not add unnecessary app weight.
"""

from __future__ import annotations

import os

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
SOURCE = "/Users/studio.vv/Downloads/巴魯菇正確.blend"
OUTPUT = os.path.join(ROOT, "public/assets/pets/baruku-mushroom.glb")
DECIMATE_RATIO = 0.20
TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 84


def resize_packed_images() -> None:
    for image in bpy.data.images:
        width, height = image.size[:]
        if width <= TEXTURE_MAX_SIZE and height <= TEXTURE_MAX_SIZE:
            continue
        scale = min(TEXTURE_MAX_SIZE / width, TEXTURE_MAX_SIZE / height)
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))


def export() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.open_mainfile(filepath=SOURCE)

    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(meshes) != 1 or len(armatures) != 1:
        raise RuntimeError(
            f"Expected one mesh and one armature, got {len(meshes)} and {len(armatures)}"
        )

    mesh = meshes[0]
    original_polygons = len(mesh.data.polygons)
    decimate = mesh.modifiers.new(name="BarukuMushroom_MobileDecimate", type="DECIMATE")
    decimate.decimate_type = "COLLAPSE"
    decimate.ratio = DECIMATE_RATIO
    decimate.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    # Apply decimation before the armature modifier so animation deformation
    # remains predictable in the exported file.
    bpy.ops.object.modifier_move_up(modifier=decimate.name)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    resize_packed_images()

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_optimize_animation_size=True,
        export_skins=True,
        export_apply=False,
        export_yup=True,
        export_image_format="WEBP",
        export_image_quality=TEXTURE_QUALITY,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
        export_draco_generic_quantization=12,
    )
    print(
        "BARUKU_EXPORT",
        OUTPUT,
        "ORIGINAL_POLYGONS=",
        original_polygons,
        "EXPORTED_POLYGONS=",
        len(mesh.data.polygons),
        "ACTIONS=",
        [action.name for action in bpy.data.actions],
    )


if __name__ == "__main__":
    export()
