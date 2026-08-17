"""Pack supplied Jasmine and Christo FBX actions into compact GLB pets.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background \\
    --python tools/export_jasmine_christo_action_assets.py

The source FBX/PNG files are never modified.  Each GLB contains one shared
skinned mesh plus all requested animation clips, Draco mesh compression, and
WebP textures.  Walk clips are normalized to in-place root motion because the
world runtime owns actor translation.
"""

from __future__ import annotations

import os
import re

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
DOWNLOADS = "/Users/studio.vv/Downloads"
TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 84
THUMBNAIL_SIZE = 512


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx(path: str):
    before_objects = set(bpy.context.scene.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    new_objects = [obj for obj in bpy.context.scene.objects if obj not in before_objects]
    new_armatures = [obj for obj in new_objects if obj.type == "ARMATURE"]
    new_meshes = [obj for obj in new_objects if obj.type == "MESH"]
    if len(new_armatures) != 1 or len(new_meshes) != 1:
        raise RuntimeError(
            f"{path}: expected one imported armature and mesh, got "
            f"{len(new_armatures)} armatures and {len(new_meshes)} meshes"
        )
    new_actions = [action for action in bpy.data.actions if action not in before_actions]
    if len(new_actions) != 1:
        raise RuntimeError(f"{path}: expected one imported action, got {len(new_actions)}")
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
        # FBX import uses Blender X/Y as the horizontal plane. export_yup then
        # maps Blender Y to glTF Z, so lock X/Y here rather than Blender Z.
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


def reduce_mesh(mesh, ratio: float, label: str) -> None:
    modifier = mesh.modifiers.new(name=f"{label}_MobileDecimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
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


def export_glb(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    resize_packed_images()
    bpy.ops.export_scene.gltf(
        filepath=path,
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


def export_thumbnail(source: str, output: str) -> None:
    os.makedirs(os.path.dirname(output), exist_ok=True)
    image = bpy.data.images.load(source, check_existing=False)
    width, height = image.size[:]
    if width != THUMBNAIL_SIZE or height != THUMBNAIL_SIZE:
        image.scale(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    image.file_format = "PNG"
    image.save(filepath=output)


def pack_jasmine() -> None:
    reset_scene()
    base_armature, base_mesh, idle_source = import_fbx(os.path.join(DOWNLOADS, "茉莉Idle.fbx"))
    idle = idle_source.copy()
    idle.name = "Idle"
    idle.use_fake_user = True
    bpy.data.actions.remove(idle_source, do_unlink=True)

    actions = [idle]
    for source_name, action_name in (
        ("茉莉walk.fbx", "Walk_InPlace"),
        ("茉莉坐下.fbx", "Sit"),
        ("茉莉揮手.fbx", "Wave"),
        ("茉莉跳舞.fbx", "Dance"),
    ):
        action = copy_action_from_fbx(os.path.join(DOWNLOADS, source_name), action_name)
        if action_name == "Walk_InPlace":
            normalize_walk_root_motion(action)
        actions.append(action)

    reduce_mesh(base_mesh, 0.20, "JASMINE")
    for action in actions:
        ensure_action_on_armature(base_armature, action)
    export_glb(os.path.join(ROOT, "public/assets/pets/jasmine.glb"))
    print("JASMINE_ACTIONS", [action.name for action in actions])


def pack_christo() -> None:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "public/assets/pets/christo.glb"))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Christo: expected one armature, got {len(armatures)}")
    base_armature = armatures[0]
    existing_actions = []
    for action in list(bpy.data.actions):
        if action.name in {"Idle", "Walk_InPlace"} and not any(
            existing.name == action.name for existing in existing_actions
        ):
            action.use_fake_user = True
            existing_actions.append(action)
        else:
            bpy.data.actions.remove(action, do_unlink=True)

    actions = existing_actions
    for source_name, action_name in (
        ("克里斯多坐下.fbx", "Sit"),
        ("克里斯多揮手.fbx", "Wave"),
        ("克里斯多跳舞.fbx", "Dance"),
    ):
        action = copy_action_from_fbx(os.path.join(DOWNLOADS, source_name), action_name)
        actions.append(action)

    for action in actions:
        ensure_action_on_armature(base_armature, action)
    export_glb(os.path.join(ROOT, "public/assets/pets/christo.glb"))
    print("CHRISTO_ACTIONS", [action.name for action in actions])


def main() -> None:
    pack_jasmine()
    pack_christo()
    export_thumbnail(
        os.path.join(DOWNLOADS, "茉莉去背.png"),
        os.path.join(ROOT, "public/assets/pets/jasmine-thumbnail.png"),
    )


if __name__ == "__main__":
    main()
