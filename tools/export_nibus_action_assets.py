"""Pack the supplied Nibus FBX files into one compact animated GLB.

The Sad Idle FBX supplies the shared mesh, materials, and texture. Each other
FBX supplies one action. Walk is normalized to a fully in-place clip before
and after glTF export so the runtime steering owns all actor movement.
"""

from __future__ import annotations

import json
import os
import re
import struct

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
ACTION_DIRECTORY = "/Users/studio.vv/Desktop/habithero動作檔"
WALK_SOURCE_CANDIDATES = (
    "/Users/studio.vv/Downloads/尼布斯.fbx",
    os.path.join(ACTION_DIRECTORY, "尼布斯.fbx"),
)
OUTPUT = os.path.join(ROOT, "public/assets/pets/nibus.glb")
TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 82
MESH_DECIMATE_RATIO = 0.45


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def resolve_walk_source() -> str:
    for path in WALK_SOURCE_CANDIDATES:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("Nibus Walk FBX was not found in Downloads or habithero動作檔")


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


def resize_packed_images() -> None:
    for image in bpy.data.images:
        width, height = image.size[:]
        if width <= TEXTURE_MAX_SIZE and height <= TEXTURE_MAX_SIZE:
            continue
        scale = min(TEXTURE_MAX_SIZE / width, TEXTURE_MAX_SIZE / height)
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))


