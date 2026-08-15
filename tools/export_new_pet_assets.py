"""Export the supplied Star Diver and Teddy Sou pets for mobile delivery.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/export_new_pet_assets.py

The source files in Downloads are never modified. The shipped assets use a
moderate geometry reduction, 1024px packed textures, Draco mesh compression,
and WebP textures/thumbnails to keep the iOS and Android bundles small.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 84
THUMBNAIL_SIZE = 512
THUMBNAIL_QUALITY = 88


@dataclass(frozen=True)
class PetExport:
    source: str
    output: str
    thumbnail_source: str
    thumbnail_output: str
    decimate_ratio: float
    label: str
    name: str


EXPORTS = (
    PetExport(
        source="/Users/studio.vv/Downloads/星辰潛者.blend",
        output=os.path.join(ROOT, "public/assets/pets/star-diver.glb"),
        thumbnail_source="/Users/studio.vv/Downloads/星辰潛者去背.png",
        thumbnail_output=os.path.join(ROOT, "public/assets/pets/star-diver-thumbnail.webp"),
        decimate_ratio=0.24,
        label="STAR_DIVER",
        name="星辰潛者",
    ),
    PetExport(
        source="/Users/studio.vv/Downloads/泰迪酥.fbx",
        output=os.path.join(ROOT, "public/assets/pets/teddy-sou.glb"),
        thumbnail_source="/Users/studio.vv/Downloads/泰迪酥去背.png",
        thumbnail_output=os.path.join(ROOT, "public/assets/pets/teddy-sou-thumbnail.webp"),
        decimate_ratio=0.20,
        label="TEDDY_SOU",
        name="泰迪酥",
    ),
)


def load_source(source: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.lower().endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=source, automatic_bone_orientation=False)
    else:
        bpy.ops.wm.open_mainfile(filepath=source)


def find_mesh_and_armature(label: str):
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(meshes) != 1 or len(armatures) != 1:
        raise RuntimeError(
            f"{label}: expected one mesh and one armature, got "
            f"{len(meshes)} meshes and {len(armatures)} armatures"
        )
    return meshes[0], armatures[0]


def resize_packed_images() -> None:
    for image in bpy.data.images:
        width, height = image.size[:]
        if width <= TEXTURE_MAX_SIZE and height <= TEXTURE_MAX_SIZE:
            continue
        scale = min(TEXTURE_MAX_SIZE / width, TEXTURE_MAX_SIZE / height)
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))


def reduce_mesh(mesh, label: str, ratio: float) -> tuple[int, int]:
    original_polygons = len(mesh.data.polygons)
    modifier = mesh.modifiers.new(name=f"{label}_MobileDecimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    # The source has an Armature modifier. Apply decimation to the undeformed
    # mesh so skinning remains stable in the exported animation.
    bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return original_polygons, len(mesh.data.polygons)


def export_model(spec: PetExport) -> None:
    load_source(spec.source)
    mesh, armature = find_mesh_and_armature(spec.label)
    original_polygons, exported_polygons = reduce_mesh(mesh, spec.label, spec.decimate_ratio)
    resize_packed_images()
    scene = bpy.context.scene
    action_ranges = [tuple(action.frame_range) for action in bpy.data.actions]
    if action_ranges:
        scene.frame_start = int(min(frame_range[0] for frame_range in action_ranges))
        scene.frame_end = int(max(frame_range[1] for frame_range in action_ranges))

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
        f"{spec.label}_MODEL {spec.output} "
        f"ORIGINAL_POLYGONS={original_polygons} EXPORTED_POLYGONS={exported_polygons} "
        f"ACTIONS={[action.name for action in bpy.data.actions]} ARMATURE={armature.name}"
    )


def export_thumbnail(spec: PetExport) -> None:
    os.makedirs(os.path.dirname(spec.thumbnail_output), exist_ok=True)
    image = bpy.data.images.load(spec.thumbnail_source, check_existing=False)
    image.scale(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    image.file_format = "WEBP"
    image.save(filepath=spec.thumbnail_output, quality=THUMBNAIL_QUALITY)
    print(f"{spec.label}_THUMBNAIL {spec.thumbnail_output} SIZE={image.size[:]} FORMAT={image.file_format}")


for export_spec in EXPORTS:
    export_model(export_spec)
    export_thumbnail(export_spec)
