"""Pack the supplied 艾莉特 FBX files into one compact animated pet GLB.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python tools/export_ailite_action_assets.py

艾莉特idle.fbx is the only mesh/material source. The other FBX files only
contribute actions so the runtime ships one shared mesh and texture.
"""

from __future__ import annotations

import os
import re

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
DOWNLOADS = "/Users/studio.vv/Downloads"
OUTPUT = os.path.join(ROOT, "public/assets/pets/ailite.glb")
TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 82
MESH_DECIMATE_RATIO = 0.12


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx(path: str):
    before_objects = set(bpy.context.scene.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    new_objects = [obj for obj in bpy.context.scene.objects if obj not in before_objects]
    new_armatures = [obj for obj in new_objects if obj.type == "ARMATURE"]
    new_meshes = [obj for obj in new_objects if obj.type == "MESH"]
    new_actions = [action for action in bpy.data.actions if action not in before_actions]
    if len(new_armatures) != 1 or len(new_meshes) != 1 or len(new_actions) != 1:
        raise RuntimeError(
            f"{path}: expected one imported armature, mesh, and action, got "
            f"{len(new_armatures)} armatures, {len(new_meshes)} meshes, "
            f"{len(new_actions)} actions"
        )
    return new_armatures[0], new_meshes[0], new_actions[0]


def remove_imported_objects(objects) -> None:
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)


def copy_action_from_fbx(path: str, name: str):
    armature, mesh, source_action = import_fbx(path)
    action = source_action.copy()
    action.name = name
    action.use_fake_user = True
    remove_imported_objects((armature, mesh))
    bpy.data.actions.remove(source_action, do_unlink=True)
    return action


def action_channel_fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                yield from channelbag.fcurves


def normalize_walk_root_motion(action) -> None:
    root_pattern = re.compile(r'pose\.bones\["(?:mixamorig:)?(?:Hips|Pelvis)"\]\.location$')
    for fcurve in action_channel_fcurves(action):
        if fcurve.array_index not in (0, 1) or not root_pattern.search(fcurve.data_path):
            continue
        if not fcurve.keyframe_points:
            continue
        initial_value = fcurve.keyframe_points[0].co.y
        for keyframe in fcurve.keyframe_points:
            keyframe.co.y = initial_value
        fcurve.update()


def resize_packed_images() -> None:
    for image in bpy.data.images:
        width, height = image.size[:]
        if width <= TEXTURE_MAX_SIZE and height <= TEXTURE_MAX_SIZE:
            continue
        scale = min(TEXTURE_MAX_SIZE / width, TEXTURE_MAX_SIZE / height)
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))


def reduce_mesh(mesh) -> None:
    modifier = mesh.modifiers.new(name="AILITE_MobileDecimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = MESH_DECIMATE_RATIO
    modifier.use_collapse_triangulate = True
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    while mesh.modifiers.find(modifier.name) > 0:
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def ensure_action_on_armature(armature, action) -> None:
    armature.animation_data_create()
    armature.animation_data.action = action
    if action.slots:
        armature.animation_data.action_slot = action.slots[0]
    action.use_fake_user = True


def export_glb() -> None:
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    resize_packed_images()
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


def main() -> None:
    reset_scene()
    base_armature, base_mesh, idle_source = import_fbx(
        os.path.join(DOWNLOADS, "艾莉特idle.fbx")
    )
    idle = idle_source.copy()
    idle.name = "Idle"
    idle.use_fake_user = True
    bpy.data.actions.remove(idle_source, do_unlink=True)

    actions = [idle]
    for source_name, action_name in (
        ("艾莉特.fbx", "Walk_InPlace"),
        ("艾莉特坐下.fbx", "Sit"),
        ("艾莉特揮手.fbx", "Wave"),
        ("艾莉特跳舞.fbx", "Dance"),
    ):
        action = copy_action_from_fbx(os.path.join(DOWNLOADS, source_name), action_name)
        if action_name == "Walk_InPlace":
            normalize_walk_root_motion(action)
        actions.append(action)

    reduce_mesh(base_mesh)
    for action in actions:
        ensure_action_on_armature(base_armature, action)
    export_glb()
    print("AILITE_ACTIONS", [action.name for action in actions])
    print("AILITE_OUTPUT_BYTES", os.path.getsize(OUTPUT))


if __name__ == "__main__":
    main()
