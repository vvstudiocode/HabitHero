"""Export the user-provided tiger and fox pets as compact animated GLBs.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/export_buleifu_tiger_and_belilos_fox.py

The source blends remain untouched. Geometry is reduced after the armature is
loaded, packed textures are resized to 1024px, and the GLB exporter applies
Draco compression plus WebP textures for a smaller mobile download.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 84


@dataclass(frozen=True)
class PetExport:
    source: str
    output: str
    decimate_ratio: float
    label: str


EXPORTS = (
    PetExport(
        source="/Users/studio.vv/Downloads/布雷夫虎正確.blend",
        output=os.path.join(ROOT, "public/assets/pets/buleifu-tiger.glb"),
        decimate_ratio=0.24,
        label="BULEIFU_TIGER",
    ),
    PetExport(
        source="/Users/studio.vv/Downloads/貝里洛斯狐狸正確.blend",
        output=os.path.join(ROOT, "public/assets/pets/belilos-fox.glb"),
        decimate_ratio=0.20,
        label="BELILOS_FOX",
    ),
)


def resize_packed_images() -> None:
    for image in bpy.data.images:
        width, height = image.size[:]
        if width <= TEXTURE_MAX_SIZE and height <= TEXTURE_MAX_SIZE:
            continue
        scale = min(TEXTURE_MAX_SIZE / width, TEXTURE_MAX_SIZE / height)
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))


def find_mesh_and_armature(label: str):
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(meshes) != 1 or len(armatures) != 1:
        raise RuntimeError(
            f"{label}: expected one mesh and one armature, got "
            f"{len(meshes)} meshes and {len(armatures)} armatures"
        )
    return meshes[0], armatures[0]


def export_one(spec: PetExport) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.open_mainfile(filepath=spec.source)
    mesh, armature = find_mesh_and_armature(spec.label)

    original_polygons = len(mesh.data.polygons)
    decimate = mesh.modifiers.new(name=f"{spec.label}_MobileDecimate", type="DECIMATE")
    decimate.decimate_type = "COLLAPSE"
    decimate.ratio = spec.decimate_ratio
    decimate.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    # Keep the reduction on the undeformed mesh. Applying it after the
    # armature modifier can produce a valid-looking export with a warning and
    # less predictable animated deformation.
    bpy.ops.object.modifier_move_up(modifier=decimate.name)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    resize_packed_images()

    os.makedirs(os.path.dirname(spec.output), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=spec.output,
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
        f"{spec.label}_EXPORT {spec.output} "
        f"ORIGINAL_POLYGONS={original_polygons} "
        f"EXPORTED_POLYGONS={len(mesh.data.polygons)} "
        f"ACTIONS={[action.name for action in bpy.data.actions]} "
        f"ARMATURE={armature.name}"
    )


def main() -> None:
    for spec in EXPORTS:
        export_one(spec)


if __name__ == "__main__":
    main()
