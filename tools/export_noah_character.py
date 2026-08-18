"""Build the supplied Noah FBX actions into one mobile-ready animated GLB.

The Idle FBX provides the shared rig, mesh, materials, and texture. Each other
FBX contributes one authored action; its duplicate rig and mesh are removed so
the final file contains one skinned character with five clips.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/export_noah_character.py
"""

from __future__ import annotations

import os
import re

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
ACTION_DIRECTORY = "/Users/studio.vv/Downloads"
IDLE_SOURCE = "/Users/studio.vv/Desktop/habithero動作檔/諾亞Idle.fbx"
MODEL_OUTPUT = os.path.join(ROOT, "public/assets/characters/noah.glb")
THUMBNAIL_SOURCE = "/Users/studio.vv/Desktop/habithero動作檔/諾亞去背.png"
THUMBNAIL_OUTPUT = os.path.join(ROOT, "public/assets/characters/noah-thumbnail.webp")

TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 86
THUMBNAIL_SIZE = 512
THUMBNAIL_QUALITY = 90
MESH_RATIO = 0.12
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


def import_fbx(path: str):
    before_objects = set(bpy.context.scene.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    imported_objects = [object_ for object_ in bpy.context.scene.objects if object_ not in before_objects]
    armatures = [object_ for object_ in imported_objects if object_.type == "ARMATURE"]
    meshes = [object_ for object_ in imported_objects if object_.type == "MESH"]
    actions = [action for action in bpy.data.actions if action not in before_actions]
    if len(armatures) != 1 or len(meshes) != 1 or len(actions) != 1:
        raise RuntimeError(
            f"{path}: expected one armature, mesh, and action; got "
            f"{len(armatures)} armatures, {len(meshes)} meshes, {len(actions)} actions"
        )
    return imported_objects, armatures[0], meshes[0], actions[0]


def remove_imported_objects(objects) -> None:
    for object_ in objects:
        bpy.data.objects.remove(object_, do_unlink=True)


def copy_action_from_fbx(path: str, name: str):
    imported_objects, _armature, _mesh, source_action = import_fbx(path)
    action = source_action.copy()
    action.name = name
    action.use_fake_user = True
    remove_imported_objects(imported_objects)
    bpy.data.actions.remove(source_action, do_unlink=True)
    return action


def resize_packed_images() -> None:
    for image in bpy.data.images:
        width, height = image.size[:]
        if width <= TEXTURE_MAX_SIZE and height <= TEXTURE_MAX_SIZE:
            continue
        scale = min(TEXTURE_MAX_SIZE / width, TEXTURE_MAX_SIZE / height)
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))


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
    _base_objects, armature, mesh, idle_source_action = import_fbx(IDLE_SOURCE)
    idle_action = idle_source_action.copy()
    idle_action.name = "Idle"
    idle_action.use_fake_user = True
    lock_root_motion(idle_action)
    bpy.data.actions.remove(idle_source_action, do_unlink=True)

    actions = [idle_action]
    for filename, action_name in (
        ("諾亞.fbx", "Walk_InPlace"),
        ("諾亞坐下.fbx", "Sit"),
        ("諾亞揮手.fbx", "Wave"),
        ("諾亞跳舞.fbx", "Dance"),
    ):
        action = copy_action_from_fbx(os.path.join(ACTION_DIRECTORY, filename), action_name)
        lock_root_motion(action)
        actions.append(action)

    armature.animation_data_create()
    for action in actions:
        armature.animation_data.action = action
        action.use_fake_user = True
    armature.animation_data.action = actions[1]
    walk_channels_locked = sum(
        1
        for fcurve in iter_action_fcurves(actions[1])
        if ROOT_MOTION_BONE.search(fcurve.data_path) and fcurve.array_index in (0, 2)
    )

    original_polygons, exported_polygons = reduce_mesh(mesh)
    resize_packed_images()
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = max(int(action.frame_range[1]) for action in actions)
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
        f"NOAH_MODEL {MODEL_OUTPUT} original_polygons={original_polygons} "
        f"exported_polygons={exported_polygons} walk_root_channels_locked={walk_channels_locked} "
        "animations=Idle,Walk_InPlace,Sit,Wave,Dance"
    )


def export_thumbnail() -> None:
    os.makedirs(os.path.dirname(THUMBNAIL_OUTPUT), exist_ok=True)
    image = bpy.data.images.load(THUMBNAIL_SOURCE, check_existing=False)
    image.scale(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    image.file_format = "WEBP"
    image.save(filepath=THUMBNAIL_OUTPUT, quality=THUMBNAIL_QUALITY)
    print(f"NOAH_THUMBNAIL {THUMBNAIL_OUTPUT} size={image.size[:]} format={image.file_format}")


export_model()
export_thumbnail()
