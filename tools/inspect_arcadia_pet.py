"""Inspect the supplied Arcadia FBX pair without modifying the source files."""

import bpy


SOURCES = (
    "/Users/studio.vv/Downloads/阿卡迪亞.fbx",
    "/Users/studio.vv/Downloads/阿卡迪亞Idle.fbx",
)


for source in SOURCES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=source, automatic_bone_orientation=False)
    print(f"SOURCE {source}")
    print("OBJECTS", [(obj.name, obj.type) for obj in bpy.data.objects])
    print("ACTIONS", [(action.name, tuple(action.frame_range)) for action in bpy.data.actions])
    for action in bpy.data.actions:
        for layer in action.layers:
            for strip in layer.strips:
                for channelbag in strip.channelbags:
                    for fcurve in channelbag.fcurves:
                        if "Hips" in fcurve.data_path and fcurve.data_path.endswith("location"):
                            values = [round(point.co[1], 4) for point in fcurve.keyframe_points]
                            print("ROOT_CHANNEL", action.name, fcurve.array_index, values[:3], values[-3:])
    print(
        "MESHES",
        [
            (
                obj.name,
                len(obj.data.vertices),
                len(obj.data.polygons),
                [slot.material.name if slot.material else None for slot in obj.material_slots],
                [modifier.type for modifier in obj.modifiers],
            )
            for obj in bpy.data.objects
            if obj.type == "MESH"
        ],
    )
    print(
        "ARMATURES",
        [(obj.name, len(obj.data.bones), [bone.name for bone in obj.data.bones[:16]]) for obj in bpy.data.objects if obj.type == "ARMATURE"],
    )
    print("IMAGES", [(image.name, tuple(image.size[:]), image.filepath) for image in bpy.data.images])
