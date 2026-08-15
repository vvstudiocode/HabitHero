"""Build the supplied Collette FBX pair into one mobile-ready animated GLB.

The walk FBX provides the rig and mesh. The idle FBX is imported only to
capture its action; its duplicate rig and mesh are removed before export so
the final file contains one skinned character with both clips.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/export_collette_character.py
"""

from __future__ import annotations

import os
import re

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
WALK_SOURCE = "/Users/studio.vv/Downloads/柯蕾特去背.fbx"
IDLE_SOURCE = "/Users/studio.vv/Downloads/柯蕾特Idle.fbx"
MODEL_OUTPUT = os.path.join(ROOT, "public/assets/characters/collette.glb")
THUMBNAIL_SOURCE = "/Users/studio.vv/Downloads/柯蕾特去背.png"
THUMBNAIL_OUTPUT = os.path.join(ROOT, "public/assets/characters/collette-thumbnail.webp")

TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 86
THUMBNAIL_SIZE = 512
THUMBNAIL_QUALITY = 90
MESH_RATIO = 0.12
WARM_ROUGHNESS = 0.86
WARM_METALLIC = 0.0
WARM_SPECULAR = 0.35
ROOT_MOTION_BONE = re.compile(r'pose\.bones\["[^"]*(?:root|hips|pelvis)[^"]*"\]\.location$', re.IGNORECASE)


def iter_action_fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                yield from channelbag.fcurves


def lock_root_motion(action) -> int:
    changed = 0
    for fcurve in iter_action_fcurves(action):
        if not ROOT_MOTION_BONE.search(fcurve.data_path) or fcurve.array_index not in (0, 2):
            continue
        if not fcurve.keyframe_points:
            continue
        first_value = fcurve.keyframe_points[0].co[1]
        for keyframe in fcurve.keyframe_points:
            keyframe.co[1] = first_value
            keyframe.handle_left_type = "AUTO_CLAMPED"
            keyframe.handle_right_type = "AUTO_CLAMPED"
        fcurve.update()
        changed += 1
    return changed


def import_fbx(path: str) -> None:
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)


def resize_packed_images() -> None:
    for image in bpy.data.images:
        width, height = image.size[:]
        if width <= TEXTURE_MAX_SIZE and height <= TEXTURE_MAX_SIZE:
            continue
        scale = min(TEXTURE_MAX_SIZE / width, TEXTURE_MAX_SIZE / height)
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))


def apply_warm_material_preset() -> None:
    for material in bpy.data.materials:
        material.metallic = WARM_METALLIC
        material.roughness = WARM_ROUGHNESS
        if not material.use_nodes:
            continue
        principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if principled is None:
            continue
        principled.inputs.get("Metallic").default_value = WARM_METALLIC
        principled.inputs.get("Roughness").default_value = WARM_ROUGHNESS
        specular = principled.inputs.get("Specular IOR Level") or principled.inputs.get("Specular")
        if specular is not None:
            specular.default_value = WARM_SPECULAR


def reduce_mesh(mesh) -> tuple[int, int]:
    original_polygons = len(mesh.data.polygons)
    modifier = mesh.modifiers.new(name="MobileCharacterDecimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = MESH_RATIO
    modifier.use_collapse_triangulate = True
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    armature_index = next((index for index, item in enumerate(mesh.modifiers) if item.type == "ARMATURE"), None)
    if armature_index is not None:
        while mesh.modifiers.find(modifier.name) > armature_index:
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return original_polygons, len(mesh.data.polygons)


def export_model() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import_fbx(WALK_SOURCE)
    armature = next(object_ for object_ in bpy.data.objects if object_.type == "ARMATURE")
    mesh = next(object_ for object_ in bpy.data.objects if object_.type == "MESH")
    walk_action = armature.animation_data.action
    if walk_action is None:
        raise RuntimeError("柯蕾特 walk FBX did not contain an animation action")
    walk_action.name = "Walk_InPlace"
    walk_channels_locked = lock_root_motion(walk_action)

    import_fbx(IDLE_SOURCE)
    idle_armature = next(object_ for object_ in bpy.data.objects if object_.type == "ARMATURE" and object_ != armature)
    idle_action = idle_armature.animation_data.action
    if idle_action is None:
        raise RuntimeError("柯蕾特 idle FBX did not contain an animation action")
    idle_action.name = "Idle"
    lock_root_motion(idle_action)

    duplicate_objects = [
        object_
        for object_ in list(bpy.data.objects)
        if object_ == idle_armature or object_.parent == idle_armature
    ]
    for object_ in duplicate_objects:
        bpy.data.objects.remove(object_, do_unlink=True)
    armature.animation_data.action = walk_action

    apply_warm_material_preset()
    original_polygons, exported_polygons = reduce_mesh(mesh)
    resize_packed_images()
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 500
    scene.frame_set(scene.frame_start)

    os.makedirs(os.path.dirname(MODEL_OUTPUT), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=MODEL_OUTPUT,
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
        f"COLLETTE_MODEL {MODEL_OUTPUT} original_polygons={original_polygons} "
        f"exported_polygons={exported_polygons} walk_root_channels_locked={walk_channels_locked} "
        "animations=Idle,Walk_InPlace warm_material=roughness_0.86"
    )


def export_thumbnail() -> None:
    os.makedirs(os.path.dirname(THUMBNAIL_OUTPUT), exist_ok=True)
    image = bpy.data.images.load(THUMBNAIL_SOURCE, check_existing=False)
    image.scale(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    image.file_format = "WEBP"
    image.save(filepath=THUMBNAIL_OUTPUT, quality=THUMBNAIL_QUALITY)
    print(f"COLLETTE_THUMBNAIL {THUMBNAIL_OUTPUT} size={image.size[:]} format={image.file_format}")


export_model()
export_thumbnail()