def reduce_mesh(mesh) -> None:
    original_polygons = len(mesh.data.polygons)
    modifier = mesh.modifiers.new(name="NIBUS_MobileDecimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = MESH_DECIMATE_RATIO
    modifier.use_collapse_triangulate = True
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    while mesh.modifiers.find(modifier.name) > 0:
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    print("NIBUS_MESH_POLYGONS", original_polygons, len(mesh.data.polygons))


def ensure_action_on_armature(armature, action) -> None:
    armature.animation_data_create()
    armature.animation_data.action = action
    if action.slots:
        armature.animation_data.action_slot = action.slots[0]
    action.use_fake_user = True


def action_channel_fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                yield from channelbag.fcurves


def normalize_walk_root_motion(action) -> None:
    root_pattern = re.compile(r'pose\.bones\["(?:mixamorig:)?(?:Hips|Pelvis)"\]\.location$')
    for fcurve in action_channel_fcurves(action):
        if fcurve.array_index not in (0, 1, 2) or not root_pattern.search(fcurve.data_path):
            continue
        if not fcurve.keyframe_points:
            continue
        initial_value = fcurve.keyframe_points[0].co.y
        for keyframe in fcurve.keyframe_points:
            keyframe.co.y = initial_value
        fcurve.update()


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


def read_glb_json_and_binary(path: str):
    with open(path, "rb") as handle:
        data = bytearray(handle.read())
    if data[:4] != b"glTF":
        raise RuntimeError(f"{path}: exported file is not a GLB")

    json_length = int.from_bytes(data[12:16], "little")
    json_start = 20
    json_end = json_start + json_length
    gltf = json.loads(data[json_start:json_end].decode("utf-8").rstrip(" "))
    binary_offset = json_end + 8
    return gltf, data, binary_offset


def normalize_exported_walk_root_motion() -> None:
    """Freeze the final Walk root translation accessor on all three axes.

    Blender 5 can remap FBX action coordinates while exporting to glTF. The
    source Walk has no root displacement, but the exported GLB can still carry
    a translated Hips track. Patching the existing float accessor keeps the
    GLB JSON/BIN layout intact and makes the delivered clip unambiguously
    in-place for Three.js.
    """
    gltf, data, binary_offset = read_glb_json_and_binary(OUTPUT)
    nodes = gltf.get("nodes", [])
    root_pattern = re.compile(r"root|armature|hips|pelvis", re.IGNORECASE)
    changed = False
    for animation in gltf.get("animations", []):
        if animation.get("name") != "Walk_InPlace":
            continue
        samplers = animation.get("samplers", [])
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            if target.get("path") != "translation":
                continue
            node_index = target.get("node", -1)
            node_name = nodes[node_index].get("name", "") if 0 <= node_index < len(nodes) else ""
            if not root_pattern.search(node_name):
                continue
            sampler = samplers[channel["sampler"]]
            accessor = gltf["accessors"][sampler["output"]]
            if accessor.get("componentType") != 5126 or accessor.get("type") != "VEC3":
                raise RuntimeError(f"{node_name} Walk_InPlace root translation must be a float VEC3 accessor")
            buffer_view = gltf["bufferViews"][accessor["bufferView"]]
            stride = buffer_view.get("byteStride", 12)
            start = (
                binary_offset
                + buffer_view.get("byteOffset", 0)
                + accessor.get("byteOffset", 0)
            )
            initial = struct.unpack_from("<3f", data, start)
            for index in range(accessor["count"]):
                struct.pack_into("<3f", data, start + index * stride, *initial)
            changed = True

    if not changed:
        raise RuntimeError("exported Walk_InPlace has no root translation track to normalize")
    with open(OUTPUT, "wb") as handle:
        handle.write(data)


def validate_exported_walk_in_place() -> None:
    gltf, data, binary_offset = read_glb_json_and_binary(OUTPUT)
    nodes = gltf.get("nodes", [])
    animations = [
        animation
        for animation in gltf.get("animations", [])
        if animation.get("name") == "Walk_InPlace"
    ]
    if not animations:
        raise RuntimeError("exported GLB is missing the Walk_InPlace animation")

    root_track_found = False
    root_pattern = re.compile(r"root|armature|hips|pelvis", re.IGNORECASE)
    for animation in animations:
        samplers = animation.get("samplers", [])
        for channel in animation.get("channels", []):
            target = channel.get("target", {})
            if target.get("path") != "translation":
                continue
            node_index = target.get("node", -1)
            node_name = nodes[node_index].get("name", "") if 0 <= node_index < len(nodes) else ""
            if not root_pattern.search(node_name):
                continue

            root_track_found = True
            sampler = samplers[channel["sampler"]]
            accessor = gltf["accessors"][sampler["output"]]
            buffer_view = gltf["bufferViews"][accessor["bufferView"]]
            stride = buffer_view.get("byteStride", 12)
            start = (
                binary_offset
                + buffer_view.get("byteOffset", 0)
                + accessor.get("byteOffset", 0)
            )
            vectors = [
                struct.unpack_from("<3f", data, start + index * stride)
                for index in range(accessor["count"])
            ]
            ranges = [
                max(vector[axis] for vector in vectors) - min(vector[axis] for vector in vectors)
                for axis in range(3)
            ]
            if any(axis_range > 0.0005 for axis_range in ranges):
                raise RuntimeError(
                    f"{node_name} Walk_InPlace contains root motion "
                    f"(x range {ranges[0]:.6f}, y range {ranges[1]:.6f}, z range {ranges[2]:.6f})"
                )

    if not root_track_found:
        raise RuntimeError("exported Walk_InPlace has no root translation track to validate")
    print("NIBUS_WALK_IN_PLACE_VALIDATED")


def main() -> None:
    reset_scene()
    base_armature, base_mesh, idle_source = import_fbx(
        os.path.join(ACTION_DIRECTORY, "尼布斯Sad Idle.fbx")
    )
    idle = idle_source.copy()
    idle.name = "Idle"
    idle.use_fake_user = True
    bpy.data.actions.remove(idle_source, do_unlink=True)

    actions = [idle]
    for source_path, action_name in (
        (resolve_walk_source(), "Walk_InPlace"),
        (os.path.join(ACTION_DIRECTORY, "尼布斯坐下.fbx"), "Sit"),
        (os.path.join(ACTION_DIRECTORY, "尼布斯揮手.fbx"), "Wave"),
        (os.path.join(ACTION_DIRECTORY, "尼布斯跳舞.fbx"), "Dance"),
    ):
        action = copy_action_from_fbx(source_path, action_name)
        if action_name == "Walk_InPlace":
            normalize_walk_root_motion(action)
        actions.append(action)

    reduce_mesh(base_mesh)
    for action in actions:
        ensure_action_on_armature(base_armature, action)
    export_glb()
    normalize_exported_walk_root_motion()
    validate_exported_walk_in_place()
    print("NIBUS_ACTIONS", [action.name for action in actions])
    print("NIBUS_OUTPUT_BYTES", os.path.getsize(OUTPUT))


if __name__ == "__main__":
    main()
