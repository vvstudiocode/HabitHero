"""Pack the supplied Gilt FBX files into one compact animated GLB.

The Idle FBX supplies the shared mesh, materials, and textures. Each other
FBX supplies one action, so the exported GLB contains one skinned character
with Idle, Walk_InPlace, Sit, Wave, and Dance clips.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/export_gilt_character.py
"""

from __future__ import annotations

import os

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
ACTION_DIRECTORY = "/Users/studio.vv/Downloads"
IDLE_SOURCE = "/Users/studio.vv/Desktop/habithero動作檔/吉爾特Idle.fbx"
OUTPUT = os.path.join(ROOT, "public/assets/characters/gilt.glb")
TEXTURE_MAX_SIZE = 1024
TEXTURE_QUALITY = 86
MESH_DECIMATE_RATIO = 0.12
WARM_ROUGHNESS = 0.86
WARM_METALLIC = 0.0
WARM_SPECULAR = 0.35


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
    modifier = mesh.modifiers.new(name="GILT_MobileDecimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = MESH_DECIMATE_RATIO
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
    base_armature, base_mesh, idle_source = import_fbx(IDLE_SOURCE)
    idle = idle_source.copy()
    idle.name = "Idle"
    idle.use_fake_user = True
    bpy.data.actions.remove(idle_source, do_unlink=True)

    actions = [idle]
    for source_filename, action_name in (
        ("吉爾特.fbx", "Walk_InPlace"),
        ("吉爾特坐下.fbx", "Sit"),
        ("吉爾特揮手.fbx", "Wave"),
        ("吉爾特跳舞.fbx", "Dance"),
    ):
        actions.append(copy_action_from_fbx(os.path.join(ACTION_DIRECTORY, source_filename), action_name))

    apply_warm_material_preset()
    original_polygons, exported_polygons = reduce_mesh(base_mesh)
    for action in actions:
        ensure_action_on_armature(base_armature, action)
    export_glb()
    print(
        "GILT_ACTIONS",
        [action.name for action in actions],
        "original_polygons=",
        original_polygons,
        "exported_polygons=",
        exported_polygons,
        "walk_root_motion=source-preserved",
    )
    print("GILT_OUTPUT_BYTES", os.path.getsize(OUTPUT))


if __name__ == "__main__":
    main()
