"""Print the structure of the two supplied pet source files.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/inspect_new_pet_assets.py
"""

from __future__ import annotations

import bpy


SOURCES = (
    "/Users/studio.vv/Downloads/星辰潛者.blend",
    "/Users/studio.vv/Downloads/泰迪酥.fbx",
)


def inspect_source(source: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.lower().endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=source, automatic_bone_orientation=False)
    else:
        bpy.ops.wm.open_mainfile(filepath=source)

    print(f"SOURCE {source}")
    print(f"OBJECTS {[obj.name + ':' + obj.type for obj in bpy.data.objects]}")
    print(f"ACTIONS {[action.name + ':' + str(action.frame_range[:]) for action in bpy.data.actions]}")
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            mesh = obj.data
            print(
                f"MESH {obj.name} vertices={len(mesh.vertices)} "
                f"polygons={len(mesh.polygons)} loops={len(mesh.loops)} "
                f"materials={[slot.material.name if slot.material else None for slot in obj.material_slots]} "
                f"modifiers={[modifier.name + ':' + modifier.type for modifier in obj.modifiers]}"
            )
        elif obj.type == "ARMATURE":
            print(f"ARMATURE {obj.name} bones={len(obj.data.bones)}")
    for image in bpy.data.images:
        width, height = image.size[:]
        print(f"IMAGE {image.name} {width}x{height} packed={image.packed_file is not None} source={image.filepath}")
    print(f"SCENE_FRAME_RANGE {bpy.context.scene.frame_start}:{bpy.context.scene.frame_end}")


for source_path in SOURCES:
    inspect_source(source_path)
